// The original's lorebook save journal ($n) and reference loader (vt) running against the Lumiverse backend through the
// frontend's host adapter (src/host.js): no changes to the original code, only the adapter in between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service.js';
import { createHost } from '../src/host.js';
import { fake } from './fake.js';
import * as L from '../src/original/logic.js';

function link() {
    const f = fake(), service = createService(f.api);
    let toFrontend = null;
    const ctx = {
        onBackendMessage(fn) { toFrontend = fn; return () => {}; },
        sendToBackend(m) { service.run(m, 'u1').then(r => toFrontend({ ok: true, requestId: m.requestId, ...r }), e => toFrontend({ ok: false, requestId: m.requestId, error: e.message })); },
    };
    return { f, host: createHost(ctx, { timeoutMs: 2000 }) };
}

test('save as a new world book: entries in draft order, types and descriptions kept, read-back verified', async () => {
    const { f, host } = link();
    const draft = { name: '새 북', description: '설명', entries: [
        L.Ae({ name: '빵집', keys: ['빵집'], content: 'A', description: '요약' }),
        L.Ae({ name: '계절', constant: true, content: 'B' }),
        L.Ae({ name: '축제', selective: true, keys: ['축제'], content: 'C' }),
    ] };
    const res = await L.$n({ api: host.lorebookApi, draft, source: null, original: false });
    const book = [...f.books.values()].find(b => b.id === res.snapshot.book.id);
    assert.equal(book.name, '새 북');
    const e = f.entries.get(book.id);
    assert.deepEqual(e.map(x => x.comment), ['빵집', '계절', '축제']);
    assert.deepEqual(e.map(x => [x.constant, x.selective]), [[false, false], [true, false], [false, true]]);
    assert.equal(e[0].extensions.lingling_studio_lv.description, '요약');
    assert.ok(e[0].order_value < e[1].order_value && e[1].order_value < e[2].order_value);
    assert.equal(res.snapshot.entries.length, 3);
});

test('save to the original: only changed fields are written, additions and deletions applied', async () => {
    const { f, host } = link();
    const source = await host.lorebookApi.read('wb-town');
    assert.deepEqual(source.entries.map(x => x.id), ['e2', 'e1', 'e3']);
    const draft = L.Bt(source);
    draft.entries[1].data.content = '고친 빵집 내용';
    draft.entries.splice(2, 1);                                  // delete e3
    draft.entries.push(L.Ae({ name: '새 항목', content: 'N' }));
    f.state.calls.length = 0;
    const res = await L.$n({ api: host.lorebookApi, draft, source, original: true });
    const calls = f.state.calls.map(c => c.name);
    assert.deepEqual(calls.filter(n => n === 'entries.update').length, 1);
    assert.equal(f.state.calls.find(c => c.name === 'entries.update').args[1].content, '고친 빵집 내용');
    assert.ok(!('key' in f.state.calls.find(c => c.name === 'entries.update').args[1]), 'untouched keys are not rewritten (secondary keys / selective logic survive)');
    const after = f.entries.get('wb-town');
    assert.deepEqual(after.map(x => x.id).includes('e3'), false);
    assert.equal(after.find(x => x.id === 'e1').keysecondary[0], '하루');
    assert.equal(after.length, 3);
    assert.equal(res.snapshot.entries.length, 3);
});

test('save to the original refuses when the book changed since it was loaded', async () => {
    const { f, host } = link();
    const source = await host.lorebookApi.read('wb-town');
    const draft = L.Bt(source);
    draft.entries[0].data.content = '내 수정';
    f.entries.get('wb-town')[0].content = '바깥에서 수정';
    f.entries.get('wb-town')[0].updated_at = 99;
    await assert.rejects(() => L.$n({ api: host.lorebookApi, draft, source, original: true }), e => e.name === 'ConflictError');
    assert.equal(f.entries.get('wb-town')[0].content, '바깥에서 수정');
});

test('a half-finished save carries a journal (so the studio blocks a blind retry)', async () => {
    const { f, host } = link();
    const api = { ...host.lorebookApi, createEntry: async (...a) => { if (f.entries.get(a[0]).length >= 1) throw new Error('서버 오류'); return host.lorebookApi.createEntry(...a); } };
    const draft = { name: '북', description: '', entries: [L.Ae({ name: 'a' }), L.Ae({ name: 'b' })] };
    await assert.rejects(() => L.$n({ api, draft, source: null, original: false }), e => e.journal?.completed.length === 2 && !!e.journal.target);
});

test('reference loader: lorebook entries, characters and personas become the original\'s reference text', async () => {
    const { host } = link();
    const loader = L.vt({ api: host.library, getLorebooks: () => [], getEntries: () => [], getEntriesForId: () => '' });
    const text = await loader.load({ mode: 'world', referenceKind: 'internal', lorebookId: 'wb-town', lorebookEntryIds: ['e1', 'e2'], characterIds: ['char-haru'], personaIds: ['p-user'] });
    assert.match(text, /^로어북: 동네 로어/);
    assert.match(text, /항목 2: 빵집\n30년 된 빵집\./);
    assert.match(text, /캐릭터: 하루\n설명: 빵집 사장\n성격: 무뚝뚝/);
    assert.match(text, /페르소나: \{\{user\}\}\n설명: 나/);
    assert.equal(await loader.load({ mode: 'free' }), '');
});

test('host adapter: backend errors surface with their message; a silent backend times out', async () => {
    const { host } = link();
    await assert.rejects(() => host.library.character('nope'), /선택한 캐릭터를 읽을 수 없습니다/);
    const dead = createHost({ onBackendMessage: () => () => {}, sendToBackend() {} }, { timeoutMs: 30 });
    await assert.rejects(() => dead.rpc('chat'), /서버 응답이 없어요/);
});
