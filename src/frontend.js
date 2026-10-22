// 령령의 제작실 (Lumiverse) — frontend entry: wires the host link, the studio controller and the on-screen shell.
import { createHost } from './host.js';
import { createStudio } from './controller.js';
import { createShell } from './shell.js';

export function setup(ctx, opts = {}) {
    const host = createHost(ctx, opts);
    const getChatId = () => {
        try { return ctx.state?.get?.('chat.active')?.chatId || ''; } catch { return ''; }
    };
    /** Confirmation through the host's own dialog (window.confirm is a blocking browser box; on some phones it is suppressed). */
    const ask = async (message, { title = '확인', confirmLabel = '확인', variant = 'info' } = {}) => {
        if (typeof ctx.ui?.showConfirm === 'function') {
            try { return !!(await ctx.ui.showConfirm({ title, message, variant, confirmLabel, cancelLabel: '취소' })).confirmed; } catch { /* fall back */ }
        }
        return typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false;
    };
    let shell = null;
    const studio = createStudio({
        host, getChatId, ask,
        composer: ctx.composer && typeof ctx.composer.setText === 'function' ? ctx.composer : null,
        fetchImpl: (...a) => globalThis.fetch(...a),
        openWindow: () => shell?.open(),
        closeWindow: () => shell?.close(),
    });
    shell = createShell(ctx, { studio, host, getChatId, doc: opts.document || globalThis.document, win: opts.window || globalThis.window });
    (async () => {
        let boot = null;
        try { boot = await host.rpc('bootstrap'); shell.setBoot(boot); } catch { /* the studio still opens; lists report the error */ }
        await studio.start(boot);
    })();
    return () => { try { shell.dispose(); } catch { /* ignore */ } try { studio.destroy(); } catch { /* ignore */ } host.dispose(); };
}
