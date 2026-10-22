// 령령의 제작실 (Lumiverse) — panel colours from the host theme.
// The original used Marinara's --primary / --background (oklch) variables, which Lumiverse does not have. Lumiverse's theme
// engine (frontend/src/theme/engine.ts) rewrites --lumiverse-bg / -bg-elevated / -bg-deep / -text* /
// -primary* per theme, often translucent (glass), but never --lumiverse-bg-opaque or
// --lumiverse-card-bg-solid (static dark defaults in variables.css). So everything is computed here:
//  - background: --lumiverse-bg flattened onto --lumiverse-bg-deep (never a translucent base),
//  - text: --lumiverse-text flattened onto it; below 4.5:1 (or missing variables) a fixed light/dark palette,
//  - muted and accent text: pulled toward the main text until every surface they sit on reaches 4.5:1,
//  - text on the accent: white or near-black, whichever contrasts more.
// All colours are written as solid hex so the panel never depends on what is behind the drawer.

export function parseColor(value, doc = globalThis.document) {
    if (!value || !doc) return null;
    const probe = doc.createElement('i');
    probe.style.color = '';
    probe.style.color = value;
    if (!probe.style.color) return null;
    probe.style.display = 'none';
    doc.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    const m = c.match(/[\d.]+/g);
    return m && m.length >= 3 ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null;
}

export const over = (c, base) => (c ? { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 } : null);
export const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });
export const hex = c => '#' + ['r', 'g', 'b'].map(k => Math.round(Math.max(0, Math.min(255, c[k]))).toString(16).padStart(2, '0')).join('');
export const luminance = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** Pull `c` toward `ink` until it reaches `min` against every surface in `grounds`. */
export function ensure(c, ink, grounds, min = 4.5) {
    if (!c) return ink;
    const worst = x => Math.min(...grounds.map(g => contrast(x, g)));
    let out = c;
    for (let t = 0; t <= 1.0001 && worst(out) < min; t += 0.05) out = mix(c, ink, t);
    return worst(out) < min ? ink : out;
}

const FALLBACK = {
    dark: { bg: '#1c1b22', ink: '#e6e4ec', muted: '#aaa8b4', accent: '#9bc4a8' },
    light: { bg: '#ffffff', ink: '#232228', muted: '#5b5a64', accent: '#2f6f4f' },
};

/** Reads the host variables and returns the panel palette (hex strings) plus how it was chosen. */
export function computePalette(doc = globalThis.document) {
    const cs = getComputedStyle(doc.documentElement);
    const v = name => parseColor(cs.getPropertyValue(name).trim(), doc);
    const white = { r: 255, g: 255, b: 255, a: 1 };
    let source = 'host';
    let bg, ink, muted, accent;
    const raw = v('--lumiverse-bg'), deep = v('--lumiverse-bg-deep');
    if (raw) {
        const floor = deep && deep.a >= 0.99 ? deep : (over(deep, white) || white);
        bg = over(raw, floor);
        ink = over(v('--lumiverse-text'), bg);
    }
    if (!bg || !ink || contrast(ink, bg) < 4.5) {
        const mode = bg && luminance(bg) > 0.4 ? 'light' : 'dark';
        const f = FALLBACK[mode];
        source = 'fallback-' + mode;
        bg = parseColor(f.bg, doc); ink = parseColor(f.ink, doc); muted = parseColor(f.muted, doc); accent = parseColor(f.accent, doc);
    } else {
        muted = over(v('--lumiverse-text-muted'), bg);
        accent = over(v('--lumiverse-primary'), bg) || ink;
    }
    const soft = mix(bg, ink, 0.04), soft2 = mix(bg, ink, 0.08), accentSoft = mix(bg, accent, 0.14);
    const grounds = [bg, soft, soft2, accentSoft];
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const onAccent = contrast(white, accent) >= contrast(black, accent) ? white : black;
    const danger = over(v('--lumiverse-danger'), bg);
    return {
        source,
        mode: luminance(bg) < 0.18 ? 'dark' : 'light',
        vars: {
            '--ll-bg': hex(bg),
            '--ll-text': hex(ensure(ink, ink, grounds)),
            '--ll-muted': hex(ensure(muted, ink, grounds)),
            '--ll-line': hex(mix(bg, ink, 0.16)),
            '--ll-soft': hex(soft),
            '--ll-soft-2': hex(soft2),
            '--ll-accent': hex(accent),
            '--ll-accent-text': hex(ensure(accent, ink, grounds)),
            '--ll-on-accent': hex(onAccent),
            '--ll-accent-soft': hex(accentSoft),
            '--ll-danger': hex(ensure(danger || accent, ink, grounds)),
        },
    };
}

export function applyPalette(el, doc = globalThis.document) {
    const p = computePalette(doc);
    for (const [k, val] of Object.entries(p.vars)) el.style.setProperty(k, val);
    el.dataset.palette = p.source;
    el.dataset.mode = p.mode;
    return p;
}
