// "Check outside services" on Background work (2026-11-19): every service asked once, keys that aren't set say so,
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
// and the page lists the answers. (No internet in CI: the services simply don't answer, which is a fine answer.)
import { test, expect } from '@playwright/test';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-ck-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') };
  for (const k of ['TMDB_API_KEY', 'TMDB_TOKEN', 'GAMESDB_API_KEY', 'TASTEDIVE_API_KEY', 'LASTFM_API_KEY']) delete env[k];
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test('Background work: Check outside services lists every service, and keys that aren’t set say so', async ({ page }) => {
  test.setTimeout(60000);
  const d = await (await fetch(B + '/api/checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  const ids = d.results.map(r => r.id);
  for (const id of ['tmdb', 'gamesdb', 'tastedive', 'nhl', 'openmeteo']) expect(ids).toContain(id);
  for (const r of d.results) expect(['ok', 'nokey', 'unreadable', 'down']).toContain(r.state);
  expect(d.results.find(r => r.id === 'tmdb')).toMatchObject({ state: 'nokey' });
  expect(d.results.find(r => r.id === 'tastedive').note).toMatch(/TASTEDIVE_API_KEY/);
  // the page shows the last check and can run another
  await page.goto(B + '/#view-jobs');
  await expect(page.locator('#jb-check')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.jb-ck-l li')).toHaveCount(d.results.length);
  await page.click('#jb-check');
  await expect(page.locator('#jb-check')).toBeEnabled({ timeout: 40000 });
  await expect(page.locator('.jb-ck-l li.ck-nokey').first()).toContainText('No key');
});
