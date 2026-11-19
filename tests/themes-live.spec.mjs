// The live and season themes, and the Themes screen's compact grid and try-it-on preview (user, 2026-11-18).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-tl-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, DISCOGS_TOKEN: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const open = async page => { await page.goto(B + '/'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 }); };

test('every new theme is there, Seasons is wearing the season, and each one comes and goes cleanly', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await open(page);
  const ids = ['record-of-the-day', 'kexp-live', 'movie-night', 'weather-window', 'game-shelf', 'seasons', 'winter', 'spring', 'camping',
    'csgo', 'half-life', 'portal', 'borderlands', 'vice-city', 'severance', 'blade-runner', 'dune', 'twin-peaks', 'grand-budapest', 'stranger-things', 'kiki', 'howl', 'interstellar', 'lotr',
    'winamp', 'wii', 'ps2', 'system7', 'bandcamp'];
  const have = await page.evaluate(() => window.CadenceThemes.list().map(t => t.id));
  expect(ids.filter(i => !have.includes(i))).toEqual([]);
  const m = new Date().getMonth(), want = m === 9 ? 'Halloween' : m === 10 ? 'Late fall' : m === 11 || m <= 1 ? 'Winter' : m <= 4 ? 'Spring' : 'Camping';
  expect(await page.evaluate(() => window.CadenceThemes.list().find(t => t.id === 'seasons').tagline)).toContain('Right now: ' + want);
  for (const id of ids) {
    await page.evaluate(i => window.CadenceThemes.apply(i), id);
    expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe(id);
  }
  await page.evaluate(() => window.CadenceThemes.apply('cadence'));
  await expect(page.locator('.lt-card')).toHaveCount(0);
  expect(await page.evaluate(() => ['--bg', '--accent'].map(k => document.documentElement.style.getPropertyValue(k)).join(''))).toBe('');   // live colours undone
  expect(errs).toEqual([]);
});

test('live themes without their services say how to connect them', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.CadenceThemes.apply('record-of-the-day'));
  await expect(page.locator('.lt-rec')).toContainText('Connect Discogs');
  await page.locator('.lt-rec [data-lt=keys]').click();
  await expect(page.locator('#conn-list')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.CadenceThemes.apply('movie-night'));
  await expect(page.locator('.lt-mv')).toContainText('Add your Letterboxd diary in Feeds');
  await page.evaluate(() => window.CadenceThemes.apply('kexp-live'));
  await expect(page.locator('.lt-kx')).toContainText('On the air at KEXP');
});

test('Game shelf: your own list of games, one a day', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.CadenceThemes.apply('game-shelf'));
  await page.locator('.lt-gs [data-lt=edit]').click();
  await page.locator('.lt-gs textarea').fill('Hollow Knight');
  await page.locator('.lt-gs [data-lt=save]').click();
  await expect(page.locator('.lt-gs')).toContainText('Hollow Knight');
  expect(await page.evaluate(() => window.CadenceThemes.current().game.title)).toBe('Hollow Knight');
});

test('Themes screen: a compact grid, and resting on a card tries the theme on until you move away', async ({ page }) => {
  await open(page);
  // the test before saved Game shelf on the NAS: put the default back and let that save, so a late sync can't bring
  // Game shelf back in the middle of this one (it made this test fail now and then)
  await page.evaluate(() => window.CadenceThemes.apply('cadence')); await page.waitForTimeout(800);
  await page.reload(); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin || 'cadence')).toBe('cadence');
  await page.evaluate(() => { location.hash = 'view-themes'; });
  await page.locator('#thg-dense').check();
  await expect(page.locator('.thg')).toHaveClass(/thg-dense/);
  const card = page.locator('.thg-sec .th-card[data-th=dune]');
  await card.scrollIntoViewIfNeeded(); await card.hover(); await page.mouse.move(...(await card.boundingBox().then(b => [b.x + b.width / 2 + 3, b.y + b.height / 2 + 3])));
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin), { timeout: 15000 }).toBe('dune');
  await page.mouse.move(2, 400);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin || 'cadence'), { timeout: 15000 }).toBe('cadence');
  // a click keeps it
  await card.hover(); await card.click();
  await page.mouse.move(2, 400); await page.waitForTimeout(1500);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin), { timeout: 15000 }).toBe('dune');
  // and the compact setting is remembered
  await page.reload(); await page.evaluate(() => { location.hash = 'view-themes'; });
  await expect(page.locator('.thg')).toHaveClass(/thg-dense/);
});
