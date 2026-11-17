// Problems log (user, 2026-11-17): errors in the browser, failed and slow requests, freezes, and a run that ended without
// shutting down are kept in data/problems.jsonl and shown on the Problems page.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const dir = mkdtempSync(join(tmpdir(), 'cadence-problems-'));
async function start() {
  const PORT = await freePort(), B = `http://localhost:${PORT}`;
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), KEXP_LOG: '0', RADIO_WARM: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  return { B, p };
}
test.afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('a crash, a browser error and a killed server all land in Problems, and the page shows them', async ({ page }) => {
  let s = await start();
  // an error in the app in the browser
  await page.goto(s.B + '/');
  await page.evaluate(() => setTimeout(() => { throw new Error('Something broke on purpose'); }, 0));
  await expect.poll(async () => (await (await fetch(s.B + '/api/problems')).json()).map(x => x.msg).join('|')).toContain('Something broke on purpose');
  // the server is killed without warning (like running out of memory), then starts again
  s.p.kill('SIGKILL'); await new Promise(r => s.p.once('exit', r));
  s = await start();
  const list = await (await fetch(s.B + '/api/problems')).json();
  const stop = list.find(x => x.kind === 'stopped');
  expect(stop.msg).toMatch(/stopped unexpectedly, last seen/);
  expect(stop.lastMb).toBeGreaterThan(0);
  const b = list.find(x => x.kind === 'browser');
  expect(b.where).toBe('/');
  // the page: both, plainly labelled
  await page.goto(s.B + '/#view-problems');
  await expect(page.locator('.pr-l li', { hasText: 'Stopped unexpectedly' })).toHaveCount(1);
  await expect(page.locator('.pr-l li', { hasText: 'Something broke on purpose' })).toContainText('In the browser');
  // a clean stop isn't a problem
  s.p.kill('SIGTERM'); await new Promise(r => s.p.once('exit', r));
  s = await start();
  expect((await (await fetch(s.B + '/api/problems')).json()).filter(x => x.kind === 'stopped').length).toBe(1);
  // clearing empties it
  await page.goto(s.B + '/#view-problems');
  await page.locator('#pr-clear').click();
  await expect(page.locator('.pr')).toContainText('Nothing has gone wrong');
  s.p.kill('SIGTERM');
});

test('the music side runs in its own process: if it dies, tasks keep working, it comes back, and Problems says so', async () => {
  const { execSync } = await import('node:child_process');
  const s = await start();
  await expect.poll(async () => (await fetch(s.B + '/api/radar/status')).status, { timeout: 20000 }).toBe(200);
  const kids = () => execSync(`ps -o pid= --ppid ${s.p.pid} || true`).toString().trim().split(/\s+/).filter(Boolean).map(Number);
  const [music] = kids(); expect(music).toBeGreaterThan(0);
  process.kill(music, 'SIGKILL');                                                     // like running out of memory
  // the rest of Cadence doesn't notice
  expect((await fetch(s.B + '/healthz')).status).toBe(200);
  expect((await fetch(s.B + '/api/state')).status).toBe(200);
  // it's started again, and Radar answers
  await expect.poll(async () => { const k = kids(); return k.length && k[0] !== music; }, { timeout: 20000 }).toBe(true);
  await expect.poll(async () => (await fetch(s.B + '/api/radar/status')).status, { timeout: 20000 }).toBe(200);
  const p = (await (await fetch(s.B + '/api/problems')).json()).find(x => /music side/.test(x.msg));
  expect(p.msg).toMatch(/was stopped \(SIGKILL, often running out of memory\); starting it again/);
  s.p.kill('SIGTERM'); await new Promise(r => s.p.once('exit', r));
  await expect.poll(() => kids().length).toBe(0);                                     // and it goes when Cadence stops
});
