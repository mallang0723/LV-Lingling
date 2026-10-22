// 령령의 제작실 (Lumiverse) — studio controller. Follows the original's controller (character / persona studio and the
// lorebook studio): the same state, the same flows and Korean messages. What changed is where things are read from:
//   Marinara REST      -> host.library / host.lorebookApi (backend, src/service.js)
//   RP input box DOM   -> backend `send` (chat.appendMessage + generation) and, when the host has one, ctx.composer
//   fetch interceptor  -> the standing context is built here and registered with the backend (`inject`)
//   extension storage  -> backend user storage (`storageGet` / `storagePatch`)
//   window.confirm     -> deps.ask (ctx.ui.showConfirm)
import {
    We as newStudioState, Rn as serializeStudio, er as restoreStudio, Yt as personaBuilders, tr as characterBuilders,
    le as isExternalReference, Ie as externalText, Zt as characterDataToDraft, xt as draftToCard, kt as assertCard, xn as characterPatch,
    xe as normalizePersona, wt as assertPersona, mn as personaPatch, pn as parseCharacterAnswer, hn as parsePersonaAnswer, Yr as restoreMacros,
    J as protectMacros, Ze as assertImportable, ut as safeFileName, Z as TOKEN_PROFILES, Re as LENGTHS, Ye as PERSONA_LENGTHS, St as createExternalController,
    vt as createReferenceLoader, Qt as keywordsOf, gn as downloadPersona,
    jt as newLorebookState, qt as serializeLorebook, zr as restoreLorebook, nn as lorebookReferenceContext, on as lorebookCurrentContext,
    Ht as lorebookBriefing, an as lorebookRequest, ln as applyLorebookAnswer, un as importLorebookText, cn as parseLorebookAnswer,
    Pe as setEntryField, Ae as newEntry, Jr as duplicateEntry, Bt as lorebookToDraft, ft as validateLorebook, Y as stable, $n as saveLorebook,
    ge as ENTRY_AMOUNTS, yt as LOREBOOK_BRIDGE, D as clone, ir as updateLoreTokens,
} from './original/logic.js';
import { Qe, $i as renderCharacterShell, Xn as renderLorebookShell, hr as renderToast, gr as updateTokenLabels } from './original/ui.js';
import { characterCardFile, lorebookFile } from './mapping.js';
import { wrapRequest } from './wrap.js';

const CHARACTER_KEY = 'rpCharacterStudioDraftV1';
const PERSONA_KEY = 'rpPersonaStudioDraftV1';
const LOREBOOK_KEY = 'integratedLorebookStudioV1';
const abortError = () => Object.assign(new Error('요청을 취소했습니다.'), { name: 'AbortError' });
const isAbort = e => e?.name === 'AbortError';
const message = (e, fallback = '요청을 처리하지 못했습니다.') => (isAbort(e) ? '요청을 취소했습니다.' : e instanceof Error && e.message ? e.message : fallback);
const filled = v => typeof v === 'string' && v.trim().length > 0;
const compat = health => {
    const ok = !!(health && health.status === 'ok');
    return { readable: ok, writable: ok, version: health?.version || '알 수 없음', message: ok ? '' : '루미버스 서버 상태를 확인할 수 없습니다. 직접 편집과 JSON 저장은 계속 사용할 수 있습니다.' };
};

/** Saves a JSON file through a temporary link (no clipboard / secure-context API involved). */
function downloadJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_'); a.hidden = true;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text. navigator.clipboard only exists on secure origins (the phone reaches Lumiverse over plain http). */
export async function copyText(text, host = document.body) {
    const value = String(text ?? '');
    let ok = false;
    try { if (globalThis.navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(value); ok = true; } } catch { ok = false; }
    if (!ok) {
        const ta = document.createElement('textarea');
        ta.value = value; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;left:0;top:0;font-size:16px';
        host.append(ta); ta.select(); ta.setSelectionRange(0, value.length);
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
    }
    if (!ok) throw new Error('클립보드 복사를 사용할 수 없습니다.');
}

