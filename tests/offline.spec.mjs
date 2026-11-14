// Offline: once the app has been opened, it opens again with the NAS unreachable, from this browser's own data, and
// changes made offline reach the NAS when it's back. Big local copies are stored compressed.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-off-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const add = async (page, t) => { await page.fill('#qa', t); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter'); };

test('opens offline from the saved copy, and offline changes sync when the NAS is back', async ({ page, context }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await add(page, 'Made while online today');
  await expect.poll(() => page.evaluate(async () => /Made while online/.test(await (await fetch('api/sync?since=0')).text())), { timeout: 8000 }).toBe(true);
  // wait for the service worker to control the page and save the shell
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 8000 }).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.t-title', { hasText: 'Made while online' })).toBeVisible({ timeout: 10000 });
  await add(page, 'Made while offline today');
  await expect(page.locator('.t-title', { hasText: 'Made while offline' })).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(async () => /Made while offline/.test(await (await fetch('api/sync?since=0')).text())), { timeout: 30000 }).toBe(true);
  expect(errs.filter(e => !/Failed to fetch|NetworkError|Load failed/.test(e))).toEqual([]);
});

test('large local copies are stored compressed and read back', async ({ page }) => {
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  const r = await page.evaluate(() => {
    const big = { tasks: Array.from({ length: 3000 }, (_, i) => ({ id: 'x' + i, title: 'A fairly long task title number ' + i, notes: 'some notes '.repeat(5) })) };
    localStorage.setItem('cadence.test.big', 'lz1:' + LZString.compressToUTF16(JSON.stringify(big)));
    const raw = localStorage.getItem('cadence.test.big'), back = JSON.parse(LZString.decompressFromUTF16(raw.slice(4)));
    return { ratio: JSON.stringify(big).length / raw.length, ok: back.tasks.length === 3000 };
  });
  expect(r.ok).toBe(true); expect(r.ratio).toBeGreaterThan(3);
  expect(await page.evaluate(() => typeof localStorage.getItem('cadence.off.work'))).toBe('string');
});
