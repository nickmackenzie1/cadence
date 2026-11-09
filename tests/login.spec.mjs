// Login page: with APP_PASSWORD set, the app sits behind a cookie session.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9811 + Math.floor(Math.random() * 300);
const B = `http://localhost:${PORT}`;
let server, dataDir;
test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'cadence-login-'));
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, APP_USERNAME: 'nick', APP_PASSWORD: 's3cret:pw' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`${B}/api/whoami`); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
});
test.afterAll(() => { server && server.kill(); rmSync(dataDir, { recursive: true, force: true }); });

test('signed-out visits land on the login page and nothing private leaks', async ({ page }) => {
  expect((await fetch(`${B}/api/state`)).status).toBe(401);
  expect((await fetch(`${B}/core.js`, { redirect: 'manual' })).status).toBe(302);
  await page.goto(`${B}/#inbox`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('h1')).toHaveText('Welcome back');
});

test('wrong password shows an error, right one opens the app and the session sticks', async ({ page, context }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${B}/`);
  await page.fill('#u', 'nick'); await page.fill('#p', 'nope'); await page.click('#go');
  await expect(page.locator('#err')).toContainText('Wrong username or password');
  await page.fill('#p', 's3cret:pw'); await page.click('#go');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  const ck = (await context.cookies()).find(c => c.name === 'cadence_session');
  expect(ck).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  expect(statSync(join(dataDir, 'sessions.json')).mode & 0o077).toBe(0);
  await page.reload();
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.goto(`${B}/login`);            // already signed in: straight back to the app
  await expect(page).not.toHaveURL(/login/);
  expect(errs).toEqual([]);
});

test('sign out from the command palette, and an expired session returns to login', async ({ page, context }) => {
  await page.goto(`${B}/login`);
  await page.fill('#u', 'nick'); await page.fill('#p', 's3cret:pw'); await page.click('#go');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  // session disappears server-side (e.g. password changed): the next sync sends you to login
  await context.clearCookies();
  await page.evaluate(() => fetch('api/state'));
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 5000 });
  await page.fill('#u', 'nick'); await page.fill('#p', 's3cret:pw'); await page.click('#go');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  const r = await page.evaluate(() => fetch('api/logout', { method: 'POST' }).then(r => r.status));
  expect(r).toBe(200);
  expect(await page.evaluate(() => fetch('api/state').then(r => r.status))).toBe(401);
});

test('cross-site requests are refused', async () => {
  const r = await fetch(`${B}/api/login`, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
  expect(r.status).toBe(403);
});
