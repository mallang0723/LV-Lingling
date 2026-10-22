// 령령의 제작실 (Lumiverse) — where the studio lives on screen.
//  - the draggable ghost button      -> a chromeless Spindle float widget (needs `ui_panels`), the host drags it and keeps its position
//  - the draggable window            -> a second float widget; the header is the drag surface (the host starts a drag on any
//                                       pointerdown that reaches it, so the body stops them), a phone-sized screen gets the
//                                       widget's full-screen mode, a desktop window has a resize grip
//  - sidebar tab / Extras action / Ctrl+K palette -> always registered (free): home card + settings, and the studio itself
//                                       when floating widgets are not granted
import { STYLE } from './style.js';
import { applyPalette } from './theme.js';
import { GHOST_PNG } from './ghost.js';
import { Ue } from './original/ui.js';

export const TITLE = '령령의 제작실';
const PHONE = 640;           // viewport width at or below which the window goes full screen
const MIN_W = 340, MIN_H = 360;
const NEED = { generation: '생성(generation)', chats: '채팅(chats)', chat_mutation: '메시지(chat_mutation)', characters: '캐릭터(characters)', personas: '페르소나(personas)', world_books: '월드북(world_books)', interceptor: '상시 주입(interceptor)', ui_panels: '떠 있는 창(ui_panels)' };

