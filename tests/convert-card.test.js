import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { unwrap, withTextChunk } from '../scripts/convert-card.mjs';

// a 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const wrapper = (over = {}) => ({ type: 'marinara_character', version: 1, exportedAt: 'x', data: { spec: 'chara_card_v2', spec_version: '2.0', data: { name: '{{char}}', description: 'd', character_book: { name: 'b', entries: [{ keys: ['k'], content: 'c' }] } }, avatar: 'data:image/png;base64,' + PNG.toString('base64'), metadata: {}, ...over } });

test('unwrap: Marinara export wrapper -> chara_card_v2 at the top level (what Lumiverse parseCardJson needs)', () => {
    const { card, avatarPng } = unwrap(wrapper());
    assert.equal(card.spec, 'chara_card_v2');
    assert.equal(card.data.name, '{{char}}');
    assert.equal(card.data.character_book.entries.length, 1);
    assert.ok(avatarPng.equals(PNG));
    assert.equal(card.type, undefined);
});
test('unwrap refuses something else', () => {
    assert.throws(() => unwrap({ hello: 1 }), /not a Marinara character export/);
});
test('PNG gets a tEXt "chara" chunk right after IHDR, with a valid CRC and the PNG still intact', () => {
    const text = Buffer.from(JSON.stringify({ spec: 'chara_card_v2' })).toString('base64');
    const out = withTextChunk(PNG, 'chara', text);
    assert.ok(out.subarray(0, 8).equals(PNG.subarray(0, 8)));
    // walk the chunks the way Lumiverse's extractPngTextChunk does
    let offset = 8; const types = []; let found = null;
    while (offset + 12 <= out.length) {
        const len = out.readUInt32BE(offset), type = out.toString('ascii', offset + 4, offset + 8);
        types.push(type);
        if (type === 'tEXt') { const data = out.subarray(offset + 8, offset + 8 + len); const z = data.indexOf(0); if (data.toString('ascii', 0, z) === 'chara') found = data.toString('latin1', z + 1); }
        offset += 12 + len;
    }
    assert.deepEqual(types.slice(0, 2), ['IHDR', 'tEXt']);
    assert.equal(types.at(-1), 'IEND');
    assert.equal(JSON.parse(Buffer.from(found, 'base64').toString('utf8')).spec, 'chara_card_v2');
    // replacing an existing chunk keeps one
    assert.equal(withTextChunk(out, 'chara', text).length, out.length);
});
