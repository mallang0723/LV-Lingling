// Bundles the backend (Spindle worker) and frontend (browser) entries with Bun.
// BUN_BIN overrides the bun executable (the mise shim may be broken on this machine).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const bun = process.env.BUN_BIN || 'bun';
mkdirSync('dist', { recursive: true });
for (const [entry, target] of [['backend', 'bun'], ['frontend', 'browser']]) {
    const p = spawnSync(bun, ['build', `src/${entry}.ts`, '--outfile', `dist/${entry}.js`, '--target', target, '--format', 'esm'], { stdio: 'inherit' });
    if (p.error || p.status !== 0) throw p.error || Error(`Bun build failed: status=${p.status} signal=${p.signal}`);
}
console.log(JSON.stringify({ ok: true, artifacts: ['dist/backend.js', 'dist/frontend.js'] }));
