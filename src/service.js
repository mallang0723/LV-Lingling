// 령령의 제작실 (Lumiverse) — backend host adapter (runs in the Spindle worker).
// What the original did through Marinara's REST API and the RP room's DOM is done here through the Spindle API:
//   library reads/writes      characters / personas / world_books (+ entries)   -> mapping.js turns them into the
//                                                                                  Marinara-shaped data the studio uses
//   "send to 령령"            chat.appendMessage(…, { triggerGeneration })       -> the request goes into the open chat
//   "마지막 답변 가져오기"      chat.getMessages                                   -> the last message of the open chat
//   standing context (상시 주입) registerInterceptor                              -> text the frontend registered per chat
//   drafts / layout            userStorage (studio.json), settings (settings.json)
// Every call carries the requesting user's id (operator-scoped installs need it).
import { wrapRequest, injectContext, MESSAGE_SOURCE } from './wrap.js';
import {
    NS, lvCharacterToData, cardToLvCharacter, characterPatchToLv, lvPersonaToStudio, studioToLvPersona, personaPatchToLv,
    lvEntryToStudio, studioEntryToLv, hasEntryDescription,
} from './mapping.js';

const PAGE = 200;               // list / entries.list maximum page size
const STUDIO_PATH = 'studio.json';
const SETTINGS_PATH = 'settings.json';
const DEFAULT_SETTINGS = { connectionId: '', fold: true };
const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const validUser = x => typeof x === 'string' && x.length > 0 && x.length <= 200;
const clone = v => JSON.parse(JSON.stringify(v ?? null));
const PERMS = ['generation', 'chats', 'chat_mutation', 'characters', 'personas', 'world_books', 'interceptor', 'ui_panels'];

