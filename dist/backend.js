// @bun
// src/wrap.js
var SKIP_PATTERNS = [
  /\[MARINARA_STUDIO_(?:TRANSLATION|REFERENCE|REVISION)\]/u,
  /\[MARINARA_PERSONA_STUDIO_(?:BRIEFING|REVISION)\]/u,
  /\[MARINARA_LOREBOOK_STUDIO_(?:BRIEFING|EXPORT|REVISION)\]/u
];
var EXPORT_PATTERN = /\[MARINARA_(?:STUDIO_EXPORT|PERSONA_STUDIO_EXPORT)\]/u;
var SKIPPED_GENERATION_TYPES = ["continue", "regenerate", "swipe", "impersonate", "quiet"];
var REQUEST_TAG = "lingling-studio-request";
var MESSAGE_SOURCE = "lingling_studio_lv";
function labelFor(text) {
  const d = String(text || "");
  if (/\[MARINARA_PERSONA_STUDIO_/u.test(d))
    return "\uD83C\uDFAD \uD398\uB974\uC18C\uB098 \uC81C\uC791\uC2E4 \xB7 \uC694\uCCAD";
  if (/\[MARINARA_LOREBOOK_STUDIO_/u.test(d))
    return "\uD83D\uDCD6 \uB85C\uC5B4\uBD81 \uC81C\uC791\uC2E4 \xB7 \uC694\uCCAD";
  if (d.includes("[MARINARA_STUDIO_REFERENCE]"))
    return "\uD83D\uDC7B \uCE90\uB9AD\uD130 \uC81C\uC791\uC2E4 \xB7 \uC81C\uC791 \uBE0C\uB9AC\uD551";
  if (d.includes("[MARINARA_STUDIO_EXPORT]"))
    return "\uD83D\uDC7B \uCE90\uB9AD\uD130 \uC81C\uC791\uC2E4 \xB7 \uCD5C\uC885\uBCF8 \uC694\uCCAD";
  if (d.includes("[MARINARA_STUDIO_REVISION]"))
    return "\uD83D\uDC7B \uCE90\uB9AD\uD130 \uC81C\uC791\uC2E4 \xB7 \uBD80\uBD84 \uC218\uC815 \uC694\uCCAD";
  return "";
}
function wrapRequest(text) {
  const d = String(text || "").trim();
  const label = labelFor(d);
  if (!label)
    return d;
  const tag = ["section", "aside", "nav", "footer", "header"].find((t) => !new RegExp(`</${t}\\s*>`, "iu").test(d));
  if (!tag)
    return d.includes(`</${REQUEST_TAG}>`) ? d : `<span class="csm-studio-command">${label}</span>
<${REQUEST_TAG}>
${d}
</${REQUEST_TAG}>`;
  const hidden = `<${tag} class="csm-hidden-prompt" style="display:none">
${d}
</${tag}>`;
  if (d.includes(`</${REQUEST_TAG}>`))
    return `<span class="csm-studio-command">${label}</span>
${hidden}`;
  return `<span class="csm-studio-command">${label}</span>
<${REQUEST_TAG}>
${hidden}
</${REQUEST_TAG}>`;
}
var textOf = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p && p.type === "text" ? p.text : "").join(`
`) : "";
function injectContext(messages, ctx, rec) {
  if (!rec || !Array.isArray(messages))
    return messages;
  if (SKIPPED_GENERATION_TYPES.includes(ctx?.generationType))
    return messages;
  let at = -1;
  for (let i = messages.length - 1;i >= 0; i--) {
    if (messages[i]?.role === "user" && (messages[i].__isChatHistory || at < 0)) {
      at = i;
      if (messages[i].__isChatHistory)
        break;
    }
  }
  const last = at >= 0 ? textOf(messages[at].content) : "";
  if (SKIP_PATTERNS.some((re) => re.test(last)))
    return messages;
  const body = EXPORT_PATTERN.test(last) ? rec.export : rec.conversation;
  if (!body || !String(body).trim())
    return messages;
  const index = at >= 0 ? at : messages.length;
  const out = [...messages.slice(0, index), { role: "system", content: String(body) }, ...messages.slice(index)];
  return { messages: out, breakdown: [{ messageIndex: index, name: "\uB839\uB839\uC758 \uC81C\uC791\uC2E4" }] };
}

// src/mapping.js
var NS = "lingling_studio_lv";
var clean = (v) => typeof v === "string" ? v : "";
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fold(description, extras) {
  const parts = [clean(description).trim()];
  for (const [label, text] of extras) {
    const t = clean(text).trim();
    if (t)
      parts.push(`## ${label}
${t}`);
  }
  return parts.filter(Boolean).join(`

`);
}
var CHAR_EXTRAS = [["\uBC30\uACBD \uC774\uC57C\uAE30", "backstory"], ["\uC678\uBAA8", "appearance"]];
var CHAR_SNAP_ONLY = ["convoDisplayName", "aboutMe"];
function lvCharacterToData(ch) {
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
    alternate_greetings: Array.isArray(ch.alternate_greetings) ? ch.alternate_greetings.filter((x) => typeof x === "string") : [],
    extensions: {
      backstory: usable ? clean(f.backstory) : "",
      appearance: usable ? clean(f.appearance) : "",
      convoDisplayName: clean(snap?.fields?.convoDisplayName),
      aboutMe: clean(snap?.fields?.aboutMe),
      convoBehavior: { instruction: clean(snap?.fields?.convoBehavior) }
    },
    snapshotUsable: !!usable
  };
}
function cardToLvCharacter(card, { fold: doFold = true, now = Date.now() } = {}) {
  const ext = card.extensions || {};
  const fields = {
    description: clean(card.description),
    backstory: clean(ext.backstory),
    appearance: clean(ext.appearance),
    convoDisplayName: clean(ext.convoDisplayName),
    aboutMe: clean(ext.aboutMe),
    convoBehavior: clean(ext.convoBehavior?.instruction)
  };
  const description = doFold ? fold(fields.description, CHAR_EXTRAS.map(([label, key]) => [label, fields[key]])) : fields.description;
  return {
    name: clean(card.name).trim(),
    description,
    personality: clean(card.personality),
    scenario: clean(card.scenario),
    first_mes: clean(card.first_mes),
    mes_example: clean(card.mes_example),
    alternate_greetings: Array.isArray(card.alternate_greetings) ? card.alternate_greetings.filter((x) => typeof x === "string") : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    extensions: { [NS]: { v: 1, fields, folded: description, savedAt: now } }
  };
}
function characterPatchToLv(current, patch, { fold: doFold = true, now = Date.now() } = {}) {
  const data = lvCharacterToData(current);
  const next = { ...data, extensions: { ...data.extensions, convoBehavior: { ...data.extensions.convoBehavior } } };
  for (const k of ["name", "description", "personality", "scenario", "first_mes", "mes_example", "alternate_greetings"]) {
    if (Object.hasOwn(patch, k))
      next[k] = patch[k];
  }
  const pe = patch.extensions || {};
  for (const k of ["backstory", "appearance", ...CHAR_SNAP_ONLY])
    if (Object.hasOwn(pe, k))
      next.extensions[k] = pe[k];
  if (pe.convoBehavior && Object.hasOwn(pe.convoBehavior, "instruction"))
    next.extensions.convoBehavior.instruction = pe.convoBehavior.instruction;
  const card = cardToLvCharacter({ ...next, alternate_greetings: next.alternate_greetings }, { fold: doFold, now });
  const update = { extensions: card.extensions };
  for (const k of ["name", "description", "personality", "scenario", "first_mes", "mes_example"])
    if (!same(card[k], clean(current[k])))
      update[k] = card[k];
  if (!same(card.alternate_greetings, current.alternate_greetings || []))
    update.alternate_greetings = card.alternate_greetings;
  return update;
}
var PERSONA_FIELDS = ["description", "personality", "backstory", "appearance", "scenario"];
var PERSONA_EXTRAS = [["\uC131\uACA9", "personality"], ["\uBC30\uACBD \uC774\uC57C\uAE30", "backstory"], ["\uC678\uBAA8", "appearance"], ["\uC2DC\uB098\uB9AC\uC624", "scenario"]];
function lvPersonaToStudio(p) {
  const snap = p?.metadata?.[NS];
  const usable = snap && snap.v === 1 && snap.fields && snap.folded === clean(p.description);
  const out = { id: p.id, name: clean(p.name), description: clean(p.description), personality: "", backstory: "", appearance: "", scenario: "" };
  if (usable)
    for (const k of PERSONA_FIELDS)
      out[k] = clean(snap.fields[k]);
  out.snapshotUsable = !!usable;
  return out;
}
function studioToLvPersona(p, { fold: doFold = true, now = Date.now() } = {}) {
  const fields = Object.fromEntries(PERSONA_FIELDS.map((k) => [k, clean(p[k])]));
  const description = doFold ? fold(fields.description, PERSONA_EXTRAS.map(([label, key]) => [label, fields[key]])) : fields.description;
  return { name: clean(p.name).trim(), description, snapshot: { v: 1, fields, folded: description, savedAt: now } };
}
function personaPatchToLv(current, patch, opts = {}) {
  const studio = lvPersonaToStudio(current);
  const next = { ...studio };
  for (const k of ["name", ...PERSONA_FIELDS])
    if (Object.hasOwn(patch, k))
      next[k] = patch[k];
  return studioToLvPersona(next, opts);
}
function lvEntryToStudio(e) {
  return {
    id: e.id,
    name: clean(e.comment),
    keys: Array.isArray(e.key) ? e.key.filter((k) => typeof k === "string") : [],
    content: clean(e.content),
    description: clean(e.extensions?.[NS]?.description),
    constant: !!e.constant,
    selective: !!e.selective,
    enabled: e.disabled !== true,
    order: Number.isFinite(Number(e.order_value)) ? Number(e.order_value) : 100,
    updatedAt: e.updated_at ?? null
  };
}
function studioEntryToLv(s) {
  const out = {};
  if (Object.hasOwn(s, "name"))
    out.comment = clean(s.name);
  if (Object.hasOwn(s, "keys"))
    out.key = Array.isArray(s.keys) ? s.keys.filter((k) => typeof k === "string") : [];
  if (Object.hasOwn(s, "content"))
    out.content = clean(s.content);
  if (Object.hasOwn(s, "constant"))
    out.constant = !!s.constant;
  if (Object.hasOwn(s, "selective"))
    out.selective = !!s.selective;
  if (Object.hasOwn(s, "enabled"))
    out.disabled = s.enabled === false;
  if (Object.hasOwn(s, "order") && Number.isFinite(Number(s.order)))
    out.order_value = Number(s.order);
  return out;
}
var hasEntryDescription = (s) => Object.hasOwn(s, "description");

