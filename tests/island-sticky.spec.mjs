// The Island: a notice that stays up steps aside for a plain message (2026-11-20).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-isl-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });


test('a message shows even while a notice that stays up is on the Island, which comes back after', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => !!window.CadenceIsland)).toBe(true);
  // the Island may be busy with something of its own first (a spinner while it connects): the notice waits its turn
  await page.evaluate(() => window.CadenceIsland.show({ title: 'A pinned note', sticky: true, key: 'test-sticky' }));
  await expect(page.getByText('A pinned note').first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => window.CadenceIsland.toast('A plain message'));
  await expect(page.getByText('A plain message').first()).toBeVisible();
  // and the notice returns once the message has gone
  await expect(page.getByText('A plain message')).toHaveCount(0, { timeout: 8000 });
  await expect(page.getByText('A pinned note').first()).toBeVisible();
  expect(errs).toEqual([]);
});
