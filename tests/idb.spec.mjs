// IndexedDB: every save of the big documents also goes to IndexedDB. When a save no longer fits in localStorage, a
// marker takes its place and the app opens from IndexedDB, before drawing or syncing. Here localStorage is made to
// refuse big saves, and the NAS is cut off on the reload, so the tasks can only have come from IndexedDB.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-idb-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const hook = page => page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
// look without creating anything: before the app's first save there's no database (or no store) yet
const idbGet = (page, k) => page.evaluate(k => new Promise((res, rej) => { const r = indexedDB.open('cadence');
  r.onupgradeneeded = () => { r.transaction.abort(); };
  r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('docs')) { d.close(); return res(null); }
    const g = d.transaction('docs').objectStore('docs').get(k); g.onsuccess = () => { d.close(); res(g.result || null); }; g.onerror = () => rej(g.error); };
  r.onerror = () => res(null); }), k);

test('saves go to IndexedDB too; too big for localStorage, the app opens from IndexedDB', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 }); await hook(page);
  // an ordinary save: in localStorage as before, and in IndexedDB
  await page.evaluate(() => { window.T.tasks.add({ title: 'Small and saved twice', dueDate: window.T.util.todayKey() }); window.T.ui.refresh(); });
  await expect.poll(async () => ((await idbGet(page, 'cadence.v1')) || { tasks: [] }).tasks.some(t => t.title === 'Small and saved twice')).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('cadence.v1').startsWith('idb1:'))).toBe(false);

  // from now on this browser's localStorage refuses big saves (as if it were full)
  await page.addInitScript(() => { const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'cadence.v1' && String(v).length > 4000 && !String(v).startsWith('idb1:')) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; });
  await page.reload(); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 }); await hook(page);
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.T.tasks.add({ title: 'Big list item ' + i + ' ' + 'x'.repeat(80), dueDate: window.T.util.todayKey() }); window.T.ui.refresh(); });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cadence.v1').slice(0, 5))).toBe('idb1:');
  await expect.poll(async () => ((await idbGet(page, 'cadence.v1')) || { tasks: [] }).tasks.length).toBeGreaterThanOrEqual(41);

  // reload with the NAS cut off: everything is still here, from IndexedDB
  await page.route('**/api/**', r => r.abort());
  await page.reload();
  await expect(page.locator('#view .task', { hasText: 'Big list item 39' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#view .task', { hasText: 'Small and saved twice' })).toBeVisible();
  await hook(page);
  expect(await page.evaluate(() => window.T.tasks.list(t => /^Big list item/.test(t.title)).length)).toBe(40);
  // and a change made now is kept (IndexedDB only, straight away)
  await page.evaluate(() => { window.T.tasks.add({ title: 'Added while only in IndexedDB', dueDate: window.T.util.todayKey() }); });
  await expect.poll(async () => ((await idbGet(page, 'cadence.v1')) || { tasks: [] }).tasks.some(t => t.title === 'Added while only in IndexedDB')).toBe(true);
  await page.reload();
  await expect(page.locator('#view .task', { hasText: 'Added while only in IndexedDB' })).toBeVisible({ timeout: 10000 });
  expect(errs.filter(e => !/Failed to fetch|NetworkError|net::/i.test(e))).toEqual([]);
});

test('a "cadence" database with nothing in it (made before the app opened it) is repaired, and saving works', async ({ page }) => {
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.evaluate(() => new Promise(res => { const del = indexedDB.deleteDatabase('cadence'); del.onsuccess = del.onerror = () => {
    const r = indexedDB.open('cadence', 1); r.onsuccess = () => { r.result.close(); res(); }; }; }));   // version 1, no store
  await page.reload(); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 }); await hook(page);
  await page.evaluate(() => { window.T.tasks.add({ title: 'Saved after the repair', dueDate: window.T.util.todayKey() }); });
  await expect.poll(async () => ((await idbGet(page, 'cadence.v1')) || { tasks: [] }).tasks.some(t => t.title === 'Saved after the repair')).toBe(true);
});
