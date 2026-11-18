// Havoc is on in Life too (user, 2026-11-18), for new Life spaces and, once, for ones that started with it off.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-hl-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Havoc is switched on in Life, including a Life space that had it off from the old default', async ({ page }) => {
  // an older Life space: Havoc off because that was the default then
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('cadence.life.v1', JSON.stringify({ disabled: ['haunted', 'havoc'], settings: {} })); } });
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.locator('#side-head [data-act=space][data-s=life]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cadence.off.life') || '[]'))).not.toContain('havoc');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.off.life') || '[]'))).toContain('haunted');
  // Shift+H unleashes it there
  await page.keyboard.press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc || window.__elements)), { timeout: 8000 }).toBe(true);
});