// src/service.js
var PAGE = 200;
var STUDIO_PATH = "studio.json";
var SETTINGS_PATH = "settings.json";
var validId = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
var validUser = (x) => typeof x === "string" && x.length > 0 && x.length <= 200;
var clone = (v) => JSON.parse(JSON.stringify(v ?? null));
var PERMS = ["generation", "chats", "chat_mutation", "characters", "personas", "world_books", "interceptor", "ui_panels"];
function createService(api) {
  const queues = new Map;
  const generating = new Map;
  const injections = new Map;
  const users = new Set;
  const has = (p) => typeof api.permissions?.has === "function" ? api.permissions.has(p) : true;
  const gate = (...ps) => {
    for (const p of ps)
      if (!has(p))
        throw new Error("\uAD8C\uD55C\uC774 \uD544\uC694\uD574\uC694: " + p);
  };
  function queued(user, fn) {
    const prior = queues.get(user) || Promise.resolve();
    const task = prior.catch(() => {}).then(fn);
    const tail = task.catch(() => {});
    queues.set(user, tail);
    tail.then(() => {
      if (queues.get(user) === tail)
        queues.delete(user);
    });
    return task;
  }
  async function readJson(path, user, fallback) {
    try {
      if (!await api.userStorage.exists(path, user))
        return fallback;
      return await api.userStorage.getJson(path, { userId: user }) ?? fallback;
    } catch {
      return fallback;
    }
  }
  const writeJson = (path, v, user) => api.userStorage.setJson(path, v, { userId: user });
  const readSettings = async (user) => {
    const s = await readJson(SETTINGS_PATH, user, {});
    return { connectionId: typeof s.connectionId === "string" ? s.connectionId : "", fold: s.fold !== false };
  };
  async function pages(list) {
    const out = [];
    for (let offset = 0;offset < 50000; offset += PAGE) {
      const page = await list(offset);
      const data = Array.isArray(page?.data) ? page.data : [];
      out.push(...data);
      if (data.length < PAGE || out.length >= Number(page?.total ?? 0))
        break;
    }
    return out;
  }
  async function activeChat(user) {
    if (!has("chats"))
      return null;
    let chat = null;
    try {
      chat = await api.chats.getActive(user);
    } catch {
      chat = null;
    }
    if (!chat)
      return null;
    let characterName = "";
    if (chat.character_id && has("characters")) {
      try {
        characterName = (await api.characters.get(chat.character_id, user))?.name || "";
      } catch {
        characterName = "";
      }
    }
    return { chatId: chat.id, name: chat.name || "", characterId: chat.character_id || "", characterName, group: chat.metadata?.group === true };
  }
  async function ownedChat(user, chatId) {
    gate("chats");
    if (!validId(chatId))
      throw new Error("\uC798\uBABB\uB41C \uCC44\uD305");
    const chat = await api.chats.get(chatId, user);
    if (!chat)
      throw new Error("\uCC44\uD305\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694");
    return chat;
  }
  async function latest(user, chatId) {
    gate("chat_mutation");
    await ownedChat(user, chatId);
    const msgs = await api.chat.getMessages(chatId);
    const last = Array.isArray(msgs) && msgs.length ? msgs[msgs.length - 1] : null;
    return {
      chatId,
      generating: isGenerating(chatId),
      message: last ? { id: String(last.id), role: String(last.role || ""), content: typeof last.content === "string" ? last.content : "", createdAt: last.created_at ?? last.send_date ?? "" } : null
    };
  }
  async function send(user, req) {
    gate("chats", "chat_mutation", "generation");
    const chatId = req.chatId;
    await ownedChat(user, chatId);
    const text = String(req.text || "").trim();
    if (!text)
      throw new Error("RP\uBC29\uC5D0 \uB123\uC744 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    if (isGenerating(chatId))
      throw new Error("\uB839\uB839\uC758 \uB2F5\uBCC0 \uC0DD\uC131\uC774 \uB05D\uB09C \uB4A4 \uC694\uCCAD\uD574 \uC8FC\uC138\uC694.");
    const s = await readSettings(user);
    const options = { triggerGeneration: true, ...s.connectionId ? { generation: { connection_id: s.connectionId } } : {} };
    ensureTracking();
    const sent = await api.chat.appendMessage(chatId, { role: "user", content: wrapRequest(text), metadata: { source: MESSAGE_SOURCE, kind: String(req.kind || "") } }, options);
    if (sent?.generationId)
      generating.set(chatId, { id: sent.generationId, at: Date.now() });
    return { id: sent?.id || null, generationId: sent?.generationId || null };
  }
  const emit = (user, msg) => {
    try {
      api.sendToFrontend?.(msg, user);
    } catch {}
  };
  function broadcast(msg) {
    for (const u of users)
      emit(u, msg);
  }
  function track(event) {
    return (payload) => {
      const chatId = payload?.chatId;
      if (!chatId)
        return;
      if (event === "started")
        generating.set(chatId, { id: payload.generationId || "1", at: Date.now() });
      else
        generating.delete(chatId);
      broadcast({ event: "generation", chatId, state: event === "ended" && payload.error ? "error" : event, error: payload?.error || "" });
    };
  }
  const STALE_MS = 10 * 60 * 1000;
  function isGenerating(chatId) {
    const g = generating.get(chatId);
    if (!g)
      return false;
    if (Date.now() - g.at > STALE_MS) {
      generating.delete(chatId);
      return false;
    }
    return true;
  }
  const offs = [];
  function subscribe() {
    for (const off of offs.splice(0)) {
      try {
        off();
      } catch {}
    }
    if (typeof api.on !== "function" || !has("generation"))
      return;
    for (const [name, event] of [["GENERATION_STARTED", "started"], ["GENERATION_ENDED", "ended"], ["GENERATION_STOPPED", "stopped"]]) {
      try {
        const off = api.on(name, track(event));
        if (typeof off === "function")
          offs.push(off);
      } catch {}
    }
  }
  function ensureTracking() {
    if (!offs.length)
      subscribe();
  }
  function attach() {
    subscribe();
    registerInterceptor();
  }
  let interceptorOff = null;
  function registerInterceptor() {
    if (interceptorOff || !has("interceptor") || typeof api.registerInterceptor !== "function")
      return;
    interceptorOff = api.registerInterceptor(async (messages, ctx) => {
      try {
        const chatId = ctx?.chatId;
        const rec = chatId ? [...injections.values()].find((r) => r.chatId === chatId) : null;
        return injectContext(messages, ctx, rec);
      } catch {
        return messages;
      }
    }, 100);
  }
  function onPermissionChanged(detail) {
    registerInterceptor();
    if (!detail || detail.permission === "generation")
      subscribe();
  }
  function setInjection(user, req) {
    if (!req.chatId) {
      injections.delete(user);
      return { active: false };
    }
    if (!validId(req.chatId))
      throw new Error("\uC798\uBABB\uB41C \uCC44\uD305");
    const rec = { chatId: req.chatId, conversation: typeof req.conversation === "string" ? req.conversation : "", export: typeof req.export === "string" ? req.export : "" };
    if (!rec.conversation && !rec.export)
      injections.delete(user);
    else
      injections.set(user, rec);
    return { active: injections.has(user) };
  }
  async function characters(user) {
    gate("characters");
    const all = await pages((offset) => api.characters.list({ limit: PAGE, offset, userId: user }));
    return all.filter((c) => c && c.id).map((c) => ({ id: c.id, name: String(c.name || "").trim() || "\uC774\uB984 \uC5C6\uB294 \uCE90\uB9AD\uD130" }));
  }
  async function character(user, id) {
    gate("characters");
    const ch = await api.characters.get(id, user);
    if (!ch)
      throw new Error("\uC120\uD0DD\uD55C \uCE90\uB9AD\uD130\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const data = lvCharacterToData(ch);
    return { id: ch.id, name: data.name || "\uC774\uB984 \uC5C6\uB294 \uCE90\uB9AD\uD130", data, updatedAt: ch.updated_at ?? null };
  }
  async function createCharacter(user, req) {
    gate("characters");
    const s = await readSettings(user);
    const input = cardToLvCharacter(req.data || {}, { fold: s.fold });
    if (!input.name)
      throw new Error("\uCE90\uB9AD\uD130 \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    const made = await api.characters.create(input, user);
    if (!made?.id)
      throw new Error("\uCE90\uB9AD\uD130 \uB4F1\uB85D \uC751\uB2F5 \uD615\uC2DD\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return { id: made.id, name: made.name };
  }
  async function updateCharacter(user, req) {
    gate("characters");
    const s = await readSettings(user);
    const current = await api.characters.get(req.id, user);
    if (!current)
      throw new Error("\uC120\uD0DD\uD55C \uCE90\uB9AD\uD130\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const saved = await api.characters.update(req.id, characterPatchToLv(current, req.data || {}, { fold: s.fold }), user);
    const data = lvCharacterToData(saved);
    return { id: saved.id, name: data.name, data };
  }
  async function personas(user) {
    gate("personas");
    const all = await pages((offset) => api.personas.list({ limit: PAGE, offset, userId: user }));
    return all.filter((p) => p && p.id).map((p) => ({ id: p.id, name: String(p.name || "").trim() || "\uC774\uB984 \uC5C6\uB294 \uD398\uB974\uC18C\uB098" }));
  }
  async function persona(user, id) {
    gate("personas");
    const p = await api.personas.get(id, user);
    if (!p)
      throw new Error("\uC120\uD0DD\uD55C \uD398\uB974\uC18C\uB098\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return lvPersonaToStudio(p);
  }
  async function createPersona(user, req) {
    gate("personas");
    const s = await readSettings(user);
    const lv = studioToLvPersona(req.persona || {}, { fold: s.fold });
    if (!lv.name)
      throw new Error("\uD398\uB974\uC18C\uB098 \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    const made = await api.personas.create({ name: lv.name, description: lv.description, metadata: { [NS]: lv.snapshot } }, user);
    if (!made?.id)
      throw new Error("\uB4F1\uB85D \uACB0\uACFC\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBAA9\uB85D\uC744 \uC0C8\uB85C\uACE0\uCE68\uD574 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    return lvPersonaToStudio(made);
  }
  async function updatePersona(user, req) {
    gate("personas");
    const s = await readSettings(user);
    const current = await api.personas.get(req.id, user);
    if (!current)
      throw new Error("\uC120\uD0DD\uD55C \uD398\uB974\uC18C\uB098\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const lv = personaPatchToLv(current, req.patch || {}, { fold: s.fold });
    const saved = await api.personas.update(req.id, { name: lv.name, description: lv.description, metadata: { ...current.metadata || {}, [NS]: lv.snapshot } }, user);
    return lvPersonaToStudio(saved);
  }
  async function books(user) {
    gate("world_books");
    const all = await pages((offset) => api.world_books.list({ limit: PAGE, offset, userId: user }));
    return all.filter((b) => b && b.id).map((b) => ({ id: b.id, name: String(b.name || "").trim() || "\uC774\uB984 \uC5C6\uB294 \uB85C\uC5B4\uBD81", description: typeof b.description === "string" ? b.description : "" }));
  }
  async function bookEntries(user, bookId) {
    gate("world_books");
    const all = await pages((offset) => api.world_books.entries.list(bookId, { limit: PAGE, offset, userId: user }));
    return all.filter((e) => e && e.id != null).map((e, i) => ({ e, i })).sort((a, b) => (Number(a.e.order_value) || 0) - (Number(b.e.order_value) || 0) || a.i - b.i).map((x) => lvEntryToStudio(x.e));
  }
  async function bookRead(user, id) {
    gate("world_books");
    const book = await api.world_books.get(id, user);
    if (!book)
      throw new Error("\uB85C\uC5B4\uBD81 \uC6D0\uBCF8 \uC751\uB2F5 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    return { book: { id: book.id, name: book.name, description: book.description || "", category: "world", updatedAt: book.updated_at ?? null }, entries: await bookEntries(user, id), folders: [] };
  }
  async function setDescription(user, entryId, description) {
    if (typeof api.world_books.entries.setExtension !== "function")
      return;
    await api.world_books.entries.setExtension(entryId, NS, { description: String(description || "") }, user);
  }
  async function createBook(user, req) {
    gate("world_books");
    const made = await api.world_books.create({ name: String(req.name || "").trim(), description: String(req.description || ""), metadata: { source: MESSAGE_SOURCE } }, user);
    if (!made?.id)
      throw new Error("\uC11C\uBC84\uAC00 \uC800\uC7A5\uB41C ID\uB97C \uBC18\uD658\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    return { id: made.id };
  }
  async function updateBook(user, req) {
    gate("world_books");
    const patch = {};
    if (Object.hasOwn(req.patch || {}, "name"))
      patch.name = String(req.patch.name);
    if (Object.hasOwn(req.patch || {}, "description"))
      patch.description = String(req.patch.description);
    const saved = await api.world_books.update(req.id, patch, user);
    return { id: saved.id };
  }
  async function createEntry(user, req) {
    gate("world_books");
    const input = studioEntryToLv(req.entry || {});
    if (input.order_value === undefined) {
      const page = await api.world_books.entries.list(req.bookId, { limit: 1, offset: 0, userId: user });
      input.order_value = (Number(page?.total) + 1) * 10 || 10;
    }
    const made = await api.world_books.entries.create(req.bookId, input, user);
    if (!made?.id)
      throw new Error("\uC11C\uBC84\uAC00 \uC800\uC7A5\uB41C ID\uB97C \uBC18\uD658\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    if (hasEntryDescription(req.entry) && String(req.entry.description || ""))
      await setDescription(user, made.id, req.entry.description);
    return { id: made.id };
  }
  async function updateEntry(user, req) {
    gate("world_books");
    const changes = req.changes || {};
    const input = studioEntryToLv(changes);
    let saved = null;
    if (Object.keys(input).length)
      saved = await api.world_books.entries.update(req.id, input, user);
    if (hasEntryDescription(changes))
      await setDescription(user, req.id, changes.description);
    return { id: saved?.id || req.id };
  }
  async function deleteEntry(user, req) {
    gate("world_books");
    await api.world_books.entries.delete(req.id, user);
    return {};
  }
  async function connections(user) {
    if (!has("generation"))
      return [];
    try {
      const list = await api.connections.list(user);
      return (Array.isArray(list) ? list : []).map((c) => ({ id: String(c.id), name: String(c.name || c.id), model: String(c.model || ""), provider: String(c.provider || "") }));
    } catch {
      return [];
    }
  }
  async function run(req, user) {
    if (!validUser(user))
      throw new Error("\uC0AC\uC6A9\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC5B4\uC694");
    users.add(user);
    const id = req?.id;
    if (id !== undefined && !validId(id))
      throw new Error("\uC798\uBABB\uB41C ID");
    switch (req?.type) {
      case "bootstrap":
        return {
          perms: Object.fromEntries(PERMS.map((p) => [p, has(p)])),
          chat: await activeChat(user),
          connections: await connections(user),
          settings: await readSettings(user),
          generating: [...generating.keys()].filter(isGenerating),
          health: { status: "ok" }
        };
      case "chat":
        return { chat: await activeChat(user) };
      case "characters":
        return { list: await characters(user) };
      case "character":
        return character(user, id);
      case "personas":
        return { list: await personas(user) };
      case "persona":
        return persona(user, id);
      case "lorebooks":
        return { list: await books(user) };
      case "lorebookEntries": {
        gate("world_books");
        return { list: await bookEntries(user, id) };
      }
      case "lorebookRead":
        return bookRead(user, id);
      case "createCharacter":
        return createCharacter(user, req);
      case "updateCharacter":
        return updateCharacter(user, req);
      case "createPersona":
        return createPersona(user, req);
      case "updatePersona":
        return updatePersona(user, req);
      case "createBook":
        return createBook(user, req);
      case "updateBook":
        return updateBook(user, req);
      case "createEntry":
        return createEntry(user, req);
      case "updateEntry":
        return updateEntry(user, req);
      case "deleteEntry":
        return deleteEntry(user, req);
      case "send":
        return send(user, req);
      case "latest":
        return latest(user, req.chatId);
      case "inject":
        return setInjection(user, req);
      case "storageGet":
        return { value: await readJson(STUDIO_PATH, user, {}) };
      case "storagePatch":
        return queued(user, async () => {
          const cur = await readJson(STUDIO_PATH, user, {});
          if (!cur || typeof cur !== "object")
            throw new Error("\uC800\uC7A5\uC18C \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC544\uC694");
          for (const [k, v] of Object.entries(req.patch || {})) {
            if (v === null)
              delete cur[k];
            else
              cur[k] = clone(v);
          }
          await writeJson(STUDIO_PATH, cur, user);
          return {};
        });
      case "setting":
        return queued(user, async () => {
          const cur = await readSettings(user);
          if (req.key === "connectionId")
            cur.connectionId = String(req.value || "");
          else if (req.key === "fold")
            cur.fold = req.value !== false;
          else
            throw new Error("\uC54C \uC218 \uC5C6\uB294 \uC124\uC815");
          await writeJson(SETTINGS_PATH, cur, user);
          return { settings: cur };
        });
      default:
        throw new Error("\uC54C \uC218 \uC5C6\uB294 \uC791\uC5C5");
    }
  }
  function stop() {
    for (const off of offs.splice(0)) {
      try {
        off();
      } catch {}
    }
    try {
      interceptorOff?.();
    } catch {}
    interceptorOff = null;
    injections.clear();
    generating.clear();
  }
  return { run, attach, stop, onPermissionChanged, intercept: (messages, ctx) => injectContext(messages, ctx, [...injections.values()].find((r) => r.chatId === ctx?.chatId)), generating };
}

// src/backend.js
function start(api) {
  const service = createService(api);
  let release = null;
  try {
    release = api.frontendCapabilities?.declare?.("message_tag_interceptor");
  } catch {}
  const offMessage = api.onFrontendMessage(async (payload, userId, frontendSessionId) => {
    if (!payload || typeof payload.requestId !== "string" || typeof userId !== "string" || !userId)
      return;
    let reply;
    try {
      reply = { ok: true, ...await service.run(payload, userId) };
    } catch (error) {
      reply = { ok: false, error: error?.message || String(error) };
    }
    try {
      api.sendToFrontend({ ...reply, requestId: payload.requestId }, userId, frontendSessionId ? { frontendSessionId } : undefined);
    } catch {}
  });
  let offPerm = null;
  try {
    offPerm = api.permissions?.onChanged?.((detail) => service.onPermissionChanged(detail));
  } catch {}
  service.attach();
  return () => {
    service.stop();
    offMessage?.();
    try {
      offPerm?.();
    } catch {}
    try {
      release?.();
    } catch {}
  };
}
if (typeof spindle !== "undefined")
  start(spindle);
export {
  start
};
