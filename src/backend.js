// 령령의 제작실 (Lumiverse) — backend entry. The Spindle worker exposes the API as global `spindle`.
import { createService } from './service.js';

export function start(api) {
    const service = createService(api);
    // keeps the chat from flashing the raw request tag while the page loads (frontend strips it from the rendered message)
    let release = null;
    try { release = api.frontendCapabilities?.declare?.('message_tag_interceptor'); } catch { /* older host */ }
    const offMessage = api.onFrontendMessage(async (payload, userId, frontendSessionId) => {
        if (!payload || typeof payload.requestId !== 'string' || typeof userId !== 'string' || !userId) return;
        let reply;
        try { reply = { ok: true, ...(await service.run(payload, userId)) }; } catch (error) { reply = { ok: false, error: error?.message || String(error) }; }
        try { api.sendToFrontend({ ...reply, requestId: payload.requestId }, userId, frontendSessionId ? { frontendSessionId } : undefined); } catch { /* frontend gone */ }
    });
    let offPerm = null;
    try { offPerm = api.permissions?.onChanged?.(detail => service.onPermissionChanged(detail)); } catch { /* optional */ }
    service.attach();
    return () => { service.stop(); offMessage?.(); try { offPerm?.(); } catch { /* ignore */ } try { release?.(); } catch { /* ignore */ } };
}

if (typeof spindle !== 'undefined') start(spindle);
