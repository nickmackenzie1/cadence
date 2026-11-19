// Cover Flow and the record bin (2026-11-18): flip through, switch views, and keep the place across a redraw.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-cf-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('flip through with keys, clicks and the slider; switch to the bin and the grid; the place survives a redraw', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const mount = () => page.evaluate(() => {
    let host = document.getElementById('cf-test'); if (!host) { host = document.createElement('div'); host.id = 'cf-test'; host.style.cssText = 'position:fixed;inset:60px 80px auto;background:var(--panel);z-index:99999;padding:12px'; document.body.append(host); }
    const items = Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, title: 'Album ' + (i + 1), date: String(2000 + i), type: 'Album', cover: '', link: 'https://musicbrainz.org/release-group/r' + i }));
    host.innerHTML = window.CadenceCoverFlow.html(items, { key: 'test', artist: 'Band' });
  });
  await page.evaluate(() => { try { localStorage.removeItem('cadence.cf.mode'); } catch {} });
  await mount();
  const cf = page.locator('#cf-test .cf');
  await expect(cf).toHaveAttribute('data-cf-ready', '1');
  await expect(cf.locator('.cf-cap')).toContainText('Album 1');
  await cf.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(cf.locator('.cf-cap')).toContainText('Album 3');
  await cf.locator('.cf-it[data-i="4"]').dispatchEvent('click');
  await expect(cf.locator('.cf-cap')).toContainText('Album 5');
  await cf.locator('.cf-scrub').fill('9');
  await expect(cf.locator('.cf-cap')).toContainText('Album 10');
  await expect(cf.locator('.cf-cap')).toContainText('10 of 12');
  // a redraw keeps the place
  await mount();
  await expect(page.locator('#cf-test .cf .cf-cap')).toContainText('Album 10');
  // the bin, then the grid; the choice is remembered
  await page.locator('#cf-test [data-cf-mode=bin]').click();
  await expect(page.locator('#cf-test .cf')).toHaveAttribute('data-mode', 'bin');
  await expect(page.locator('#cf-test .cf-crate')).toBeVisible();
  await expect(page.locator('#cf-test .cf .cf-cap')).toContainText('Album 10');
  await page.locator('#cf-test [data-cf-mode=grid]').click();
  await expect(page.locator('#cf-test .cf-g')).toHaveCount(12);
  expect(await page.evaluate(() => localStorage.getItem('cadence.cf.mode'))).toBe('grid');
  await page.locator('#cf-test [data-cf-mode=flow]').click();
  expect(errs).toEqual([]);
});
