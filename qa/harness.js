// Browser QA stub of the Lumiverse frontend: the built dist/frontend.js talks to the real backend entry (src/backend.js)
// over an in-page channel; underneath is the in-memory fake Spindle API of tests/fake.js (no network, no model calls).
// The float widget below copies the real host's behaviour (frontend/src/components/spindle/SpindleFloatWidget.tsx +
// spindle-float-widget-layout.ts, Lumiverse 1.2.5): a drag starts on any pointerdown that reaches the wrapper (except form
// fields / links / contenteditable), 4px slop, pointer capture, clamp to the viewport with 12px padding, snap to edge,
// mobile clamp of the requested size, full screen = touch-action:auto.
import { setup } from '../dist/frontend.js';
import { start } from '../src/backend.js';
import { fake, REPLY_CHARACTER } from '../tests/fake.js';

const USER = 'qa-user';
let toFrontend = null;
const f = fake({ onSend: (m, user) => { if (user === USER) setTimeout(() => toFrontend?.(m), 4); } });
f.state.botDelay = 250;
const PERSONA_REPLY = `<<<MARINARA_PERSONA_EXPORT_V1>>>
[NAME]
나
[/NAME]
[DESCRIPTION]
평범한 대학생. 야식을 좋아한다.
[/DESCRIPTION]
[PERSONALITY]
조용하지만 호기심이 많다.
[/PERSONALITY]
[BACKSTORY]
지방에서 올라와 자취 중.
[/BACKSTORY]
[APPEARANCE]
안경, 큰 후드티.
[/APPEARANCE]
[SCENARIO]
기말고사 기간.
[/SCENARIO]
<<<END_MARINARA_PERSONA_EXPORT_V1>>>`;
const LORE_REPLY = `<<<MARINARA_LOREBOOK_EXPORT_V1>>>
${JSON.stringify({ name: '가을 마을', description: '하루의 빵집이 있는 마을', entries: [
    { name: '빵집', type: 'normal', keys: ['빵집', '하루'], description: '마을의 빵집', content: '30년 된 빵집. 사장은 하루.' },
    { name: '계절', type: 'constant', keys: [], description: '', content: '마을은 늘 가을이다.' },
    { name: '축제', type: 'selective', keys: ['축제'], description: '', content: '가을 축제는 사흘 동안 열린다.' },
] }, null, 2)}
<<<END_MARINARA_LOREBOOK_EXPORT_V1>>>`;
const REVISION_REPLY = `<<<MARINARA_CHARACTER_PATCH_V2>>>
[PERSONALITY]
무뚝뚝하지만 속정이 깊다. (수정됨)
[/PERSONALITY]
<<<END_MARINARA_CHARACTER_PATCH_V2>>>`;
f.state.replyText = list => {
    const last = [...list].reverse().find(m => m.role === 'user')?.content || '';
    if (last.includes('[MARINARA_STUDIO_EXPORT]')) return REPLY_CHARACTER;
    if (last.includes('[MARINARA_STUDIO_REVISION]')) return REVISION_REPLY;
    if (last.includes('[MARINARA_PERSONA_STUDIO_EXPORT]')) return PERSONA_REPLY;
    if (last.includes('[MARINARA_LOREBOOK_STUDIO_EXPORT]')) return LORE_REPLY;
    return '오오, 좋은데? *눈을 반짝인다* 더 말해봐ㅋㅋ';
};
start(f.api);

// ---------- Lumiverse host stand-ins ----------
const state = { 'chat.active': { chatId: 'chat-a', characterId: 'char-ling' } };
const subs = new Map(), activators = new Set(), actions = [], widgets = [];
let activations = 0, confirmAnswer = true, perms = new Set(['ui_panels']);
const confirms = [], tagInterceptors = [];
const modals = document.getElementById('modals');
const tabHost = document.getElementById('tab-host');
const drawer = document.getElementById('drawer');
const isMobile = () => matchMedia('(max-width: 768px)').matches;
const PAD = 12;
const layoutViewport = () => ({ width: window.innerWidth, height: window.innerHeight });

