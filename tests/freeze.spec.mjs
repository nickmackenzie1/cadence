// "The saving locks things up" (2026-11-19): an edit's own save waits a moment (and is written at once when the page
// closes), and a freeze in the browser is written to Problems with what was running and how big the spaces are.
import { test, expect } from '@playwright/test';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-frz-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
const hook = page => page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));

test('an edit is saved on this device even when the page closes straight after it', async ({ page, context }) => {
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 }); await hook(page);
  await page.evaluate(() => window.T.tasks.add({ title: 'Saved right before closing', dueDate: window.T.util.todayKey() }));
  // the NAS is cut off before it could be sent, and the page reloads at once
  await context.route('**/api/**', r => r.abort());
  await page.reload();
  await expect(page.locator('#view .task', { hasText: 'Saved right before closing' })).toBeVisible({ timeout: 10000 });
  await context.unroute('**/api/**');
});

test('a freeze in the browser goes to Problems with what was running and the space sizes', async ({ page }) => {
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 1500) {} });   // the page stops answering
  await expect.poll(async () => (await (await fetch(B + '/api/problems')).json()).filter(x => x.kind === 'slow' && x.from === 'browser').length, { timeout: 10000 }).toBeGreaterThan(0);
  const row = (await (await fetch(B + '/api/problems')).json()).find(x => x.kind === 'slow' && x.from === 'browser');
  expect(row.msg).toMatch(/The page froze for 1\.\d s/);
  expect(row.detail).toMatch(/work: \d+ KB, \d+ tasks/);
});
