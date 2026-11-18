// Live sync: a change saved on one device shows on the others within a couple of seconds, without waiting for the
// 20-second check or a refocus. One tab per browser holds the stream; the other tabs hear it from that one.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-live-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

async function tab(ctx, name) {
  const page = await ctx.newPage();
  await page.addInitScript(n => { localStorage.setItem('cadence.device', n); }, name);
  await page.goto(B + '/#inbox');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return page;
}
const titles = page => page.evaluate(() => window.T.tasks.list().map(t => t.title));

test('a task added on one device shows on another, and in a second tab, within seconds', async ({ browser }) => {
  const desk = await browser.newContext(), phone = await browser.newContext();
  const d1 = await tab(desk, 'Desk'), d2 = await tab(desk, 'Desk'), p = await tab(phone, 'Phone');
  // one stream per browser: the desk's two tabs share one
  await expect.poll(async () => (await (await fetch(B + '/api/health')).json()).live ?? null, { timeout: 8000 }).toBe(2);
  // the phone adds something: both desk tabs have it long before the 20-second check
  await p.evaluate(() => window.T.tasks.add({ title: 'Call the plumber' }));
  for (const pg of [d1, d2]) await expect.poll(() => titles(pg), { timeout: 4000, intervals: [200] }).toContain('Call the plumber');
  // a change in one desk tab reaches the other desk tab and the phone
  await d2.evaluate(() => window.T.tasks.add({ title: 'Book the dentist' }));
  for (const pg of [d1, p]) await expect.poll(() => titles(pg), { timeout: 4000, intervals: [200] }).toContain('Book the dentist');
  // the tab holding the stream closes: another tab takes over and still hears changes
  await d1.close();
  await expect.poll(async () => (await (await fetch(B + '/api/health')).json()).live, { timeout: 8000 }).toBe(2);
  await p.evaluate(() => window.T.tasks.add({ title: 'Water the plants' }));
  await expect.poll(() => titles(d2), { timeout: 4000, intervals: [200] }).toContain('Water the plants');
  await desk.close(); await phone.close();
});