function createFloatWidget(o = {}) {
    if (!perms.has('ui_panels')) throw new Error('PERMISSION_DENIED: ui_panels');
    const w = { id: 'w' + widgets.length, x: o.initialPosition?.x ?? 0, y: o.initialPosition?.y ?? 0, width: o.width, height: o.height, full: false, visible: true, snap: o.snapToEdge ?? true, dragEnds: new Set(), options: o };
    const wrap = document.createElement('div');
    wrap.className = 'widget' + (o.chromeless ? ' chromeless' : '');
    wrap.title = o.tooltip || '';
    const content = document.createElement('div'); content.className = 'content';
    const root = document.createElement('div');
    content.append(root); wrap.append(content); document.body.append(wrap);
    w.wrap = wrap; w.root = root;
    const size = () => (isMobile() ? { width: Math.max(1, Math.min(w.width, window.innerWidth - PAD * 2)), height: Math.max(1, Math.min(w.height, window.innerHeight - PAD * 2)) } : { width: w.width, height: w.height });
    const clampPos = (x, y) => { const s = size(); return { x: Math.max(PAD, Math.min(x, window.innerWidth - s.width - PAD)), y: Math.max(PAD, Math.min(y, window.innerHeight - s.height - PAD)) }; };
    const apply = () => {
        wrap.classList.toggle('fullscreen', w.full);
        wrap.style.display = w.visible ? '' : 'none';
        if (w.full) { Object.assign(wrap.style, { left: '0px', top: '0px', width: window.innerWidth + 'px', height: window.innerHeight + 'px' }); return; }
        const s = size(), p = clampPos(w.x, w.y);
        Object.assign(wrap.style, { left: p.x + 'px', top: p.y + 'px', width: s.width + 'px', height: s.height + 'px' });
    };
    const snapToEdge = (x, y) => {
        if (!w.snap) return { x, y };
        const d = 24, s = size(), vw = window.innerWidth, vh = window.innerHeight;
        let sx = x, sy = y;
        if (x < d) sx = PAD; else if (x + s.width > vw - d) sx = vw - s.width - PAD;
        if (y < d) sy = PAD; else if (y + s.height > vh - d) sy = vh - s.height - PAD;
        return { x: sx, y: sy };
    };
    let suppressClick = false;
    wrap.addEventListener('pointerdown', e => {
        if (w.full || e.defaultPrevented || e.button !== 0 || (e.pointerType === 'touch' && !e.isPrimary)) return;
        suppressClick = false;
        for (const t of e.composedPath()) {
            if (t === wrap) break;
            if (t instanceof Element && t.matches('input, textarea, select, option, a[href], [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="textbox"], [data-spindle-float-resize-handle]')) return;
        }
        const id = e.pointerId, sx = e.clientX, sy = e.clientY, start = { x: w.x, y: w.y };
        let moved = false, pos = start;
        const onMove = ev => {
            if (ev.pointerId !== id) return;
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (!moved) { if (Math.hypot(dx, dy) < 4) return; moved = true; suppressClick = true; wrap.setPointerCapture(id); }
            pos = clampPos(start.x + dx, start.y + dy); w.x = pos.x; w.y = pos.y; apply();
        };
        const finish = ev => {
            if (ev && ev.pointerId !== id) return;
            window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish);
            if (wrap.hasPointerCapture(id)) wrap.releasePointerCapture(id);
            if (!moved) return;
            const s = snapToEdge(pos.x, pos.y); w.x = s.x; w.y = s.y; apply();
            for (const fn of w.dragEnds) fn({ x: w.x, y: w.y });
        };
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
    });
    wrap.addEventListener('click', e => { if (suppressClick && e.detail !== 0) { suppressClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
    window.addEventListener('resize', apply);
    w.api = {
        root, widgetId: w.id,
        moveTo(x, y) { w.x = x; w.y = y; apply(); },
        getPosition: () => ({ x: w.x, y: w.y }),
        setSize(width, height) { if (w.full) return; w.width = Math.round(width); w.height = Math.round(height); apply(); },
        setVisible(v) { w.visible = v; apply(); },
        isVisible: () => w.visible,
        setFullscreen(v) { w.full = !!v; apply(); },
        isFullscreen: () => w.full,
        onDragEnd(fn) { w.dragEnds.add(fn); return () => w.dragEnds.delete(fn); },
        destroy() { wrap.remove(); window.removeEventListener('resize', apply); },
    };
    apply();
    widgets.push(w);
    return w.api;
}

const ctx = {
    ui: {
        geometry: { layoutViewportSize: layoutViewport },
        createFloatWidget,
        registerDrawerTab(o) {
            const root = document.createElement('div');
            tabHost.append(root);
            return { root, tabId: 'lingling_studio_lv:' + o.id, options: o, activate() { activations++; drawer.classList.add('on'); for (const fn of activators) fn(); }, onActivate(fn) { activators.add(fn); return () => activators.delete(fn); }, destroy() { root.remove(); } };
        },
        registerInputBarAction(o) {
            const handlers = new Set();
            const a = { options: o, click() { for (const h of handlers) h(); }, onClick(fn) { handlers.add(fn); return () => handlers.delete(fn); }, destroy() {} };
            actions.push(a);
            return a;
        },
        async showConfirm(o) { confirms.push(o); return { confirmed: confirmAnswer }; },
    },
    messages: { registerTagInterceptor(o) { tagInterceptors.push(o); return () => {}; } },
    onBackendMessage(fn) { toFrontend = fn; return () => { toFrontend = null; }; },
    sendToBackend(m) { setTimeout(() => f.frontendHandler?.(JSON.parse(JSON.stringify(m)), USER, 'qa-session'), 4); },
    state: {
        get: k => state[k],
        subscribe(k, fn) { if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(fn); return () => subs.get(k).delete(fn); },
    },
};
// a composer only when asked for (the real 1.2.5 host has none; newer ones do)
const composer = { text: '', setText(t) { this.text = t; }, insertText(t) { this.text += t; }, focus() {}, getState: () => ({ mounted: true }) };

let dispose = null;
const mount = (extra = {}) => { dispose = setup({ ...ctx, ...extra }); };
const query = new URLSearchParams(location.search);
if (query.get('composer')) mount({ composer }); else mount();
const hostThemes = await (await fetch('./host-themes.json')).json();
function setTheme(name) {
    const set = hostThemes[name];
    if (!set) throw Error('unknown theme ' + name);
    const root = document.documentElement;
    for (const p of [...root.style]) if (p.startsWith('--lumiverse-')) root.style.removeProperty(p);
    for (const [k, v] of Object.entries(set)) root.style.setProperty(k, v);
}
setTheme('default-dark');
window.qa = {
    fake: f, ctx, setTheme, actions, confirms, composer, tagInterceptors, widgets,
    themes: Object.keys(hostThemes).filter(k => !k.startsWith('_')),
    get activations() { return activations; },
    set confirmAnswer(v) { confirmAnswer = v; },
    denyPanels() { perms = new Set(); },
    root: () => document.querySelector('.ll-root[role="dialog"]') || document.querySelector('.ll-studio .ll-root'),
    launcher: () => document.querySelector('.ll-launcher'),
    scroller: () => document.querySelector('.ll-root .mcs-main'),
    env: () => ({ secure: window.isSecureContext, randomUUID: typeof crypto?.randomUUID, subtle: typeof crypto?.subtle, clipboard: typeof navigator.clipboard, origin: location.origin }),
    switchChat(chatId) { state['chat.active'] = { chatId, characterId: null }; f.setActive(chatId); for (const fn of subs.get('chat.active') || []) fn(state['chat.active']); },
    remount(extra) { dispose?.(); for (const w of widgets.splice(0)) w.api.destroy(); tabHost.replaceChildren(); mount(extra); },
    ready: true,
};
