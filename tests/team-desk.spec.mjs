// Team (hand work to devs) and Desk tickets.
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
// every test gets its own server and an empty data folder, so tests can't trip over each other's data
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-td-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterEach(async () => { if (server) { const gone = new Promise(r => server.once('exit', r)); server.kill(); await gone; } rmSync(dir, { recursive: true, force: true }); });

async function open(page) {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return errs;
}
const quick = async (page, text) => { await page.fill('#qa', text); await page.press('#qa', 'Enter'); };

test('hand tasks to dev: >dev, the owner chip, the Dev page', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => window.T.clients.add('Acme'));
  await page.evaluate(() => location.hash = 'dev');
  await expect(page.locator('#view')).toContainText('Nothing with dev');
  await page.evaluate(() => location.hash = 'today');
  await page.fill('#qa', 'Fix the blueprint transition @acme >dev ');
  await expect(page.locator('#qa-chips')).toContainText('Dev');
  await page.press('#qa', 'Enter');
  await quick(page, 'Build the Books sync ^dev tomorrow');
  await quick(page, 'Send SOW @acme ^bob');
  const ts = await page.evaluate(() => window.T.tasks.list().map(t => ({ title: t.title, owner: t.owner, a: t.assignee, at: !!t.assignedAt })));
  expect(ts.find(t => t.title.startsWith('Fix'))).toMatchObject({ title: 'Fix the blueprint transition', owner: 'dev', at: true });
  expect(ts.find(t => t.title.startsWith('Build')).owner).toBe('dev');
  expect(ts.find(t => t.title.startsWith('Send'))).toMatchObject({ owner: 'client', a: 'bob' });
  // they leave my Today and show on the Dev page
  await expect(page.locator('#side-main a[href="#dev"] .n')).toHaveText('2');
  await page.evaluate(() => location.hash = 'dev');
  await expect(page.locator('#view .task')).toHaveCount(2);
  // hand one back to me from the owner chip, then to dev again
  await page.click('#view .task .t-title >> text=Build the Books sync');
  await page.click('.task.open [data-te=owner]');
  await page.click('.pop-i[data-o=me]');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title.startsWith('Build'))[0].owner)).toBe('me');
  await page.evaluate(() => location.hash = 'upcoming');
  await page.click('#view .task .t-title >> text=Build the Books sync');
  await page.click('.task.open [data-te=owner]');
  await page.click('.pop-i[data-o=dev]');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title.startsWith('Build'))[0].owner)).toBe('dev');
  // client page shows "With dev"
  await page.evaluate(() => location.hash = 'client-' + window.T.clients.list()[0].id);
  await expect(page.locator('.group-h.dev')).toContainText('With dev');
  expect(errs).toEqual([]);
});

