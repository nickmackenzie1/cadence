// Cadence smoke tests: boots a real server against a throwaway data dir and drives the app like a user.
// Run: npm test   (needs `npx playwright install chromium` once)
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8611 + Math.floor(Math.random() * 300);
let server, dataDir;
test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'cadence-test-'));
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${PORT}/api/health`); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
});
test.afterAll(() => { server && server.kill(); rmSync(dataDir, { recursive: true, force: true }); });

const errorsOf = page => { const errs = []; page.on('pageerror', e => errs.push(String(e))); return errs; };
async function boot(page) {
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
}

test('boots with every plugin registered and no errors', async ({ page }) => {
  const errs = errorsOf(page); await boot(page);
  const scripts = await page.locator('script[src^="plugins/"]').count();
  await page.click('[data-act=settings]'); await page.click('[data-act=set-tab][data-tab=plugins]');
  expect(await page.locator('.pl-card').count()).toBeGreaterThanOrEqual(scripts);
  expect(errs).toEqual([]);
});

test('quick add parses client, owner, dates and keeps names after prepositions', async ({ page }) => {
  await boot(page);
  await page.fill('#ob-clients', 'Acme Corp, Blue Sky Labs'); await page.click('[data-act=ob-add]');
  const add = async t => { await page.fill('#qa', t); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter'); await page.keyboard.press('Escape'); };
  await add('send SOW @Acme Corp fri 3pm !1 #crm');
  await add('meet with @Blue Sky Labs tomorrow');
  await add('^Sarah share logins @acme today');
  const tasks = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')).tasks);
  const by = t => tasks.find(x => x.title.startsWith(t));
  expect(by('Send SOW')).toMatchObject({ dueTime: '15:00', priority: 3, tags: ['Zoho-CRM'] });
  expect(by('Meet with Blue Sky Labs')).toBeTruthy();
  expect(by('Share logins')).toMatchObject({ owner: 'client', assignee: 'Sarah' });
});

test('data survives a reload through the NAS', async ({ page, context }) => {
  await boot(page);
  await page.fill('#qa', 'Persist me today'); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter');
  await page.waitForTimeout(1500);
  const p2 = await context.newPage(); await p2.goto(`http://localhost:${PORT}/`); await p2.evaluate(() => localStorage.clear()); await p2.reload();
  await expect(p2.locator('.t-title', { hasText: 'Persist me' })).toBeVisible({ timeout: 8000 });
});

test('inline editor opens in place and the date chip sets a date', async ({ page }) => {
  await boot(page);
  await page.goto(`http://localhost:${PORT}/#inbox`);
  await page.fill('#qa', 'Editable task'); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter'); await page.keyboard.press('Escape');
  await page.locator('.task', { hasText: 'Editable task' }).click();
  await expect(page.locator('.task.open .te-title')).toHaveValue('Editable task');
  await page.click('.task.open [data-te=due]'); await page.click('.dp-quick button >> nth=1');
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')).tasks.find(x => x.title === 'Editable task'));
  expect(t.dueDate).toBeTruthy();
});

test('meeting: capture, Fireflies import, review, commit', async ({ page }) => {
  const errs = errorsOf(page); await boot(page);
  await page.click('[data-act=settings]'); await page.fill('#st-name', 'Nick Mackenzie'); await page.press('#st-name', 'Tab'); await page.keyboard.press('Escape');
  await page.click('[data-act=meeting]');
  await page.fill('#m-in', 'Send blueprint fri'); await page.press('#m-in', 'Enter');
  await page.click('[data-act=m-import]');
  await page.fill('#imp-text', 'Action Items\n\n**Sarah Lee**\nShare API credentials (18:02)');
  await page.evaluate(() => { document.querySelector('#imp-ex').value = 'fireflies'; });
  await page.click('[data-act=imp-run]');
  await page.click('[data-act=m-review]'); await page.click('[data-act=m-commit]');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')));
  expect(s.meetings.length).toBe(1);
  expect(s.tasks.some(t => t.owner === 'client' && /API credentials/.test(t.title))).toBe(true);
  expect(errs).toEqual([]);
});

test('every sidebar view renders', async ({ page }) => {
  const errs = errorsOf(page); await boot(page);
  for (const r of ['today', 'upcoming', 'waiting', 'inbox', 'done', 'insights', 'view-pulse', 'view-review', 'view-mural', 'view-feeds', 'view-db']) {
    await page.goto(`http://localhost:${PORT}/#${r}`); await page.waitForTimeout(250);
    await expect(page.locator('#view')).not.toContainText('Plugin view failed');
  }
  expect(errs).toEqual([]);
});

