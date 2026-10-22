// Synthetic Spindle API for the tests and the browser harness. No host, no provider, no network: the "bot" (령령)
// answers appended user messages from a script. Behaviours follow the Lumiverse 1.2.5 host source where they matter:
//  - characters.update shallow-merges `extensions`; personas.update replaces `metadata` as a whole,
//  - world book entry `extensions` are written through setExtension(entryId, namespace, value),
//  - lists are paged (max 200), chat.getMessages returns every message, appendMessage names user messages "User",
//  - everything takes the user id (operator-scoped install): a call without it fails like the host does.
export const REPLY_CHARACTER = `<<<MARINARA_CHARACTER_EXPORT_V1>>>
[NAME]
하루
[/NAME]
[DESCRIPTION]
빵집 사장. {{user}}의 이웃.
[/DESCRIPTION]
[PERSONALITY]
무뚝뚝하지만 챙겨 준다.
[/PERSONALITY]
[BACKSTORY]
30년 된 빵집을 물려받았다.
[/BACKSTORY]
[APPEARANCE]
앞치마, 짧은 머리.
[/APPEARANCE]
[SCENARIO]
가을 축제 직전.
[/SCENARIO]
[SAMPLE_CONVERSATIONS]
<START>
{{user}}: 빵 주세요 *손을 흔든다*
{{char}}: …응. *봉투를 건넨다*
[/SAMPLE_CONVERSATIONS]
[CONVO_DISPLAY_NAME]
하루
[/CONVO_DISPLAY_NAME]
[ABOUT_ME]
빵 굽는 중
[/ABOUT_ME]
[CONVO_BEHAVIOR]
말이 짧다.
[/CONVO_BEHAVIOR]
[OPENING]
*가게 문을 연다.* 어서 와.
[/OPENING]
<<<END_MARINARA_CHARACTER_EXPORT_V1>>>`;

