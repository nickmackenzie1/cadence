// Background work page (2026-11-18): every scheduler job, with run now, pause (kept across restarts) and how often.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B, PORT;
const boot = async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), SCHEDULER_TICK: '200', QUIET_MS: '300' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
};
test.beforeAll(async () => { PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-jobs-')); B = `http://localhost:${PORT}`; await boot(); });
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const post = (name, body) => fetch(`${B}/api/jobs/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const job = async name => (await (await fetch(B + '/api/jobs')).json()).find(j => j.name === name);

test('run now, pause, how often; pausing and pace survive a restart', async () => {
  const j = await job('db-upkeep'); expect(j).toBeTruthy(); expect(j.base).toBeGreaterThanOrEqual(60e3);
  // pace: a day, then back
  let r = await (await post('db-upkeep', { action: 'every', every: 86400e3 })).json();
  expect(r).toMatchObject({ every: 86400e3, changed: true });
  // a job that runs in small steps has no pace to change
  expect((await post('reminders', { action: 'every', every: 3600e3 })).status).toBe(400);
  expect((await post('nope', { action: 'run' })).status).toBe(404);
  // run now: it runs even though it normally waits for a quiet moment
  const runs = (await job('feeds')).runs;
  await post('feeds', { action: 'run' });
  await expect.poll(async () => (await job('feeds')).runs, { timeout: 15000 }).toBeGreaterThan(runs);
  expect((await job('feeds')).history.length).toBeGreaterThan(0);
  // pause
  r = await (await post('feeds', { action: 'pause' })).json(); expect(r.state).toBe('paused');
  expect(JSON.parse(readFileSync(join(dir, 'jobs-app.json'), 'utf8')).paused).toContain('feeds');
  // restart: still paused, still a day
  server.kill(); await new Promise(r => setTimeout(r, 500)); await boot();
  expect((await job('feeds')).state).toBe('paused');
  expect((await job('db-upkeep')).every).toBe(86400e3);
  r = await (await post('feeds', { action: 'resume' })).json(); expect(r.state).not.toBe('paused');
  r = await (await post('db-upkeep', { action: 'every', every: (await job('db-upkeep')).base })).json(); expect(r.changed).toBe(false);
});

test('the page lists the jobs and controls them', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#view-jobs');
  const row = page.locator('.jb-j', { hasText: 'Database' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('.jb-row').click();
  await row.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(row).toContainText('Paused', { timeout: 5000 });
  await row.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(row).not.toHaveClass(/jb-paused/, { timeout: 5000 });
  await row.locator('[data-jp]').selectOption(String(7 * 86400e3));
  await expect.poll(async () => (await job('db-upkeep')).every).toBe(7 * 86400e3);
  await row.locator('[data-jp]').selectOption({ index: 0 });
  await expect.poll(async () => (await job('db-upkeep')).changed).toBe(false);
  expect(errs).toEqual([]);
});
