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

