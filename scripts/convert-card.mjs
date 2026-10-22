// Turns the original release's CharCard.json (Marinara export wrapper) into files Lumiverse's importer reads.
// Lumiverse 1.2.5 (src/services/character-card.service.ts parseCardJson) looks for `spec: "chara_card_v2"` at the TOP level of the
// file; Marinara's export wraps the card as { type: "marinara_character", version, exportedAt, data: { spec, data, avatar, ... } },
// so the wrapper file fails to import ("Character card is missing required 'name' field"). This script unwraps it and
// writes, next to the input (or into --out DIR):
//   <name>.lumiverse.json   the plain chara_card_v2 JSON (card + embedded lorebook; no avatar)
//   <name>.lingling.png     the card's own avatar as a PNG with the card in a `chara` text chunk — import this one:
//                           Lumiverse takes the card, the avatar and the embedded lorebook from it in one go
// Usage: node scripts/convert-card.mjs /path/to/CharCard.json [--out DIR]
// Nothing is sent anywhere; the original file is not modified.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const crcTable = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = buf => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Puts a tEXt chunk (keyword\0text) right after IHDR; an existing chunk with the same keyword is dropped. */
export function withTextChunk(png, keyword, text) {
    if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE)) throw new Error('avatar is not a PNG');
    const out = [SIGNATURE];
    let offset = 8, placed = false;
    while (offset + 12 <= png.length) {
        const len = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8), end = offset + 12 + len;
        if (end > png.length) throw new Error('truncated PNG');
        const raw = png.subarray(offset, end);
        if (type === 'tEXt' && png.toString('latin1', offset + 8, offset + 8 + keyword.length + 1) === keyword + '\0') { offset = end; continue; }
        out.push(raw);
        if (type === 'IHDR' && !placed) { out.push(chunk('tEXt', Buffer.concat([Buffer.from(keyword + '\0', 'latin1'), Buffer.from(text, 'latin1')]))); placed = true; }
        offset = end;
    }
    return Buffer.concat(out);
}

export function unwrap(json) {
    const wrapper = json?.type === 'marinara_character' ? json.data : json;
    if (!wrapper || wrapper.spec !== 'chara_card_v2' || !wrapper.data?.name) throw new Error('not a Marinara character export (expected type "marinara_character" with a chara_card_v2 inside)');
    const card = { spec: wrapper.spec, spec_version: wrapper.spec_version || '2.0', data: wrapper.data };
    const avatar = typeof wrapper.avatar === 'string' ? /^data:image\/png;base64,(.+)$/s.exec(wrapper.avatar) : null;
    return { card, avatarPng: avatar ? Buffer.from(avatar[1], 'base64') : null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const outAt = args.indexOf('--out');
    const outDir = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
    const input = args[0];
    if (!input) { console.error('usage: node scripts/convert-card.mjs CharCard.json [--out DIR]'); process.exit(2); }
    const { card, avatarPng } = unwrap(JSON.parse(readFileSync(input, 'utf8')));
    const dir = outDir || path.dirname(path.resolve(input));
    mkdirSync(dir, { recursive: true });
    const base = path.basename(input).replace(/\.json$/i, '');
    const jsonPath = path.join(dir, `${base}.lumiverse.json`);
    writeFileSync(jsonPath, JSON.stringify(card, null, 2));
    console.log('wrote', jsonPath, `(card "${card.data.name}", ${card.data.character_book?.entries?.length ?? 0} lorebook entries)`);
    if (avatarPng) {
        // the card text is base64 of UTF-8 JSON (what Lumiverse's extractPngTextChunk expects); the chunk itself is plain ASCII
        const pngPath = path.join(dir, `${base}.lingling.png`);
        writeFileSync(pngPath, withTextChunk(avatarPng, 'chara', Buffer.from(JSON.stringify(card), 'utf8').toString('base64')));
        console.log('wrote', pngPath);
    } else console.log('no PNG avatar inside the file: import the .json and set the avatar by hand');
}
