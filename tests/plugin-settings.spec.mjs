// Plugin settings added in the 2026-11-16 audit: each opens from its gear in Plugins, saves, and changes what it says.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-pset-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), RADAR_MB: '0', KEXP_LOG: '0', RADIO_WARM: '0', STG: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
async function open(page) {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())));
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  return errs;
}
// the gear on a plugin's card in Plugins → its settings window
const gear = async (page, pid) => {
  await page.click('button[title^="Plugins"]'); await page.locator('#pb-grid').waitFor();
  await page.click('[data-act=pl-tab][data-t=all]');
  await page.locator(`#pb-grid .pb-card[data-pid="${pid}"] .pb-gear`).click();
  await expect(page.locator('#modal #lk-ok')).toBeVisible();
};

test('settings windows: quick date, calendar week start, roulette lock, review day, rewind, outside and garbage notes', async ({ page }) => {
  const errs = await open(page);
  // Quick date: off → no calendar after a task without a date
  await gear(page, 'datepick');
  await page.uncheck('#lk-auto'); await page.click('#lk-ok');
  await page.evaluate(() => { location.hash = 'today'; }); await page.locator('#qa').waitFor();
  await page.fill('#qa', 'No date here'); await page.press('#qa', 'Enter');
  await expect(page.locator('#view .task', { hasText: 'No date here' })).toBeVisible();
  await page.waitForTimeout(400); await expect(page.locator('.dp')).toHaveCount(0);
  await gear(page, 'datepick'); await expect(page.locator('#lk-auto')).not.toBeChecked(); await page.check('#lk-auto'); await page.click('#lk-ok');
  // Calendar view: weeks start on Monday
  await gear(page, 'calview'); await page.selectOption('#lk-ws', '1'); await page.click('#lk-ok');
  await page.evaluate(() => { location.hash = 'view-calendar'; });
  await expect(page.locator('.cv-dow span').first()).toHaveText('Mon');
  // Roulette: no lock after a spin
  await gear(page, 'roulette'); await page.selectOption('#lk-m', '0'); await page.click('#lk-ok');
  // Weekly review, Weekly rewind: a day, or never; remembered
  await gear(page, 'review'); await page.selectOption('#lk-day', 'off'); await page.click('#lk-ok');
  await gear(page, 'review'); await expect(page.locator('#lk-day')).toHaveValue('off'); await page.keyboard.press('Escape');
  await gear(page, 'rewind'); await page.selectOption('#lk-day', '0'); await page.click('#lk-ok');
  await gear(page, 'rewind'); await expect(page.locator('#lk-day')).toHaveValue('0'); await page.keyboard.press('Escape');
  // Outside: the space station note off
  await gear(page, 'outdoors'); await page.uncheck('#lk-iss'); await page.click('#lk-ok');
  await gear(page, 'outdoors'); await expect(page.locator('#lk-iss')).not.toBeChecked(); await expect(page.locator('#lk-aurora')).toBeChecked(); await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});

test('Life: garbage-night reminder off', async ({ page }) => {
  const errs = await open(page);
  await page.click('[data-act="space"][data-s="life"]');
  await gear(page, 'home-bits'); await expect(page.locator('#lk-on')).toBeChecked(); await page.uncheck('#lk-on'); await page.click('#lk-ok');
  await gear(page, 'home-bits'); await expect(page.locator('#lk-on')).not.toBeChecked(); await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});
