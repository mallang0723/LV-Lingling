// 령령의 제작실 (Lumiverse) — how a studio request goes into the RP room and how the room's generation is recognised.
// The hidden-request wrapper and the marker patterns follow the original (it filled the RP input with
// <span class="csm-studio-command">…</span><section class="csm-hidden-prompt" style="display:none">…</section>
// and skipped / classified generation requests by these exact markers).

/** Generation requests that already carry their own studio contract (the original's skip list). */
export const SKIP_PATTERNS = [
    /\[MARINARA_STUDIO_(?:TRANSLATION|REFERENCE|REVISION)\]/u,
    /\[MARINARA_PERSONA_STUDIO_(?:BRIEFING|REVISION)\]/u,
    /\[MARINARA_LOREBOOK_STUDIO_(?:BRIEFING|EXPORT|REVISION)\]/u,
];
/** Character / persona final-draft requests: only the reference context is injected for them. */
export const EXPORT_PATTERN = /\[MARINARA_(?:STUDIO_EXPORT|PERSONA_STUDIO_EXPORT)\]/u;
/** Generation types that are not a new turn (the original skipped regenerate / continue / impersonate). */
export const SKIPPED_GENERATION_TYPES = ['continue', 'regenerate', 'swipe', 'impersonate', 'quiet'];
export const REQUEST_TAG = 'lingling-studio-request';
export const MESSAGE_SOURCE = 'lingling_studio_lv';

export function labelFor(text) {
    const d = String(text || '');
    if (/\[MARINARA_PERSONA_STUDIO_/u.test(d)) return '🎭 페르소나 제작실 · 요청';
    if (/\[MARINARA_LOREBOOK_STUDIO_/u.test(d)) return '📖 로어북 제작실 · 요청';
    if (d.includes('[MARINARA_STUDIO_REFERENCE]')) return '👻 캐릭터 제작실 · 제작 브리핑';
    if (d.includes('[MARINARA_STUDIO_EXPORT]')) return '👻 캐릭터 제작실 · 최종본 요청';
    if (d.includes('[MARINARA_STUDIO_REVISION]')) return '👻 캐릭터 제작실 · 부분 수정 요청';
    return '';
}

/**
 * The text that is put into the RP room: a visible one-line label and the request itself, hidden.
 * Not a studio request → returned as it is. Lumiverse differs from the original in one line: the hidden block is also
 * enclosed in a <lingling-studio-request> tag that the frontend strips from the rendered message (message-tag
 * interceptor), so a blank line inside the request cannot end the HTML block early.
 */
export function wrapRequest(text) {
    const d = String(text || '').trim();
    const label = labelFor(d);
    if (!label) return d;
    const tag = ['section', 'aside', 'nav', 'footer', 'header'].find(t => !new RegExp(`</${t}\\s*>`, 'iu').test(d));
    if (!tag) return d.includes(`</${REQUEST_TAG}>`) ? d : `<span class="csm-studio-command">${label}</span>\n<${REQUEST_TAG}>\n${d}\n</${REQUEST_TAG}>`;
    const hidden = `<${tag} class="csm-hidden-prompt" style="display:none">\n${d}\n</${tag}>`;
    if (d.includes(`</${REQUEST_TAG}>`)) return `<span class="csm-studio-command">${label}</span>\n${hidden}`;
    return `<span class="csm-studio-command">${label}</span>\n<${REQUEST_TAG}>\n${hidden}\n</${REQUEST_TAG}>`;
}

const textOf = c => (typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => (p && p.type === 'text' ? p.text : '')).join('\n') : '');

/**
 * Pre-generation interceptor body: puts the studio's standing context in front of the user turn that is being
 * answered. `rec` is what the frontend registered for the chat: { conversation, export }.
 */
export function injectContext(messages, ctx, rec) {
    if (!rec || !Array.isArray(messages)) return messages;
    if (SKIPPED_GENERATION_TYPES.includes(ctx?.generationType)) return messages;
    let at = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user' && (messages[i].__isChatHistory || at < 0)) { at = i; if (messages[i].__isChatHistory) break; }
    }
    const last = at >= 0 ? textOf(messages[at].content) : '';
    if (SKIP_PATTERNS.some(re => re.test(last))) return messages;
    const body = EXPORT_PATTERN.test(last) ? rec.export : rec.conversation;
    if (!body || !String(body).trim()) return messages;
    const index = at >= 0 ? at : messages.length;
    const out = [...messages.slice(0, index), { role: 'system', content: String(body) }, ...messages.slice(index)];
    return { messages: out, breakdown: [{ messageIndex: index, name: '령령의 제작실' }] };
}
