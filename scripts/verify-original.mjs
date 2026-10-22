// Provenance check: every code line of src/original/*.js must appear unchanged in the original bundle
// (령령의 마리나라 제작실 v2.0.0 by you2-use), or carry an "LV:" marker / be listed in ADAPTED below.
// Usage: node scripts/verify-original.mjs /path/to/extension.pretty.js
//   where extension.pretty.js is the original extension.js formatted with
//   `prettier --print-width 140` (only whitespace changes; the identifiers are the bundle's own).
import { readFileSync } from 'node:fs';
const src = process.argv[2] || process.env.ORIGINAL_PRETTY;
if (!src) { console.error('usage: node scripts/verify-original.mjs original.pretty.js'); process.exit(2); }
const norm = s => s.trim();
const have = new Set(readFileSync(src, 'utf8').split('\n').map(norm));
// Lines of a multi-line "LV:" edit that are not individually in the original (indentation / ternary wrapping of the
// same expressions).
const ADAPTED = new Set([
    '? Ee(',
    '"수정 요청을 입력창에 넣기",',
    '"send",',
    '(n) => {',
    '(n.preventDefault(), n.stopPropagation(), t.revisionRequestToChat());',
    '},',
    '!!e.request,',
    ')',
    ': null,',
    '? Ee("RP 입력창에 넣기", "send", (n) => {',
    '(n.preventDefault(), n.stopPropagation(), e.request(t, "composer"));',
    '})',
    ': null,',
    '(n.preventDefault(), n.stopPropagation(), e.request(t, "composer"));',
]);
const files = ['src/original/logic.js', 'src/original/ui.js'];
const missing = [];
let checked = 0, adapted = 0;
for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const t = norm(line);
        if (!t || t.startsWith('//') || t.startsWith('import ') || t.startsWith('export {')) return;
        checked++;
        if (have.has(t)) return;
        if (/\/\/ LV:/.test(t) || ADAPTED.has(t)) { adapted++; return; }
        missing.push(`${file}:${i + 1}: ${t.slice(0, 160)}`);
    });
}
console.log(JSON.stringify({ checked, adapted, notInOriginal: missing.length }));
for (const m of missing) console.log(m);
process.exit(missing.length ? 1 : 0);