export function createShell(ctx, { studio, host, getChatId, doc = globalThis.document, win = globalThis.window }) {
    let alive = true, boot = null, launcher = null, windowWidget = null, winRoot = null, drawerRoot = null, tab = null, action = null, embedded = false, visible = false;
    const disposers = [];
    const viewport = () => {
        try { const v = ctx.ui?.geometry?.layoutViewportSize?.(); if (v?.width) return v; } catch { /* fall through */ }
        return { width: win.innerWidth || 1024, height: win.innerHeight || 768 };
    };
    const el = (tag, attrs = {}, ...kids) => {
        const n = doc.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) { if (v === undefined || v === null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
        for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(typeof c === 'object' && 'nodeType' in c ? c : doc.createTextNode(String(c)));
        return n;
    };
    const style = () => el('style', { text: STYLE });
    const ghostImg = () => {
        const img = el('img', { src: GHOST_PNG, alt: '', draggable: 'false' });
        img.addEventListener('error', () => img.replaceWith(Ue('ghost', 40)), { once: true });   // fall back to the original's ghost icon
        return img;
    };
    const paint = () => { for (const n of [winRoot, drawerRoot, launcher?.firstChild]) { if (n) { try { applyPalette(n, doc); } catch { /* keep colours */ } } } };

    // ---------- the window ----------
    function windowSize() {
        const v = viewport();
        return { width: Math.min(860, Math.max(MIN_W, v.width - 24)), height: Math.min(720, Math.max(MIN_H, v.height - 24)) };
    }
    function ensureWindow() {
        if (windowWidget || embedded || !ctx.ui?.createFloatWidget) return !!windowWidget;
        try {
            const size = windowSize(), v = viewport();
            windowWidget = ctx.ui.createFloatWidget({
                width: size.width, height: size.height, initialPosition: { x: Math.max(12, Math.round((v.width - size.width) / 2)), y: Math.max(12, Math.round((v.height - size.height) / 2)) },
                snapToEdge: false, tooltip: TITLE, chromeless: true, touchScrollMode: 'native', persistGeometry: 'window',
            });
        } catch (e) { windowWidget = null; embedded = true; return false; }
        windowWidget.root.style.cssText = 'width:100%;height:100%';
        winRoot = el('div', { class: 'll-root', role: 'dialog', 'aria-label': TITLE });
        windowWidget.root.append(style(), winRoot);
        // the host starts dragging the widget on any pointerdown that reaches it: only the header may drag
        winRoot.addEventListener('pointerdown', e => { if (!e.target.closest?.('.mcs-shell-header')) e.stopPropagation(); });
        wireResizer();
        // The host swallows the click that follows a drag (and only clears that flag on the next pointerdown that reaches it,
        // which the body never lets through). A touch drag produces no trailing click, so the first tap in the body would be
        // eaten: send one click at the window itself after a drag; the host's capture handler takes it (or, if the real
        // trailing click already did, it lands on the empty root and does nothing).
        try { windowWidget.onDragEnd?.(() => setTimeout(() => { try { winRoot.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); } catch { /* ignore */ } }, 30)); } catch { /* optional */ }
        windowWidget.setVisible(false);
        paint();
        return true;
    }
    function fit() {
        if (!windowWidget) return;
        const v = viewport();
        const phone = v.width <= PHONE;
        const full = typeof windowWidget.isFullscreen === 'function' && windowWidget.isFullscreen();
        if (phone && typeof windowWidget.setFullscreen === 'function' && !full) windowWidget.setFullscreen(true);
        else if (!phone && full) windowWidget.setFullscreen(false);
        else if (phone && typeof windowWidget.setFullscreen !== 'function') windowWidget.setSize(Math.max(MIN_W - 40, v.width - 24), Math.max(MIN_H, v.height - 24));
        winRoot.dataset.full = windowWidget.isFullscreen?.() ? '1' : '';
    }
    function wireResizer() {
        let drag = null;
        winRoot.addEventListener('pointerdown', e => {
            const grip = e.target.closest?.('.mcs-resizer');
            if (!grip || e.button !== 0) return;
            const r = winRoot.getBoundingClientRect();
            drag = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
            try { grip.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            e.preventDefault();
        });
        winRoot.addEventListener('pointermove', e => {
            if (!drag || e.pointerId !== drag.id) return;
            const v = viewport();
            windowWidget.setSize(Math.round(Math.min(v.width - 24, Math.max(MIN_W, drag.w + e.clientX - drag.x))), Math.round(Math.min(v.height - 24, Math.max(MIN_H, drag.h + e.clientY - drag.y))));
        });
        const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
        winRoot.addEventListener('pointerup', end);
        winRoot.addEventListener('pointercancel', end);
    }

    function open() {
        if (!alive) return;
        if (ensureWindow()) {
            windowWidget.setVisible(true);
            launcher?.widget.setVisible(false);
            visible = true;
            fit();
            studio.attach(winRoot);
            studio.ensureLibrary();
            refreshHome();
            try { winRoot.querySelector('.mcs-shell-header__actions button:last-child')?.focus({ preventScroll: true }); } catch { /* optional */ }
            return;
        }
        // no floating widgets: the studio opens inside the sidebar tab
        embedded = true;
        try { tab?.activate(); } catch { /* ignore */ }
        mountEmbedded();
    }
    function close() {
        studio.persistAll();
        if (windowWidget) {
            windowWidget.setVisible(false);
            launcher?.widget.setVisible(true);
            studio.detach();
        } else if (embedded) { studio.detach(); embeddedRoot?.remove(); embeddedRoot = null; }
        visible = false;
        refreshHome();
    }

    // ---------- the ghost button ----------
    function createLauncher() {
        if (!ctx.ui?.createFloatWidget) return;
        try {
            const v = viewport();
            const widget = ctx.ui.createFloatWidget({ width: 56, height: 72, initialPosition: { x: Math.max(12, v.width - 56 - 16), y: Math.max(12, v.height - 72 - 96) }, snapToEdge: true, tooltip: TITLE, chromeless: true, touchScrollMode: 'native', persistGeometry: 'launcher' });
            widget.root.style.cssText = 'width:100%;height:100%';
            const button = el('button', { class: 'll-launcher', type: 'button', 'aria-label': TITLE, title: TITLE, onclick: () => open() }, ghostImg(), el('span', { class: 'll-tip', text: TITLE }));
            const holder = el('div', { class: 'll-root', style: 'width:100%;height:100%;border:0;background:transparent;box-shadow:none;border-radius:0;overflow:visible;container-type:normal' }, button);
            widget.root.append(style(), holder);
            launcher = { widget, button, firstChild: holder };
        } catch { launcher = null; }
    }

    // ---------- sidebar tab ----------
    let embeddedRoot = null;
    function mountEmbedded() {
        if (!drawerRoot) return;
        embeddedRoot?.remove();
        embeddedRoot = el('div', { class: 'll-studio' }, el('div', { class: 'll-root' }));
        drawerRoot.append(embeddedRoot);
        winRoot = embeddedRoot.firstChild;
        paint();
        visible = true;
        studio.attach(winRoot);
        studio.ensureLibrary();
    }
    function registerTab() {
        try {
            tab = ctx.ui.registerDrawerTab({
                id: 'lingling', title: TITLE, shortName: '령령', headerTitle: TITLE,
                description: '령령과 캐릭터·페르소나·로어북을 만들고 저장 (원작: 령령의 마리나라 제작실)',
                keywords: ['령령', '제작실', '캐릭터 제작', '페르소나', '로어북', '월드북', 'lingling', 'studio', 'ghost', '유령'],
                iconSvg: Ue('ghost', 20).outerHTML,
            });
            drawerRoot = el('div', { class: 'll-drawer' });
            tab.root.replaceChildren(style(), drawerRoot);
            paint();
            refreshHome();
            disposers.push(tab.onActivate(() => { refreshBoot(); }));
        } catch { tab = null; }
        try {
            action = ctx.ui.registerInputBarAction({ id: 'lingling-open', label: TITLE, iconSvg: Ue('ghost', 14).outerHTML });
            disposers.push(action.onClick(() => open()));
        } catch { action = null; }
    }
    function refreshHome() {
        if (!drawerRoot || !alive) return;
        const keep = embeddedRoot && embeddedRoot.isConnected ? embeddedRoot : null;
        const chat = studio.chat;
        const perms = boot?.perms || {};
        const missing = Object.entries(NEED).filter(([k]) => boot && perms[k] === false).map(([, label]) => label);
        const conns = boot?.connections || [];
        const settings = boot?.settings || { connectionId: '', fold: true };
        const chatId = getChatId();
        const active = boot?.chat && boot.chat.chatId === chatId ? boot.chat : null;
        const home = el('div', { class: 'll-card' },
            el('div', { class: 'll-hero' }, ghostImg(), el('div', {}, el('h2', { text: TITLE }), el('p', { text: '령령과 대화하며 캐릭터·페르소나·로어북을 만들어 루미버스에 저장해요.' }))),
            el('p', { class: chatId ? 'll-ok' : 'll-warn', text: chatId ? `연결된 방: ${active ? `${active.name || '이름 없는 채팅'} · ${active.characterName || '캐릭터 없음'}` : '열려 있는 채팅'}` : '채팅을 열어 두면 그 방으로 요청을 보내요. (령령 카드의 1:1 채팅 권장)' }),
            active && active.characterName && active.characterName !== '{{char}}' ? el('p', { class: 'll-warn', text: '이 방의 캐릭터 이름이 {{char}}가 아니에요. 령령 카드가 맞는지 확인해 주세요.' }) : null,
            chat.generating ? el('p', { text: '령령이 답하는 중이에요…' }) : null,
            el('button', { class: 'll-btn', type: 'button', text: visible ? '제작실 닫기' : '제작실 열기', onclick: () => (visible ? close() : open()) }));
        const form = el('div', { class: 'll-card' },
            el('label', { class: 'll-row' }, '령령에게 보낼 때 쓸 연결',
                (() => {
                    const sel = el('select', { 'aria-label': '령령 요청용 연결' }, el('option', { value: '', text: '채팅의 기본 연결' }), conns.map(c => el('option', { value: c.id, text: `${c.name}${c.model ? ` · ${c.model}` : ''}` })));
                    sel.value = conns.some(c => c.id === settings.connectionId) ? settings.connectionId : '';
                    sel.addEventListener('change', () => saveSetting('connectionId', sel.value));
                    return sel;
                })()),
            el('label', { class: 'll-check' }, (() => { const c = el('input', { type: 'checkbox' }); c.checked = settings.fold !== false; c.addEventListener('change', () => saveSetting('fold', c.checked)); return c; })(),
                el('span', {}, '배경 이야기·외모를 설명에 합쳐 저장', el('small', { text: '루미버스에는 이 칸이 없어요. 끄면 제작실에서만 따로 보관되고 RP 프롬프트에는 안 들어가요.' }))),
            missing.length ? el('p', { class: 'll-warn', text: `허용되지 않은 권한: ${missing.join(', ')} — 확장 패널에서 허용해 주세요.` }) : null);
        const help = el('div', { class: 'll-card' }, el('p', { text: '사용 순서' }), el('ul', {}, ['령령 카드가 있는 채팅을 열기', '오른쪽 아래 유령 버튼(또는 이 탭의 제작실 열기)', '1 준비 → 2 제작 → 3 편집 → 4 최종 저장'].map(t => el('li', { text: t }))));
        drawerRoot.replaceChildren(home, form, help);
        if (keep) drawerRoot.append(keep);
    }
    async function saveSetting(key, value) {
        try { const r = await host.rpc('setting', { key, value }); if (boot) boot.settings = r.settings; } catch (e) { ctx.ui?.showToast?.(e.message); }
        refreshHome();
    }
    async function refreshBoot() {
        try { const b = await host.rpc('bootstrap'); if (alive) { boot = b; refreshHome(); } } catch { /* shown as "no info" */ }
        return boot;
    }

    // ---------- tag interceptor: the hidden request block is not shown in the chat ----------
    function hideRequests() {
        try {
            const off = ctx.messages?.registerTagInterceptor?.({ tagName: 'lingling-studio-request', removeFromMessage: true }, () => {});
            if (typeof off === 'function') disposers.push(off);
        } catch { /* older host: the request stays visible (still hidden by display:none where styles are kept) */ }
    }

    // ---------- start ----------
    createLauncher();
    registerTab();
    hideRequests();
    const onResize = () => { if (visible && windowWidget) fit(); };
    win.addEventListener?.('resize', onResize);
    let paintTimer = 0;
    const repaint = () => { clearTimeout(paintTimer); paintTimer = setTimeout(paint, 80); };
    let mo = null;
    try { mo = new win.MutationObserver(repaint); mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] }); } catch { /* optional */ }
    const offState = (() => { try { return ctx.state?.subscribe?.('chat.active', () => { studio.chatChanged(); refreshBoot(); }); } catch { return null; } })();

    return {
        open, close, refreshBoot, refreshHome, paint,
        get visible() { return visible; },
        get embedded() { return embedded; },
        setBoot(b) { boot = b; refreshHome(); },
        dispose() {
            alive = false;
            win.removeEventListener?.('resize', onResize);
            try { mo?.disconnect(); } catch { /* ignore */ }
            clearTimeout(paintTimer);
            try { offState?.(); } catch { /* ignore */ }
            for (const d of disposers) { try { d(); } catch { /* ignore */ } }
            for (const w of [windowWidget, launcher?.widget]) { try { w?.destroy(); } catch { /* ignore */ } }
            try { tab?.destroy(); } catch { /* ignore */ }
            try { action?.destroy(); } catch { /* ignore */ }
        },
    };
}
