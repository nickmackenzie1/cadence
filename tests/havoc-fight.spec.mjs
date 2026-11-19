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

test('pixel fight on both engines: four bosses, the spells, the skeleton trick, and the page comes back', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const text = () => page.evaluate(() => document.querySelector('#view h1').textContent);
  const h1 = await text();
  const styled = () => page.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.getAttribute('style')).length);
  const before = await styled();
  await page.locator('body').press('Shift+F');
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  const st = () => page.evaluate(() => window.HavocFight.state());
  // the words are physics now (no Havoc toolbar), the matter is the Elements layer
  await expect.poll(async () => (await st()).physics, { timeout: 8000 }).toBe(true);
  expect(await page.evaluate(() => !!document.getElementById('havoc-host').shadowRoot.querySelector('.hud'))).toBe(false);
  expect((await st()).boss).toBe('dragon');
  // a spell shouts its name
  await page.waitForTimeout(2000);
  await page.keyboard.press('2');
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).toContain('Kablammo');
  const hits = await page.evaluate(() => window.HavocFight.debug.impact(500, 300, 'blast', 2) || window.HavocFight.state().hits);
  expect(hits).toBeGreaterThan(0);
  for (const next of ['cat', 'blobby']) { await page.evaluate(() => window.HavocFight.debug.hit(99)); await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe(next); }
  // Splat splat: Blobby bursts, then pulls himself back together
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.HavocFight.debug.cast('splat'));
  await expect.poll(async () => (await st()).solid).toBe(false);
  await expect.poll(async () => (await st()).solid, { timeout: 10000 }).toBe(true);
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe('skeleton');
  // the trick: an offer, the wizard walks over, gets grabbed and shaken, then thrown
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.HavocFight.debug.trick());
  await expect.poll(async () => (await st()).mode, { timeout: 3000 }).toBe('offer');
  await expect.poll(async () => (await st()).wizard.held, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await st()).wizard.flying, { timeout: 5000 }).toBe(true);
  await expect.poll(async () => (await st()).wizard.flying, { timeout: 5000 }).toBe(false);
  // Esc: the words go back, nothing left behind
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active))).toBe(false);
  expect(await text()).toBe(h1);
  expect(await styled()).toBe(before);
  expect(errs).toEqual([]);
});

test('one Havoc: Fire and Acid tools, the letters float, the Wizard button starts the fight', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const fx = []; await page.exposeFunction('__fxSeen', t => fx.push(t));
  await page.evaluate(() => addEventListener('havoc:fx', e => window.__fxSeen(e.detail.type)));
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  const hud = sel => page.evaluate(s => !!document.getElementById('havoc-host').shadowRoot.querySelector(s), sel);
  expect(await hud('button[data-id=fire]')).toBe(true); expect(await hud('button[data-id=acid]')).toBe(true); expect(await hud('button[data-id=fight]')).toBe(true);
  // Fire on a heading: Elements fire, and the words come loose
  const box = await page.locator('#view h1').boundingBox();
  await page.keyboard.press('3');
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await page.keyboard.press('5');
  await page.mouse.click(box.x + 80, box.y + box.height / 2);
  await expect.poll(() => fx.join(' ')).toContain('fire');
  expect(fx).toContain('acid');
  // the Wizard button: Havoc steps aside and the fight starts
  await page.evaluate(() => document.getElementById('havoc-host').shadowRoot.querySelector('button[data-id=fight]').click());
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('the new bosses: the big baby is calmed with milk, zombies climb out of the graves, Old Clinker hates the cold', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.locator('body').press('Shift+F');
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  const st = () => page.evaluate(() => window.HavocFight.state());
  // the baby: any spell is milk, and when he stops crying he's asleep and the round is done
  await page.evaluate(() => window.HavocFight.debug.boss('baby'));
  await expect.poll(async () => (await st()).landed, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(1900);
  await page.keyboard.press('2');
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).not.toContain('Kablammo');
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).toContain('Zzz');
  // the graveyard: a zombie comes up when the wizard goes near; the round ends when they're all down
  await page.evaluate(() => window.HavocFight.debug.boss('graves'));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).toBe('graves');
  await expect.poll(async () => (await st()).graves.some(g => g !== 'shut'), { timeout: 20000 }).toBe(true);
  for (let i = 0; i < 10 && (await st()).boss === 'graves'; i++) await page.evaluate(() => window.HavocFight.debug.hit(1));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).not.toBe('graves');
  // Old Clinker: fire barely touches him, Frostbite puts him out bit by bit (he shrinks)
  await page.evaluate(() => window.HavocFight.debug.boss('clinker'));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).toBe('clinker');
  await page.waitForTimeout(2000);
  const r0 = (await st()).R, hp0 = (await st()).hp;
  await page.evaluate(() => window.HavocFight.debug.hit(3));
  expect((await st()).R).toBeLessThan(r0);
  expect((await st()).hp).toBeLessThan(hp0);
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  expect(errs).toEqual([]);
});
