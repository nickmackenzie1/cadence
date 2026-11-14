// On a phone the 20 MB grammar engine isn't started at load: it loads the first time you focus a text box.
import { test, expect, devices } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-hp-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const { defaultBrowserType, ...phone } = devices['Pixel 7'];
test.use(phone);

test('phone: no grammar engine until a text box is focused', async ({ page }) => {
  const wasm = []; page.on('request', r => { if (/harper.*\.(wasm|js)$/i.test(r.url()) && /vendor/.test(r.url())) wasm.push(r.url()); });
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.waitForTimeout(4000);
  expect(wasm).toEqual([]);
  await page.locator('#qa').focus();
  await expect.poll(() => wasm.length, { timeout: 10000 }).toBeGreaterThan(0);
});