export function createStudio(deps) {
    const { host, getChatId, ask } = deps;
    const lib = host.library;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    let destroyed = false;
    let root = null;
    const canComposer = () => !!deps.composer && typeof deps.composer.setText === 'function';

    // ---------- shared state ----------
    const studios = { character: newStudioState(), persona: newStudioState('persona') };
    for (const s of Object.values(studios)) s.open = true;
    let selected = 'character';        // 'character' | 'persona' | 'lorebook'
    let r = studios.character;         // the character / persona studio in use
    const chat = { id: '', name: '', characterName: '', generating: false, replyDone: false };
    const extras = Object.fromEntries(Object.entries(studios).map(([kind, st]) => [kind, {
        loader: createReferenceLoader({ api: lib, getLorebooks: () => st.lorebooks, getEntries: () => st.lorebookEntries, getEntriesForId: () => st.lorebookEntriesForId }),
        external: createExternalController({ state: st, render: () => render(), fetchImpl: deps.fetchImpl, changed() { st.worldContext = ''; st.bridge.briefing = ''; extras[kind].loader.invalidate(); } }),
        lastContextDraft: null,
    }]));
    let loader = extras.character.loader, external = extras.character.external, lastContext = null;
    let hostLoaded = false, entriesAbort = null, noticeTimer = 0, tokenTimer = 0, savedView = null;
    const savedJson = new Map();
    const views = new Map();
    const builders = () => (r.kind === 'persona' ? personaBuilders : characterBuilders);
    const noun = () => (r.kind === 'persona' ? '페르소나' : '캐릭터');
    const currentChat = () => getChatId() || '';

    // ---------- lorebook studio ----------
    const lore = createLorebookStudio({
        host, lib, getChatId: currentChat, ask, canComposer, copy: text => copyText(text), isGenerating: () => chat.generating,
        send: (text, kind) => sendRequest(text, kind), composerInsert: text => composerInsert(text),
        render: () => render(), later, fetchImpl: deps.fetchImpl, storage: { get: () => host.rpc('storageGet').then(x => x.value), patch: p => host.rpc('storagePatch', { patch: p }) },
        switchStudio: k => switchStudio(k), onLibraryChanged: k => libraryChanged(k), close: () => deps.closeWindow?.(),
        injectionChanged: () => scheduleInjection(),
    });
    let loreState = lore.state;

    function libraryChanged(kind) {
        lib.invalidateLibrary(kind);
        hostLoaded = false;
        for (const x of Object.values(extras)) x.loader.invalidate();
        if (kind === 'lorebooks') for (const s of Object.values(studios)) s.lorebookEntriesForId = '';
        lore.invalidateReferences(kind);
    }

    // ---------- notices, rendering ----------
    function captureView() {
        const main = root?.querySelector('.mcs-main');
        const details = new Map(), scrolls = new Map();
        for (const d of root?.querySelectorAll('details[data-mcs-details]') || []) details.set(d.getAttribute('data-mcs-details'), d.open);
        for (const s of root?.querySelectorAll('[data-mcs-scroll]') || []) scrolls.set(s.getAttribute('data-mcs-scroll'), { top: s.scrollTop, left: s.scrollLeft });
        const active = document.activeElement;
        const focus = root && root.contains(active) && active?.dataset?.mcsExternalField ? { key: active.dataset.mcsExternalField, start: active.selectionStart, end: active.selectionEnd } : null;
        return { scrollTop: main instanceof HTMLElement ? main.scrollTop : null, details, scrolls, focus };
    }
    function restoreView(v) {
        if (!v || !root) return;
        for (const d of root.querySelectorAll('details[data-mcs-details]')) { const k = d.getAttribute('data-mcs-details'); if (v.details.has(k)) d.open = v.details.get(k); }
        for (const s of root.querySelectorAll('[data-mcs-scroll]')) { const x = v.scrolls.get(s.getAttribute('data-mcs-scroll')); if (x) { s.scrollTop = x.top; s.scrollLeft = x.left; } }
        const main = root.querySelector('.mcs-main');
        if (main instanceof HTMLElement && v.scrollTop !== null) main.scrollTop = v.scrollTop;
    }
    function render() {
        if (destroyed || !root) return;
        const view = savedView || captureView();
        savedView = null;
        if (selected === 'lorebook') lore.render(root);
        else Qe(root, renderCharacterShell(r, handlers));
        restoreView(view);
        if (view?.focus) {
            const f = [...root.querySelectorAll('[data-mcs-external-field]')].find(x => x.dataset.mcsExternalField === view.focus.key);
            if (f && !f.disabled) { f.focus({ preventScroll: true }); try { f.setSelectionRange(view.focus.start, view.focus.end); } catch { /* not a text field */ } }
        }
        scheduleInjection();
    }
    function notify(text, kind = 'info', ms = 5000) {
        if (selected === 'lorebook') {   // the lorebook screens show their messages inside the page
            if (kind === 'error') { loreState.error = text; loreState.notice = ''; } else { loreState.notice = text; loreState.error = ''; }
            render();
            return;
        }
        const st = r;
        st.notice = { message: text, kind };
        if (noticeTimer) clearTimeout(noticeTimer);
        if (ms) noticeTimer = later(() => { st.notice = null; noticeTimer = 0; if (r === st && selected !== 'lorebook' && root) renderToast(root, st, handlers); }, ms);
        render();
    }
    function startRequest(kind, controller) { r.request = { kind, controller }; render(); }
    function endRequest(controller) { if (r.request?.controller === controller) r.request = null; }
    const scheduleTokenLabels = () => {
        if (tokenTimer) clearTimeout(tokenTimer);
        tokenTimer = later(() => { tokenTimer = 0; if (!destroyed && root && selected !== 'lorebook' && r.step === 2) updateTokenLabels(root, r); }, 500);
    };

    // ---------- storage ----------
    async function persist(st = r) {
        const data = serializeStudio(st);
        delete data.savedAt;
        const json = JSON.stringify(data);
        if (savedJson.get(st.kind) === json) return;
        await host.rpc('storagePatch', { patch: { [st.kind === 'persona' ? PERSONA_KEY : CHARACTER_KEY]: { ...data, savedAt: new Date().toISOString() } } });
        savedJson.set(st.kind, json);
    }
    async function restore() {
        try {
            const saved = (await host.rpc('storageGet')).value || {};
            if (destroyed) return;
            restoreStudio(studios.persona, saved[PERSONA_KEY]);
            if (restoreStudio(studios.character, saved[CHARACTER_KEY])) notify('임시 저장한 작업을 불러왔습니다.', 'success', 3500);
            restoreLorebook(loreState, saved[LOREBOOK_KEY]);
        } catch (e) { /* storage unreadable: start empty */ }
    }

    // ---------- library lists ----------
    async function loadLibrary(force = false) {
        if (force === true) { lib.invalidateLibrary(); for (const x of Object.values(extras)) x.loader.invalidate(); lore.invalidateReferences(); }
        if (r.loadingHost || destroyed) return;
        r.loadingHost = true; r.hostError = ''; render();
        try {
            const health = await lib.health();
            if (destroyed) return;
            r.compatibility = compat(health);
            const res = await Promise.allSettled([lib.characters(), lib.personas(), lib.lorebooks()]);
            if (destroyed) return;
            if (res[0].status === 'fulfilled') r.characters = res[0].value;
            if (res[1].status === 'fulfilled') r.personas = res[1].value;
            if (res[2].status === 'fulfilled') r.lorebooks = res[2].value;
            loader.invalidate();
            const failed = res.find(x => x.status === 'rejected');
            if (failed) r.hostError = message(failed.reason, '일부 목록을 불러오지 못했습니다.');
            for (const s of Object.values(studios)) { s.characters = r.characters; s.personas = r.personas; s.lorebooks = r.lorebooks; s.compatibility = r.compatibility; }
            hostLoaded = !failed;
        } catch (e) {
            r.compatibility = compat(null);
            for (const s of Object.values(studios)) s.compatibility = r.compatibility;
            hostLoaded = false; r.hostError = message(e, '루미버스와 연결할 수 없습니다.');
        } finally { r.loadingHost = false; render(); }
    }
    async function loadEntries(id, signal, { init = false } = {}) {
        if (!id) return [];
        const st = r;
        const list = await lib.lorebookEntries(id);
        if (signal?.aborted || r !== st || r.input.lorebookId !== id || destroyed) return list;
        r.lorebookEntries = list; r.lorebookEntriesForId = id; r.lorebookEntriesError = '';
        const ids = new Set(list.map(x => x.id));
        r.input.lorebookEntryIds = init ? list.filter(x => x.enabled !== false).map(x => x.id) : r.input.lorebookEntryIds.filter(x => ids.has(x));
        loader.invalidate();
        return list;
    }
    async function chooseLorebook(id) {
        entriesAbort?.abort(); entriesAbort = null;
        Object.assign(r.input, { lorebookId: id, lorebookEntryIds: [] });
        loader.invalidate();
        Object.assign(r, { lorebookEntries: [], lorebookEntriesForId: '', lorebookEntriesError: '', lorebookEntriesLoading: !!id, worldContext: '', registeredCharacterId: '' });
        render();
        if (!id) return;
        const ac = new AbortController();
        entriesAbort = ac;
        try { await loadEntries(id, ac.signal, { init: true }); } catch (e) { if (!isAbort(e) && r.input.lorebookId === id) r.lorebookEntriesError = message(e, '로어북 항목을 불러오지 못했습니다.'); } finally {
            if (entriesAbort === ac) entriesAbort = null;
            if (r.input.lorebookId === id) r.lorebookEntriesLoading = false;
            render();
        }
    }
    async function referenceContext(signal) {
        if (r.input.mode !== 'world') return '';
        if (isExternalReference(r.input)) {
            if (r.externalBusy) throw new Error('외부 자료 가져오기가 끝난 뒤 요청해 주세요.');
            r.worldContext = externalText(r.input, { required: true });
            return r.worldContext;
        }
        if (!r.input.lorebookId && !r.input.characterIds.length && !r.input.personaIds.length) throw new Error('기존 자료 참고에서는 캐릭터·페르소나·로어북 중 하나 이상 선택해 주세요.');
        if (r.input.lorebookId && r.lorebookEntriesForId !== r.input.lorebookId) await loadEntries(r.input.lorebookId, signal, { init: true });
        r.worldContext = await loader.load(r.input);
        return r.worldContext;
    }

    // ---------- sending to 령령 / reading her answer ----------
    async function sendRequest(text, kind, { chatId = currentChat(), signal } = {}) {
        if (!chatId) throw new Error('현재 RP방을 확인하지 못했습니다. RP방을 연 상태에서 다시 시도해 주세요.');
        if (chat.generating) throw new Error('현재 령령의 답변을 생성 중입니다. 생성이 끝난 뒤 다시 요청해 주세요.');
        if (signal?.aborted) throw abortError();
        await flushInjection();
        const res = await host.rpc('send', { chatId, text, kind });
        if (destroyed || chatId !== currentChat()) throw new Error('RP방이 변경되었습니다. 현재 방에서 다시 요청해 주세요.');
        chat.generating = !!res.generationId; chat.replyDone = false;
        return res;
    }
    async function composerInsert(text) {
        if (!currentChat()) throw new Error('현재 RP방을 확인하지 못했습니다. RP방을 연 상태에서 다시 시도해 주세요.');
        if (!canComposer()) throw new Error('RP 입력창에 넣을 수 없습니다. 요청문 복사를 사용해 주세요.');
        deps.composer.setText(wrapRequest(text));
        try { deps.composer.focus?.(); } catch { /* optional */ }
    }
    async function fetchLatest(chatId) {
        const res = await lib.latestMessage(chatId);
        chat.generating = !!res.generating;
        if (res.generating) throw new Error('답변 생성이 끝난 뒤 가져와 주세요.');
        return assertImportable(res.message);
    }

    // ---------- character / persona flows ----------
    async function prepareBriefing({ toComposer = false, send = false, advance = true } = {}) {
        if (r.request) return;
        const ac = new AbortController();
        startRequest('briefing', ac);
        try {
            const world = await referenceContext(ac.signal);
            r.editingSource = null;
            r.bridge.briefing = builders().buildStudioBriefing({ input: r.input, worldContext: world });
            r.bridge.chatId = currentChat(); r.bridge.error = '';
            if (advance) r.step = 1;
            if (send) { await sendRequest(r.bridge.briefing, 'briefing'); sentNotice(); }
            else if (toComposer) { await composerInsert(r.bridge.briefing); notify('제작 브리핑을 RP 입력창에 넣었습니다.', 'success', 3000); }
            else notify('령령에게 보낼 제작 브리핑을 만들었습니다.', 'success', 3000);
        } catch (e) { if (!isAbort(e)) notify(message(e), 'error', 7000); } finally { endRequest(ac); render(); }
    }
    const sentNotice = () => notify('령령에게 요청을 보냈습니다. 답변이 끝나면 아래 가져오기 버튼을 눌러 주세요.', 'success', 5000);

    async function startExistingEdit() {
        if (r.request) return;
        const sourceId = r.input.editCharacterId, chatId = currentChat();
        if (!sourceId || !chatId) return notify(`수정할 ${noun()}와 령령 RP방을 선택해 주세요.`, 'error');
        if (Object.values(r.draft).flat().some(filled) && !await ask(`현재 편집 내용을 선택한 ${noun()}의 원본으로 바꿀까요? 필요한 작업은 먼저 임시 저장하거나 JSON으로 보관해 주세요.`, { title: '원본 불러오기', confirmLabel: '바꾸기', variant: 'warning' })) return;
        const input = clone(r.input), ac = new AbortController();
        startRequest('load-existing', ac);
        try {
            const [source, world] = await Promise.all([r.kind === 'persona' ? lib.persona(sourceId) : lib.character(sourceId), loader.load(input)]);
            if (destroyed || ac.signal.aborted) return;
            if (chatId !== currentChat() || JSON.stringify(input) !== JSON.stringify(r.input)) throw new Error('방이나 참고 자료 선택이 변경되었습니다. 다시 편집 바로 이동을 눌러 주세요.');
            const draft = r.kind === 'persona' ? normalizePersona(source) : characterDataToDraft(source.data);
            const briefing = builders().buildExistingCharacterBriefing({ draft, worldContext: world, editRequest: input.editRequest });
            await sendRequest(briefing, 'edit', { chatId });
            r.draft = draft;
            r.editingSource = { id: source.id, name: source.name, draft: clone(draft) };
            r.worldContext = world;
            r.bridge = { ...newStudioState().bridge, chatId, briefing, hasImport: true };
            r.undo = []; r.redo = []; r.registeredCharacterId = '';
            lastContext = { chatId, draft: clone(draft), reference: world };
            if (r.revision.injectCurrentPrompt) r.contextChatId = chatId;
            if (r.referenceContext.enabled) r.referenceContext.chatId = chatId;
            r.step = 2;
            deps.openWindow?.();
            notify(`‘${source.name}’을(를) 불러오고 령령에게 편집 자료를 보냈습니다.`, 'success');
        } catch (e) { if (!isAbort(e)) notify(message(e), 'error', 7000); } finally { endRequest(ac); render(); }
    }
    async function saveOriginal() {
        if (r.request || !r.editingSource) return;
        if (!r.compatibility.writable) return notify(r.compatibility.message, 'error');
        const source = clone(r.editingSource), draft = r.kind === 'persona' ? normalizePersona(r.draft) : clone(r.draft);
        try { r.kind === 'persona' ? assertPersona(normalizePersona(draft)) : assertCard(draftToCard(draft)); } catch (e) { return notify(message(e), 'error'); }
        if (!await ask(`원본 ‘${source.name}’에 편집한 항목을 저장할까요?\n원본 ${noun()}의 해당 항목이 변경됩니다.`, { title: '원본에 저장', confirmLabel: '저장', variant: 'warning' })) return;
        const ac = new AbortController();
        startRequest('save-original', ac);
        try {
            const current = r.kind === 'persona' ? await lib.persona(source.id) : await lib.character(source.id);
            const patch = r.kind === 'persona' ? personaPatch(draft, source.draft, current) : characterPatch(draft, source.draft, current.data);
            if (!Object.keys(patch).length) return notify('원본에 저장할 변경 사항이 없습니다.', 'info');
            const saved = r.kind === 'persona' ? await lib.updatePersona(source.id, patch) : await lib.updateCharacter(source.id, patch);
            if (destroyed) return;
            r.editingSource = { id: source.id, name: saved.name, draft };
            const key = r.kind === 'persona' ? 'personas' : 'characters';
            for (const s of Object.values(studios)) s[key] = s[key].map(x => (x.id === source.id ? { id: source.id, name: saved.name } : x));
            libraryChanged(key); loader.invalidate();
            notify(`원본 ${noun()}에 변경 사항을 저장했습니다.`, 'success');
        } catch (e) { if (!isAbort(e)) notify(message(e), 'error', 8000); } finally { endRequest(ac); render(); }
    }
    function applyAnswer(text, messageId = '', { revision = false, manual = false } = {}) {
        const parsed = r.kind === 'persona' ? parsePersonaAnswer(text, { manual }) : parseCharacterAnswer(text, { allowUnwrappedPatch: manual || revision });
        if (manual) parsed.draft = restoreMacros(parsed.draft);
        else {
            const base = lastContext?.chatId === currentChat() ? { ...lastContext.draft, reference: lastContext.reference } : r.draft;
            parsed.draft = protectMacros(base).restoreDraft(parsed.draft);
        }
        r.redo = []; r.undo.push(clone(r.draft)); r.undo = r.undo.slice(-10);
        r.draft = { ...r.draft, ...parsed.draft };
        Object.assign(r.bridge, { importedRaw: parsed.raw, lastMessageId: messageId, found: parsed.found, missing: revision ? [] : parsed.missing, wrapped: parsed.wrapped, hasImport: true, error: '' });
        r.registeredCharacterId = ''; r.step = 2;
        if (r.kind === 'persona' && parsed.packetKind === 'fields-unwrapped') notify(`답변에서 읽은 항목을 반영했습니다: ${parsed.found.join(' · ')}`, 'success', 5000);
        else if (manual && parsed.packetKind?.startsWith('patch-v2')) notify(`붙여넣은 답변을 반영했습니다: ${parsed.found.join(' · ')}`, 'success', 5000);
        else if (revision) notify(`령령의 수정 답변을 반영했습니다: ${parsed.found.join(' · ')}`, 'success', 5000);
        else notify(parsed.missing.length ? `답변을 가져왔습니다. ${parsed.missing.length}개 항목은 비어 있어 편집 화면에서 확인해 주세요.` : '령령의 최종본을 모두 가져왔습니다.', parsed.missing.length ? 'info' : 'success', 5500);
    }
    async function importLatest({ revision = false } = {}) {
        if (r.request) return;
        if (chat.generating) return notify('답변 생성이 끝난 뒤 가져와 주세요.', 'info', 4500);
        const chatId = currentChat();
        if (!chatId) return notify('현재 RP방 ID를 확인하지 못했습니다. RP방을 연 상태에서 다시 시도해 주세요.', 'error', 7000);
        const ac = new AbortController();
        startRequest(revision ? 'revision-import' : 'import', ac);
        try {
            const last = await fetchLatest(chatId);
            if (destroyed || chatId !== currentChat()) throw new Error('RP방이 변경되었거나 답변을 생성 중입니다. 생성이 끝난 뒤 다시 가져와 주세요.');
            if (!last) throw new Error('현재 RP방에서 가져올 AI 답변을 찾지 못했습니다.');
            if (revision && last.id === r.bridge.lastMessageId && last.content.trim() === r.bridge.importedRaw) throw new Error('아직 새로운 령령 답변이 없습니다. 수정 답변 생성이 끝난 뒤 다시 눌러 주세요.');
            r.bridge.chatId = chatId;
            applyAnswer(last.content, last.id, { revision });
        } catch (e) {
            if (isAbort(e)) return;
            if (revision) notify(message(e, '수정 답변을 반영하지 못했습니다.'), 'error', 8000);
            else { r.bridge.error = message(e); notify(r.bridge.error, 'error', 8000); }
        } finally { endRequest(ac); render(); }
    }
    function importManual() {
        try { applyAnswer(r.bridge.manualText, 'manual', { manual: true }); } catch (e) { r.bridge.error = message(e); notify(r.bridge.error, 'error', 7000); }
    }
    function revisionRequest() {
        lastContext = { chatId: currentChat(), draft: clone(r.draft), reference: '' };
        return builders().buildRevisionRequest({ instruction: r.revision.instruction, draft: r.draft });
    }
    const fieldCard = () => (r.kind === 'persona' ? assertPersona(normalizePersona(r.draft)) : assertCard(draftToCard(r.draft, keywordsOf(r))));
    const cardJson = () => (r.kind === 'persona' ? JSON.stringify(fieldCard(), null, 2) : JSON.stringify(characterCardFile(fieldCard()), null, 2));
    async function register() {
        if (r.request || r.registeredCharacterId) return;
        if (!r.compatibility.writable) return notify(r.compatibility.message, 'error');
        let card;
        try { card = fieldCard(); } catch (e) { return notify(message(e), 'error'); }
        if (!await ask(`‘${card.name}’을(를) 새 ${noun()}로 등록할까요?\n기존 ${noun()}는 변경하지 않습니다.`, { title: `새 ${noun()}로 등록`, confirmLabel: '등록' })) return;
        const ac = new AbortController();
        startRequest('register', ac);
        try {
            const made = r.kind === 'persona' ? await lib.createPersona(card) : await lib.createCharacter(card);
            r.registeredCharacterId = JSON.stringify(r.kind === 'persona' ? normalizePersona(r.draft) : draftToCard(r.draft, keywordsOf(r))) === JSON.stringify(card) ? made.id : '';
            const key = r.kind === 'persona' ? 'personas' : 'characters';
            for (const s of Object.values(studios)) s[key] = [{ id: made.id, name: card.name }, ...s[key].filter(x => x.id !== made.id)];
            libraryChanged(key);
            notify(`루미버스에 새 ${noun()}를 등록했습니다.`, 'success', 5000);
        } catch (e) { if (!isAbort(e)) notify(message(e), 'error', 8000); } finally { endRequest(ac); render(); }
    }
    async function resetStudio() {
        if (r.request || !await ask(`확장에 저장된 ${noun()} 제작실의 작업을 모두 초기화합니다.`, { title: '데이터 초기화', confirmLabel: '초기화', variant: 'danger' })) return;
        const ac = new AbortController();
        startRequest('clear', ac);
        try {
            await host.rpc('storagePatch', { patch: { [r.kind === 'persona' ? PERSONA_KEY : CHARACTER_KEY]: null } });
            if (destroyed || ac.signal.aborted) return;
            external.cancel(); entriesAbort?.abort();
            Object.assign(r, newStudioState(r.kind), { open: true });
            savedJson.delete(r.kind); lastContext = null; loader.invalidate(); hostLoaded = false;
            await loadLibrary();
            notify(`${noun()} 제작실의 저장된 작업을 모두 초기화했습니다.`, 'success', 3500);
        } catch (e) { notify(message(e, `${noun()} 제작실 데이터를 초기화하지 못했습니다.`), 'error', 7000); } finally { endRequest(ac); render(); }
    }
    const copyAndNotify = (text, done) => copyText(text, root || document.body).then(() => notify(done, 'success', 3000), e => notify(message(e), 'error'));

    // ---------- the handler table the original's UI builders call ----------
    const handlers = {
        get external() { return external; },
        get canComposer() { return canComposer(); },
        switchStudio: k => switchStudio(k),
        open: () => deps.openWindow?.(),
        close: () => { external.cancel(); lore.cancelExternal(); deps.closeWindow?.(); },
        refreshHost: () => { loadLibrary(true); },
        dismissNotice: () => { r.notice = null; if (root) renderToast(root, r, handlers); },
        goStep(c) { if (c < 0 || c > 3) return; r.step = c; render(); root?.querySelector('.mcs-main')?.scrollTo?.(0, 0); },
        updateInput(k, v, rerender = false) {
            r.input[k] = v;
            if (r.kind === 'persona' && k === 'editCharacterId') { r.input.personaIds = r.input.personaIds.filter(x => x !== v); loader.invalidate(); }
            if (k === 'mode') { external.cancel(); r.bridge.briefing = ''; loader.invalidate(); }
            r.worldContext = ''; r.registeredCharacterId = '';
            if (rerender) render();
        },
        setLorebook(id) { chooseLorebook(id); },
        disconnectLorebook() { chooseLorebook(''); },
        toggleLorebookEntry(id) {
            const on = r.input.lorebookEntryIds.includes(id);
            r.input.lorebookEntryIds = on ? r.input.lorebookEntryIds.filter(x => x !== id) : [...r.input.lorebookEntryIds, id];
            loader.invalidate(); r.worldContext = ''; render();
        },
        setAllLorebookEntries(all) { r.input.lorebookEntryIds = all ? r.lorebookEntries.filter(x => x.enabled !== false).map(x => x.id) : []; loader.invalidate(); r.worldContext = ''; render(); },
        toggleKeyword(k) { r.input.keywords = r.input.keywords.includes(k) ? r.input.keywords.filter(x => x !== k) : [...r.input.keywords, k]; render(); },
        addCharacter(id) {
            if (!id || r.input.characterIds.includes(id)) return;
            if (r.input.characterIds.length >= 3) return notify('참고 캐릭터는 최대 3명까지 선택할 수 있습니다.', 'info', 3000);
            r.input.characterIds = [...r.input.characterIds, id]; loader.invalidate(); r.worldContext = ''; render();
        },
        removeCharacter(id) { r.input.characterIds = r.input.characterIds.filter(x => x !== id); loader.invalidate(); r.worldContext = ''; render(); },
        addPersona(id) {
            if (!id || r.input.personaIds.includes(id) || (r.kind === 'persona' && r.input.mode === 'edit' && id === r.input.editCharacterId)) return;
            if (r.input.personaIds.length >= 3) return notify('참고 페르소나는 최대 3개까지 선택할 수 있습니다.', 'info', 3000);
            r.input.personaIds = [...r.input.personaIds, id]; loader.invalidate(); r.worldContext = ''; render();
        },
        removePersona(id) { r.input.personaIds = r.input.personaIds.filter(x => x !== id); loader.invalidate(); r.worldContext = ''; render(); },
        startExistingEdit() { startExistingEdit(); },
        saveOriginalCharacter() { saveOriginal(); },
        prepareBriefing() { prepareBriefing({ toComposer: false, advance: false }); },
        prepareBriefingToChat() { prepareBriefing({ toComposer: true }); },
        prepareBriefingAndSend() { prepareBriefing({ send: true }).catch(e => notify(message(e), 'error', 8000)); },
        copyBriefing() {
            try {
                if (isExternalReference(r.input) && r.externalBusy) throw new Error('외부 자료 가져오기가 끝난 뒤 요청해 주세요.');
                const text = isExternalReference(r.input) ? builders().buildStudioBriefing({ input: r.input, worldContext: externalText(r.input, { required: true }) }) : r.bridge.briefing || builders().buildStudioBriefing({ input: r.input, worldContext: r.worldContext });
                copyAndNotify(text, '제작 브리핑을 복사했습니다.');
            } catch (e) { notify(message(e), 'error'); }
        },
        setOutputFormat(v) { if (['markdown', 'prose'].includes(v)) r.outputFormat = v; render(); },
        setLengthMode(v) { if (Object.hasOwn(r.kind === 'persona' ? PERSONA_LENGTHS : LENGTHS, v)) r.lengthMode = v; render(); },
        exportRequestToChat() { composerInsert(builders().buildExportRequest(r.lengthMode, r.outputFormat)).then(() => notify('최종본 요청문을 RP 입력창에 넣었습니다.', 'success', 3000), e => notify(message(e), 'error', 7000)); },
        exportRequestAndSend() {
            if (r.request) return;
            const text = builders().buildExportRequest(r.lengthMode, r.outputFormat), ac = new AbortController();
            startRequest('export-send', ac);
            sendRequest(text, 'export', { signal: ac.signal }).then(sentNotice, e => notify(message(e), 'error', 8000)).finally(() => { endRequest(ac); render(); });
        },
        copyExportRequest() { copyAndNotify(builders().buildExportRequest(r.lengthMode, r.outputFormat), '최종본 요청문을 복사했습니다.'); },
        importLatestAssistant() { importLatest(); },
        updateManualText(v) { r.bridge.manualText = v; },
        importManualText: importManual,
        updateRevisionInstruction(v) { r.revision.instruction = v; },
        setInjectCurrentPrompt(on) {
            const id = currentChat();
            if (on && !id) return notify('상시 주입을 연결할 령령 RP방을 먼저 열어 주세요.', 'error');
            r.revision.injectCurrentPrompt = !!on; r.contextChatId = on ? id : ''; render();
        },
        setReferenceContext(on) {
            const id = currentChat();
            if (on && !id) return notify('참고 자료를 연결할 RP방을 먼저 열어 주세요.', 'error');
            r.referenceContext = { enabled: !!on, chatId: on ? id : '' }; r.bridge.chatId = id; render();
        },
        revisionRequestToChat() { try { composerInsert(revisionRequest()).then(() => notify('수정 요청을 RP 입력창에 넣었습니다.', 'success', 3000), e => notify(message(e), 'error', 7000)); } catch (e) { notify(message(e), 'error', 7000); } },
        copyRevisionRequest() { try { copyAndNotify(revisionRequest(), '수정 요청문을 복사했습니다.'); } catch (e) { notify(message(e), 'error', 7000); } },
        async revisionRequestAndSend() {
            if (r.request) return;
            const instruction = r.revision.instruction, ac = new AbortController();
            try {
                const text = revisionRequest();
                startRequest('revision-send', ac);
                await sendRequest(text, 'revision', { signal: ac.signal });
                if (r.revision.instruction === instruction) r.revision.instruction = '';
                sentNotice();
            } catch (e) { if (!isAbort(e)) notify(message(e), 'error', 8000); } finally { endRequest(ac); render(); }
        },
        applyLatestRevision() { importLatest({ revision: true }); },
        toggleEditorSection(k) { const o = r.openEditorSection; r.openEditorSection = o.includes(k) ? o.filter(x => x !== k) : [...o, k]; render(); },
        updateDraftField(k, v) { r.draft[k] = v; scheduleTokenLabels(); r.redo = []; r.registeredCharacterId = ''; },
        updateAlternateGreeting(i, v) { r.draft.alternateGreetings[i] = v; scheduleTokenLabels(); r.redo = []; r.registeredCharacterId = ''; },
        addAlternateGreeting() { r.draft.alternateGreetings = [...r.draft.alternateGreetings, '']; r.redo = []; render(); },
        removeAlternateGreeting(i) { r.draft.alternateGreetings = r.draft.alternateGreetings.filter((_, k) => k !== i); r.redo = []; render(); },
        undoDraft() { const prev = r.undo.pop(); if (!prev) return; r.redo.push(clone(r.draft)); r.redo = r.redo.slice(-10); r.draft = prev; r.registeredCharacterId = ''; notify('최근 가져오기 수정을 되돌렸습니다.', 'success', 3000); },
        restoreDraft() { const next = r.redo.pop(); if (!next) return; r.undo.push(clone(r.draft)); r.undo = r.undo.slice(-10); r.draft = next; r.registeredCharacterId = ''; notify('되돌리기 전 상태를 복원했습니다.', 'success', 3000); },
        toggleTokenSettings() { r.tokenSettingsOpen = !r.tokenSettingsOpen; render(); },
        setTokenProfile(v) { if (Object.hasOwn(TOKEN_PROFILES, v)) { r.tokenProfile = v; if (root) updateTokenLabels(root, r); } },
        registerCharacter() { register(); },
        downloadCharacter() {
            try {
                if (r.kind === 'persona') downloadPersona(fieldCard());
                else { const card = fieldCard(); downloadJson(characterCardFile(card), `${safeFileName(card.name)}.lumiverse.json`); }
                notify(`${noun()} JSON 파일을 저장했습니다.`, 'success', 3500);
            } catch (e) { notify(message(e), 'error'); }
        },
        copyCharacter() { try { copyAndNotify(cardJson(), `${noun()} JSON 전체를 복사했습니다.`); } catch (e) { notify(message(e, '전체 복사에 실패했습니다.'), 'error', 7000); } },
        saveTemporary() { persist().then(() => notify('현재 작업을 임시 저장했습니다.', 'success', 3500), e => notify(message(e, '임시 저장에 실패했습니다.'), 'error', 7000)); },
        clearTemporary() { resetStudio(); },
    };

    // ---------- studio switching ----------
    async function switchStudio(kind) {
        if (!['character', 'persona', 'lorebook'].includes(kind) || kind === selected || destroyed) return;
        if (Object.values(studios).some(s => s.request || s.loadingHost || s.lorebookEntriesLoading) || lore.busy) return;
        lore.deactivate(); external.cancel(); lore.cancelExternal();
        try { selected === 'lorebook' ? await lore.persist() : await persist(); } catch (e) { return notify(message(e, '작업을 저장하지 못했습니다.'), 'error'); }
        if (destroyed) return;
        views.set(selected, captureView());
        extras[r.kind].lastContextDraft = lastContext;
        if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = 0; r.notice = null; }
        selected = kind;
        if (kind !== 'lorebook') { r = studios[kind]; loader = extras[kind].loader; external = extras[kind].external; lastContext = extras[kind].lastContextDraft; }
        savedView = views.get(kind) || null;
        render();
        root?.querySelector('.mcs-studio-switcher__item.is-selected')?.focus?.();
        if (kind === 'lorebook') lore.activate(); else if (!hostLoaded) loadLibrary();
    }

    // ---------- standing context (상시 주입) ----------
    let injectKey = '', injectTimer = 0, injecting = Promise.resolve(), lastInjectError = '';
    function scheduleInjection() {
        if (destroyed) return;
        if (injectTimer) clearTimeout(injectTimer);
        injectTimer = later(() => { injectTimer = 0; injecting = injecting.then(syncInjection, syncInjection); }, 350);
    }
    function flushInjection() {
        if (injectTimer) { clearTimeout(injectTimer); injectTimer = 0; injecting = injecting.then(syncInjection, syncInjection); }
        return injecting.catch(() => {});
    }
    async function buildInjection() {
        const chatId = currentChat();
        if (!chatId) return null;
        if (selected === 'lorebook') {
            const text = await lore.contextForChat(chatId);
            return text ? { chatId, conversation: text, export: '' } : null;
        }
        const st = r;
        let reference = '', ref = '';
        if (st.referenceContext.enabled && st.referenceContext.chatId === chatId) {
            for (let k = 0; k < 3; k++) {
                const input = clone(st.input), world = await loader.load(input);
                if (destroyed || r !== st || chatId !== currentChat()) return null;
                if (!st.referenceContext.enabled || st.referenceContext.chatId !== chatId) break;
                if (JSON.stringify(input) !== JSON.stringify(st.input)) { if (k === 2) throw new Error('참고 자료 선택이 계속 변경되어 이번 답변에는 주입하지 못했습니다. 다시 전송해 주세요.'); continue; }
                reference = builders().buildSelectedReferenceContext({ input, worldContext: world });
                ref = `${JSON.stringify(input)}\n${world}`;
                break;
            }
        }
        const parts = [];
        if (reference) parts.push(reference);
        const draftOn = st.revision.injectCurrentPrompt && st.contextChatId === chatId && Object.values(st.draft).flat().some(x => typeof x === 'string' && x.trim());
        if (draftOn) parts.push(builders().buildCurrentDraftContext(st.draft));
        if (parts.length) lastContext = { chatId, draft: clone(st.draft), reference: ref };
        return parts.length || reference ? { chatId, conversation: parts.join('\n\n'), export: reference } : null;
    }
    async function syncInjection() {
        if (destroyed) return;
        let rec = null;
        try { rec = await buildInjection(); lastInjectError = ''; } catch (e) {
            const text = message(e, '최신 초안을 컨텍스트에 넣지 못했습니다.');
            if (text !== lastInjectError) { lastInjectError = text; notify(text, 'error'); }   // once per distinct problem, so a render cannot loop
            return;
        }
        const key = JSON.stringify(rec);
        if (key === injectKey) return;
        injectKey = key;
        try { await host.rpc('inject', rec ? { ...rec } : { chatId: null }); } catch { injectKey = ''; }
    }

    // ---------- events from the backend / the host ----------
    function onEvent(ev) {
        if (ev.event !== 'generation' || ev.chatId !== currentChat()) return;
        const wasBusy = chat.generating;
        chat.generating = ev.state === 'started';
        if (ev.state === 'started') chat.replyDone = false;
        if (ev.state === 'ended') { chat.replyDone = true; if (wasBusy) notify('령령의 답변이 끝났어요. 가져오기 버튼을 눌러 주세요.', 'success', 6000); }
        if (ev.state === 'error') notify(`령령의 답변 생성에 실패했어요${ev.error ? `: ${ev.error}` : ''}`, 'error', 8000);
        if (ev.state === 'stopped') notify('령령의 답변 생성이 중단되었어요.', 'info', 4000);
    }
    const offEvents = host.onEvent(onEvent);

    return {
        get selected() { return selected; },
        get chat() { return chat; },
        attach(el) { root = el; render(); },
        detach() { root = null; },
        render,
        async start(boot) {
            if (boot) { chat.generating = !!boot.generating?.includes?.(currentChat()); }
            await restore();
            if (!destroyed) render();
            if (!hostLoaded && selected !== 'lorebook') loadLibrary();
        },
        chatChanged() { chat.generating = false; scheduleInjection(); render(); },
        persistAll: async () => { try { selected === 'lorebook' ? await lore.persist() : await persist(); } catch { /* best effort */ } },
        flushInjection,
        ensureLibrary() { if (!hostLoaded && !r.loadingHost && selected !== 'lorebook') loadLibrary(); if (selected === 'lorebook') lore.activate(); },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            offEvents();
            for (const s of Object.values(extras)) s.external.cancel();
            entriesAbort?.abort(); lore.destroy();
            for (const t of timers) clearTimeout(t);
            timers.clear();
            host.rpc && host.rpc('inject', { chatId: null }).catch(() => {});
            root = null;
        },
    };
}

