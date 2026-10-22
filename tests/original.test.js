// The original's logic (src/original/logic.js, copied as-is) behaves the way the 령령 card expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/original/logic.js';

const draft = () => ({ ...L.At(), name: '하루', description: '빵집 {{user}}', personality: '무뚝뚝', backstory: '물려받음', appearance: '앞치마', scenario: '가을', firstMessage: '어서 와 {{user}}', exampleDialogue: '<START>\n{{user}}: 안녕\n{{char}}: …응', alternateGreetings: ['대체 1', '대체 2'] });

test('character export packet -> draft (every field block, alternate greetings split on ---)', () => {
    const blocks = L.ce.map(([tag, key]) => `[${tag}]\n${key === 'name' ? '하루' : `${key} 내용`}\n[/${tag}]`).join('\n');
    const text = `<<<MARINARA_CHARACTER_EXPORT_V1>>>\n${blocks}\n[ALTERNATE_GREETINGS]\n하나\n---\n둘\n[/ALTERNATE_GREETINGS]\n<<<END_MARINARA_CHARACTER_EXPORT_V1>>>`;
    const r = L.ct(text);
    assert.equal(r.draft.name, '하루');
    assert.equal(r.draft.firstMessage, 'firstMessage 내용');
    assert.deepEqual(r.draft.alternateGreetings, ['하나', '둘']);
    assert.deepEqual(r.missing, []);
    assert.equal(r.wrapped, true);
});
test('character patch v2 (only changed blocks) and unwrapped fields with allowUnwrappedPatch', () => {
    const r = L.ct('<<<MARINARA_CHARACTER_PATCH_V2>>>\n[PERSONALITY]\n다정\n[/PERSONALITY]\n<<<END_MARINARA_CHARACTER_PATCH_V2>>>');
    assert.deepEqual(r.draft, { personality: '다정' });
    assert.equal(r.packetKind, 'patch-v2');
    assert.throws(() => L.ct('아무 말'), /찾지 못했습니다/);
    assert.deepEqual(L.ct('[PERSONALITY]\n다정\n[/PERSONALITY]', { allowUnwrappedPatch: true }).draft, { personality: '다정' });
});
test('dispatcher refuses the other studios\' answers', () => {
    assert.throws(() => L.pn('<<<MARINARA_PERSONA_EXPORT_V1>>>'), /페르소나 제작실의 응답/);
    assert.throws(() => L.pn('<<<MARINARA_LOREBOOK_EXPORT_V1>>>\n{}\n<<<END_MARINARA_LOREBOOK_EXPORT_V1>>>'), /로어북 제작실의 응답/);
    assert.throws(() => L.hn('<<<MARINARA_CHARACTER_EXPORT_V1>>>'), /다른 제작실의 응답/);
    assert.throws(() => L.cn('<<<MARINARA_PERSONA_EXPORT_V1>>>'), /다른 제작실의 응답/);
});
test('persona export needs all six blocks; a patch may hold some', () => {
    const six = ['NAME', 'DESCRIPTION', 'PERSONALITY', 'BACKSTORY', 'APPEARANCE', 'SCENARIO'].map(t => `[${t}]\n${t.toLowerCase()}\n[/${t}]`).join('\n');
    const ok = L.hn(`<<<MARINARA_PERSONA_EXPORT_V1>>>\n${six}\n<<<END_MARINARA_PERSONA_EXPORT_V1>>>`);
    assert.equal(ok.draft.scenario, 'scenario');
    assert.throws(() => L.hn('<<<MARINARA_PERSONA_EXPORT_V1>>>\n[NAME]\n나\n[/NAME]\n<<<END_MARINARA_PERSONA_EXPORT_V1>>>'), /블록이 빠졌습니다/);
    const patch = L.hn('<<<MARINARA_PERSONA_PATCH_V1>>>\n[APPEARANCE]\n안경\n[/APPEARANCE]\n<<<END_MARINARA_PERSONA_PATCH_V1>>>');
    assert.deepEqual(patch.draft, { appearance: '안경' });
    assert.throws(() => L.hn('<<<MARINARA_PERSONA_EXPORT_V1>>>\n[NAME]\n나'), /잘렸거나/);
});
test('request builders carry the markers the 령령 card routes on', () => {
    const c = L.tr, p = L.Yt;
    const input = { mode: 'free', gender: '여', age: '27세', keywords: ['달달'], idea: '사서', wants: '' };
    assert.match(c.buildStudioBriefing({ input }), /^\[MARINARA_STUDIO_REFERENCE\]/);
    assert.match(c.buildExportRequest('standard', 'markdown'), /^\[MARINARA_STUDIO_EXPORT\]/);
    assert.match(c.buildExportRequest('detailed', 'prose'), /\[STUDIO_OUTPUT_FORMAT:PROSE\]/);
    assert.match(c.buildExportRequest('standard', 'markdown'), /<<<MARINARA_CHARACTER_EXPORT_V1>>>[\s\S]*<<<END_MARINARA_CHARACTER_EXPORT_V1>>>/);
    assert.match(c.buildRevisionRequest({ instruction: '성격을 다정하게', draft: draft() }), /^\[MARINARA_STUDIO_REVISION\][\s\S]*MARINARA_CHARACTER_PATCH_V2[\s\S]*\[CURRENT_CHARACTER\]/);
    assert.throws(() => c.buildRevisionRequest({ instruction: ' ', draft: draft() }), /수정 요청 내용/);
    assert.match(p.buildStudioBriefing({ input }), /^\[MARINARA_PERSONA_STUDIO_BRIEFING\]/);
    assert.match(p.buildExportRequest('standard', 'markdown'), /^\[MARINARA_PERSONA_STUDIO_EXPORT\]/);
    assert.match(p.buildCurrentDraftContext({ name: '나', description: 'd', personality: '', backstory: '', appearance: '', scenario: '' }), /^\[MARINARA_PERSONA_STUDIO_CURRENT_CONTEXT\]/);
    assert.match(c.buildCurrentDraftContext(draft()), /^\[MARINARA_STUDIO_CURRENT_CONTEXT\]/);
    assert.match(c.buildSelectedReferenceContext({ input, worldContext: '참고' }), /^\[MARINARA_STUDIO_SELECTED_REFERENCE\]/);
});
test('{{user}} / {{char}} go through verbatim, other macros are protected and restored', () => {
    const d = { description: '{{user}}와 {{char}}는 {{getvar::mood}} 상태', name: '하루' };
    const out = L.tr.buildRevisionRequest({ instruction: 'x', draft: d });
    assert.ok(out.includes('{{user}}와 {{char}}는'), 'user/char stay literal');
    assert.ok(!out.includes('{{getvar::mood}}'), 'other macros are replaced by a protected token');
    assert.match(out, /\[\[MCS_RP_MACRO_[0-9a-f_]+\]\]/);
    const prot = L.J(d);
    const back = prot.restoreDraft(prot.draft);
    assert.deepEqual(back, d);
    assert.equal(L.ht('[[MCS_RP_USER]] [[MCS_RP_CHAR]]'), '{{user}} {{char}}');
});
test('character card shape and the original\'s edit conflict check', () => {
    const card = L.xt(draft(), ['달달']);
    assert.equal(card.first_mes, '어서 와 {{user}}');
    assert.equal(card.extensions.backstory, '물려받음');
    assert.deepEqual(card.tags, ['달달']);
    assert.throws(() => L.kt({ ...card, name: '' }), /이름을 입력/);
    const orig = draft(), edited = { ...orig, personality: '다정' };
    assert.deepEqual(L.xn(edited, orig, L.xt(orig)), { personality: '다정' });
    const cur = L.xt({ ...orig, personality: '바깥에서 바뀜' });
    assert.throws(() => L.xn(edited, orig, cur), /다른 곳에서 변경/);
});
test('persona edit conflict check', () => {
    const orig = { name: '나', description: 'a', personality: '', backstory: '', appearance: '', scenario: '' };
    assert.deepEqual(L.mn({ ...orig, appearance: '안경' }, orig, orig), { appearance: '안경' });
    assert.throws(() => L.mn({ ...orig, description: 'b' }, orig, { ...orig, description: 'c' }), /다른 곳에서 변경/);
});
test('lorebook export / revision packets: parse, apply to the draft, refuse a stale draft', () => {
    const state = L.jt();
    state.draft = { name: '북', description: '', entries: [Object.assign(L.Ae({ name: '빵집', keys: ['빵집'], content: '내용' }), { studioId: 'ls-1', sourceId: 'e1' })] };
    state.input.mode = 'edit';
    const req = L.an(state, 'revision', 'chat-1');
    assert.match(req.text, /^\[MARINARA_LOREBOOK_STUDIO_REVISION\]/);
    assert.equal(req.pending.kind, 'revision');
    const answer = `<<<MARINARA_LOREBOOK_REVISION_V1>>>\n${JSON.stringify({ updates: [{ id: 'ls-1', content: '고친 내용' }], additions: [{ name: '새 항목', type: 'constant', keys: [], content: '새 본문' }], deletions: [] })}\n<<<END_MARINARA_LOREBOOK_REVISION_V1>>>`;
    const parsed = L.cn(answer);
    assert.equal(parsed.kind, 'revision');
    const next = L.ln(state.draft, parsed, req.pending, 'chat-1');
    assert.equal(next.entries[0].data.content, '고친 내용');
    assert.equal(next.entries[1].data.constant, true);
    assert.throws(() => L.ln(state.draft, parsed, req.pending, 'chat-2'), /방과 현재 방이 다릅니다/);
    assert.throws(() => L.ln({ ...state.draft, name: '바뀜' }, parsed, req.pending, 'chat-1'), /초안이 변경되었습니다/);
    assert.throws(() => L.cn('<<<MARINARA_LOREBOOK_EXPORT_V1>>>\n{ "name":'), /찾지 못했|완전한/);
});
test('lorebook export keeps every existing entry id and refuses a packet that drops one', () => {
    const state = L.jt();
    state.draft = { name: '북', description: '', entries: [Object.assign(L.Ae({ name: 'A', keys: ['a'] }), { studioId: 'ls-1' }), Object.assign(L.Ae({ name: 'B' }), { studioId: 'ls-2' })] };
    const req = L.an(state, 'export', 'c');
    const packet = body => `<<<MARINARA_LOREBOOK_EXPORT_V1>>>\n${JSON.stringify(body)}\n<<<END_MARINARA_LOREBOOK_EXPORT_V1>>>`;
    const keep = L.cn(packet({ name: '북', description: 'd', entries: [{ id: 'ls-1', name: 'A', type: 'normal', keys: ['a'], content: '1' }, { id: 'ls-2', name: 'B', type: 'normal', keys: [], content: '2' }] }));
    assert.equal(L.ln(state.draft, keep, req.pending, 'c').description, 'd');
    const drop = L.cn(packet({ name: '북', entries: [{ id: 'ls-1', name: 'A', type: 'normal', keys: ['a'], content: '1' }] }));
    assert.throws(() => L.ln(state.draft, drop, req.pending, 'c'), /기존 Entry가 누락/);
});
test('pasted lorebook text in several shapes', () => {
    const empty = { name: '', description: '', entries: [] };
    const a = L.un(empty, JSON.stringify({ name: 'X', entries: [{ name: 'a', keys: 'k1, k2', content: 'c' }] }));
    assert.equal(a.added, 1); assert.deepEqual(a.draft.entries[0].data.keys, ['k1', 'k2']);
    const b = L.un(empty, '이름: 빵집\n주요 키: 빵집, 하루\n본문: 30년 된 빵집\n\n이름: 축제\n본문: 사흘');
    assert.equal(b.added, 2);
    assert.throws(() => L.un(empty, '그냥 글'), /가져올 로어북 항목을 찾지 못했습니다/);
});
test('lorebook diff against the original book: patches, additions, deletions', () => {
    const source = { book: { id: 'b', name: 'N', description: '' }, entries: [{ id: 'e1', name: 'a', keys: [], content: 'x', description: '', constant: false, selective: false, order: 10 }, { id: 'e2', name: 'b', keys: [], content: 'y', description: '', constant: false, selective: false, order: 20 }], folders: [] };
    const d = L.Bt(source);
    d.entries[0].data.content = 'x2';
    d.entries.pop();
    d.entries.push(L.Ae({ name: 'c' }));
    const diff = L.mt(d, source);
    assert.deepEqual(diff.patches, [{ id: 'e1', changes: { content: 'x2' } }]);
    assert.equal(diff.additions.length, 1);
    assert.deepEqual(diff.deletions, ['e2']);
    assert.deepEqual(L.ft({ name: '', entries: [] }), ['로어북 이름을 1~200자로 입력해 주세요.']);
});
test('token estimate and the "last message must be a finished assistant answer" check', () => {
    assert.ok(L._n('가나다라마바사 안녕하세요', 'gemini') > 5);
    assert.equal(L._n('', 'gpt'), 0);
    assert.throws(() => L.Ze({ role: 'user', content: 'x' }), /가져올 AI 답변이 없습니다/);
    assert.throws(() => L.Ze({ role: 'assistant', content: '<<<MARINARA_CHARACTER_EXPORT_V1>>>\n[NAME]\na' }), /완성되지 않았습니다/);
    assert.ok(L.Ze({ role: 'assistant', content: '그냥 대화' }));
});
test('external material: fandom link rules and the size limits', () => {
    assert.equal(L.qo('https://haru.fandom.com/wiki/Haru_Kim').title, 'Haru Kim');
    assert.throws(() => L.qo('https://namu.wiki/w/하루'), /팬덤 위키만/);
    assert.throws(() => L.qo('http://haru.fandom.com/wiki/X'), /HTTPS/);
    const ext = L.dt({ urls: 'u', documents: Array.from({ length: 7 }, (_, i) => ({ title: 't' + i, text: 'x'.repeat(70000) })) });
    assert.equal(ext.documents.length, 5);
    assert.ok(ext.documents.every(x => new TextEncoder().encode(x.text).length <= 60000));
    assert.throws(() => L.Ie({ external: { documents: [] } }, { required: true }), /외부 자료의 본문/);
});
test('draft state round trip (the temporary save)', () => {
    const s = L.We();
    s.draft = { ...s.draft, name: '하루' };
    s.step = 2;
    const saved = JSON.parse(JSON.stringify(L.Rn(s)));
    const t = L.We();
    assert.equal(L.er(t, saved), true);
    assert.equal(t.draft.name, '하루'); assert.equal(t.step, 2);
    assert.equal(L.er(L.We('persona'), saved), false, 'a character draft is not restored into the persona studio');
    const lore = L.jt(); lore.draft.name = '북';
    const lt = L.jt();
    assert.equal(L.zr(lt, JSON.parse(JSON.stringify(L.qt(lore)))), true);
    assert.equal(lt.draft.name, '북');
});
