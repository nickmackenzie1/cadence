// Redraws keep what's on screen (user, 2026-11-17: no framework, and every redraw replaced everything): loaded pictures
// are moved into the new page instead of loading again, and on the same page focus, cursor, unsaved typing and the
// scroll of inner strips stay put. Pages still draw with innerHTML; the core does this around every redraw.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-keep-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), KEXP_LOG: '0', RADIO_WARM: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const redraw = page => page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));

test('a redraw keeps focus, typing, cursor, loaded pictures and strip scroll', async ({ page }) => {
  await page.route(/\/api\/(favicon|logo)\?/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto(B + '/#view-radio');
  const q = page.locator('#rd-q');
  await q.click(); await q.pressSequentially('shoegaz');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');   // cursor in the middle
  // a loaded station logo, marked so we can tell it's the very same picture afterwards
  const logo = page.locator('.rd-st .cx-logo').first();
  await expect.poll(() => logo.evaluate(i => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  await logo.evaluate(i => { i.__same = 1; });
  await redraw(page);
  await expect(page.locator('#rd-q')).toBeFocused();
  await expect(page.locator('#rd-q')).toHaveValue('shoegaz');
  expect(await page.locator('#rd-q').evaluate(i => [i.selectionStart, i.selectionEnd])).toEqual([5, 5]);
  expect(await page.locator('.rd-st .cx-logo').first().evaluate(i => i.__same)).toBe(1);   // not loaded again
  await page.keyboard.type('e');
  await expect(page.locator('#rd-q')).toHaveValue('shoegeaz');                                // typing carries on where the cursor was

  // the music tabs scroll sideways on a narrow screen: a redraw keeps where you'd scrolled to
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto(B + '/#view-radio');
  const tabs = page.locator('.mus-tabs');
  await expect(tabs).toBeVisible();
  const can = await tabs.evaluate(t => t.scrollWidth > t.clientWidth);
  if (can) {
    await tabs.evaluate(t => { t.scrollLeft = 80; });
    await redraw(page);
    expect(await page.locator('.mus-tabs').evaluate(t => t.scrollLeft)).toBeGreaterThan(60);
  }
  // another page: nothing carried over except pictures
  await page.evaluate(() => { location.hash = 'today'; });
  await expect(page.locator('#rd-q')).toHaveCount(0);
});
