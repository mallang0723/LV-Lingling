import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service.js';
import { start } from '../src/backend.js';
import { fake } from './fake.js';
import { NS } from '../src/mapping.js';
import { xt, At } from '../src/original/logic.js';

const U = 'user-1';
const mk = (opts, setup) => { const f = fake(opts); setup?.(f); const s = createService(f.api); s.attach(); return { f, s, run: (req, user = U) => s.run({ requestId: 'r', ...req }, user) }; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const card = (over = {}) => xt({ ...At(), name: '하루', description: '빵집 사장', backstory: '물려받음', appearance: '앞치마', ...over });

test('bootstrap: permissions, active chat with its character, connections, settings', async () => {
    const { run } = mk();
    const r = await run({ type: 'bootstrap' });
    assert.equal(r.perms.characters, true);
    assert.deepEqual(r.chat, { chatId: 'chat-a', name: '령령방', characterId: 'char-ling', characterName: '{{char}}', group: false });
    assert.equal(r.connections.length, 2);
    assert.deepEqual(r.settings, { connectionId: '', fold: true });
});

test('every host call carries the user id (operator-scoped installs)', async () => {
    const { run } = mk();
    await run({ type: 'characters' }); await run({ type: 'personas' }); await run({ type: 'lorebooks' }); await run({ type: 'lorebookEntries', id: 'wb-town' });
    await run({ type: 'character', id: 'char-haru' }); await run({ type: 'persona', id: 'p-user' }); await run({ type: 'bootstrap' });
    // the fake throws "userId is required" otherwise
    await assert.rejects(() => run({ type: 'bootstrap' }, ''), /사용자 정보/);
});

test('lists are read page by page (200 max) until everything is there', async () => {
    const { run } = mk({ manyCharacters: 450 });
    const r = await run({ type: 'characters' });
    assert.equal(r.list.length, 452);
    assert.deepEqual(r.list.slice(0, 2).map(c => c.name), ['{{char}}', '하루']);
});

test('character read returns the Marinara-shaped data; create folds and snapshots', async () => {
    const { f, run } = mk();
    const made = await run({ type: 'createCharacter', data: card() });
    const stored = f.characters.get(made.id);
    assert.equal(stored.description, '빵집 사장\n\n## 배경 이야기\n물려받음\n\n## 외모\n앞치마');
    assert.equal(stored.extensions[NS].fields.backstory, '물려받음');
    const back = await run({ type: 'character', id: made.id });
    assert.equal(back.data.extensions.backstory, '물려받음');
    assert.equal(back.data.description, '빵집 사장');
});

test('the fold setting can be switched off (saved on change)', async () => {
    const { f, run } = mk();
    await run({ type: 'setting', key: 'fold', value: false });
    const made = await run({ type: 'createCharacter', data: card() });
    assert.equal(f.characters.get(made.id).description, '빵집 사장');
    assert.equal(f.store.get(`${U}:settings.json`).fold, false);
    await assert.rejects(() => run({ type: 'setting', key: 'nope', value: 1 }), /알 수 없는 설정/);
});

test('character update: only changed native fields, extensions shallow-merged (world_book_ids and others survive)', async () => {
    const { f, run } = mk();
    const made = await run({ type: 'createCharacter', data: card() });
    f.characters.get(made.id).extensions.world_book_ids = ['wb-ling'];
    f.characters.get(made.id).extensions.talkativeness = 0.5;
    const r = await run({ type: 'updateCharacter', id: made.id, data: { personality: '다정', extensions: { appearance: '앞치마, 안경' } } });
    const c = f.characters.get(made.id);
    assert.equal(c.personality, '다정');
    assert.match(c.description, /## 외모\n앞치마, 안경/);
    assert.deepEqual(c.extensions.world_book_ids, ['wb-ling']);
    assert.equal(c.extensions.talkativeness, 0.5);
    assert.equal(r.data.extensions.appearance, '앞치마, 안경');
    const sent = f.state.calls.filter(x => x.name === 'characters.update').at(-1).args[1];
    assert.ok(!('first_mes' in sent) && !('name' in sent), 'unchanged fields are not sent');
});

test('persona create/update: metadata of other extensions is kept, snapshot restores the six fields', async () => {
    const { f, run } = mk();
    const made = await run({ type: 'createPersona', persona: { name: '나', description: '평범', personality: '조용', backstory: '', appearance: '', scenario: '' } });
    assert.equal(made.personality, '조용');
    const p = f.personas.get(made.id);
    assert.match(p.description, /## 성격\n조용/);
    p.metadata.other_ext = { keep: 1 };
    const upd = await run({ type: 'updatePersona', id: made.id, patch: { appearance: '안경' } });
    assert.equal(upd.appearance, '안경');
    assert.equal(upd.personality, '조용');
    assert.deepEqual(f.personas.get(made.id).metadata.other_ext, { keep: 1 });
});

test('lorebook: read, create book + entries, patch, delete, description in the extension namespace', async () => {
    const { f, run } = mk();
    const read = await run({ type: 'lorebookRead', id: 'wb-town' });
    assert.deepEqual(read.entries.map(e => e.id), ['e2', 'e1', 'e3'], 'sorted by order_value');
    assert.equal(read.entries[1].description, '가게');
    assert.equal(read.entries[2].enabled, false);
    assert.deepEqual(read.folders, []);
    const { id: bookId } = await run({ type: 'createBook', name: '새 북', description: '설명' });
    const a = await run({ type: 'createEntry', bookId, entry: { name: 'A', keys: ['a'], content: 'AA', description: '요약A', constant: false, selective: false } });
    const b = await run({ type: 'createEntry', bookId, entry: { name: 'B', keys: [], content: 'BB', constant: true, selective: false } });
    const ea = f.entries.get(bookId).find(e => e.id === a.id), eb = f.entries.get(bookId).find(e => e.id === b.id);
    assert.equal(ea.comment, 'A'); assert.deepEqual(ea.key, ['a']); assert.equal(eb.constant, true);
    assert.ok(ea.order_value < eb.order_value, 'entries keep their draft order');
    assert.deepEqual(ea.extensions[NS], { description: '요약A' });
    await run({ type: 'updateEntry', bookId, id: a.id, changes: { content: 'AA2', description: '요약A2' } });
    assert.equal(ea.content, 'AA2'); assert.equal(ea.extensions[NS].description, '요약A2');
    assert.equal(ea.comment, 'A', 'untouched fields stay');
    await run({ type: 'updateBook', id: bookId, patch: { name: '바뀐 북' } });
    assert.equal(f.books.get(bookId).name, '바뀐 북');
    await run({ type: 'deleteEntry', bookId, id: b.id });
    assert.equal(f.entries.get(bookId).length, 1);
});

test('send: the request goes into the open chat, hidden, with the picked connection; reply tracked', async () => {
    const { f, run } = mk();
    await run({ type: 'setting', key: 'connectionId', value: 'conn-b' });
    const r = await run({ type: 'send', chatId: 'chat-a', text: '[MARINARA_STUDIO_EXPORT]\n본문', kind: 'export' });
    assert.ok(r.generationId);
    const a = f.appended.at(-1);
    assert.equal(a.message.role, 'user');
    assert.match(a.message.content, /csm-hidden-prompt/);
    assert.equal(a.message.metadata.source, 'lingling_studio_lv');
    assert.deepEqual(a.options, { triggerGeneration: true, generation: { connection_id: 'conn-b' } });
    assert.equal((await run({ type: 'latest', chatId: 'chat-a' })).generating, true);
    await assert.rejects(() => run({ type: 'send', chatId: 'chat-a', text: '또' }), /끝난 뒤/);
    await wait(30);
    const last = await run({ type: 'latest', chatId: 'chat-a' });
    assert.equal(last.generating, false);
    assert.equal(last.message.role, 'assistant');
    assert.equal(last.message.content, '령령: 오오, 좋은데?');
    const ev = f.sent.map(x => x.msg).filter(m => m.event === 'generation');
    assert.deepEqual(ev.map(e => e.state), ['started', 'ended']);
});

test('send: errors and stops are reported; a failed generation does not leave the chat locked', async () => {
    const { f, run } = mk();
    f.state.replyError = 'API 오류';
    await run({ type: 'send', chatId: 'chat-a', text: 'x' });
    await wait(30);
    assert.equal(f.sent.map(x => x.msg).filter(m => m.event === 'generation').at(-1).state, 'error');
    assert.equal((await run({ type: 'latest', chatId: 'chat-a' })).generating, false);
    f.emit('GENERATION_STARTED', { chatId: 'chat-a', generationId: 'g9' });
    assert.equal((await run({ type: 'latest', chatId: 'chat-a' })).generating, true);
    f.emit('GENERATION_STOPPED', { chatId: 'chat-a', generationId: 'g9' });
    assert.equal((await run({ type: 'latest', chatId: 'chat-a' })).generating, false);
});

test('send: needs the permissions and refuses an empty request', async () => {
    const { f, run } = mk();
    await assert.rejects(() => run({ type: 'send', chatId: 'chat-a', text: '   ' }), /내용이 없/);
    await assert.rejects(() => run({ type: 'send', chatId: 'nope', text: 'x' }), /채팅을 찾을 수 없어요/);
    f.state.denied.push('generation');
    await assert.rejects(() => run({ type: 'send', chatId: 'chat-a', text: 'x' }), /generation/);
});

test('storage: patch merges keys, null deletes, per user', async () => {
    const { run } = mk();
    await run({ type: 'storagePatch', patch: { a: { x: 1 }, b: 2 } });
    await run({ type: 'storagePatch', patch: { b: null, c: 3 } });
    assert.deepEqual((await run({ type: 'storageGet' })).value, { a: { x: 1 }, c: 3 });
    assert.deepEqual((await run({ type: 'storageGet' }, 'user-2')).value, {});
});

test('standing context: registered per chat, applied by the interceptor, cleared again', async () => {
    const { f, run } = mk();
    const prompt = [{ role: 'user', content: '안녕', __isChatHistory: true }];
    assert.equal((await f.intercept(prompt, { chatId: 'chat-a', generationType: 'normal' })).length, 1);
    await run({ type: 'inject', chatId: 'chat-a', conversation: 'CONTEXT', export: '' });
    const out = await f.intercept(prompt, { chatId: 'chat-a', generationType: 'normal' });
    assert.deepEqual(out.map(m => m.content), ['CONTEXT', '안녕']);
    assert.equal((await f.intercept(prompt, { chatId: 'chat-b', generationType: 'normal' })).length, 1, 'other chats untouched');
    await run({ type: 'inject', chatId: null });
    assert.equal((await f.intercept(prompt, { chatId: 'chat-a', generationType: 'normal' })).length, 1);
});

test('interceptor registers when the permission arrives later; stop() takes everything down', async () => {
    const f = fake({ deny: ['interceptor'] });
    const s = createService(f.api);
    s.attach();
    assert.equal(f.interceptors.length, 0);
    f.api.permissions.has = () => true;
    s.onPermissionChanged();
    assert.equal(f.interceptors.length, 1);
    s.stop();
    assert.equal(f.interceptors.length, 0);
});

test('backend entry: replies to the asking user and session; declares the tag capability', async () => {
    const f = fake();
    const stop = start(f.api);
    assert.equal(f.api.declared, 'message_tag_interceptor');
    await f.frontendHandler({ requestId: 'q1', type: 'chat' }, 'u9', 'sess-1');
    const reply = f.sent.find(s => s.msg.requestId === 'q1');
    assert.equal(reply.user, 'u9'); assert.deepEqual(reply.o, { frontendSessionId: 'sess-1' });
    assert.equal(reply.msg.ok, true);
    await f.frontendHandler({ requestId: 'q2', type: 'zzz' }, 'u9');
    assert.equal(f.sent.find(s => s.msg.requestId === 'q2').msg.ok, false);
    stop();
});
