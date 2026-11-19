// Havoc: Wizard vs the bosses (2026-11-18): the fight starts, bosses take turns, the page gets wrecked, Esc puts it all back.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-hf-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('dragon, then the vampire cat, then Blobby; the page gets wrecked and comes back', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const before = await page.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.getAttribute('style')).length);
  await page.locator('body').press('Shift+F');
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => window.HavocFight.state().boss)).toBe('dragon');
  // the fight goes on by itself: fireballs fly and the page takes hits
  await page.mouse.click(700, 200); await page.mouse.click(400, 300);
  const st = () => page.evaluate(() => window.HavocFight.state());
  // knock the dragon down: the cat comes out, round 2
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe('cat');
  expect((await st()).round).toBe(2);
  const hp = (await st()).max; expect(hp).toBeGreaterThanOrEqual(5); expect(hp).toBeLessThanOrEqual(10);
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe('blobby');
  // round 3: hits make bits come loose and fall
  const row = '#view .task:has(> .check)', box = await page.locator(row).first().boundingBox();
  await page.evaluate(([x, y]) => window.HavocFight.debug.wreck(x, y, 1), [box.x + box.width / 2, box.y + box.height / 2]);
  await expect.poll(() => page.evaluate(() => (e => e.getAnimations().length + (e.style.filter ? 1 : 0))(document.querySelector('#view .task:has(> .check)')))).toBeGreaterThan(0);
  expect((await st()).touched).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  // Esc: everything back where it was
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.getAttribute('style')).length)).toBe(before);
  expect(await page.evaluate(() => [...document.querySelectorAll('#view .task')].some(e => e.getAnimations().length))).toBe(false);
  expect(errs).toEqual([]);
});