export function createService(api) {
    const queues = new Map();       // user -> promise chain (serialises read-modify-write of the user's files)
    const generating = new Map();   // chatId -> generationId
    const injections = new Map();   // user -> { chatId, conversation, export }
    const users = new Set();        // users that talked to us (generation events are pushed to them)
    const has = p => (typeof api.permissions?.has === 'function' ? api.permissions.has(p) : true);
    const gate = (...ps) => { for (const p of ps) if (!has(p)) throw new Error('권한이 필요해요: ' + p); };

    function queued(user, fn) {
        const prior = queues.get(user) || Promise.resolve();
        const task = prior.catch(() => {}).then(fn);
        const tail = task.catch(() => {});
        queues.set(user, tail);
        tail.then(() => { if (queues.get(user) === tail) queues.delete(user); });
        return task;
    }

    // ---------- storage ----------
    async function readJson(path, user, fallback) {
        try {
            if (!await api.userStorage.exists(path, user)) return fallback;
            return (await api.userStorage.getJson(path, { userId: user })) ?? fallback;
        } catch { return fallback; }
    }
    const writeJson = (path, v, user) => api.userStorage.setJson(path, v, { userId: user });
    const readSettings = async user => {
        const s = await readJson(SETTINGS_PATH, user, {});
        return { connectionId: typeof s.connectionId === 'string' ? s.connectionId : '', fold: s.fold !== false };
    };

    // ---------- paging ----------
    async function pages(list) {
        const out = [];
        for (let offset = 0; offset < 50000; offset += PAGE) {
            const page = await list(offset);
            const data = Array.isArray(page?.data) ? page.data : [];
            out.push(...data);
            if (data.length < PAGE || out.length >= Number(page?.total ?? 0)) break;
        }
        return out;
    }

    // ---------- chat ----------
    async function activeChat(user) {
        if (!has('chats')) return null;
        let chat = null;
        try { chat = await api.chats.getActive(user); } catch { chat = null; }
        if (!chat) return null;
        let characterName = '';
        if (chat.character_id && has('characters')) {
            try { characterName = (await api.characters.get(chat.character_id, user))?.name || ''; } catch { characterName = ''; }
        }
        return { chatId: chat.id, name: chat.name || '', characterId: chat.character_id || '', characterName, group: chat.metadata?.group === true };
    }
    async function ownedChat(user, chatId) {
        gate('chats');
        if (!validId(chatId)) throw new Error('잘못된 채팅');
        const chat = await api.chats.get(chatId, user);
        if (!chat) throw new Error('채팅을 찾을 수 없어요');
        return chat;
    }
    async function latest(user, chatId) {
        gate('chat_mutation');
        await ownedChat(user, chatId);
        const msgs = await api.chat.getMessages(chatId);
        const last = Array.isArray(msgs) && msgs.length ? msgs[msgs.length - 1] : null;
        return {
            chatId, generating: isGenerating(chatId),
            message: last ? { id: String(last.id), role: String(last.role || ''), content: typeof last.content === 'string' ? last.content : '', createdAt: last.created_at ?? last.send_date ?? '' } : null,
        };
    }
    async function send(user, req) {
        gate('chats', 'chat_mutation', 'generation');
        const chatId = req.chatId;
        await ownedChat(user, chatId);
        const text = String(req.text || '').trim();
        if (!text) throw new Error('RP방에 넣을 내용이 없습니다.');
        if (isGenerating(chatId)) throw new Error('령령의 답변 생성이 끝난 뒤 요청해 주세요.');
        const s = await readSettings(user);
        const options = { triggerGeneration: true, ...(s.connectionId ? { generation: { connection_id: s.connectionId } } : {}) };
        ensureTracking();
        const sent = await api.chat.appendMessage(chatId, { role: 'user', content: wrapRequest(text), metadata: { source: MESSAGE_SOURCE, kind: String(req.kind || '') } }, options);
        if (sent?.generationId) generating.set(chatId, { id: sent.generationId, at: Date.now() });
        return { id: sent?.id || null, generationId: sent?.generationId || null };
    }

    // ---------- generation tracking ----------
    const emit = (user, msg) => { try { api.sendToFrontend?.(msg, user); } catch { /* frontend gone */ } };
    function broadcast(msg) { for (const u of users) emit(u, msg); }
    function track(event) {
        return payload => {
            const chatId = payload?.chatId;
            if (!chatId) return;
            if (event === 'started') generating.set(chatId, { id: payload.generationId || '1', at: Date.now() });
            else generating.delete(chatId);
            broadcast({ event: 'generation', chatId, state: event === 'ended' && payload.error ? 'error' : event, error: payload?.error || '' });
        };
    }
    // A generation this old is not in flight any more (the host caps a reply far below this): never lock the chat forever
    const STALE_MS = 10 * 60 * 1000;
    function isGenerating(chatId) {
        const g = generating.get(chatId);
        if (!g) return false;
        if (Date.now() - g.at > STALE_MS) { generating.delete(chatId); return false; }
        return true;
    }
    const offs = [];
    /** The host refuses these subscriptions silently while `generation` is not granted, so they are redone when it is. */
    function subscribe() {
        for (const off of offs.splice(0)) { try { off(); } catch { /* ignore */ } }
        if (typeof api.on !== 'function' || !has('generation')) return;
        for (const [name, event] of [['GENERATION_STARTED', 'started'], ['GENERATION_ENDED', 'ended'], ['GENERATION_STOPPED', 'stopped']]) {
            try { const off = api.on(name, track(event)); if (typeof off === 'function') offs.push(off); } catch { /* not allowed yet */ }
        }
    }
    function ensureTracking() { if (!offs.length) subscribe(); }
    function attach() {
        subscribe();
        registerInterceptor();
    }
    let interceptorOff = null;
    function registerInterceptor() {
        if (interceptorOff || !has('interceptor') || typeof api.registerInterceptor !== 'function') return;
        interceptorOff = api.registerInterceptor(async (messages, ctx) => {
            try {
                const chatId = ctx?.chatId;
                const rec = chatId ? [...injections.values()].find(r => r.chatId === chatId) : null;
                return injectContext(messages, ctx, rec);
            } catch { return messages; }
        }, 100);
    }
    function onPermissionChanged(detail) {
        registerInterceptor();
        if (!detail || detail.permission === 'generation') subscribe();
    }
    function setInjection(user, req) {
        if (!req.chatId) { injections.delete(user); return { active: false }; }
        if (!validId(req.chatId)) throw new Error('잘못된 채팅');
        const rec = { chatId: req.chatId, conversation: typeof req.conversation === 'string' ? req.conversation : '', export: typeof req.export === 'string' ? req.export : '' };
        if (!rec.conversation && !rec.export) injections.delete(user); else injections.set(user, rec);
        return { active: injections.has(user) };
    }

    // ---------- library: characters ----------
    async function characters(user) {
        gate('characters');
        const all = await pages(offset => api.characters.list({ limit: PAGE, offset, userId: user }));
        return all.filter(c => c && c.id).map(c => ({ id: c.id, name: String(c.name || '').trim() || '이름 없는 캐릭터' }));
    }
    async function character(user, id) {
        gate('characters');
        const ch = await api.characters.get(id, user);
        if (!ch) throw new Error('선택한 캐릭터를 읽을 수 없습니다.');
        const data = lvCharacterToData(ch);
        return { id: ch.id, name: data.name || '이름 없는 캐릭터', data, updatedAt: ch.updated_at ?? null };
    }
    async function createCharacter(user, req) {
        gate('characters');
        const s = await readSettings(user);
        const input = cardToLvCharacter(req.data || {}, { fold: s.fold });
        if (!input.name) throw new Error('캐릭터 이름을 입력해 주세요.');
        const made = await api.characters.create(input, user);
        if (!made?.id) throw new Error('캐릭터 등록 응답 형식을 확인할 수 없습니다.');
        return { id: made.id, name: made.name };
    }
    async function updateCharacter(user, req) {
        gate('characters');
        const s = await readSettings(user);
        const current = await api.characters.get(req.id, user);
        if (!current) throw new Error('선택한 캐릭터를 읽을 수 없습니다.');
        const saved = await api.characters.update(req.id, characterPatchToLv(current, req.data || {}, { fold: s.fold }), user);
        const data = lvCharacterToData(saved);
        return { id: saved.id, name: data.name, data };
    }

    // ---------- library: personas ----------
    async function personas(user) {
        gate('personas');
        const all = await pages(offset => api.personas.list({ limit: PAGE, offset, userId: user }));
        return all.filter(p => p && p.id).map(p => ({ id: p.id, name: String(p.name || '').trim() || '이름 없는 페르소나' }));
    }
    async function persona(user, id) {
        gate('personas');
        const p = await api.personas.get(id, user);
        if (!p) throw new Error('선택한 페르소나를 읽을 수 없습니다.');
        return lvPersonaToStudio(p);
    }
    async function createPersona(user, req) {
        gate('personas');
        const s = await readSettings(user);
        const lv = studioToLvPersona(req.persona || {}, { fold: s.fold });
        if (!lv.name) throw new Error('페르소나 이름을 입력해 주세요.');
        const made = await api.personas.create({ name: lv.name, description: lv.description, metadata: { [NS]: lv.snapshot } }, user);
        if (!made?.id) throw new Error('등록 결과를 확인할 수 없습니다. 목록을 새로고침해 확인해 주세요.');
        return lvPersonaToStudio(made);
    }
    async function updatePersona(user, req) {
        gate('personas');
        const s = await readSettings(user);
        const current = await api.personas.get(req.id, user);
        if (!current) throw new Error('선택한 페르소나를 읽을 수 없습니다.');
        const lv = personaPatchToLv(current, req.patch || {}, { fold: s.fold });
        // metadata is replaced as a whole by update(): keep everything that is not ours
        const saved = await api.personas.update(req.id, { name: lv.name, description: lv.description, metadata: { ...(current.metadata || {}), [NS]: lv.snapshot } }, user);
        return lvPersonaToStudio(saved);
    }

    // ---------- library: world books ----------
    async function books(user) {
        gate('world_books');
        const all = await pages(offset => api.world_books.list({ limit: PAGE, offset, userId: user }));
        return all.filter(b => b && b.id).map(b => ({ id: b.id, name: String(b.name || '').trim() || '이름 없는 로어북', description: typeof b.description === 'string' ? b.description : '' }));
    }
    async function bookEntries(user, bookId) {
        gate('world_books');
        const all = await pages(offset => api.world_books.entries.list(bookId, { limit: PAGE, offset, userId: user }));
        return all.filter(e => e && e.id != null)
            .map((e, i) => ({ e, i }))
            .sort((a, b) => (Number(a.e.order_value) || 0) - (Number(b.e.order_value) || 0) || a.i - b.i)
            .map(x => lvEntryToStudio(x.e));
    }
    async function bookRead(user, id) {
        gate('world_books');
        const book = await api.world_books.get(id, user);
        if (!book) throw new Error('로어북 원본 응답 형식이 올바르지 않습니다.');
        return { book: { id: book.id, name: book.name, description: book.description || '', category: 'world', updatedAt: book.updated_at ?? null }, entries: await bookEntries(user, id), folders: [] };
    }
    async function setDescription(user, entryId, description) {
        if (typeof api.world_books.entries.setExtension !== 'function') return;
        await api.world_books.entries.setExtension(entryId, NS, { description: String(description || '') }, user);
    }
    async function createBook(user, req) {
        gate('world_books');
        const made = await api.world_books.create({ name: String(req.name || '').trim(), description: String(req.description || ''), metadata: { source: MESSAGE_SOURCE } }, user);
        if (!made?.id) throw new Error('서버가 저장된 ID를 반환하지 않았습니다.');
        return { id: made.id };
    }
    async function updateBook(user, req) {
        gate('world_books');
        const patch = {};
        if (Object.hasOwn(req.patch || {}, 'name')) patch.name = String(req.patch.name);
        if (Object.hasOwn(req.patch || {}, 'description')) patch.description = String(req.patch.description);
        const saved = await api.world_books.update(req.id, patch, user);
        return { id: saved.id };
    }
    async function createEntry(user, req) {
        gate('world_books');
        const input = studioEntryToLv(req.entry || {});
        if (input.order_value === undefined) {
            const page = await api.world_books.entries.list(req.bookId, { limit: 1, offset: 0, userId: user });
            input.order_value = (Number(page?.total) + 1) * 10 || 10;
        }
        const made = await api.world_books.entries.create(req.bookId, input, user);
        if (!made?.id) throw new Error('서버가 저장된 ID를 반환하지 않았습니다.');
        if (hasEntryDescription(req.entry) && String(req.entry.description || '')) await setDescription(user, made.id, req.entry.description);
        return { id: made.id };
    }
    async function updateEntry(user, req) {
        gate('world_books');
        const changes = req.changes || {};
        const input = studioEntryToLv(changes);
        let saved = null;
        if (Object.keys(input).length) saved = await api.world_books.entries.update(req.id, input, user);
        if (hasEntryDescription(changes)) await setDescription(user, req.id, changes.description);
        return { id: saved?.id || req.id };
    }
    async function deleteEntry(user, req) {
        gate('world_books');
        await api.world_books.entries.delete(req.id, user);
        return {};
    }

    // ---------- connections ----------
    async function connections(user) {
        if (!has('generation')) return [];
        try {
            const list = await api.connections.list(user);
            return (Array.isArray(list) ? list : []).map(c => ({ id: String(c.id), name: String(c.name || c.id), model: String(c.model || ''), provider: String(c.provider || '') }));
        } catch { return []; }
    }

    // ---------- requests from the frontend ----------
    async function run(req, user) {
        if (!validUser(user)) throw new Error('사용자 정보가 없어요');
        users.add(user);
        const id = req?.id;
        if (id !== undefined && !validId(id)) throw new Error('잘못된 ID');
        switch (req?.type) {
            case 'bootstrap': return {
                perms: Object.fromEntries(PERMS.map(p => [p, has(p)])), chat: await activeChat(user), connections: await connections(user),
                settings: await readSettings(user), generating: [...generating.keys()].filter(isGenerating), health: { status: 'ok' },
            };
            case 'chat': return { chat: await activeChat(user) };
            case 'characters': return { list: await characters(user) };
            case 'character': return character(user, id);
            case 'personas': return { list: await personas(user) };
            case 'persona': return persona(user, id);
            case 'lorebooks': return { list: await books(user) };
            case 'lorebookEntries': { gate('world_books'); return { list: await bookEntries(user, id) }; }
            case 'lorebookRead': return bookRead(user, id);
            case 'createCharacter': return createCharacter(user, req);
            case 'updateCharacter': return updateCharacter(user, req);
            case 'createPersona': return createPersona(user, req);
            case 'updatePersona': return updatePersona(user, req);
            case 'createBook': return createBook(user, req);
            case 'updateBook': return updateBook(user, req);
            case 'createEntry': return createEntry(user, req);
            case 'updateEntry': return updateEntry(user, req);
            case 'deleteEntry': return deleteEntry(user, req);
            case 'send': return send(user, req);
            case 'latest': return latest(user, req.chatId);
            case 'inject': return setInjection(user, req);
            case 'storageGet': return { value: await readJson(STUDIO_PATH, user, {}) };
            case 'storagePatch': return queued(user, async () => {
                const cur = await readJson(STUDIO_PATH, user, {});
                if (!cur || typeof cur !== 'object') throw new Error('저장소 형식이 올바르지 않아요');
                for (const [k, v] of Object.entries(req.patch || {})) { if (v === null) delete cur[k]; else cur[k] = clone(v); }
                await writeJson(STUDIO_PATH, cur, user);
                return {};
            });
            case 'setting': return queued(user, async () => {
                const cur = await readSettings(user);
                if (req.key === 'connectionId') cur.connectionId = String(req.value || '');
                else if (req.key === 'fold') cur.fold = req.value !== false;
                else throw new Error('알 수 없는 설정');
                await writeJson(SETTINGS_PATH, cur, user);
                return { settings: cur };
            });
            default: throw new Error('알 수 없는 작업');
        }
    }

    function stop() {
        for (const off of offs.splice(0)) { try { off(); } catch { /* ignore */ } }
        try { interceptorOff?.(); } catch { /* ignore */ }
        interceptorOff = null;
        injections.clear();
        generating.clear();
    }

    return { run, attach, stop, onPermissionChanged, intercept: (messages, ctx) => injectContext(messages, ctx, [...injections.values()].find(r => r.chatId === ctx?.chatId)), generating };
}

export { DEFAULT_SETTINGS };
