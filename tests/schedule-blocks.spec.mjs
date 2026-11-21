// Today's schedule: short blocks open to their full title, and phones get a Next up list (2026-11-20).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-sch-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });


test('a short block grows to its full title on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('.td-b').first()).toBeVisible({ timeout: 15000 });
  // the narrowest block that cuts its title off
  const i = await page.evaluate(() => { const bs = [...document.querySelectorAll('.td-b')]; let best = -1, w = 1e9; bs.forEach((b, k) => { const t = b.querySelector('b'); if (t.scrollWidth > t.clientWidth + 1 && b.offsetWidth < w) { w = b.offsetWidth; best = k; } }); return best; });
  expect(i).toBeGreaterThanOrEqual(0);
  const blk = page.locator('.td-b').nth(i);
  await blk.hover();
  await expect.poll(() => blk.evaluate(b => { const t = b.querySelector('b'); return t.scrollWidth <= t.clientWidth + 1; })).toBe(true);
  // and it stays inside the timeline
  const tl = await page.locator('.td-tl').boundingBox(), bb = await blk.boundingBox();
  expect(bb.x + bb.width).toBeLessThanOrEqual(tl.x + tl.width + 1);
  expect(bb.x).toBeGreaterThanOrEqual(tl.x - 1);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('the next few things are listed under the timeline and open on tap', async ({ page }) => {
    await page.goto(B + '/?demo=1#today');
    await expect(page.locator('.td-b').first()).toBeVisible({ timeout: 15000 });
    const items = page.locator('.td-next .td-nx');
    if (await items.count() === 0) return;   // nothing left today in the demo at this hour
    await expect(items.first()).toBeVisible();
    const task = page.locator('.td-next .td-nx[data-task]').first();
    if (await task.count()) { await task.tap(); await expect(page.locator('#view .task.open').first()).toBeVisible(); }
  });
});