test('Desk tickets: quick add, chips, board, SLA, closing with the task', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => window.T.clients.add('Acme'));
  // the view can re-render under us after a sync pull; retype until the preview shows
  await expect(async () => { await page.fill('#qa', ''); await page.fill('#qa', 'Sync error on Deals @acme desk 4821 '); await expect(page.locator('#qa-chips')).toContainText('#4821', { timeout: 1000 }); }).toPass({ timeout: 10000 });
  await page.press('#qa', 'Enter');
  await quick(page, 'Portal login loop @acme https://desk.zoho.com/agent/acme/acme/tickets/details/123456789012345 !1');
  const ks = await page.evaluate(() => window.T.tasks.list(t => t.ticket).map(t => ({ title: t.title, k: t.ticket, tags: t.tags })));
  expect(ks).toHaveLength(2);
  expect(ks[0].title).toBe('Sync error on Deals'); expect(ks[0].k.no).toBe('4821'); expect(ks[0].tags).toContain('desk');
  expect(ks[1].k.url).toContain('desk.zoho.com'); expect(ks[1].title).toBe('Portal login loop');
  expect(ks.every(t => t.k.via === 'desk')).toBe(true);
  await expect(page.locator('.task .chip.tkt', { hasText: '#4821' })).toBeVisible();
  await expect(page.locator('.task .chip.tkt', { hasText: 'Desk ticket' })).toBeVisible();
  // age one past its SLA (normal = 4 days)
  await page.evaluate(() => { const t = window.T.tasks.list(t => t.ticket && t.ticket.no === '4821')[0]; window.T.tasks.update(t.id, { ticket: { ...t.ticket, opened: Date.now() - 6 * 864e5 } }); });
  await page.evaluate(() => location.hash = 'view-tickets');
  await expect(page.locator('.dk-sum')).toContainText('1 past SLA');
  await expect(page.locator('.dk-col[data-col=open] .dk-card')).toHaveCount(2);
  await expect(page.locator('.dk-col[data-col=open] .dk-card').first()).toHaveClass(/breach/);
  // move it to escalated from the card
  await page.selectOption('.dk-card:has-text("Sync error") .dk-st', 'escalated');
  await expect(page.locator('.dk-col[data-col=escalated] .dk-card')).toHaveCount(1);
  // completing the task closes the ticket
  await page.evaluate(() => { const t = window.T.tasks.list(t => t.ticket && t.ticket.no === '4821')[0]; window.T.tasks.complete(t.id); });
  expect(await page.evaluate(() => window.T.tasks.list(t => t.ticket && t.ticket.no === '4821')[0].ticket.status)).toBe('closed');
  await page.evaluate(() => window.T.ui.refresh());
  await expect(page.locator('.dk-sum')).toContainText('1 closed this week');
  // link a ticket to an existing task from its menu
  await page.evaluate(() => location.hash = 'client-' + window.T.clients.list()[0].id);
  await quick(page, 'Check the workflow');
  await page.click('#view .task .t-title >> text=Check the workflow');
  await page.click('.task.open [data-te=more]');
  await page.click('.pop-i:has-text("Support ticket")');
  await page.fill('#dk-no', '5000'); await page.click('#modal [data-seg=pri] [data-v=urgent]'); await page.click('#dk-save');
  const k = await page.evaluate(() => window.T.tasks.list(t => t.title === 'Check the workflow')[0].ticket);
  expect(k.no).toBe('5000'); expect(k.pri).toBe('urgent');
  expect(errs).toEqual([]);
});

test('in-progress work: did my part, follow up later, with a history of steps', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => { const c = window.T.clients.add('Acme'); window.T.tasks.add({ title: 'Get Zoho to fix the Desk webhook', clientId: c.id, dueDate: window.T.util.todayKey() }); window.T.ui.refresh(); });
  await page.click('#view .task .t-title >> text=Get Zoho to fix');
  await page.click('.task.open [data-te=stage]');
  await page.click('.pop-i[data-s=doing]');
  await expect(page.locator('.task.open [data-te=stage]')).toContainText('In progress');
  await page.click('.task.open [data-te=stage]');
  await page.click('.pop-i[data-s=waiting]');
  await page.fill('#st-text', 'Opened a ticket with Zoho support #998');
  await page.click('#st-when [data-v="2"]');
  await page.click('#st-save');
  const t = await page.evaluate(() => window.T.tasks.list(x => x.title.startsWith('Get Zoho'))[0]);
  expect(t.stage).toBe('waiting'); expect(t.done).toBe(false); expect(t.log).toHaveLength(1);
  const in2 = await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), 2)));
  expect(t.dueDate).toBe(in2);
  // it left Today and waits in Upcoming, showing the last step
  await page.evaluate(() => location.hash = 'upcoming');
  await expect(page.locator('.task:has-text("Get Zoho") .t-last')).toContainText('Opened a ticket with Zoho support #998');
  await expect(page.locator('.task:has-text("Get Zoho") .chip.stage')).toContainText('Following up');
  // follow up again with the keyboard: F
  await page.click('.task:has-text("Get Zoho") .t-title'); await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await expect(page.locator('#st-text')).toBeVisible();
  await page.fill('#st-text', 'They asked for logs, sent them'); await page.press('#st-text', 'Enter');
  expect((await page.evaluate(() => window.T.tasks.list(x => x.title.startsWith('Get Zoho'))[0])).log.map(l => l.text)).toEqual(['Opened a ticket with Zoho support #998', 'They asked for logs, sent them']);
  // completing finishes it for good
  await page.evaluate(() => window.T.tasks.complete(window.T.tasks.list(x => x.title.startsWith('Get Zoho'))[0].id));
  expect((await page.evaluate(() => window.T.tasks.list(x => x.title.startsWith('Get Zoho'))[0])).done).toBe(true);
  expect(errs).toEqual([]);
});

