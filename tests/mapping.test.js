import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    NS, fold, cardToLvCharacter, lvCharacterToData, characterPatchToLv, characterCardFile, lvPersonaToStudio, studioToLvPersona,
    personaPatchToLv, lvEntryToStudio, studioEntryToLv, lorebookFile,
} from '../src/mapping.js';
import { xt, Zt, xn, At } from '../src/original/logic.js';

const draft = () => ({ ...At(), name: '하루', description: '빵집 사장', personality: '무뚝뚝', backstory: '물려받음', appearance: '앞치마', scenario: '가을', firstMessage: '어서 와', exampleDialogue: '<START>', alternateGreetings: ['대체'], conversationDisplayName: '하루 ', aboutMe: '빵', conversationBehavior: '짧게' });

test('fold: sections only for non-empty extras', () => {
    assert.equal(fold('설명', [['외모', ''], ['성격', ' 차분 ']]), '설명\n\n## 성격\n차분');
    assert.equal(fold('', [['외모', '키 큼']]), '## 외모\n키 큼');
});

test('character: studio card -> Lumiverse input folds backstory/appearance and keeps a snapshot', () => {
    const lv = cardToLvCharacter(xt(draft()), { now: 5 });
    assert.equal(lv.name, '하루');
    assert.equal(lv.description, '빵집 사장\n\n## 배경 이야기\n물려받음\n\n## 외모\n앞치마');
    assert.equal(lv.first_mes, '어서 와');
    assert.equal(lv.mes_example, '<START>');
    assert.deepEqual(lv.alternate_greetings, ['대체']);
    assert.equal(lv.extensions[NS].fields.convoBehavior, '짧게');
    assert.equal(lv.extensions[NS].folded, lv.description);
    assert.equal(Object.keys(lv.extensions).join(), NS, 'only our namespace is sent (the host shallow-merges, world_book_ids lives in extensions)');
});

test('character: without folding the description stays as written', () => {
    const lv = cardToLvCharacter(xt(draft()), { fold: false });
    assert.equal(lv.description, '빵집 사장');
});

test('character: round trip through Lumiverse returns every studio field', () => {
    const lv = cardToLvCharacter(xt(draft()));
    const stored = { id: 'c1', ...lv, extensions: { talkativeness: 0.5, ...lv.extensions } };
    const back = Zt(lvCharacterToData(stored));
    assert.deepEqual({ ...back }, { ...draft(), conversationDisplayName: '하루 ' });
});

test('character: description edited outside -> snapshot no longer trusted, whole text is the description', () => {
    const lv = cardToLvCharacter(xt(draft()));
    const stored = { id: 'c1', ...lv, description: lv.description + '\n(바깥에서 고침)', extensions: lv.extensions };
    const data = lvCharacterToData(stored);
    assert.equal(data.snapshotUsable, false);
    assert.equal(data.description, stored.description);
    assert.equal(data.extensions.backstory, '');
    assert.equal(data.extensions.convoBehavior.instruction, '짧게', 'fields with no native slot always come from the snapshot');
});

test('character: patch from the original conflict check updates only changed native fields and re-folds', () => {
    const lv = cardToLvCharacter(xt(draft()));
    const stored = { id: 'c1', ...lv, extensions: { talkativeness: 0.5, world_book_ids: ['w'], ...lv.extensions } };
    const original = Zt(lvCharacterToData(stored));
    const edited = { ...original, backstory: '새 배경', personality: '다정' };
    const patch = xn(edited, original, lvCharacterToData(stored));
    assert.deepEqual(patch, { personality: '다정', extensions: { backstory: '새 배경' } });
    const update = characterPatchToLv(stored, patch);
    assert.equal(update.personality, '다정');
    assert.equal(update.description, '빵집 사장\n\n## 배경 이야기\n새 배경\n\n## 외모\n앞치마');
    assert.equal(update.first_mes, undefined);
    assert.deepEqual(Object.keys(update.extensions), [NS]);
    assert.equal(update.extensions[NS].fields.backstory, '새 배경');
});

test('character: chara_card_v2 file for Lumiverse import', () => {
    const file = characterCardFile(xt(draft()));
    assert.equal(file.spec, 'chara_card_v2');
    assert.equal(file.data.name, '하루');
    assert.match(file.data.description, /## 외모/);
    assert.equal(file.type, undefined, 'no Marinara wrapper: Lumiverse reads obj.spec at the top level');
});

test('persona: six fields fold into description; snapshot restores them', () => {
    const p = { id: 'p1', name: '나', description: '평범', personality: '조용', backstory: '', appearance: '안경', scenario: '학교' };
    const lv = studioToLvPersona(p, { now: 1 });
    assert.equal(lv.description, '평범\n\n## 성격\n조용\n\n## 외모\n안경\n\n## 시나리오\n학교');
    const back = lvPersonaToStudio({ id: 'p1', name: lv.name, description: lv.description, metadata: { [NS]: lv.snapshot } });
    assert.deepEqual({ ...back, snapshotUsable: undefined }, { ...p, snapshotUsable: undefined });
    const stale = lvPersonaToStudio({ id: 'p1', name: '나', description: lv.description + 'x', metadata: { [NS]: lv.snapshot } });
    assert.equal(stale.snapshotUsable, false);
    assert.equal(stale.personality, '');
});

test('persona: patch keeps the other fields', () => {
    const lv = studioToLvPersona({ name: '나', description: '평범', personality: '조용', backstory: '', appearance: '', scenario: '' });
    const current = { id: 'p1', name: '나', description: lv.description, metadata: { [NS]: lv.snapshot } };
    const next = personaPatchToLv(current, { appearance: '안경' });
    assert.equal(next.description, '평범\n\n## 성격\n조용\n\n## 외모\n안경');
    assert.equal(next.snapshot.fields.personality, '조용');
});

test('lorebook entry: studio <-> Lumiverse', () => {
    const e = { id: 'e1', key: ['빵집'], keysecondary: ['하루'], content: '내용', comment: '빵집', order_value: 20, selective: true, constant: false, disabled: true, extensions: { [NS]: { description: '요약' } }, updated_at: 9 };
    assert.deepEqual(lvEntryToStudio(e), { id: 'e1', name: '빵집', keys: ['빵집'], content: '내용', description: '요약', constant: false, selective: true, enabled: false, order: 20, updatedAt: 9 });
    assert.deepEqual(studioEntryToLv({ name: 'N', keys: ['a'], content: 'c', constant: true, selective: false, enabled: true, order: 30, description: 'x' }), { comment: 'N', key: ['a'], content: 'c', constant: true, selective: false, disabled: false, order_value: 30 });
    assert.deepEqual(studioEntryToLv({ content: 'only' }), { content: 'only' }, 'a patch maps only what it holds (secondary keys etc. stay untouched)');
});

test('lorebook file for Lumiverse import', () => {
    const f = lorebookFile({ name: '북', description: 'd' }, [{ name: 'a', keys: ['k'], content: 'c', constant: false, selective: false, enabled: true, description: '설명' }]);
    assert.equal(f.entries[0].comment, 'a');
    assert.deepEqual(f.entries[0].key, ['k']);
    assert.equal(f.entries[0].order_value, 10);
});
