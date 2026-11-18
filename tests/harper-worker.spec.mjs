// The grammar checker (Harper) checks text in its own worker thread, so the page stays responsive while you type,
// and its 20 MB engine downloads once even when the page and the worker both ask (sw.js).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-hpw-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Harper underlines mistakes from its worker, with no download errors', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [], workers = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('worker', w => workers.push(w.url()));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => { const t = document.createElement('textarea'); t.id = 'probe'; t.style.cssText = 'position:fixed;top:60px;left:320px;width:420px;height:90px;z-index:50;font-family:system-ui'; document.body.appendChild(t); });
  await page.click('#probe');
  await page.keyboard.type('This are a sentance.');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.hp-mirror u, .hp-mirror mark, .hp-mirror span[class]').length), { timeout: 100000 }).toBeGreaterThan(0);
  expect(workers.some(u => u.startsWith('blob:'))).toBe(true);    // the checking runs in Harper's worker
  expect(errs).toEqual([]);
});

test('a grammar engine that never answers is given up on, and the next check starts a fresh one', async ({ page }) => {
  test.setTimeout(60000);
  // the first downloads are cut off (as when the connection drops); later ones arrive
  let n = 0;
  await page.route('**/vendor/harper/harper_wasm_bg.wasm', async r => { if (++n <= 2) return r.abort('connectionreset'); await r.continue(); });   // the first two downloads (page + worker) are cut off
  await page.addInitScript(() => { window.__harperStartMs = 3000; });
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => { const t = document.createElement('textarea'); t.id = 'probe'; t.style.cssText = 'position:fixed;top:60px;left:320px;width:420px;height:90px;z-index:50;font-family:system-ui'; document.body.appendChild(t); });
  await page.click('#probe');
  await page.keyboard.type('This are a sentance.');
  // after the give-up, more typing tries again and this time it works
  // (typing clears the underlines until the next check, 0.45 s later, so count a moment after each key)
  await expect.poll(async () => { await page.keyboard.type(' '); await page.waitForTimeout(1200); return page.evaluate(() => document.querySelectorAll('.hp-mirror u, .hp-mirror mark, .hp-mirror span[class]').length); }, { timeout: 45000, intervals: [2000] }).toBeGreaterThan(0);
});