// ===================================================================================================================
// Lorebook studio — the original's `zn()` controller.
// ===================================================================================================================
function createLorebookStudio(d) {
    const { lib, host, storage } = d;
    const o = newLorebookState();
    let destroyed = false, rootEl = null, tokenTimer = 0;
    const store = lib && host.lorebookApi;
    const loader = createReferenceLoader({ api: lib, getLorebooks: () => o.lorebooks, getEntries: () => o.lorebookEntries, getEntriesForId: () => o.lorebookEntriesForId });
    const external = createExternalController({ state: o, render: () => paint(), fetchImpl: d.fetchImpl, changed() { o.briefing = ''; loader.invalidate(); } });
    let savedJson = '';
    const tokenLabels = () => { if (tokenTimer) clearTimeout(tokenTimer); tokenTimer = d.later(() => { tokenTimer = 0; if (!destroyed && rootEl) updateLoreTokens(rootEl, o); }, 500); };
    const paint = () => { if (!destroyed) d.render(); };
    const load = async input => (input.mode !== 'edit' ? loader.load(input) : loader.load({ ...input, mode: 'world', referenceKind: 'internal', lorebookId: '', lorebookEntryIds: [] }));
    async function persist() {
        const data = serializeLorebook(o), json = JSON.stringify(data);
        if (json !== savedJson) { await storage.patch({ [LOREBOOK_KEY]: data }); savedJson = json; }
    }
    const pushHistory = () => { o.undo = [...o.undo.slice(-19), clone(o.draft)]; o.redo = []; };
    async function guarded(fn) {
        if (o.busy || destroyed) return;
        o.busy = true; o.error = ''; o.notice = ''; paint();
        try { await fn(); } catch (e) { o.error = e instanceof Error ? e.message : String(e); } finally { o.busy = false; paint(); }
    }
    async function refresh() {
        const [chars, pers, books] = await Promise.all([lib.characters(), lib.personas(), lib.lorebooks()]);
        if (destroyed) return;
        if (o.characters !== chars || o.personas !== pers || o.lorebooks !== books) loader.invalidate();
        o.characters = chars; o.personas = pers; o.lorebooks = books;
        if (o.input.lorebookId && o.lorebookEntriesForId !== o.input.lorebookId) {
            const id = o.input.lorebookId, list = await lib.lorebookEntries(id);
            if (destroyed || id !== o.input.lorebookId) return;
            o.lorebookEntries = list; o.lorebookEntriesForId = id;
            const ok = new Set(list.filter(x => x.enabled !== false).map(x => x.id));
            o.input.lorebookEntryIds = o.input.lorebookEntryIds.filter(x => ok.has(x));
            loader.invalidate();
        }
    }
    async function chooseBook(id) {
        Object.assign(o.input, { lorebookId: id, lorebookEntryIds: [] });
        Object.assign(o, { lorebookEntries: [], lorebookEntriesForId: '', lorebookEntriesError: '', lorebookEntriesLoading: !!id });
        loader.invalidate(); paint();
        try {
            const list = id ? await lib.lorebookEntries(id) : [];
            if (o.input.lorebookId !== id || destroyed) return;
            o.lorebookEntries = list; o.lorebookEntriesForId = id;
            o.input.lorebookEntryIds = list.filter(x => x.enabled !== false).map(x => x.id);
        } catch (e) { if (o.input.lorebookId === id) o.lorebookEntriesError = e.message; } finally { if (o.input.lorebookId === id) o.lorebookEntriesLoading = false; paint(); }
    }
    async function toComposerOrSend(text, mode, chatId) {
        if (!chatId || chatId !== d.getChatId()) throw new Error('령령 RP방을 열고 다시 요청해 주세요.');
        if (mode === 'send') { await d.send(text, 'lorebook'); return; }
        await d.composerInsert(text);
    }
    async function request(kind, mode) {
        const chatId = d.getChatId();
        if (['send', 'composer'].includes(mode) && !chatId) throw new Error('령령 RP방을 먼저 열어 주세요.');
        let text;
        if (kind === 'briefing') {
            if (isExternalReference(o.input)) { if (o.externalBusy) throw new Error('외부 자료 가져오기가 끝난 뒤 요청해 주세요.'); externalText(o.input, { required: true }); }
            if (o.input.mode === 'world' && !isExternalReference(o.input) && !o.input.lorebookId && !o.input.characterIds.length && !o.input.personaIds.length) throw new Error('참고 캐릭터·페르소나·로어북 중 하나를 선택해 주세요.');
            if (o.input.mode === 'edit' && !o.source) throw new Error('편집할 원본을 먼저 불러와 주세요.');
            if (!isExternalReference(o.input) && (o.lorebookEntriesLoading || o.lorebookEntriesError)) throw new Error('참고 로어북 항목을 먼저 정상적으로 불러와 주세요.');
            text = lorebookBriefing(o, await load(o.input));
            o.briefing = text;
            if (mode !== 'preview') o.step = 1;
        } else {
            if (kind === 'revision' && !o.revision.trim()) throw new Error('수정할 내용을 입력해 주세요.');
            const built = lorebookRequest(o, kind, chatId);
            text = built.text; o.pending = built.pending;
        }
        o.chatId = chatId;
        await persist();
        if (destroyed) return;
        if (mode === 'copy') { await d.copy(text); o.notice = '로어북 요청문을 복사했습니다.'; }
        else if (mode !== 'preview') { await toComposerOrSend(text, mode, chatId); if (mode === 'send') o.notice = '령령에게 요청을 보냈습니다. 답변이 끝나면 아래 가져오기 버튼을 눌러 주세요.'; }
    }
    function adopt(parsed, chatId) {
        const next = applyLorebookAnswer(o.draft, parsed, o.pending, chatId);
        pushHistory();
        Object.assign(o, { draft: next, entryMoveOrder: null, pending: null, step: 2, notice: '로어북 응답을 작업용 초안에 반영했습니다.' });
    }
    const exportFile = () => lorebookFile({ name: o.draft.name, description: o.draft.description }, o.draft.entries.map(e => ({ ...clone(e.data) })));
    function downloadFile(value, filename) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_'); a.hidden = true;
        document.body.append(a); a.click(); a.remove();
        d.later(() => URL.revokeObjectURL(url), 1000);
    }

    const handlers = {
        external,
        get canComposer() { return d.canComposer(); },
        goStep(p) { if (o.entryMoveOrder && p !== 2) { o.error = 'Entry 이동을 확인하거나 취소해 주세요.'; paint(); return; } if (!o.busy && p >= 0 && p <= 3) { o.step = p; paint(); rootEl?.querySelector('.mcs-main')?.scrollTo?.(0, 0); } },
        updateInput(k, v, rerender = false) { o.input[k] = v; if (k === 'mode') { external.cancel(); o.briefing = ''; loader.invalidate(); } if (rerender) paint(); },
        updateBook(k, v) { o.draft[k] = v; o.redo = []; },
        setLorebook: id => { guarded(() => chooseBook(id)); },
        disconnectLorebook: () => { guarded(() => chooseBook('')); },
        setAllLorebookEntries(all) { o.input.lorebookEntryIds = all ? o.lorebookEntries.filter(x => x.enabled !== false).map(x => x.id) : []; loader.invalidate(); paint(); },
        toggleLorebookEntry(id) { o.input.lorebookEntryIds = o.input.lorebookEntryIds.includes(id) ? o.input.lorebookEntryIds.filter(x => x !== id) : [...o.input.lorebookEntryIds, id]; loader.invalidate(); paint(); },
        addCharacter(id) { if (o.input.characterIds.length < 3 && !o.input.characterIds.includes(id)) o.input.characterIds.push(id); loader.invalidate(); paint(); },
        removeCharacter(id) { o.input.characterIds = o.input.characterIds.filter(x => x !== id); loader.invalidate(); paint(); },
        addPersona(id) { if (o.input.personaIds.length < 3 && !o.input.personaIds.includes(id)) o.input.personaIds.push(id); loader.invalidate(); paint(); },
        removePersona(id) { o.input.personaIds = o.input.personaIds.filter(x => x !== id); loader.invalidate(); paint(); },
        loadOriginal: () => {
            guarded(async () => {
                const chatId = d.getChatId();
                if (!o.input.editLorebookId) throw new Error('수정할 로어북을 선택해 주세요.');
                if (!chatId) throw new Error('령령 RP방을 먼저 열어 주세요.');
                if ((o.draft.entries.length || o.draft.name) && !await d.ask('현재 로어북 초안을 선택한 서버 원본으로 교체할까요? 필요한 작업은 먼저 임시 저장하거나 JSON으로 보관해 주세요.', { title: '원본 불러오기', confirmLabel: '교체', variant: 'warning' })) return;
                const input = clone(o.input);
                const [source, world] = await Promise.all([store.read(input.editLorebookId), load(input)]);
                if (destroyed) return;
                if (chatId !== d.getChatId() || JSON.stringify(input) !== JSON.stringify(o.input)) throw new Error('방이나 참고 자료 선택이 변경되었습니다. 다시 편집 바로 이동을 눌러 주세요.');
                const draft = lorebookToDraft(source);
                const briefing = lorebookBriefing({ ...o, input, source, draft }, world);
                await toComposerOrSend(briefing, 'send', chatId);
                Object.assign(o, { source, draft, step: 2, openEntries: [], entryMoveOrder: null, pending: null, undo: [], redo: [], recovery: null, registered: null, briefing, chatId });
                if (o.referenceContext.enabled) o.referenceContext.chatId = chatId;
                if (o.currentLorebookContext.enabled) o.currentLorebookContext.chatId = chatId;
                await persist();
                o.notice = '원본과 선택한 참고 자료를 령령에게 보내고 작업용 초안으로 불러왔습니다.';
            });
        },
        request: (kind, mode) => { guarded(() => request(kind, mode)); },
        manual(v) { o.manualText = v; },
        revision(v) { o.revision = v; },
        setEntryAmountMode(v) { if (Object.hasOwn(ENTRY_AMOUNTS, v)) { o.entryAmountMode = v; paint(); } },
        setReferenceContext(on) {
            const id = d.getChatId();
            if (on && !id) { o.error = '참고 자료를 연결할 RP방을 먼저 열어 주세요.'; paint(); return; }
            o.referenceContext = { enabled: !!on, chatId: on ? id : '' }; if (on) o.chatId = id; paint();
        },
        setCurrentLorebookContext(on) {
            const id = d.getChatId();
            if (on && !id) { o.error = '현재 로어북을 연결할 RP방을 먼저 열어 주세요.'; paint(); return; }
            o.currentLorebookContext = { enabled: !!on, chatId: on ? id : '' }; if (on) o.chatId = id; paint();
        },
        importManual: () => {
            guarded(async () => {
                const res = importLorebookText(o.draft, o.manualText);
                pushHistory();
                Object.assign(o, { draft: res.draft, entryMoveOrder: null, pending: null, step: 2 });
                o.notice = `붙여넣은 로어북을 가져왔습니다: 추가 ${res.added}개 · 갱신 ${res.updated}개.` + (res.skipped ? ` 인식하지 못한 항목 ${res.skipped}개는 제외했습니다.` : '') + (res.ignoredDeletions ? ' 붙여넣기의 삭제 지시는 적용하지 않았습니다.' : '');
                await persist();
            });
        },
        importLatest: () => {
            guarded(async () => {
                const chatId = d.getChatId();
                if (!chatId || (o.pending?.chatId && o.pending.chatId !== chatId)) throw new Error('요청을 보낸 령령 RP방을 열어 주세요.');
                if (d.isGenerating()) throw new Error('답변 생성이 끝난 뒤 가져와 주세요.');
                const res = await lib.latestMessage(chatId);
                if (res.generating) throw new Error('답변 생성이 끝난 뒤 가져와 주세요.');
                const last = assertImportable(res.message);
                if (destroyed || chatId !== d.getChatId()) throw new Error('RP방이 변경되었습니다. 다시 가져와 주세요.');
                if (!last) throw new Error('현재 RP방에서 가져올 AI 답변을 찾지 못했습니다.');
                let parsed;
                try { parsed = parseLorebookAnswer(last.content, { allowUnwrapped: true }); } catch { throw new Error('마지막 AI 답변이 로어북 제작실 형식이 아닙니다. 령령의 로어북 최종본 또는 수정본 답변이 마지막에 오도록 한 뒤 다시 가져와 주세요.'); }
                adopt(parsed, chatId);
                await persist();
            });
        },
        toggleTokenSettings() { o.tokenSettingsOpen = !o.tokenSettingsOpen; paint(); },
        setTokenProfile(v) { if (Object.hasOwn(TOKEN_PROFILES, v)) { o.tokenProfile = v; if (rootEl) updateLoreTokens(rootEl, o); } },
        addEntry() { if (o.entryMoveOrder) return; pushHistory(); const e = newEntry(); o.draft.entries.push(e); o.openEntries.push(e.studioId); paint(); },
        toggleEntryMove() { o.entryMoveOrder = o.entryMoveOrder ? null : o.draft.entries.length > 1 ? o.draft.entries.map(e => e.studioId) : null; o.error = ''; paint(); },
        moveEntry(id, delta) {
            const order = o.entryMoveOrder;
            if (!order) return;
            const i = order.indexOf(id), j = i + delta;
            if (i < 0 || j < 0 || j >= order.length) return;
            [order[i], order[j]] = [order[j], order[i]];
            paint();
            [...(rootEl?.querySelectorAll('.mls-entry-move-row') || [])].find(x => x.getAttribute('data-lore-entry') === id)?.scrollIntoView({ block: 'nearest' });
        },
        confirmEntryMove: () => {
            guarded(async () => {
                const order = o.entryMoveOrder;
                if (!order) return;
                const entries = o.draft.entries;
                if (order.length !== entries.length || order.some(k => !entries.some(e => e.studioId === k))) throw new Error('Entry 목록이 변경되었습니다. 이동을 다시 시작해 주세요.');
                const changed = order.some((k, i) => entries[i]?.studioId !== k);
                if (changed) {
                    pushHistory();
                    const map = new Map(o.draft.entries.map(e => [e.studioId, e]));
                    o.draft.entries = order.map((k, i) => { const e = map.get(k); e.data.order = (i + 1) * 10; return e; });
                    await persist();
                }
                o.entryMoveOrder = null;
                o.notice = changed ? 'Entry 순서를 편집 초안에 저장했습니다.' : 'Entry 순서를 유지했습니다.';
            });
        },
        toggle(id) { o.openEntries = o.openEntries.includes(id) ? o.openEntries.filter(x => x !== id) : [...o.openEntries, id]; paint(); },
        entryField(id, field, value) { const e = o.draft.entries.find(x => x.studioId === id); if (e) { setEntryField(e, field, value); o.redo = []; if (field === 'content') tokenLabels(); } },
        duplicate(id) { const e = o.draft.entries.find(x => x.studioId === id); if (e) { pushHistory(); o.draft.entries.push(duplicateEntry(e)); paint(); } },
        remove(id) { pushHistory(); o.draft.entries = o.draft.entries.filter(e => e.studioId !== id); paint(); },
        undo() { if (o.entryMoveOrder || !o.undo.length) return; o.redo = [...o.redo.slice(-19), clone(o.draft)]; o.draft = o.undo.pop(); paint(); },
        redo() { if (o.entryMoveOrder || !o.redo.length) return; o.undo = [...o.undo.slice(-19), clone(o.draft)]; o.draft = o.redo.pop(); paint(); },
        persist: () => { guarded(async () => { await persist(); o.notice = '로어북 작업을 임시 저장했습니다.'; }); },
        clearTemporary: () => {
            guarded(async () => {
                if (!await d.ask('확장에 저장된 로어북 제작실의 작업을 모두 초기화합니다.', { title: '데이터 초기화', confirmLabel: '초기화', variant: 'danger' })) return;
                await storage.patch({ [LOREBOOK_KEY]: null });
                external.cancel();
                Object.assign(o, newLorebookState(), { busy: true });
                savedJson = ''; loader.invalidate();
                await refresh();
                o.notice = '로어북 제작실의 저장된 작업을 모두 초기화했습니다.';
            });
        },
        save: original => {
            guarded(async () => {
                if (o.recovery) throw new Error('이전 저장 결과를 먼저 확인해 주세요. 초안 백업은 계속 사용할 수 있습니다.');
                if (!original && o.registered?.original === false && o.registered.fingerprint === stable(o.draft)) throw new Error('이미 등록된 초안입니다.');
                const draft = clone(o.draft), source = clone(o.source);
                try {
                    const res = await saveLorebook({ api: store, draft, source, original, checkpoint: async j => { o.recovery = j; await persist(); } });
                    if (original) {
                        const fresh = lorebookToDraft(res.snapshot);
                        for (const e of fresh.entries) {
                            const old = o.draft.entries.find(x => (x.sourceId || res.createdEntryIds[x.studioId]) === e.sourceId);
                            if (old) e.studioId = old.studioId;
                        }
                        o.source = res.snapshot; o.draft = fresh;
                    }
                    Object.assign(o, { registered: { id: res.snapshot.book.id, fingerprint: stable(o.draft), original }, recovery: null, pending: null, undo: [] });
                    d.onLibraryChanged('lorebooks');
                    await persist();
                    o.notice = original ? '원본 로어북에 변경 사항을 저장했습니다.' : '새 로어북을 등록했습니다.';
                } catch (e) { if (e.journal) { o.recovery = e.journal; await persist().catch(() => {}); } throw e; }
            });
        },
        download() { downloadFile(exportFile(), `${safeFileName(o.draft.name || '로어북')}.lumiverse.json`); },
        copyJson: () => { guarded(async () => { await d.copy(JSON.stringify(exportFile(), null, 2)); o.notice = '로어북 JSON 전체를 복사했습니다.'; }); },
    };
    const shellHandlers = { close: () => d.close(), switchStudio: k => d.switchStudio(k) };

    return {
        state: o,
        get busy() { return o.busy; },
        async start() { /* state is restored by the studio */ },
        activate() { guarded(refresh); },
        deactivate() { if (tokenTimer) { clearTimeout(tokenTimer); tokenTimer = 0; } rootEl = null; },
        invalidateReferences(kind) { loader.invalidate(); if (!kind || kind === 'lorebooks') o.lorebookEntriesForId = ''; },
        render(root) { rootEl = root; renderLorebookShell(root, o, handlers, shellHandlers); },
        persist,
        cancelExternal: () => external.cancel(),
        async contextForChat(chatId) {
            if (destroyed || !chatId || d.getChatId() !== chatId) return '';
            const bridged = o.chatId === chatId, ref = o.referenceContext.enabled && o.referenceContext.chatId === chatId, cur = o.currentLorebookContext.enabled && o.currentLorebookContext.chatId === chatId;
            if (!bridged && !ref && !cur) return '';
            const parts = [LOREBOOK_BRIDGE];
            if (ref) {
                for (let k = 0; k < 3; k++) {
                    const input = clone(o.input), world = await load(input);
                    if (destroyed || d.getChatId() !== chatId) return '';
                    if (!o.referenceContext.enabled || o.referenceContext.chatId !== chatId) break;
                    if (JSON.stringify(input) !== JSON.stringify(o.input)) { if (k === 2) throw new Error('참고 자료 선택이 계속 변경되어 이번 답변에는 주입하지 못했습니다. 다시 전송해 주세요.'); continue; }
                    parts.push(lorebookReferenceContext({ input, references: world }));
                    break;
                }
            }
            if (cur && (o.draft.name.trim() || o.draft.entries.length)) parts.push(lorebookCurrentContext(o.draft));
            return parts.join('\n\n');
        },
        destroy() { destroyed = true; external.cancel(); if (tokenTimer) clearTimeout(tokenTimer); rootEl = null; },
    };
}
