// The shared effects layer (snow, typing fire, the sand jar, weather) sleeps when nothing is happening, instead of
// drawing 60 frames a second forever, and wakes as soon as something is asked of it.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-fxs-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('the effects layer sleeps when idle and wakes when something happens', async ({ page }) => {
  // count the frames the effects engine asks for
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__fxFrames = 0;
    window.requestAnimationFrame = cb => { if (/elements-engine/.test(new Error().stack || '')) window.__fxFrames++; return raf(cb); };
  });
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await expect.poll(() => page.evaluate(() => !!(window.__fx && window.__fx.active)), { timeout: 15000 }).toBe(true);
  const framesIn = ms => page.evaluate(ms => new Promise(r => { const a = window.__fxFrames; setTimeout(() => r(window.__fxFrames - a), ms); }), ms);
  // idle: (almost) no frames, where it used to be ~60 a second
  await expect.poll(() => framesIn(1000), { timeout: 15000, intervals: [500] }).toBeLessThan(10);
  // fire at a point: it wakes and draws
  await page.evaluate(() => window.__fx.spawn(400, 300, window.__fx.M.FIRE, 4, 1, 40, 80));
  expect(await framesIn(500)).toBeGreaterThan(10);
  // and goes back to sleep once the fire is out
  await expect.poll(() => framesIn(1000), { timeout: 20000, intervals: [1000] }).toBeLessThan(10);
});
