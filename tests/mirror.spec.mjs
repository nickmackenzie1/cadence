// The Mirror (webcam) theme with Chromium's fake camera: opt-in, a visible badge, stops when you switch away.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
test.use({ permissions: ['camera'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-mirror-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Mirror: the camera only starts when you ask, shows a badge, and stops when you switch theme', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => CadenceThemes.apply('mirror'));
  await expect(page.locator('.mi-card [data-mi=on]')).toBeVisible();
  expect(await page.evaluate(() => !!window.__mirror.stream)).toBe(false);   // nothing until you press the button
  await page.click('.mi-card [data-mi=on]');
  await expect(page.locator('.mi-card.on')).toContainText('Camera on');
  expect(await page.evaluate(() => window.__mirror.stream.getTracks()[0].readyState)).toBe('live');
  await page.click('.mi-card [data-mi=off]');
  expect(await page.evaluate(() => !!window.__mirror.stream)).toBe(false);
  await page.click('.mi-card [data-mi=on]');
  await expect(page.locator('.mi-card.on')).toBeVisible();
  await page.evaluate(() => CadenceThemes.apply('cadence'));
  expect(await page.evaluate(() => !!window.__mirror.stream)).toBe(false);
  await expect(page.locator('.mi-card, .mi-bg')).toHaveCount(0);
  expect(errs).toEqual([]);
});
