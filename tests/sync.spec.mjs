// Per-record sync between two devices (two browser profiles) through one server.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
// a free port from the OS, so test files running side by side never collide
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-sync-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

async function device(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(n => { localStorage.setItem('cadence.device', n); localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); }, name);
  await page.goto(B + '/#inbox');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return { ctx, page,
    tasks: () => page.evaluate(() => window.T.tasks.list()),
    pull: () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))),
    settle: () => page.waitForTimeout(1600) };
}

test('two devices: adds, different-field edits merge, a same-field clash keeps the newest and can be flipped', async ({ browser }) => {
  const A = await device(browser, 'Laptop'), Bd = await device(browser, 'Phone');
  // A adds a task; B gets it
  const id = await A.page.evaluate(() => window.T.tasks.add({ title: 'Send SOW', owner: 'me', dueDate: '2026-11-20' }).id);
  await A.settle(); await Bd.pull();
  await expect.poll(async () => (await Bd.tasks()).find(t => t.id === id)?.title).toBe('Send SOW');

  // B goes offline and changes the due date; A changes the title; B comes back: both survive
  await Bd.ctx.setOffline(true);
  await Bd.page.evaluate(id => window.T.tasks.update(id, { dueDate: '2026-11-25' }), id);
  await A.page.evaluate(id => window.T.tasks.update(id, { title: 'Send SOW v2' }), id);
  await A.settle();
  await Bd.ctx.setOffline(false);
  await Bd.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await Bd.settle(); await A.pull(); await Bd.pull();
  for (const d of [A, Bd]) await expect.poll(async () => { const t = (await d.tasks()).find(t => t.id === id); return t && `${t.title}|${t.dueDate}`; }).toBe('Send SOW v2|2026-11-25');

  // a real clash: both change the title while B is offline; B's (newer) edit wins, A can flip it
  await Bd.ctx.setOffline(true);
  await A.page.evaluate(id => window.T.tasks.update(id, { title: 'From laptop' }), id);
  await A.settle();
  await Bd.page.evaluate(id => window.T.tasks.update(id, { title: 'From phone' }), id);
  await Bd.ctx.setOffline(false);
  await Bd.page.evaluate(() => window.dispatchEvent(new Event('online')));
  // the clash notice is on the Island (it may be queued behind a boot notice on a slow machine)
  await expect.poll(() => Bd.page.evaluate(() => [window.__island.cur, ...window.__island.queue].some(n => n && /clashed/.test(n.title || ''))), { timeout: 8000 }).toBe(true);
  await A.pull();
  await expect.poll(async () => (await A.tasks()).find(t => t.id === id)?.title).toBe('From phone');
  // review on the laptop, from the command palette, and pick its own version
  const clashes = await (await fetch(B + '/api/conflicts')).json();
  expect(clashes.conflicts.some(c => c.field === 'title' && c.kept === 'From phone' && c.other === 'From laptop' && c.keptDevice === 'Phone')).toBe(true);
  await A.page.keyboard.press('Control+k');
  await A.page.fill('#pal-in', 'Review sync');
  await A.page.keyboard.press('Enter');
  await expect(A.page.locator('.cf').first()).toBeVisible();
  await A.page.locator('.cf', { hasText: 'Title' }).locator('[data-keep=other]').click();
  await A.settle(); await Bd.pull();
  for (const d of [A, Bd]) await expect.poll(async () => (await d.tasks()).find(t => t.id === id)?.title).toBe('From laptop');
  expect((await (await fetch(B + '/api/conflicts')).json()).conflicts.filter(c => c.field === 'title')).toHaveLength(0);

  // deletes travel too
  await A.page.evaluate(id => window.T.tasks.remove(id), id);
  await A.settle(); await Bd.pull();
  await expect.poll(async () => (await Bd.tasks()).some(t => t.id === id)).toBe(false);
  await A.ctx.close(); await Bd.ctx.close();
});

// each test can run on a fresh server (Playwright restarts the worker after a failure): make sure there is a document
async function seeded(browser) {
  const A = await device(browser, 'Laptop');
  if (!(await (await fetch(B + '/api/state')).json()).json) { await A.page.evaluate(() => window.T.tasks.add({ title: 'Seed', owner: 'me' })); await A.settle(); }
  return A;
}

test('an older tab that still sends the whole document is merged in, and devices see it', async ({ browser }) => {
  const A = await seeded(browser);
  const st = await (await fetch(B + '/api/state')).json(), S = JSON.parse(st.json);
  S.tasks.push({ id: 'old-tab-task', title: 'Made in an old tab', owner: 'me' }); S.updatedAt = Date.now();
  expect((await fetch(B + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: B }, body: JSON.stringify({ json: JSON.stringify(S), updatedAt: S.updatedAt }) })).status).toBe(200);
  await A.pull();
  await expect.poll(async () => (await A.tasks()).some(t => t.id === 'old-tab-task')).toBe(true);
  await A.ctx.close();
});

test('a browser upgrading from whole-document sync keeps its newer unsynced work, or takes the server copy if older', async ({ browser }) => {
  await (await seeded(browser)).ctx.close();
  const st = await (await fetch(B + '/api/state')).json(), S = JSON.parse(st.json);
  // newer local copy (edited offline before the upgrade): its extra task reaches the server
  const newer = { ...S, tasks: [...S.tasks, { id: 'pre-upgrade', title: 'Offline before the upgrade', owner: 'me' }], updatedAt: Date.now() + 1000 };
  const c1 = await browser.newContext(), p1 = await c1.newPage();
  await p1.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('cadence.v1', s); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); }, JSON.stringify(newer));
  await p1.goto(B + '/#inbox'); await expect(p1.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await expect.poll(async () => JSON.parse((await (await fetch(B + '/api/state')).json()).json).tasks.some(t => t.id === 'pre-upgrade')).toBe(true);
  await c1.close();
  // older local copy: replaced by the server's
  const older = { ...S, tasks: [{ id: 'stale', title: 'Stale local task', owner: 'me' }], updatedAt: 1 };
  const c2 = await browser.newContext(), p2 = await c2.newPage();
  await p2.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('cadence.v1', s); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); }, JSON.stringify(older));
  await p2.goto(B + '/#inbox'); await expect(p2.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await expect.poll(async () => p2.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')).tasks.some(t => t.id === 'pre-upgrade'))).toBe(true);
  expect(await p2.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')).tasks.some(t => t.id === 'stale'))).toBe(false);
  expect(JSON.parse((await (await fetch(B + '/api/state')).json()).json).tasks.some(t => t.id === 'stale')).toBe(false);
  await c2.close();
});
