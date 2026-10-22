// 령령의 제작실 (Lumiverse) — the frontend's link to the backend and the library adapters the original code expects.
// The original talked to Marinara's REST API (characters / personas / lorebooks / latest chat message) through `Wn()`
// and `Pn()`; here the same methods call the backend (src/service.js) over Spindle's frontend <-> backend channel.

const uid = () => {
    try { const c = globalThis.crypto; if (c && typeof c.randomUUID === 'function') return c.randomUUID(); } catch { /* insecure origin */ }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export function createHost(ctx, { timeoutMs = 120000 } = {}) {
    const pending = new Map();
    const listeners = new Set();
    let alive = true;
    const off = ctx.onBackendMessage(msg => {
        if (!alive || !msg) return;
        if (msg.event) { for (const fn of [...listeners]) fn(msg); return; }
        const p = pending.get(msg.requestId);
        if (!p) return;
        pending.delete(msg.requestId);
        clearTimeout(p.timer);
        if (msg.ok) p.resolve(msg); else p.reject(Object.assign(new Error(msg.error || '요청을 처리하지 못했습니다.'), { backend: true }));
    });

    function rpc(type, payload = {}) {
        if (!alive) return Promise.reject(new Error('확장이 종료됐어요'));
        const requestId = uid() + ':' + type;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('서버 응답이 없어요. 잠시 뒤 다시 시도해 주세요.')); }, timeoutMs);
            pending.set(requestId, { resolve, reject, timer });
            try { ctx.sendToBackend({ requestId, type, ...payload }); } catch (e) { pending.delete(requestId); clearTimeout(timer); reject(e); }
        });
    }

    // small cache, like the original's library cache (promise per list; dropped on failure and on demand)
    const cache = new Map();
    function cached(key, make) {
        if (!cache.has(key)) {
            const p = make().catch(e => { if (cache.get(key) === p) cache.delete(key); throw e; });
            cache.set(key, p);
        }
        return cache.get(key);
    }

    /** The original's `Wn()` surface (reads, creates, updates), on top of the backend. */
    const library = {
        invalidateLibrary: key => { if (key) cache.delete(key); else cache.clear(); },
        health: async () => (await rpc('chat')).health || { status: 'ok' },
        characters: signal => (signal ? rpc('characters').then(r => r.list) : cached('characters', () => rpc('characters').then(r => r.list))),
        character: id => rpc('character', { id }).then(r => ({ id: r.id, name: r.name, data: r.data })),
        personas: signal => (signal ? rpc('personas').then(r => r.list) : cached('personas', () => rpc('personas').then(r => r.list))),
        persona: id => rpc('persona', { id }).then(({ ok, requestId, ...p }) => p),
        lorebooks: signal => (signal ? rpc('lorebooks').then(r => r.list) : cached('lorebooks', () => rpc('lorebooks').then(r => r.list))),
        lorebookEntries: id => rpc('lorebookEntries', { id }).then(r => r.list),
        latestMessage: chatId => rpc('latest', { chatId }).then(r => ({ message: r.message, generating: r.generating })),
        createCharacter: data => rpc('createCharacter', { data }).then(r => ({ id: r.id, name: r.name })),
        updateCharacter: (id, data) => rpc('updateCharacter', { id, data }).then(r => ({ id: r.id, name: r.name, data: r.data })),
        createPersona: persona => rpc('createPersona', { persona }).then(({ ok, requestId, ...p }) => p),
        updatePersona: (id, patch) => rpc('updatePersona', { id, patch }).then(({ ok, requestId, ...p }) => p),
    };

    /** The original's `Pn()` surface (lorebook read / write used by the save journal). */
    const lorebookApi = {
        read: id => rpc('lorebookRead', { id }).then(({ book, entries, folders }) => ({ book, entries, folders })),
        createBook: data => rpc('createBook', { name: data.name, description: data.description }).then(r => ({ id: r.id })),
        updateBook: (id, patch) => rpc('updateBook', { id, patch }).then(r => ({ id: r.id })),
        createEntry: (bookId, entry) => rpc('createEntry', { bookId, entry }).then(r => ({ id: r.id })),
        updateEntry: (bookId, id, changes) => rpc('updateEntry', { bookId, id, changes }).then(r => ({ id: r.id })),
        deleteEntry: (bookId, id) => rpc('deleteEntry', { bookId, id }).then(() => {}),
        // Lumiverse world books have no folders (the library adapter never returns any, so this is not reached)
        createFolder: async () => { throw new Error('루미버스 월드북에는 폴더가 없습니다.'); },
    };

    return {
        rpc, library, lorebookApi,
        onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        dispose() { alive = false; try { off?.(); } catch { /* ignore */ } for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('확장이 종료됐어요')); } pending.clear(); listeners.clear(); },
    };
}
