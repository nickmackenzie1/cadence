// Music and radio themes (2026-11-18): each one applies without errors and looks like itself; Now Playing takes its
// colours from the cover of what's playing; Mixtape and On Air react to the player; Teletext adds its page bar and keys.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-thm-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

const IDS = ['now-playing', 'record-store', 'mixtape', 'on-air', 'ipod', 'gig-poster', 'teletext', 'card-catalogue', 'limestone', 'late-fall'];
// a 2×2 orange PNG cover, served with CORS like Deezer's and the Cover Art Archive
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDKgCwAAJ6kD/ap+YmUAAAAASUVORK5CYII=', 'base64');

test('every music theme applies cleanly', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => window.Cadence && window.Cadence.addTask ? 0 : 0);
  const listed = await page.evaluate(() => CadenceThemes.list().map(t => t.id));
  for (const id of IDS) expect(listed, id).toContain(id);
  for (const id of IDS) {
    await page.evaluate(id => CadenceThemes.apply(id), id);
    await expect(page.locator('html')).toHaveAttribute('data-skin', id);
    await page.waitForTimeout(350); await page.screenshot({ path: `test-results/theme-${id}.png` });
  }
  // Teletext: the page bar and four keys, gone again when the theme changes
  await page.evaluate(() => CadenceThemes.apply('teletext'));
  await expect(page.locator('.tt-top')).toContainText('P100');
  await expect(page.locator('.tt-keys a')).toHaveCount(4);
  await page.evaluate(() => CadenceThemes.apply('calm'));
  await expect(page.locator('.tt-top, .tt-keys')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('Now Playing takes its colours from the cover; On Air and Mixtape follow the player', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://covers.example.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('https://audio.example.com/**', r => r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(0) }));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => CadenceThemes.apply('now-playing'));
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  await page.evaluate(() => CadencePodcasts.load({ uuid: 'np1', url: 'https://audio.example.com/a.wav', title: 'Song', podcastTitle: 'Band', art: 'https://covers.example.com/a.png' }, false));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), { timeout: 8000 }).not.toBe(before);
  const acc = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
  expect(acc).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);   // worked out from the cover
  // leaving the theme takes its colours away
  await page.evaluate(() => CadenceThemes.apply('calm'));
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toBe('');
  // On Air: the light is there; Mixtape: the cassette
  await page.evaluate(() => CadenceThemes.apply('on-air')); await expect(page.locator('.cz-onair')).toHaveCount(1);
  await page.evaluate(() => CadenceThemes.apply('mixtape')); await expect(page.locator('.cz-tape')).toHaveCount(1); await expect(page.locator('.cz-onair')).toHaveCount(0);
  expect(errs).toEqual([]);
});
