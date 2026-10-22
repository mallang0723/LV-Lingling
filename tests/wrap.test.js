import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapRequest, labelFor, injectContext, REQUEST_TAG } from '../src/wrap.js';

test('studio requests are wrapped: label visible, request hidden', () => {
    const w = wrapRequest('[MARINARA_STUDIO_EXPORT]\n\n본문\n\n끝');
    assert.match(w, /^<span class="csm-studio-command">👻 캐릭터 제작실 · 최종본 요청<\/span>\n<lingling-studio-request>\n<section class="csm-hidden-prompt" style="display:none">\n\[MARINARA_STUDIO_EXPORT\]/);
    assert.ok(w.includes('본문\n\n끝\n</section>\n</lingling-studio-request>'));
});
test('labels per studio', () => {
    assert.equal(labelFor('[MARINARA_PERSONA_STUDIO_EXPORT]'), '🎭 페르소나 제작실 · 요청');
    assert.equal(labelFor('[MARINARA_LOREBOOK_STUDIO_BRIEFING]'), '📖 로어북 제작실 · 요청');
    assert.equal(labelFor('[MARINARA_STUDIO_REFERENCE]'), '👻 캐릭터 제작실 · 제작 브리핑');
    assert.equal(labelFor('[MARINARA_STUDIO_REVISION]'), '👻 캐릭터 제작실 · 부분 수정 요청');
    assert.equal(labelFor('그냥 말'), '');
});
test('a plain text is not touched; a wrapper tag that appears closed in the text is skipped', () => {
    assert.equal(wrapRequest('  안녕  '), '안녕');
    const w = wrapRequest('[MARINARA_STUDIO_EXPORT]\n</section>');
    assert.match(w, /<aside class="csm-hidden-prompt"/);
    const all = wrapRequest('[MARINARA_STUDIO_EXPORT]</section></aside></nav></footer></header>');
    assert.ok(all.includes(`<${REQUEST_TAG}>`) && !all.includes('csm-hidden-prompt'));
});

const hist = (content) => [{ role: 'system', content: 'sys' }, { role: 'assistant', content: 'hi', __isChatHistory: true }, { role: 'user', content, __isChatHistory: true }];
const rec = { chatId: 'c', conversation: 'CONV', export: 'EXPORT-REF' };
test('interceptor: conversation turn gets the context in front of the user turn', () => {
    const r = injectContext(hist('안녕'), { generationType: 'normal', chatId: 'c' }, rec);
    assert.equal(r.messages.length, 4);
    assert.deepEqual(r.messages[2], { role: 'system', content: 'CONV' });
    assert.deepEqual(r.breakdown, [{ messageIndex: 2, name: '령령의 제작실' }]);
});
test('interceptor: final-draft request gets only the export context', () => {
    const r = injectContext(hist('[MARINARA_STUDIO_EXPORT]\n...'), { generationType: 'normal' }, rec);
    assert.equal(r.messages[2].content, 'EXPORT-REF');
    assert.equal(injectContext(hist('[MARINARA_PERSONA_STUDIO_EXPORT]'), {}, { ...rec, export: '' }).length, 3, 'no export context -> untouched');
});
test('interceptor: requests that carry their own contract, and non-turn generations, are skipped', () => {
    for (const m of ['[MARINARA_STUDIO_REFERENCE]', '[MARINARA_STUDIO_REVISION]', '[MARINARA_PERSONA_STUDIO_BRIEFING]', '[MARINARA_PERSONA_STUDIO_REVISION]', '[MARINARA_LOREBOOK_STUDIO_EXPORT]', '[MARINARA_LOREBOOK_STUDIO_REVISION]', '[MARINARA_STUDIO_TRANSLATION]']) {
        assert.equal(injectContext(hist(m), { generationType: 'normal' }, rec).length, 3, m);
    }
    for (const t of ['continue', 'regenerate', 'swipe', 'impersonate', 'quiet']) assert.equal(injectContext(hist('x'), { generationType: t }, rec).length, 3, t);
    assert.equal(injectContext(hist('x'), {}, null).length, 3);
});
test('interceptor: user turn given as parts', () => {
    const msgs = [{ role: 'user', content: [{ type: 'text', text: '[MARINARA_STUDIO_REVISION]' }], __isChatHistory: true }];
    assert.equal(injectContext(msgs, {}, rec).length, 1);
});