test('links on tasks: Zoho Projects, Gmail and plain links become cards', async ({ page }) => {
  const errs = await open(page);
  const c = await page.evaluate(() => window.T.clients.add('Linkco').id);
  await page.evaluate(id => location.hash = 'client-' + id, c);
  await quick(page, 'Fix the import job https://projects.zoho.com/portal/catalystconnect#taskdetail/1874000000123456/1874000000234567/1874000000345678');
  await quick(page, 'https://crm.zoho.com/crm/org712345678/tab/Potentials/5432100000012345678');
  await quick(page, 'Reply to Sam https://mail.google.com/mail/u/0/#inbox/FMfcgzQXJWDsKmPbqLzxkRtTvBnHbcdz');
  await quick(page, 'Read the guide https://www.example.com/docs/setup');
  const ts = await page.evaluate(() => window.T.tasks.list(t => t.ref).map(t => ({ title: t.title, z: t.ref })));
  const by = app => ts.find(t => t.z.app === app);
  expect(by('projects')).toMatchObject({ title: 'Fix the import job', z: { kind: 'Task', portal: 'catalystconnect', id: '1874000000345678' } });
  expect(by('crm').z.kind).toBe('Potential'); expect(by('crm').title).toMatch(/^Zoho CRM potential/);
  expect(by('gmail')).toMatchObject({ title: 'Reply to Sam', z: { kind: 'Email' } });
  expect(by('web')).toMatchObject({ title: 'Read the guide', z: { host: 'example.com' } });
  await expect(page.locator('.task a.chip.zl-chip[href*="mail.google.com"]')).toBeVisible();
  await page.locator('.dp:not(.out)').waitFor({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(100);
  await page.keyboard.press('Escape');   // the 'pick a date?' calendar after a dateless quick add
  await page.click('#view .task .t-title >> text=Reply to Sam');
  await expect(page.locator('.task.open .zl-card')).toContainText('Gmail email');
  await expect(page.locator('.task.open .zl-card a.btn')).toHaveAttribute('href', /mail\.google\.com/);
  expect(errs).toEqual([]);
});

test('paste a Projects link straight into an open task', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => { window.T.tasks.add({ title: 'Paste target', dueDate: window.T.util.todayKey() }); window.T.ui.refresh(); });
  await page.evaluate(() => location.hash = 'today');
  await page.click('#view .task .t-title >> text=Paste target');
  await page.fill('.task.open [data-zl-paste]', 'https://projects.zoho.com/portal/acme#taskdetail/1/2/1874000000999999');
  await page.press('.task.open [data-zl-paste]', 'Enter');
  await expect(page.locator('.task.open .zl-card')).toContainText('Zoho Projects task');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title === 'Paste target')[0].ref.id)).toBe('1874000000999999');
  expect(errs).toEqual([]);
});

test('a ticket opened with Zoho support on a client\'s behalf is tracked as a follow-up', async ({ page }) => {
  const errs = await open(page);
  const c = await page.evaluate(() => window.T.clients.add('Zsco').id);
  await page.evaluate(id => location.hash = 'client-' + id, c);
  await quick(page, 'Webhook not firing on Deals zs 112233');
  const t = await page.evaluate(() => window.T.tasks.list(t => t.ticket && t.ticket.no === '112233')[0]);
  expect(t.title).toBe('Webhook not firing on Deals');
  expect(t.ticket.via).toBe('zoho'); expect(t.tags).toContain('zoho-support');
  expect(t.stage).toBe('waiting'); expect(t.log[0].text).toBe('Opened Zoho support ticket #112233');
  const in2 = await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), 2)));
  expect(t.dueDate).toBe(in2);
  await expect(page.locator('.task .chip.tkt', { hasText: '112233' })).toContainText('Zoho support');
  await page.evaluate(() => location.hash = 'view-tickets');
  await page.click('#dk-vf [data-v=zoho]');
  await expect(page.locator('.dk-card')).toHaveCount(1);
  await expect(page.locator('.dk-card .dk-via')).toHaveText('Zoho support');
  expect(errs).toEqual([]);
});

test('client news: only headlines that mention the client, no duplicates, excludes respected', async ({ page }) => {
  const now = new Date().toUTCString();
  await page.route('**/api/feed?*', r => r.fulfill({ json: { title: 'News', items: [
    { title: 'Initrode wins regional award - Daily', link: 'https://x/1', date: now },
    { title: 'Initrode wins regional award - Other Paper', link: 'https://x/2', date: now },
    { title: 'Weather turns cold - Daily', link: 'https://x/3', date: now },
    { title: 'Initrode recipe contest - Food', link: 'https://x/4', date: now } ] } }));
  const errs = await open(page);
  const id = await page.evaluate(() => window.T.clients.add('Initrode').id);
  await page.evaluate(id => location.hash = 'client-' + id, id);
  await expect(page.locator('.ci-news .ci-item')).toHaveCount(2);
  await page.click('.ci-news [data-ci=cfg]'); await page.fill('#ci-x', 'recipe'); await page.click('#ci-save');
  await expect(page.locator('.ci-news .ci-item')).toHaveCount(1);
  await expect(page.locator('.ci-brief')).toContainText('Initrode');
  expect(errs).toEqual([]);
});

