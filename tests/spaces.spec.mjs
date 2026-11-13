// Work / Life spaces: separate worlds on one login, synced between devices, safe from older tabs.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-spaces-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

async function device(browser, name) {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(n => { localStorage.setItem('cadence.device', n); localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); }, name);
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  const hook = () => page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  await hook();
  return { ctx, page, errs, hook, settle: () => page.waitForTimeout(1500), pull: () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))) };
}

test('switching to Life opens a separate, calm world; Work is untouched', async ({ browser }) => {
  const A = await device(browser, 'Laptop');
  await A.page.evaluate(() => window.T.clients.add('Acme'));
  await A.page.evaluate(() => window.T.tasks.add({ title: 'Work task', owner: 'me', dueDate: window.T.util.todayKey() }));
  await A.page.click('.space-sw [data-s=life]');
  await expect(A.page.locator('#side-main .sect', { hasText: 'Areas' })).toBeVisible();
  await expect(A.page.locator('#side-main .nav a[href^="#client-"]', { hasText: 'Home' })).toBeVisible();
  await expect(A.page.locator('#side-main')).not.toContainText('Waiting on clients');
  await expect(A.page.locator('.meet-btn')).toHaveCount(0);
  expect(await A.page.evaluate(() => document.documentElement.dataset.skin)).toBe('calm');
  await A.hook();
  expect(await A.page.evaluate(() => window.T.space())).toBe('life');
  expect(await A.page.evaluate(() => window.T.tasks.list().map(t => t.title))).not.toContain('Work task');
  await A.page.evaluate(() => { const home = window.T.clients.list().find(c => c.name === 'Home'); window.T.tasks.add({ title: 'Change the furnace filter', owner: 'me', clientId: home.id }); });
  // plugins: client-only ones are not offered in Life
  await A.page.evaluate(() => location.hash = 'plugins');
  await A.page.click('[data-act=pl-tab][data-t=all]');
  await expect(A.page.locator('.pb-card', { hasText: 'Zoho status' })).toHaveCount(0);
  await expect(A.page.locator('.pb-card', { hasText: 'Dashboards' })).toHaveCount(1);
  // back to Work: its own theme, clients and tasks
  await A.page.click('.space-sw [data-s=work]');
  await expect(A.page.locator('#side-main .nav a', { hasText: 'Acme' })).toBeVisible();
  await A.hook();
  const work = await A.page.evaluate(() => window.T.tasks.list().map(t => t.title));
  expect(work).toContain('Work task'); expect(work).not.toContain('Change the furnace filter');
  expect(await A.page.evaluate(() => document.documentElement.dataset.skin || 'cadence')).toBe('cadence');
  await A.settle();
  expect(A.errs).toEqual([]);
  await A.ctx.close();
});

test('Life syncs to another device, stays out of the Work document, and older tabs can never delete it', async ({ browser }) => {
  const A = await device(browser, 'Laptop');
  await A.page.click('.space-sw [data-s=life]'); await A.hook();
  await A.page.evaluate(() => { const m = window.T.clients.list().find(c => c.name === 'Money'); window.T.tasks.add({ title: 'Renew car insurance', owner: 'me', clientId: m.id }); });
  await A.settle();
  // the Work document (what older tabs and the safety copy see) has no Life in it
  const doc = JSON.parse((await (await fetch(B + '/api/state')).json()).json);
  expect(doc.tasks.map(t => t.title)).not.toContain('Renew car insurance');
  expect(doc.clients.map(c => c.name)).not.toContain('Money');
  // an older tab saves the Work document: Life survives
  // (the open tab may save in between, which the server rightly refuses as a conflict: re-read and try again)
  let st = 0;
  for (let i = 0; i < 4 && st !== 200; i++) { const d = i ? JSON.parse((await (await fetch(B + '/api/state')).json()).json) : doc; d.updatedAt = Date.now();
    st = (await fetch(B + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: B }, body: JSON.stringify({ json: JSON.stringify(d), updatedAt: d.updatedAt }) })).status; if (st !== 200) await new Promise(r => setTimeout(r, 300)); }
  expect(st).toBe(200);
  // a second device sees Life (areas, task, calm theme) after switching
  const P = await device(browser, 'Phone');
  await P.page.click('.space-sw [data-s=life]'); await P.hook();
  await expect.poll(async () => P.page.evaluate(() => window.T.tasks.list().map(t => t.title))).toContain('Renew car insurance');
  expect(await P.page.evaluate(() => window.T.clients.list().map(c => c.name).sort())).toEqual(expect.arrayContaining(['Health', 'Home', 'Money', 'Projects']));
  expect(await P.page.evaluate(() => document.documentElement.dataset.skin)).toBe('calm');
  // and an edit on the phone's Life reaches the laptop
  await P.page.evaluate(() => { const t = window.T.tasks.list().find(t => t.title === 'Renew car insurance'); window.T.tasks.update(t.id, { title: 'Renew car insurance (shop around)' }); });
  await P.settle(); await A.pull();
  await expect.poll(async () => A.page.evaluate(() => window.T.tasks.list().map(t => t.title))).toContain('Renew car insurance (shop around)');
  expect([...A.errs, ...P.errs]).toEqual([]);
  await A.ctx.close(); await P.ctx.close();
});
