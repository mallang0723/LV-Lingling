// Browser QA of the built extension (dist/frontend.js + src/backend.js on the fake Spindle API) inside a Lumiverse stand-in
// (qa/harness.html: drawer + float widgets with the real host's drag / touch-action / full-screen rules).
// Firefox and Chromium, 360x640 (touch) and 1280x800, on two origins:
//  - "insecure": http://qa.test (served from disk through page.route) — a non-loopback http origin is NOT a secure context,
//    so crypto.randomUUID / crypto.subtle / navigator.clipboard are missing exactly as on a phone over plain http,
//  - "secure": http://127.0.0.1 (a secure context).
// Plus Chromium at 700x900 (touch): a windowed (not full screen) float widget, to prove a touch swipe scrolls the window body
// and does not drag the widget.
// Per screen: horizontal overflow, text >= 15px (meta >= 13px), tap targets >= 44px, text contrast >= 4.5:1 on what is
// actually behind it, no scroll container in the window other than .mcs-main. The 5 host themes of qa/host-themes.json
// (Lumiverse's own theme engine output) are applied in turn: light themes must paint light, dark ones dark.
// No network, no model calls. Playwright is not a dependency: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs,
// FIREFOX_BIN, CHROMIUM_BIN. Screenshots go to QA_SHOT_DIR (default ~/qa-work/lingling-lv).
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(e => { console.error('Playwright not found (set PLAYWRIGHT_MODULE):', e.message); process.exit(2); });
const VIEWPORTS = [{ width: 360, height: 640, touch: true }, { width: 1280, height: 800, touch: false }];
const shotDir = process.env.QA_SHOT_DIR || path.join(os.homedir(), 'qa-work/lingling-lv');
const only = (process.env.QA_ONLY || '').split(',').filter(Boolean);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
const serve = async pathname => {
    const file = path.resolve('.' + decodeURIComponent(pathname));
    if (!file.startsWith(process.cwd() + path.sep)) throw 0;
    return { body: await readFile(file), type: types[path.extname(file)] || 'text/plain' };
};
const server = createServer(async (req, res) => {
    try { const r = await serve(new URL(req.url, 'http://x').pathname); res.setHeader('Content-Type', r.type); res.end(r.body); } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGINS = { secure: `http://127.0.0.1:${server.address().port}/qa/harness.html`, insecure: 'http://qa.test/qa/harness.html' };
const browsers = [['firefox', pw.firefox, process.env.FIREFOX_BIN || undefined], ['chromium', pw.chromium, process.env.CHROMIUM_BIN || undefined]];
const failures = [], rows = [], themeRows = [], envRows = [], notes = [];
const SECONDARY = '.mcs-hint,.mcs-summary-count,.mcs-editor-section__status,.mcs-editor-token-count,.mcs-character-summary__token-total,.mcs-segmented__item small,.mcs-step__number,.mcs-keyword-summary-selected,.mcs-context-help__body,.ll-drawer p,.ll-drawer small,.ll-drawer ul,.mcs-check-status';
const EXEMPT = [{ selector: '.mcs-resizer', reason: 'pointer-only resize grip (not shown on touch screens / full screen)' }, { selector: '.mcs-step__number', reason: 'digit badge: contrast only' }];

// ---------- in-page measurement ----------
function measure({ SECONDARY, EXEMPT }) {
    const panel = qa.root();
    const box = panel.getBoundingClientRect();
    const shown = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const name = e => e.tagName.toLowerCase() + ([...e.classList].length ? '.' + [...e.classList].join('.') : '') + (e.textContent.trim() ? '「' + e.textContent.trim().slice(0, 14) + '」' : '');
    const all = [...panel.querySelectorAll('*')].filter(shown);
    const main = panel.querySelector('.mcs-main');
    const mainBox = main?.getBoundingClientRect();
    // horizontal overflow: nothing may stick out of the window; inside the scroller nothing may be wider than it
    const overflow = all.filter(e => { const r = e.getBoundingClientRect(); if (e.closest('.mcs-resizer')) return false; return r.right > box.right + 1 || r.left < box.left - 1 || (mainBox && main.contains(e) && r.right > mainBox.right + 1); }).slice(0, 5).map(name);
    const parse = c => { const m = c.match(/[\d.]+/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const over = (c, b) => ({ r: c.r * c.a + b.r * (1 - c.a), g: c.g * c.a + b.g * (1 - c.a), b: c.b * c.a + b.b * (1 - c.a), a: 1 });
    const backOf = e => { const layers = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); if (c && c.a >= 1) break; } let b = { r: 255, g: 255, b: 255, a: 1 }; for (const c of layers.reverse()) b = over(c, b); return b; };
    const ratio = e => { const b = backOf(e), c = over(parse(getComputedStyle(e).color), b), x = lum(c), y = lum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
    const exemptSize = e => EXEMPT.some(x => e.closest(x.selector));
    const inactive = e => !!e.closest('button:disabled, textarea:disabled, .is-disabled');
    const texts = all.filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    const isSecondary = e => !!e.closest(SECONDARY);
    const fonts = texts.filter(e => !e.closest('svg')).map(e => ({ e, size: parseFloat(getComputedStyle(e).fontSize), secondary: isSecondary(e) }));
    const smallPrimary = fonts.filter(x => !x.secondary && x.size < 15), smallSecondary = fonts.filter(x => x.secondary && x.size < 13);
    const lowContrast = texts.filter(e => !inactive(e) && !e.closest('.mcs-toast')).map(e => ({ e, r: ratio(e) })).filter(x => x.r < 4.5);
    const fields = [...panel.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select')].filter(shown).filter(e => !inactive(e));
    const fieldLow = fields.map(e => ({ e, r: ratio(e) })).filter(x => x.r < 4.5);
    const taps = [...panel.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]), textarea, summary, label.mcs-toggle-row, label.mcs-external-use, label.mcs-choice-row')].filter(shown).filter(e => !e.closest('.mcs-resizer'));
    const tapSize = e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); };
    const shortTaps = taps.filter(e => tapSize(e) < 43.5);
    const scrollers = all.filter(e => e.tagName !== 'TEXTAREA' && e.tagName !== 'SELECT' && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && !e.classList.contains('mcs-main'));
    const embedded = !!panel.closest('.ll-studio');
    const fmt = (list, k) => list.slice(0, 6).map(x => name(x.e || x) + '=' + Math.round((k ? x[k] : tapSize(x.e || x)) * 100) / 100);
    const minOf = list => (list.length ? Math.min(...list) : null);
    return {
        app: { w: Math.round(box.width), h: Math.round(box.height) },
        overflow, otherScrollers: embedded ? [] : scrollers.map(name),
        minText: minOf(fonts.filter(x => !x.secondary).map(x => x.size)), minMeta: minOf(fonts.filter(x => x.secondary).map(x => x.size)),
        minTap: Math.round(minOf(taps.map(tapSize)) * 10) / 10,
        minContrast: minOf([...texts.filter(e => !inactive(e) && !e.closest('.mcs-toast')).map(ratio), ...fields.map(ratio)]),
        smallPrimary: smallPrimary.length, smallSecondary: smallSecondary.length, shortTaps: shortTaps.length, lowContrast: lowContrast.length + fieldLow.length,
        examples: [...fmt(smallPrimary, 'size'), ...fmt(smallSecondary, 'size'), ...fmt(shortTaps), ...fmt([...lowContrast, ...fieldLow], 'r')],
        palette: panel.dataset.palette, mode: panel.dataset.mode, full: panel.dataset.full || '',
        bgLum: Math.round(lum(backOf(panel)) * 100) / 100,
        scrollTop: main ? Math.round(main.scrollTop) : null, canScroll: main ? main.scrollHeight > main.clientHeight + 2 : null,
    };
}

try {
    await mkdir(shotDir, { recursive: true });
    const variants = [];
    for (const [bname, type, exe] of browsers) for (const oname of Object.keys(ORIGINS)) for (const vp of VIEWPORTS) variants.push({ bname, type, exe, oname, vp });
    variants.push({ bname: 'chromium', type: pw.chromium, exe: process.env.CHROMIUM_BIN || undefined, oname: 'insecure', vp: { width: 700, height: 900, touch: true, windowed: true } });
    const launched = new Map();
    for (const { bname, type, exe, oname, vp } of variants) {
        const tag = `${bname}-${vp.width}x${vp.height}-${oname}`;
        if (only.length && !only.includes(tag)) continue;
        if (!launched.has(bname)) {
            try { launched.set(bname, await type.launch(exe ? { executablePath: exe } : {})); } catch (e) { failures.push(`${bname}: launch failed ${e.message.split('\n')[0]}`); launched.set(bname, null); }
        }
        const browser = launched.get(bname);
        if (!browser) continue;
        const url = ORIGINS[oname];
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, ...(bname === 'chromium' && vp.touch ? { isMobile: true, deviceScaleFactor: 2 } : {}), locale: 'ko-KR', permissions: [], reducedMotion: 'reduce' });
        if (oname === 'insecure') {
            await context.route('http://qa.test/**', async route => {
                try { const r = await serve(new URL(route.request().url()).pathname); await route.fulfill({ status: 200, contentType: r.type, body: r.body }); } catch { await route.fulfill({ status: 404, body: '' }); }
            });
        }
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await page.goto(url);
        await page.waitForFunction(() => window.qa?.ready, null, { timeout: 15000 });
        await page.waitForTimeout(500);
        const sleep = ms => page.waitForTimeout(ms);
        const until = async (fn, arg, label, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw Error('timeout: ' + label); } };
        const click = async sel => {
            const ok = await page.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, sel);
            if (!ok) throw Error('missing ' + sel);
            await sleep(120);
        };
        const clickText = async (scope, text, { real = false } = {}) => {
            const idx = await page.evaluate(([s, t]) => { const list = [...document.querySelectorAll(s)]; const i = list.findIndex(x => x.textContent.trim().includes(t) && !x.disabled); if (i < 0) return -1; list[i].scrollIntoView({ block: 'center' }); list[i].setAttribute('data-qa-hit', '1'); return i; }, [scope, text]);
            if (idx < 0) throw Error(`missing "${text}" in ${scope}`);
            if (real) await page.click('[data-qa-hit="1"]'); else await page.evaluate(() => document.querySelector('[data-qa-hit="1"]').click());
            await page.evaluate(() => document.querySelector('[data-qa-hit="1"]')?.removeAttribute('data-qa-hit'));
            await sleep(150);
        };
        const set = (sel, value) => page.evaluate(([s, v]) => { const t = document.querySelector(s); if (!t) throw Error('missing ' + s); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, value]);
        const R = '.ll-root[role="dialog"]';
        const text = () => page.evaluate(() => qa.root()?.innerText || '');
        const toast = () => page.evaluate(() => document.querySelector('.ll-root .mcs-toast')?.innerText || document.querySelector('.ll-root .mls-message')?.innerText || '');
        // real touch input through CDP touch events (Input.synthesizeScrollGesture 'touch' does not scroll in this headless build)
        const touchDrag = async (cdp, x, y, dx, dy, steps = 12) => {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await sleep(400);
        };
        const goStep = async n => { const ok = await page.evaluate(i => { const b = [...document.querySelectorAll('.ll-root .mcs-stepper button.mcs-step')][i - 1]; if (!b) return false; b.click(); return true; }, n); if (!ok) throw Error('missing step ' + n); await sleep(150); };
        const openSection = async label => { await page.evaluate(l => { const b = [...document.querySelectorAll('.ll-root .mcs-editor-section__toggle')].find(x => x.textContent.includes(l)); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, label); await sleep(120); };
        const topOfMain = () => page.evaluate(() => { const m = qa.scroller(); if (m) m.scrollTop = 0; });
        const check = async view => {
            const m = await page.evaluate(measure, { SECONDARY, EXEMPT });
            const file = path.join(shotDir, `${tag}-${view}.png`);
            await page.screenshot({ path: file });
            rows.push({ origin: oname, browser: bname, viewport: `${vp.width}x${vp.height}`, view, screenshot: path.basename(file), ...m });
            if (m.overflow.length) failures.push(`${tag} ${view}: horizontal overflow ${m.overflow.join(' | ')}`);
            if (m.otherScrollers.length) failures.push(`${tag} ${view}: nested scroll containers ${m.otherScrollers.join(', ')}`);
            if (m.smallPrimary || m.smallSecondary || m.shortTaps) failures.push(`${tag} ${view}: text<15 ${m.smallPrimary}, meta<13 ${m.smallSecondary}, taps<44 ${m.shortTaps} · ${m.examples.join(' | ')}`);
            if (m.lowContrast) failures.push(`${tag} ${view}: contrast<4.5 ${m.lowContrast} · ${m.examples.join(' | ')}`);
            return m;
        };
        const step = async (label, fn) => { try { await fn(); } catch (e) { failures.push(`${tag} ${label}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: path.join(shotDir, `FAIL-${tag}-${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`) }).catch(() => {}); } };
        const noteOnce = msg => { if (!notes.includes(msg)) notes.push(msg); };

        await step('environment', async () => {
            const env = await page.evaluate(() => qa.env());
            envRows.push({ tag, ...env });
            if (oname === 'insecure' && (env.secure !== false || env.randomUUID !== 'undefined' || env.clipboard !== 'undefined')) throw Error('not an insecure context: ' + JSON.stringify(env));
            if (oname === 'secure' && env.secure !== true) throw Error('expected a secure context: ' + JSON.stringify(env));
            if (errors.length) throw Error('page errors at start: ' + errors.join(' | '));
        });
        await step('launcher (ghost float widget)', async () => {
            const l = await page.evaluate(() => { const b = qa.launcher(); const r = b.getBoundingClientRect(); const img = b.querySelector('img'); return { w: r.width, h: r.height, x: r.x, y: r.y, vw: innerWidth, vh: innerHeight, img: !!img && img.complete && img.naturalWidth > 0, tip: b.getAttribute('aria-label') }; });
            if (l.w < 44 || l.h < 44) throw Error(`launcher too small ${l.w}x${l.h}`);
            if (l.x < 0 || l.y < 0 || l.x + l.w > l.vw || l.y + l.h > l.vh) throw Error('launcher outside the viewport');
            if (!l.img) throw Error('ghost image did not load');
            await page.screenshot({ path: path.join(shotDir, `${tag}-launcher.png`) });
            // drag it (host drag) and make sure the drag does not open the window
            const b = await page.locator('.ll-launcher').boundingBox();
            const sx = b.x + b.width / 2, sy = b.y + b.height / 2;
            await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx - 80, sy - 90, { steps: 8 }); await page.mouse.up();
            await sleep(150);
            const moved = await page.locator('.ll-launcher').boundingBox();
            if (Math.abs(moved.x - b.x) < 20 && Math.abs(moved.y - b.y) < 20) throw Error('launcher did not move when dragged');
            if (await page.evaluate(() => !!qa.root() && qa.widgets[1]?.visible)) throw Error('a drag opened the window');
        });
        await step('open the window', async () => {
            await page.locator('.ll-launcher').click();
            await until(() => qa.root() && qa.widgets[1]?.visible, null, 'window visible');
            await until(() => qa.root().querySelector('.mcs-step-panel'), null, 'studio rendered');
            const info = await page.evaluate(() => { const w = qa.widgets[1]; const r = qa.root().getBoundingClientRect(); return { full: w.full, w: r.width, h: r.height, launcherHidden: !qa.widgets[0].visible, vw: innerWidth }; });
            const expectFull = vp.width <= 640;
            if (info.full !== expectFull) throw Error(`full screen ${info.full}, expected ${expectFull} at ${vp.width}px`);
            if (expectFull && (Math.round(info.w) !== info.vw)) throw Error(`full-screen window is ${info.w}px wide in a ${info.vw}px viewport`);
            if (!info.launcherHidden) throw Error('the ghost button stays while the window is open');
            await sleep(200);
            await check('character-prepare');
        });
        if (!vp.touch || vp.windowed) await step('desktop window: drag by header, not by body; resize grip', async () => {
            if (vp.width <= 640) return;
            const pos = () => page.evaluate(() => { const r = qa.root().getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
            const p0 = await pos();
            // a mouse drag that starts on the body must not move the window
            const body = await page.locator('.ll-root .mcs-section-heading h2').first().boundingBox();
            await page.mouse.move(body.x + 10, body.y + 8); await page.mouse.down(); await page.mouse.move(body.x + 90, body.y + 70, { steps: 6 }); await page.mouse.up();
            const p1 = await pos();
            if (Math.abs(p1.x - p0.x) > 1 || Math.abs(p1.y - p0.y) > 1) throw Error('dragging the body moved the window');
            // header drag moves it
            const h = await page.locator('.ll-root .mcs-shell-header h1, .ll-root .mcs-shell-header').first().boundingBox();
            await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(h.x + h.width / 2 - 60, h.y + h.height / 2 + 20, { steps: 8 }); await page.mouse.up();
            const p2 = await pos();
            const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
            const vwh = await page.evaluate(() => [innerWidth, innerHeight]);
            const ex = clamp(p1.x - 60, 12, vwh[0] - p1.w - 12), ey = clamp(p1.y + 20, 12, vwh[1] - p1.h - 12);
            if (Math.abs(p2.x - ex) > 4 || Math.abs(p2.y - ey) > 4) throw Error(`header drag moved the window to ${JSON.stringify(p2)} from ${JSON.stringify(p1)}`);
            if (!vp.windowed) {
                const g = await page.locator('.ll-root .mcs-resizer').boundingBox();
                await page.mouse.move(g.x + 10, g.y + 10); await page.mouse.down(); await page.mouse.move(g.x - 120, g.y - 100, { steps: 8 }); await page.mouse.up();
                const p3 = await pos();
                if (p3.w >= p2.w - 60 || p3.h >= p2.h - 50) throw Error(`resize grip did not shrink the window (${p2.w}x${p2.h} -> ${p3.w}x${p3.h})`);
                // and back to a usable size for the rest of the run
                const g2 = await page.locator('.ll-root .mcs-resizer').boundingBox();
                await page.mouse.move(g2.x + 10, g2.y + 10); await page.mouse.down(); await page.mouse.move(g2.x + 130, g2.y + 110, { steps: 8 }); await page.mouse.up();
            }
            // text can still be selected / a textarea focused inside the window (the body stops the host drag, nothing else)
            await click('.ll-root .mcs-segmented__item:nth-child(2)'); await click('.ll-root .mcs-segmented__item:nth-child(1)');
        });
        if (vp.touch && bname === 'chromium') await step(vp.windowed ? 'touch: a swipe scrolls the windowed body, does not move the widget; a header drag moves it' : 'touch: a swipe scrolls the full-screen window', async () => {
            await topOfMain();
            const rect = () => page.evaluate(() => { const r = qa.root().getBoundingClientRect(); return { top: qa.scroller().scrollTop, x: r.x, y: r.y, can: qa.scroller().scrollHeight > qa.scroller().clientHeight + 20 }; });
            const before = await rect();
            if (!before.can) throw Error('nothing to scroll in the window body');
            const cdp = await context.newCDPSession(page);
            const b = await page.locator('.ll-root .mcs-main').boundingBox();
            await touchDrag(cdp, Math.round(b.x + b.width / 2), Math.round(b.y + b.height * 0.75), 0, -260);
            const after = await rect();
            if (after.top < before.top + 60) throw Error(`a touch swipe did not scroll the window body (${before.top} -> ${after.top})`);
            if (Math.abs(after.x - before.x) > 1 || Math.abs(after.y - before.y) > 1) throw Error('a touch swipe on the body moved the widget');
            if (vp.windowed) {
                const h = await page.locator('.ll-root .mcs-shell-header').boundingBox();
                await touchDrag(cdp, Math.round(h.x + h.width - 8), Math.round(h.y + 6), 0, 30);
                const moved = await rect();
                if (Math.abs(moved.y - after.y) < 10) throw Error('a touch drag on the header did not move the window');
            }
            await topOfMain();
        });
        await step('studio switcher: persona, lorebook, character', async () => {
            await click(`${R} .mcs-studio-switcher__item[aria-label^="페르소나"]`);
            await until(() => /페르소나 제작 준비/.test(qa.root().innerText), null, 'persona studio');
            await check('persona-prepare');
            await click(`${R} .mcs-studio-switcher__item[aria-label^="로어북"]`);
            await until(() => /로어북 제작 준비/.test(qa.root().innerText), null, 'lorebook studio');
            await check('lorebook-prepare');
            await click(`${R} .mcs-studio-switcher__item[aria-label^="캐릭터"]`);
            await until(() => /캐릭터 제작 준비/.test(qa.root().innerText), null, 'character studio back');
        });
        await step('character: free mode -> 령령 (send) -> import -> edit -> final', async () => {
            await click(`${R} .mcs-chip:nth-child(1)`);
            await set(`${R} textarea[maxlength="12000"]`, '야간 도서관에서 일하는 무뚝뚝한 사서');
            await clickText(`${R} .mcs-button`, '브리핑 미리 보기');
            await until(() => qa.root().querySelector('.mcs-briefing-preview'), null, 'briefing preview');
            const brief = await page.evaluate(() => qa.root().querySelector('.mcs-briefing-preview').value);
            if (!brief.includes('[MARINARA_STUDIO_REFERENCE]') || !brief.includes('야간 도서관')) throw Error('briefing text wrong');
            await check('character-prepare-briefing');
            await clickText(`${R} .mcs-button`, '령령에게 바로 요청');
            await until(() => qa.fake.appended.length > 0, null, 'request appended');
            const a = await page.evaluate(() => { const x = qa.fake.appended.at(-1); return { role: x.message.role, content: x.message.content, source: x.message.metadata?.source, options: x.options }; });
            if (a.role !== 'user' || !/csm-hidden-prompt/.test(a.content) || !/\[MARINARA_STUDIO_REFERENCE\]/.test(a.content) || a.source !== 'lingling_studio_lv' || !a.options?.triggerGeneration) throw Error('request not sent as expected: ' + JSON.stringify(a).slice(0, 200));
            await until(() => /끝났어요/.test(document.querySelector('.ll-root .mcs-toast')?.innerText || ''), null, 'reply-finished notice', 8000);
            await check('character-after-send');
            await goStep(2);
            await clickText(`${R} .mcs-button`, '최종본 바로 요청');
            await until(() => qa.fake.appended.length > 1, null, 'export request appended');
            if (!(await page.evaluate(() => qa.fake.appended.at(-1).message.content.includes('[MARINARA_STUDIO_EXPORT]')))) throw Error('export request missing marker');
            await until(() => qa.fake.messages.get('chat-a').at(-1).role === 'assistant' && qa.fake.messages.get('chat-a').at(-1).content.includes('MARINARA_CHARACTER_EXPORT'), null, 'bot reply stored');
            await sleep(200);
            await topOfMain();
            await check('character-rp-step');
            await clickText(`${R} .mcs-button`, '마지막 AI 답변 가져오기');
            await until(() => /편집/.test(qa.root().querySelector('.mcs-step.is-current')?.innerText || ''), null, 'moved to the edit step');
            const t = await text();
            if (!/령령의 최종본을 모두 가져왔습니다/.test(await toast()) && !t.includes('하루')) throw Error('import not reflected');
            await topOfMain();
            await check('character-edit');
            if (!(await page.evaluate(() => [...qa.root().querySelectorAll('textarea')].some(x => x.value.includes('빵집 사장'))))) throw Error('description not imported (it is the section open by default)');
            await openSection('성격');
            await check('character-edit-open');
            await goStep(4);
            await topOfMain();
            await check('character-final');
            await clickText(`${R} .mcs-button`, '새 캐릭터로 등록');
            await until(() => qa.fake.characters.size > 2, null, 'character registered');
            const made = await page.evaluate(() => { const c = [...qa.fake.characters.values()].at(-1); return { name: c.name, description: c.description, ext: !!c.extensions.lingling_studio_lv, mes: c.first_mes }; });
            if (made.name !== '하루' || !/## 배경 이야기\n30년 된 빵집/.test(made.description) || !made.ext || !made.mes.includes('어서 와')) throw Error('registered character wrong: ' + JSON.stringify(made).slice(0, 220));
            if (!(await page.evaluate(() => qa.confirms.at(-1)?.message.includes('새 캐릭터로 등록할까요')))) throw Error('no confirmation dialog through the host');
            // JSON copy: needs a real user gesture; on the insecure origin navigator.clipboard is absent -> textarea fallback
            await clickText(`${R} .mcs-button`, 'JSON 전체 복사', { real: true });
            await until(() => /복사했습니다|복사를 사용할 수 없습니다/.test(document.querySelector('.ll-root .mcs-toast')?.innerText || ''), null, 'copy notice').catch(async e => { throw Error(`${e.message} (toast now: ${JSON.stringify(await toast())})`); });
            const copyMsg = await toast();
            if (/사용할 수 없습니다/.test(copyMsg)) noteOnce(`${tag}: JSON copy reported "클립보드 복사를 사용할 수 없습니다" (execCommand refused in this headless browser); the textarea fallback ran`);
            else if (oname === 'insecure' && !/복사했습니다/.test(copyMsg)) throw Error('copy gave no result');
            await clickText(`${R} .mcs-button`, '캐릭터 JSON 저장');
            await sleep(200);
        });
        await step('character: edit an existing one, change a field, save to the original', async () => {
            await click(`${R} .mcs-studio-switcher__item[aria-label^="로어북"]`); await sleep(150);
            await click(`${R} .mcs-studio-switcher__item[aria-label^="캐릭터"]`); await sleep(200);
            await goStep(1);
            await clickText(`${R} .mcs-segmented__item`, '편집');
            await until(() => qa.root().querySelector('select.mcs-select'), null, 'edit selectors');
            await page.evaluate(() => { const s = [...qa.root().querySelectorAll('select.mcs-select')].find(x => [...x.options].some(o => o.textContent === '하루')); s.value = [...s.options].find(o => o.textContent === '하루').value; s.dispatchEvent(new Event('change', { bubbles: true })); });
            await sleep(200);
            await check('character-edit-existing-prepare');
            const before = await page.evaluate(() => qa.fake.appended.length);
            await clickText(`${R} .mcs-button`, '편집 바로 이동');
            await until(n => qa.fake.appended.length > n, before, 'edit briefing sent');
            await until(() => /편집/.test(qa.root().querySelector('.mcs-step.is-current')?.innerText || ''), null, 'edit step');
            await until(() => !qa.fake.state.holdReply && qa.fake.messages.get('chat-a').at(-1).role === 'assistant', null, 'reply done');
            await openSection('성격');
            await page.evaluate(() => { const t = [...qa.root().querySelectorAll('textarea')].find(x => x.value === '무뚝뚝'); if (!t) throw Error('personality field not loaded'); t.value = '무뚝뚝하지만 정이 많다'; t.dispatchEvent(new Event('input', { bubbles: true })); });
            await goStep(4);
            await clickText(`${R} .mcs-button`, '원본 캐릭터에 저장');
            await until(() => qa.fake.characters.get('char-haru').personality === '무뚝뚝하지만 정이 많다', null, 'original saved');
            const c = await page.evaluate(() => { const c = qa.fake.characters.get('char-haru'); return { desc: c.description, ext: c.extensions }; });
            if (c.ext.talkativeness !== 0.5) throw Error('another extension key was lost on save: ' + JSON.stringify(c.ext));
        });
        await step('character: partial-edit request -> import the patch', async () => {
            await goStep(3);
            await clickText(`${R} .mcs-revision-details summary`, '부분 수정 요청');
            await set(`${R} textarea[aria-label="수정 요청 내용"]`, '성격을 더 다정하게');
            await clickText(`${R} .mcs-button`, '수정 요청 바로 보내기');
            await until(() => qa.fake.appended.at(-1)?.message.content.includes('[MARINARA_STUDIO_REVISION]'), null, 'revision sent');
            await until(() => qa.fake.messages.get('chat-a').at(-1).content.includes('PATCH_V2'), null, 'revision reply');
            await sleep(150);
            await clickText(`${R} .mcs-button`, '마지막 답변 가져오기');
            await until(() => /수정 답변을 반영했습니다/.test(document.querySelector('.ll-root .mcs-toast')?.innerText || ''), null, 'revision applied');
        });
        await step('standing context: toggle -> interceptor adds it, final-draft request only the reference', async () => {
            const prompt = [{ role: 'user', content: '안녕', __isChatHistory: true }];
            const run = p => page.evaluate(x => qa.fake.intercept(x, { chatId: 'chat-a', generationType: 'normal' }), p);
            if ((await run(prompt)).length !== 1) throw Error('something is injected before any toggle is on');
            await click(`${R} .mcs-reference-toggle-section input[type=checkbox]`);
            await sleep(1000);
            const ref = await run(prompt);
            if (ref.length !== 2 || !ref[0].content.includes('[MARINARA_STUDIO_SELECTED_REFERENCE]') || ref[0].content.includes('CURRENT_CONTEXT')) throw Error('reference context not injected alone: ' + JSON.stringify(ref).slice(0, 200));
            await page.evaluate(() => { const boxes = [...qa.root().querySelectorAll('.mcs-context-control input[type=checkbox]')]; const cur = boxes[boxes.length - 1]; if (!cur.checked) cur.click(); });
            await sleep(1000);
            const both = await run(prompt);
            if (both.length !== 2 || !both[0].content.includes('[MARINARA_STUDIO_CURRENT_CONTEXT]') || !both[0].content.includes('SELECTED_REFERENCE')) throw Error('current prompt not injected: ' + JSON.stringify(both).slice(0, 200));
            const exp = await run([{ role: 'user', content: '[MARINARA_STUDIO_EXPORT]\n...', __isChatHistory: true }]);
            if (exp.length !== 2 || exp[0].content.includes('CURRENT_CONTEXT') || !exp[0].content.includes('SELECTED_REFERENCE')) throw Error('final-draft request must get the reference only');
            const own = await run([{ role: 'user', content: '[MARINARA_STUDIO_REVISION]\n...', __isChatHistory: true }]);
            if (own.length !== 1) throw Error('a request carrying its own contract was given the standing context');
            for (let i = 0; i < 2; i++) { await page.evaluate(() => { [...qa.root().querySelectorAll('.mcs-context-control input[type=checkbox]')].find(b => b.checked)?.click(); }); await sleep(200); }
            await sleep(900);
            if ((await run(prompt)).length !== 1) throw Error('injection still active after switching both off');
        });
        await step('persona: paste an answer manually, register', async () => {
            await click(`${R} .mcs-studio-switcher__item[aria-label^="페르소나"]`); await sleep(200);
            await goStep(2);
            await clickText(`${R} .mcs-advanced summary`, '답변을 직접 붙여넣기');
            await set(`${R} .mcs-advanced textarea`, await page.evaluate(() => qa.fake.messages.get('chat-a').length && '<<<MARINARA_PERSONA_EXPORT_V1>>>\n[NAME]\n나\n[/NAME]\n[DESCRIPTION]\n평범한 대학생.\n[/DESCRIPTION]\n[PERSONALITY]\n조용함\n[/PERSONALITY]\n[BACKSTORY]\n자취 중\n[/BACKSTORY]\n[APPEARANCE]\n안경\n[/APPEARANCE]\n[SCENARIO]\n기말고사\n[/SCENARIO]\n<<<END_MARINARA_PERSONA_EXPORT_V1>>>'));
            await clickText(`${R} .mcs-button`, '붙여넣은 답변 분석');
            await until(() => /편집/.test(qa.root().querySelector('.mcs-step.is-current')?.innerText || ''), null, 'persona edit step');
            await topOfMain();
            await check('persona-edit');
            await goStep(4);
            await check('persona-final');
            await clickText(`${R} .mcs-button`, '새 페르소나로 등록');
            await until(() => qa.fake.personas.size > 1, null, 'persona registered');
            const p = await page.evaluate(() => { const x = [...qa.fake.personas.values()].at(-1); return { name: x.name, d: x.description, m: !!x.metadata.lingling_studio_lv }; });
            if (p.name !== '나' || !/## 외모\n안경/.test(p.d) || !p.m) throw Error('registered persona wrong: ' + JSON.stringify(p));
        });
        await step('lorebook: request -> import -> edit -> save as a new world book', async () => {
            await click(`${R} .mcs-studio-switcher__item[aria-label^="로어북"]`); await sleep(300);
            await set(`${R} input.mcs-input`, '가을 마을');
            const before = await page.evaluate(() => qa.fake.appended.length);
            await clickText(`${R} .mcs-button`, '령령에게 바로 요청');
            await until(n => qa.fake.appended.length > n, before, 'lorebook briefing sent');
            await until(() => qa.fake.messages.get('chat-a').at(-1).role === 'assistant', null, 'bot answered', 6000);
            await sleep(300);
            await goStep(2);
            await clickText(`${R} .mcs-button`, '최종본 바로 요청');
            await until(() => qa.fake.messages.get('chat-a').at(-1).content.includes('MARINARA_LOREBOOK_EXPORT'), null, 'lorebook reply', 8000);
            await sleep(300);
            await topOfMain();
            await check('lorebook-rp-step');
            await clickText(`${R} .mcs-button`, '마지막 답변 가져오기');
            await until(() => /편집/.test(qa.root().querySelector('.mcs-step.is-current')?.innerText || ''), null, 'lorebook edit step');
            await topOfMain();
            await check('lorebook-edit');
            await clickText(`${R} .mls-entry-toggle`, '빵집');
            await sleep(100);
            await check('lorebook-edit-open');
            await clickText(`${R} .mcs-button`, 'Entry 이동');
            await check('lorebook-move');
            await clickText(`${R} .mcs-button`, '확인');
            await goStep(4);
            await topOfMain();
            await check('lorebook-final');
            await clickText(`${R} .mcs-button`, '새 로어북으로 등록');
            await until(() => [...qa.fake.books.values()].some(b => b.name === '가을 마을'), null, 'world book created', 8000);
            const saved = await page.evaluate(() => { const b = [...qa.fake.books.values()].find(x => x.name === '가을 마을'); return { entries: qa.fake.entries.get(b.id).map(e => ({ c: e.comment, k: e.key, constant: e.constant, selective: e.selective, order: e.order_value, d: e.extensions.lingling_studio_lv?.description || '' })) }; });
            if (saved.entries.length !== 3 || saved.entries[0].c !== '빵집' || !saved.entries[1].constant || !saved.entries[2].selective || saved.entries[0].d !== '마을의 빵집') throw Error('world book entries wrong: ' + JSON.stringify(saved).slice(0, 300));
            await clickText(`${R} .mcs-button`, 'JSON 전체 복사', { real: true });
            await sleep(300);
        });
        await step('close and reopen keep the drafts (saved through the backend)', async () => {
            await click(`${R} .mcs-shell-header__actions button:last-child`);
            await until(() => !qa.widgets[1].visible && qa.widgets[0].visible, null, 'window closed, ghost shown again');
            await page.locator('.ll-launcher').click();
            await until(() => qa.widgets[1].visible, null, 'reopened');
            await sleep(200);
            const stored = await page.evaluate(() => JSON.stringify([...qa.fake.store.keys()]));
            if (!/studio\.json/.test(stored)) throw Error('drafts were not written to the user storage');
        });
        await step('sidebar tab + Extras action + palette entry', async () => {
            const a = await page.evaluate(() => ({ actions: qa.actions.map(x => x.options.label), before: qa.activations }));
            if (!a.actions.includes('령령의 제작실')) throw Error('input-bar action missing');
            await page.evaluate(() => { document.querySelector('.ll-root .mcs-shell-header__actions button:last-child').click(); });
            await sleep(150);
            await page.evaluate(() => qa.actions[0].click());
            await until(() => qa.widgets[1].visible, null, 'Extras action opens the window');
            await page.evaluate(() => { document.querySelector('.ll-root .mcs-shell-header__actions button:last-child').click(); });
            // the drawer home card
            await page.evaluate(() => { document.getElementById('drawer').classList.add('on'); });
            await sleep(300);
            const home = await page.evaluate(() => document.querySelector('.ll-drawer')?.innerText || '');
            if (!/령령의 제작실/.test(home) || !/연결된 방/.test(home)) throw Error('drawer home card missing: ' + home.slice(0, 120));
            await set('.ll-drawer select', 'conn-b');
            await sleep(300);
            const conn = await page.evaluate(() => qa.fake.store.get('qa-user:settings.json'));
            if (conn?.connectionId !== 'conn-b') throw Error('connection pick not saved on change');
            await page.screenshot({ path: path.join(shotDir, `${tag}-drawer.png`) });
            await page.evaluate(() => { document.getElementById('drawer').classList.remove('on'); });
        });
        await step('themes: light and dark host themes', async () => {
            await page.evaluate(() => qa.widgets[1].api.setVisible(true));
            await page.evaluate(() => { qa.widgets[0].api.setVisible(false); });
            const names = await page.evaluate(() => qa.themes);
            for (const t of names) {
                await page.evaluate(n => qa.setTheme(n), t);
                await sleep(250);
                const m = await check(`theme-${t}`);
                themeRows.push({ tag, theme: t, palette: m.palette, mode: m.mode, bgLum: m.bgLum, minContrast: m.minContrast });
                const light = /light/.test(t);
                if (light && m.bgLum < 0.5) failures.push(`${tag} theme ${t}: light theme painted dark (bg luminance ${m.bgLum})`);
                if (!light && m.bgLum > 0.2) failures.push(`${tag} theme ${t}: dark theme painted light (bg luminance ${m.bgLum})`);
            }
            await page.evaluate(() => qa.setTheme('default-dark'));
        });
        if (!vp.touch || vp.windowed) { /* sidebar fallback only needs one run per browser/origin at phone size */ }
        if (vp.touch && !vp.windowed) await step('ui_panels denied: the studio opens inside the sidebar tab', async () => {
            await page.evaluate(() => { qa.denyPanels(); qa.remount(); });
            await sleep(500);
            const none = await page.evaluate(() => ({ launcher: !!qa.launcher(), widgets: qa.widgets.length }));
            if (none.launcher || none.widgets) throw Error('floating widgets were created without ui_panels');
            await page.evaluate(() => { document.getElementById('drawer').classList.add('on'); });
            await page.evaluate(() => qa.actions.at(-1).click());
            await until(() => qa.root()?.querySelector('.mcs-step-panel'), null, 'studio inside the tab');
            await sleep(300);
            await check('sidebar-fallback-prepare');
        });
        if (errors.length) failures.push(`${tag}: page errors ${[...new Set(errors)].slice(0, 4).join(' | ')}`);
        await context.close();
    }
    for (const b of launched.values()) await b?.close();
} finally { server.close(); }

await writeFile(path.join(shotDir, 'qa-report.json'), JSON.stringify({ when: new Date().toISOString(), failures, notes, env: envRows, themes: themeRows, screens: rows }, null, 1));
const bad = rows.filter(r => r.smallPrimary || r.smallSecondary || r.shortTaps || r.lowContrast || r.overflow.length || r.otherScrollers.length);
console.log(JSON.stringify({ screens: rows.length, themeChecks: themeRows.length, screensWithProblems: bad.length, failures: failures.length, notes }, null, 1));
if (failures.length) { for (const f of failures) console.log('FAIL', f); process.exit(1); }
