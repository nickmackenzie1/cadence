// Logos where they make sense (user, 2026-11-16): views, widgets and plugins built around a site show its logo; radio
// stations show their own logo, kept on the NAS (never fetched by the browser from the station), else their site's icon.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
// a tiny PNG for every logo the browser asks the NAS for (the NAS can't reach the internet from the test machine)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-logos-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), KEXP_LOG: '0', STG: '0', RADAR_MB: '0', RADIO_WARM: '0', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('the logo keeper only fetches public images', async () => {
  for (const u of ['', 'file:///etc/passwd', 'http://127.0.0.1/x.png', 'http://localhost/logo.png', 'javascript:alert(1)']) {
    const r = await fetch(B + '/api/logo?u=' + encodeURIComponent(u));
    expect(r.status, u).toBe(404);
  }
});

test('logos on views, widgets and plugins', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const asked = [];
  await page.route(/\/api\/(favicon|logo)\?/, r => { asked.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  // Daily: each section's site
  await page.goto(B + '/#view-daily');
  for (const d of ['wikipedia.org', 'xkcd.com', 'lichess.org', 'news.ycombinator.com']) await expect(page.locator(`.dy-grid h3 .cx-logo[src*="d=${d}"]`)).toHaveCount(1);
  // radio: a station's own logo goes through the NAS, with its website's icon as the fallback
  const html = await page.evaluate(() => CadenceKit.logo('https://www.kexp.org', { img: 'https://cdn.example.org/kexp.png', size: 40 }));
  expect(html).toContain('api/logo?u=' + encodeURIComponent('https://cdn.example.org/kexp.png'));
  expect(html).toContain('data-fb="api/favicon?d=kexp.org"');
  // nothing was asked of a site's own server by the browser: every logo came from the NAS
  expect(asked.length).toBeGreaterThan(3);
  expect(asked.every(u => u.startsWith(B))).toBe(true);
  expect(errs).toEqual([]);
});