export function fake(opts = {}) {
    const store = new Map();
    const sent = [], appended = [], toasts = [], interceptors = [];
    let frontendHandler = null;
    let seq = 0;
    const nextId = p => `${p}-${++seq}`;
    const clone = v => JSON.parse(JSON.stringify(v ?? null));
    const state = { denied: [], replyText: '령령: 오오, 좋은데?', botDelay: 5, holdReply: false, replyError: null, noGenerationId: false, userRequired: true, calls: [] };
    const handlers = new Map();   // event -> Set
    const emit = (event, payload) => { for (const h of [...(handlers.get(event) || [])]) h(clone(payload)); };
    const need = (perm, user) => {
        if (state.denied.includes(perm)) throw new Error(`PERMISSION_DENIED: ${perm}`);
        if (state.userRequired && user === undefined) throw new Error('userId is required for operator-scoped extensions');
    };
    const log = (name, ...args) => state.calls.push({ name, args: clone(args) });

    const chats = new Map([
        ['chat-a', { id: 'chat-a', character_id: 'char-ling', name: '령령방', metadata: {} }],
        ['chat-b', { id: 'chat-b', character_id: 'char-other', name: '다른 방', metadata: {} }],
    ]);
    const messages = new Map([['chat-a', [{ id: 'm0', role: 'assistant', is_user: false, name: '{{char}}', content: '오오, 왔구나!!', extra: {}, created_at: 1 }]], ['chat-b', []]]);
    let active = 'chat-a';
    const characters = new Map([
        ['char-ling', { id: 'char-ling', name: '{{char}}', description: '령령', personality: '', scenario: '', first_mes: '', mes_example: '', creator_notes: '', system_prompt: '', post_history_instructions: '', tags: [], alternate_greetings: [], creator: '', world_book_ids: ['wb-ling'], extensions: {}, created_at: 1, updated_at: 1 }],
        ['char-haru', { id: 'char-haru', name: '하루', description: '빵집 사장', personality: '무뚝뚝', scenario: '가을', first_mes: '어서 와.', mes_example: '"…응."', creator_notes: '', system_prompt: '', post_history_instructions: '', tags: [], alternate_greetings: ['(대체) 어서 와.'], creator: '', world_book_ids: [], extensions: { talkativeness: 0.5 }, created_at: 1, updated_at: 1 }],
    ]);
    const personas = new Map([
        ['p-user', { id: 'p-user', name: '{{user}}', title: '', description: '나', image_id: null, attached_world_book_id: null, folder: '', is_default: true, is_narrator: false, metadata: { other_ext: { keep: true } }, created_at: 1, updated_at: 1 }],
    ]);
    const books = new Map([['wb-ling', { id: 'wb-ling', name: '령령 명령어', description: '', metadata: {}, created_at: 1, updated_at: 1 }], ['wb-town', { id: 'wb-town', name: '동네 로어', description: '하루가 사는 동네', metadata: {}, created_at: 1, updated_at: 1 }]]);
    const entries = new Map([
        ['wb-ling', [{ id: 'e0', world_book_id: 'wb-ling', uid: '0', key: ['@TTS'], keysecondary: [], content: 'TTS 명령', comment: 'TTS', order_value: 10, selective: false, constant: false, disabled: false, extensions: {}, updated_at: 1 }]],
        ['wb-town', [
            { id: 'e1', world_book_id: 'wb-town', uid: '1', key: ['빵집'], keysecondary: ['하루'], content: '30년 된 빵집.', comment: '빵집', order_value: 20, selective: true, constant: false, disabled: false, extensions: { 'lingling_studio_lv': { description: '가게' } }, updated_at: 1 },
            { id: 'e2', world_book_id: 'wb-town', uid: '2', key: [], content: '항상 가을.', comment: '계절', order_value: 10, selective: false, constant: true, disabled: false, extensions: {}, updated_at: 1 },
            { id: 'e3', world_book_id: 'wb-town', uid: '3', key: ['폐가'], keysecondary: [], content: '꺼둔 항목', comment: '폐가', order_value: 30, selective: false, constant: false, disabled: true, extensions: {}, updated_at: 1 },
        ]],
    ]);
    const bigList = (n, mk) => Array.from({ length: n }, (_, i) => mk(i));
    if (opts.manyCharacters) for (const c of bigList(opts.manyCharacters, i => ({ ...characters.get('char-haru'), id: `char-bulk-${i}`, name: `대량 ${i}` }))) characters.set(c.id, c);
    const page = (list, o = {}) => {
        if (o.limit > 200) throw new Error('limit over 200');
        const limit = Math.min(o.limit || 50, 200), offset = o.offset || 0;
        return { data: clone(list.slice(offset, offset + limit)), total: list.length };
    };
    const now = () => Math.floor(Date.now() / 1000);

    // ---- the bot ----
    const finishers = new Map();
    function startReply(chatId, generationId) {
        emit('GENERATION_STARTED', { generationId, chatId, model: 'fake' });
        const finish = () => {
            if (state.replyError) { emit('GENERATION_ENDED', { generationId, chatId, error: state.replyError }); return; }
            const m = { id: nextId('bot'), role: 'assistant', is_user: false, name: 'Assistant', content: typeof state.replyText === 'function' ? state.replyText(messages.get(chatId)) : state.replyText, extra: {}, created_at: now() };
            messages.get(chatId).push(m);
            emit('GENERATION_ENDED', { generationId, chatId, messageId: m.id, content: m.content });
        };
        if (state.holdReply) { finishers.set(generationId, finish); return; }
        setTimeout(finish, state.botDelay);
    }

    const api = {
        permissions: { has: p => !(opts.deny || state.denied).includes(p), onChanged: fn => { api._onPerm = fn; return () => { api._onPerm = null; }; } },
        frontendCapabilities: { declare: name => { api.declared = name; return () => { api.declared = null; }; } },
        userStorage: {
            exists: async (path, user) => store.has(user + ':' + path),
            getJson: async (path, o) => clone(store.get(o.userId + ':' + path) ?? o.fallback ?? null),
            setJson: async (path, v, o) => { store.set(o.userId + ':' + path, clone(v)); },
        },
        on(event, handler) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
            return () => handlers.get(event).delete(handler);
        },
        registerInterceptor(handler, priority) { const rec = { handler, priority }; interceptors.push(rec); return () => { interceptors.splice(interceptors.indexOf(rec), 1); }; },
        chats: {
            get: async (id, user) => { need('chats', user); return chats.has(id) ? clone(chats.get(id)) : null; },
            getActive: async user => { need('chats', user); return active ? clone(chats.get(active)) : null; },
        },
        chat: {
            getMessages: async id => { need('chat_mutation', 'x'); return clone(messages.get(id) || []); },
            appendMessage: async (chatId, message, options) => {
                need('chat_mutation', 'x');
                const trigger = options === true || options?.triggerGeneration === true;
                if (trigger) need('generation', 'x');
                const m = { id: nextId('msg'), role: message.role, is_user: message.role === 'user', name: message.role === 'user' ? 'User' : 'Assistant', content: message.content, extra: { spindle_role: message.role, ...(message.metadata ? { spindle_metadata: message.metadata } : {}) }, metadata: message.metadata, created_at: now() };
                messages.get(chatId).push(m);
                appended.push({ chatId, message: clone(message), options: clone(options ?? null), id: m.id });
                if (!trigger) return { id: m.id };
                const generationId = nextId('gen');
                startReply(chatId, generationId);
                return state.noGenerationId ? { id: m.id } : { id: m.id, generationId };
            },
        },
        characters: {
            list: async o => { need('characters', o?.userId); return page([...characters.values()], o); },
            get: async (id, user) => { need('characters', user); return characters.has(id) ? clone(characters.get(id)) : null; },
            create: async (input, user) => {
                need('characters', user); log('characters.create', input);
                const c = { id: nextId('char'), description: '', personality: '', scenario: '', first_mes: '', mes_example: '', creator_notes: '', system_prompt: '', post_history_instructions: '', tags: [], alternate_greetings: [], creator: '', world_book_ids: [], extensions: {}, created_at: now(), updated_at: now(), ...clone(input) };
                characters.set(c.id, c); return clone(c);
            },
            update: async (id, input, user) => {
                need('characters', user); log('characters.update', id, input);
                const c = characters.get(id); if (!c) throw new Error('Character not found');
                const { extensions, ...rest } = clone(input);
                Object.assign(c, rest);
                if (extensions) c.extensions = { ...c.extensions, ...extensions };   // shallow merge, like the host
                c.updated_at = now(); return clone(c);
            },
        },
        personas: {
            list: async o => { need('personas', o?.userId); return page([...personas.values()], o); },
            get: async (id, user) => { need('personas', user); return personas.has(id) ? clone(personas.get(id)) : null; },
            create: async (input, user) => { need('personas', user); log('personas.create', input); const p = { id: nextId('persona'), title: '', description: '', metadata: {}, ...clone(input), created_at: now(), updated_at: now() }; personas.set(p.id, p); return clone(p); },
            update: async (id, input, user) => { need('personas', user); log('personas.update', id, input); const p = personas.get(id); if (!p) throw new Error('Persona not found'); Object.assign(p, clone(input)); p.updated_at = now(); return clone(p); },   // metadata replaced wholesale
        },
        world_books: {
            list: async o => { need('world_books', o?.userId); return page([...books.values()], o); },
            get: async (id, user) => { need('world_books', user); return books.has(id) ? clone(books.get(id)) : null; },
            create: async (input, user) => { need('world_books', user); log('world_books.create', input); const b = { id: nextId('wb'), description: '', metadata: {}, ...clone(input), created_at: now(), updated_at: now() }; books.set(b.id, b); entries.set(b.id, []); return clone(b); },
            update: async (id, input, user) => { need('world_books', user); log('world_books.update', id, input); const b = books.get(id); if (!b) throw new Error('World book not found'); Object.assign(b, clone(input)); b.updated_at = now(); return clone(b); },
            getGlobal: async () => [],
            entries: {
                list: async (bookId, o) => { need('world_books', o?.userId); return page(entries.get(bookId) || [], o); },
                create: async (bookId, input, user) => {
                    need('world_books', user); log('entries.create', bookId, input);
                    if (!books.has(bookId)) throw new Error('World book not found');
                    const e = { id: nextId('entry'), world_book_id: bookId, uid: nextId('uid'), key: [], keysecondary: [], content: '', comment: '', order_value: 100, selective: false, constant: false, disabled: false, extensions: {}, ...clone(input), updated_at: now() };
                    entries.get(bookId).push(e); books.get(bookId).updated_at = now(); return clone(e);
                },
                update: async (entryId, input, user) => {
                    need('world_books', user); log('entries.update', entryId, input);
                    for (const list of entries.values()) { const e = list.find(x => x.id === entryId); if (e) { Object.assign(e, clone(input)); e.updated_at = now(); return clone(e); } }
                    throw new Error('World book entry not found');
                },
                setExtension: async (entryId, namespace, value, user) => {
                    need('world_books', user); log('entries.setExtension', entryId, namespace, value);
                    for (const list of entries.values()) { const e = list.find(x => x.id === entryId); if (e) { e.extensions = { ...e.extensions, [namespace]: clone(value) }; return clone(e); } }
                    throw new Error('World book entry not found');
                },
                delete: async (entryId, user) => {
                    need('world_books', user); log('entries.delete', entryId);
                    for (const list of entries.values()) { const i = list.findIndex(x => x.id === entryId); if (i >= 0) { list.splice(i, 1); return true; } }
                    return false;
                },
            },
        },
        connections: { list: async () => [{ id: 'conn-a', name: '연결 A', provider: 'fake', model: 'm-a' }, { id: 'conn-b', name: '연결 B', provider: 'fake', model: 'm-b' }] },
        onFrontendMessage(fn) { frontendHandler = fn; f.frontendHandler = fn; return () => { frontendHandler = null; f.frontendHandler = null; }; },
        sendToFrontend(msg, user, o) { sent.push({ msg: clone(msg), user, o }); opts.onSend?.(clone(msg), user, o); },
        toast: { info: m => toasts.push(m) },
    };
    const f = {
        api, state, store, sent, appended, interceptors, characters, personas, books, entries, messages, chats, handlers,
        frontendHandler: null, toasts,
        setActive(id) { active = id; },
        finish() { for (const [id, fn] of [...finishers]) { finishers.delete(id); fn(); } },
        emit,
        /** Runs the registered interceptor like the host does. */
        async intercept(prompt, ctx) {
            let cur = prompt;
            for (const { handler } of [...interceptors].sort((a, b) => a.priority - b.priority)) {
                const r = await handler(cur, ctx);
                cur = Array.isArray(r) ? r : r.messages;
            }
            return cur;
        },
    };
    return f;
}
