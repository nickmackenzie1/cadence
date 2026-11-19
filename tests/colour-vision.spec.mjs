// Colour-blind modes (2026-11-19): meaning colours swap on any theme, with second cues; per device.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-cvd-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('pick red–green: the meaning colours change on any theme, links get underlined, and it stays after a reload', async ({ page }) => {
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const tok = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);
  await page.evaluate(() => window.CadenceThemes.apply('dracula'));
  const before = await tok('--danger');
  await page.keyboard.press('Meta+k'); await page.keyboard.type('Colour-blind'); await page.keyboard.press('Enter');
  await page.locator('input[name=cvd][value=rg]').check();
  expect(await tok('--danger')).toBe('#d55e00'); expect(await tok('--ok')).toBe('#0072b2');
  expect(before).not.toBe('#d55e00');
  await page.evaluate(() => window.CadenceThemes.apply('nord'));
  expect(await tok('--danger')).toBe('#d55e00');                           // on top of any theme
  await page.reload(); await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => document.documentElement.dataset.cvd)).toBe('rg');
  await page.evaluate(() => localStorage.setItem('cadence.cvd', 'off')); await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.cvd || 'off')).toBe('off');
});
