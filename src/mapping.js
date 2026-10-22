// 령령의 제작실 (Lumiverse) — mapping between the original's Marinara-shaped data and Lumiverse records.
// Pure functions (no host access), used by the backend service and tested on their own.
//
// The studio keeps working with the shapes the original read from Marinara's REST API:
//   character  { name, description, personality, scenario, first_mes, mes_example, alternate_greetings,
//                extensions: { backstory, appearance, convoDisplayName, aboutMe, convoBehavior: { instruction } } }
//   persona    { id, name, description, personality, backstory, appearance, scenario }
//   lore entry { id, name, keys, content, description, constant, selective, enabled, order, updatedAt }
// Lumiverse has no slot for several of those fields (see README "옮기지 못한 것"):
//   - character: backstory / appearance (folded into `description`), Convo display name / About Me / Convo behaviour
//   - persona:   personality / backstory / appearance / scenario (folded into `description`)
//   - lore entry: `description` (kept in the entry's own extension namespace)
// The complete studio field set is also kept in a namespaced snapshot so editing the item again later gets every
// field back. The snapshot is only trusted while the folded text it was made with is still what the item holds.

export const NS = 'lingling_studio_lv';

const clean = v => (typeof v === 'string' ? v : '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** `description` followed by one "## label" section per non-empty extra field. */
export function fold(description, extras) {
    const parts = [clean(description).trim()];
    for (const [label, text] of extras) {
        const t = clean(text).trim();
        if (t) parts.push(`## ${label}\n${t}`);
    }
    return parts.filter(Boolean).join('\n\n');
}

// ---------- characters ----------

const CHAR_EXTRAS = [['배경 이야기', 'backstory'], ['외모', 'appearance']];
const CHAR_SNAP_ONLY = ['convoDisplayName', 'aboutMe'];

/** The studio's fields of a Lumiverse character, as the original's Marinara-shaped `data` object. */
export function lvCharacterToData(ch) {
    const snap = ch?.extensions?.[NS];
    const usable = snap && snap.v === 1 && snap.fields && snap.folded === clean(ch.description);
    const f = usable ? snap.fields : {};
    return {
        name: clean(ch.name),
        description: usable ? clean(f.description) : clean(ch.description),
        personality: clean(ch.personality),
        scenario: clean(ch.scenario),
        first_mes: clean(ch.first_mes),
        mes_example: clean(ch.mes_example),
        alternate_greetings: Array.isArray(ch.alternate_greetings) ? ch.alternate_greetings.filter(x => typeof x === 'string') : [],
        extensions: {
            backstory: usable ? clean(f.backstory) : '',
            appearance: usable ? clean(f.appearance) : '',
            // no native counterpart: they only live in the snapshot
            convoDisplayName: clean(snap?.fields?.convoDisplayName),
            aboutMe: clean(snap?.fields?.aboutMe),
            convoBehavior: { instruction: clean(snap?.fields?.convoBehavior) },
        },
        snapshotUsable: !!usable,
    };
}

/** Lumiverse create/update input from a complete studio card (the original's `xt(draft)` output). */
export function cardToLvCharacter(card, { fold: doFold = true, now = Date.now() } = {}) {
    const ext = card.extensions || {};
    const fields = {
        description: clean(card.description), backstory: clean(ext.backstory), appearance: clean(ext.appearance),
        convoDisplayName: clean(ext.convoDisplayName), aboutMe: clean(ext.aboutMe), convoBehavior: clean(ext.convoBehavior?.instruction),
    };
    const description = doFold ? fold(fields.description, CHAR_EXTRAS.map(([label, key]) => [label, fields[key]])) : fields.description;
    return {
        name: clean(card.name).trim(),
        description,
        personality: clean(card.personality),
        scenario: clean(card.scenario),
        first_mes: clean(card.first_mes),
        mes_example: clean(card.mes_example),
        alternate_greetings: Array.isArray(card.alternate_greetings) ? card.alternate_greetings.filter(x => typeof x === 'string') : [],
        tags: Array.isArray(card.tags) ? card.tags : [],
        extensions: { [NS]: { v: 1, fields, folded: description, savedAt: now } },
    };
}

/** A nested Marinara-style partial (the original's `xn` output) applied to the character's current studio fields. */
export function characterPatchToLv(current, patch, { fold: doFold = true, now = Date.now() } = {}) {
    const data = lvCharacterToData(current);
    const next = { ...data, extensions: { ...data.extensions, convoBehavior: { ...data.extensions.convoBehavior } } };
    for (const k of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'alternate_greetings']) {
        if (Object.hasOwn(patch, k)) next[k] = patch[k];
    }
    const pe = patch.extensions || {};
    for (const k of ['backstory', 'appearance', ...CHAR_SNAP_ONLY]) if (Object.hasOwn(pe, k)) next.extensions[k] = pe[k];
    if (pe.convoBehavior && Object.hasOwn(pe.convoBehavior, 'instruction')) next.extensions.convoBehavior.instruction = pe.convoBehavior.instruction;
    const card = cardToLvCharacter({ ...next, alternate_greetings: next.alternate_greetings }, { fold: doFold, now });
    const update = { extensions: card.extensions };
    for (const k of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example']) if (!same(card[k], clean(current[k]))) update[k] = card[k];
    if (!same(card.alternate_greetings, current.alternate_greetings || [])) update.alternate_greetings = card.alternate_greetings;
    return update;
}

/** The studio draft's character as a SillyTavern-style `chara_card_v2` file (what Lumiverse's importer reads). */
export function characterCardFile(card, opts = {}) {
    const lv = cardToLvCharacter(card, opts);
    return {
        spec: 'chara_card_v2', spec_version: '2.0',
        data: {
            name: lv.name, description: lv.description, personality: lv.personality, scenario: lv.scenario,
            first_mes: lv.first_mes, mes_example: lv.mes_example, creator_notes: '', system_prompt: '', post_history_instructions: '',
            alternate_greetings: lv.alternate_greetings, tags: lv.tags, creator: '', character_version: '0.5.5', extensions: lv.extensions,
        },
    };
}

// ---------- personas ----------

export const PERSONA_FIELDS = ['description', 'personality', 'backstory', 'appearance', 'scenario'];
const PERSONA_EXTRAS = [['성격', 'personality'], ['배경 이야기', 'backstory'], ['외모', 'appearance'], ['시나리오', 'scenario']];

/** The studio's six persona fields of a Lumiverse persona (the original's `Ct` shape plus the id). */
export function lvPersonaToStudio(p) {
    const snap = p?.metadata?.[NS];
    const usable = snap && snap.v === 1 && snap.fields && snap.folded === clean(p.description);
    const out = { id: p.id, name: clean(p.name), description: clean(p.description), personality: '', backstory: '', appearance: '', scenario: '' };
    if (usable) for (const k of PERSONA_FIELDS) out[k] = clean(snap.fields[k]);
    out.snapshotUsable = !!usable;
    return out;
}

/** Lumiverse persona input from the studio's persona (name + five fields). Metadata must be merged by the caller. */
export function studioToLvPersona(p, { fold: doFold = true, now = Date.now() } = {}) {
    const fields = Object.fromEntries(PERSONA_FIELDS.map(k => [k, clean(p[k])]));
    const description = doFold ? fold(fields.description, PERSONA_EXTRAS.map(([label, key]) => [label, fields[key]])) : fields.description;
    return { name: clean(p.name).trim(), description, snapshot: { v: 1, fields, folded: description, savedAt: now } };
}

/** The original's `mn` output (changed fields only) applied to the persona's current studio fields. */
export function personaPatchToLv(current, patch, opts = {}) {
    const studio = lvPersonaToStudio(current);
    const next = { ...studio };
    for (const k of ['name', ...PERSONA_FIELDS]) if (Object.hasOwn(patch, k)) next[k] = patch[k];
    return studioToLvPersona(next, opts);
}

// ---------- lorebook entries ----------

/** A Lumiverse entry in the shape the original's draft/save code expects. */
export function lvEntryToStudio(e) {
    return {
        id: e.id,
        name: clean(e.comment),
        keys: Array.isArray(e.key) ? e.key.filter(k => typeof k === 'string') : [],
        content: clean(e.content),
        description: clean(e.extensions?.[NS]?.description),
        constant: !!e.constant,
        selective: !!e.selective,
        enabled: e.disabled !== true,
        order: Number.isFinite(Number(e.order_value)) ? Number(e.order_value) : 100,
        updatedAt: e.updated_at ?? null,
    };
}

/** Changed studio fields (the original's `mt` patches / `Nt(draft entry)`) as a Lumiverse entry create/update input. */
export function studioEntryToLv(s) {
    const out = {};
    if (Object.hasOwn(s, 'name')) out.comment = clean(s.name);
    if (Object.hasOwn(s, 'keys')) out.key = Array.isArray(s.keys) ? s.keys.filter(k => typeof k === 'string') : [];
    if (Object.hasOwn(s, 'content')) out.content = clean(s.content);
    if (Object.hasOwn(s, 'constant')) out.constant = !!s.constant;
    if (Object.hasOwn(s, 'selective')) out.selective = !!s.selective;
    if (Object.hasOwn(s, 'enabled')) out.disabled = s.enabled === false;
    if (Object.hasOwn(s, 'order') && Number.isFinite(Number(s.order))) out.order_value = Number(s.order);
    return out;
}

export const hasEntryDescription = s => Object.hasOwn(s, 'description');

/** A Lumiverse world book (+ entries) as the lorebook JSON file Lumiverse imports ({ name, description, entries }). */
export function lorebookFile(book, entries) {
    return {
        name: clean(book.name), description: clean(book.description),
        entries: entries.map((e, i) => ({
            uid: i, key: e.keys || [], keysecondary: [], comment: clean(e.name), content: clean(e.content),
            constant: !!e.constant, selective: !!e.selective, disable: e.enabled === false,
            order_value: Number.isFinite(Number(e.order)) ? Number(e.order) : (i + 1) * 10,
            extensions: { [NS]: { description: clean(e.description) } },
        })),
    };
}
