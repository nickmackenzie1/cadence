// Sharing to Cadence from the phone's share menu (manifest share_target): what was shared lands in quick add on
// Today, ready to add with Enter; a link becomes a link card like a pasted one.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-share-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('the app offers itself in the share menu', async () => {
  const m = await (await fetch(B + '/manifest.webmanifest')).json();
  expect(m.share_target).toEqual({ action: './', method: 'GET', params: { title: 'share_title', text: 'share_text', url: 'share_url' } });
});

test('a shared page lands in quick add, and Enter adds it with its link', async ({ page }) => {
  await page.goto(B + '/?share_title=' + encodeURIComponent('Read the setup guide') + '&share_url=' + encodeURIComponent('https://www.example.com/docs/setup#step-2'));
  await expect(page.locator('#qa')).toHaveValue('Read the setup guide https://www.example.com/docs/setup#step-2');
  await expect(page.locator('#qa')).toBeFocused();
  expect(new URL(page.url()).search).toBe('');                       // the shared bits are gone from the address
  await page.keyboard.press('Enter');
  const task = page.locator('#view .task', { hasText: 'Read the setup guide' });
  await expect(task).toHaveCount(1);
  await expect(task.locator('a[href*="example.com/docs/setup"]')).toBeVisible();   // the link became a link chip
  await expect(task.locator('.t-title')).not.toContainText('https://');
});

test('apps that put the link inside the text work too, and nothing is added without Enter', async ({ page }) => {
  await page.goto(B + '/?share_text=' + encodeURIComponent('Worth a listen\nhttps://www.example.com/album'));
  await expect(page.locator('#qa')).toHaveValue('Worth a listen https://www.example.com/album');
  await page.waitForTimeout(300);
  await expect(page.locator('#view .task', { hasText: 'Worth a listen' })).toHaveCount(0);
});
