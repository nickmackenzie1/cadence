// "Show something at least" (2026-11-19): Radar, Radio and KEXP history draw at once: placeholder outlines on a first
// visit, this device's last copy after that, then the NAS's answer when it lands. The NAS is slowed down on purpose.
import { test, expect } from '@playwright/test';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-load-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), RADIO_LOOKUP_MS: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

// hold these NAS answers back until release() is called
async function slow(page, re) {
  let open; const gate = new Promise(r => { open = r; });
  await page.route(re, async route => { await gate; await route.continue(); });
  return () => open();
}

test('Music Radar: outlines first, then the page; next time the last copy draws before the NAS answers', async ({ page }) => {
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');   // Music Radar lives in Life
  let release = await slow(page, /\/api\/radar\/data/);
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await expect(page.locator('.mr .skel-card').first()).toBeVisible();
  release();
  await expect(page.locator('#mr-scan')).toBeVisible({ timeout: 15000 });
  // a fresh page load with the NAS slow: the saved copy draws straight away
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  release = await slow(page, /\/api\/radar\//);
  await page.reload();
  await expect(page.locator('#mr-scan')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.mr .skel-card')).toHaveCount(0);
  release();
});

test('Radio: the station list draws at once, and the NAS answers it without waiting on stream look-ups', async ({ page }) => {
  const t0 = Date.now();
  const r = await fetch(B + '/api/radio/stations');
  expect(r.ok).toBe(true);
  expect(Date.now() - t0).toBeLessThan(1500);
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'view-radio'; });
  await expect(page.locator('.rd-st').first()).toBeVisible({ timeout: 10000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const release = await slow(page, /\/api\/radio\/stations/);
  await page.reload();
  await expect(page.locator('.rd-st').first()).toBeVisible({ timeout: 4000 });
  release();
});