test('server refuses to fetch private network addresses', async ({ request }) => {
  expect((await request.get(`http://localhost:${PORT}/api/company?d=192.168.1.1`)).status()).toBe(400);
  expect((await request.get(`http://localhost:${PORT}/api/feed?url=${encodeURIComponent('http://127.0.0.1:22/')}`)).status()).toBeGreaterThanOrEqual(400);
});

test('demo mode: fake data, never written to the NAS, exits cleanly', async ({ page, request }) => {
  const errs = errorsOf(page);
  const before = await (await request.get(`http://localhost:${PORT}/api/state`)).json();
  await page.goto(`http://localhost:${PORT}/?demo=1#today`);
  await expect(page.locator('.demo-row')).toBeVisible();
  await expect(page.locator('#sync')).toContainText('Demo', { timeout: 8000 });
  expect(await page.locator('#side-main a[href^="#client-"]').count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.cal-ev').first()).toBeVisible();           // sample calendar is on in demo
  await page.locator('.task .check').first().click();                     // a change in demo…
  await page.waitForTimeout(1500);
  const after = await (await request.get(`http://localhost:${PORT}/api/state`)).json();
  expect(after.updatedAt).toBe(before.updatedAt);                          // …never reaches the NAS
  await page.locator('.demo-row [data-act=demo-exit]').click();
  await expect(page.locator('.demo-row')).toHaveCount(0);
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  expect(errs).toEqual([]);
});

test('insights hub, database viewer and narrow layout', async ({ page }) => {
  const errs = errorsOf(page);
  await page.goto(`http://localhost:${PORT}/?demo=1#insights`);
  for (const id of ['pulse', 'review', 'db']) { await page.locator(`[data-act=ins-tab][data-id=${id}]`).click(); await expect(page.locator('#pv')).not.toBeEmpty(); }
  await page.fill('#dbv-q', 'done:false');
  await page.waitForTimeout(400);
  await expect(page.locator('.dbv-bar .cnt')).toContainText('/');
  await page.locator('.dbv tbody tr').first().click();
  await expect(page.locator('.dbv-insp pre')).toContainText('"done": false');
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`http://localhost:${PORT}/#today`);
  await page.click('#nav-btn');
  await expect(page.locator('body')).toHaveClass(/nav-open/);
  await page.locator('#side a[href="#upcoming"]').click();
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  await page.goto(`http://localhost:${PORT}/?demo=0`);
  expect(errs).toEqual([]);
});

test('calendar: ICS feed is parsed and its URL is never sent back', async ({ request }) => {
  const r = await request.put(`http://localhost:${PORT}/api/calendar/config`, { data: { calendars: [{ id: 'x', name: 'Work', color: '#f00', url: 'https://calendar.example.com/secret-token/basic.ics' }] } });
  expect(r.ok()).toBeTruthy();
  const cfg = await (await request.get(`http://localhost:${PORT}/api/calendar/config`)).text();
  expect(cfg).not.toContain('secret-token');
  expect(cfg).toContain('calendar.example.com');
  await request.put(`http://localhost:${PORT}/api/calendar/config`, { data: { calendars: [] } });
});

test('themes: engine applies, persists, cleans up effects, and plugins can register their own', async ({ page }) => {
  const errs = errorsOf(page); await boot(page);
  const ids = await page.evaluate(() => CadenceThemes.list().map(t => t.id));
  expect(ids.length).toBeGreaterThanOrEqual(15);
  // every theme applies without errors and sets the skin attribute
  for (const id of ids) {
    await page.evaluate(id => CadenceThemes.apply(id), id);
    expect(await page.evaluate(() => document.documentElement.dataset.skin || 'cadence')).toBe(id);
  }
  // effects layer exists for an FX theme and is removed when switching away
  await page.evaluate(() => CadenceThemes.apply('matrix'));
  expect(await page.locator('.th-fx canvas').count()).toBe(1);
  await page.evaluate(() => CadenceThemes.apply('nord'));
  expect(await page.locator('.th-fx').count()).toBe(0);
  expect(await page.evaluate(() => CadenceThemes.token('--bg'))).toBe('#2e3440');
  // a third-party theme
  await page.evaluate(() => CadenceThemes.register({ id: 'test-red', name: 'Test red', vars: { '--accent': '#ff0000' } }));
  await page.evaluate(() => CadenceThemes.apply('test-red'));
  expect(await page.evaluate(() => CadenceThemes.token('--accent'))).toBe('#ff0000');
  // persisted in synced plugin storage
  await page.evaluate(() => CadenceThemes.apply('paper')); await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.v1')).pluginData.themes.theme)).toBe('paper');
  await page.reload(); await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('paper');
  await page.goto(`http://localhost:${PORT}/#view-themes`);
  await expect(page.locator('.th-card')).toHaveCount(ids.length);
  await page.evaluate(() => CadenceThemes.apply('cadence'));
  expect(errs).toEqual([]);
});