test('record feed: a release date in the title becomes a "Releases" badge on the cover', async ({ page }) => {
  // fake the feed before the page loads: the plugin fetches feeds at startup, and in CI the real ones are reachable
  const soon = new Date(Date.now() + 20 * 864e5), iso = soon.toISOString().slice(0, 10), now = new Date().toUTCString();
  await page.route('**/api/feed?*', r => r.fulfill({ json: { title: 'Shop', items: [
    { title: `Band - Future Album (Releases ${iso}) (Red Vinyl)`, link: 'https://x/1', date: now, image: '' },
    { title: 'Band - Old Album (VG+/NM)', link: 'https://x/2', date: now, image: '' } ] } }));
  const errs = await open(page);
  await page.evaluate(() => location.hash = 'view-feeds');
  await expect(page.locator('#view')).toContainText('Future Album', { timeout: 15000 }).catch(async e => { console.log('FEEDS VIEW:', (await page.locator('#view').innerText()).slice(0, 800)); throw e; });
  await expect(page.locator('.rs-rel').first()).toContainText('Releases');
  expect(await page.locator('.rs-rel').count()).toBeGreaterThan(0);
  await expect(page.locator('.rs-press', { hasText: /Releases/ })).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('typing effects: fire at the caret, Nib offers a quick-add tip, off means off', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('tfx')) { sessionStorage.setItem('tfx', 1); localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'fire', helper: true })); } });
  const errs = await open(page);
  await page.evaluate(() => window.T.clients.add('Initech'));
  await page.click('#qa'); await page.keyboard.type('Email Initech the quote', { delay: 20 });
  await expect(page.locator('#tfx-cv')).toHaveCount(1);
  await expect(page.locator('#tfx-nib.on')).toContainText('@initech');
  await page.click('#tfx-nib [data-nb=ok]');
  await expect(page.locator('#tfx-nib.on')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'off', helper: false })));
  await page.reload(); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.click('#qa'); await page.keyboard.type('hello there', { delay: 10 });
  await expect(page.locator('#tfx-cv')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('sheep: they land on things, baa when clicked, and go back in the pen', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('shp')) { sessionStorage.setItem('shp', 1); localStorage.setItem('cadence.sheep', '{"count":2}'); } });
  const errs = await open(page);
  await expect(page.locator('.shp')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__sheep.flock().every(s => s.on || s.state === 'hop')), { timeout: 8000 }).toBe(true);
  await page.locator('.shp').first().click({ force: true });
  await expect(page.locator('.shp-b.on').first()).not.toBeEmpty();
  await page.evaluate(() => { localStorage.setItem('cadence.sheep', '{"count":0}'); });
  await page.reload(); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await expect(page.locator('.shp')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('orbit: clients orbit the sun, the day clock shows timed work, right-click opens the radial menu', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => { const d = window.T.util.todayKey(); for (const n of ['Orbco', 'Planetix', 'Moonly']) { const c = window.T.clients.add(n); window.T.tasks.add({ title: n + ' thing', clientId: c.id, dueDate: d, dueTime: '23:50' }); window.T.tasks.add({ title: 'they send', clientId: c.id, owner: 'client' }); } location.hash = 'view-orbit'; });
  const ours = page.locator('.ob-pl', { hasText: /Orbco|Planetix|Moonly/ });
  await expect(ours).toHaveCount(3);
  await expect(ours.locator('.ob-moon')).toHaveCount(3);
  expect(await page.locator('.ob-clock .tk').count()).toBeGreaterThanOrEqual(3);
  await ours.first().click({ force: true });
  await expect(page).toHaveURL(/#client-/);
  await page.mouse.click(900, 700, { button: 'right' });
  await expect(page.locator('#ob-wheel.on .ob-it')).toHaveCount(8);
  await page.locator('#ob-wheel .ob-it', { hasText: 'Upcoming' }).click();
  await expect(page).toHaveURL(/#upcoming/);
  await expect(page.locator('#ob-wheel')).toHaveCount(0);
  expect(errs).toEqual([]);
});
