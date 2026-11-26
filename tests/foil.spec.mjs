// Foil (2026-11-25, holospot): the sidebar logo in foil, the Foil theme, and the plain logo where there is no real GPU.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-foil-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });


test('no real graphics chip (like this test browser): the plain logo, the Foil theme still works', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 800 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today'); await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#side-head .brand .logo.foil-on')).toHaveCount(0);
  await page.evaluate(() => window.CadenceThemes.apply('foil'));
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin || document.documentElement.getAttribute('data-theme'))).toBeTruthy();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#side-head .space-sw i')).backgroundImage)).toContain('gradient');
  expect(errs).toEqual([]);
});

test('with WebGL: the sidebar logo becomes foil, and the Foil theme gets a real foil sheet', async ({ page }) => {
  test.setTimeout(150e3);
  await page.addInitScript(() => { window.__forceGL = true; });
  await page.setViewportSize({ width: 1300, height: 800 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today'); await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#side-head .brand .logo.foil-on canvas.foil-cv')).toHaveCount(1, { timeout: 120000 });
  await page.evaluate(() => window.CadenceThemes.apply('foil'));
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--foil-img')), { timeout: 120000 }).toContain('url(data:image/png');
  expect(errs).toEqual([]);
});
