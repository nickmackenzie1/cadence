// Team (hand work to devs) and Desk tickets.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 10600 + Math.floor(Math.random() * 200), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-td-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

async function open(page) {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return errs;
}
const quick = async (page, text) => { await page.fill('#qa', text); await page.press('#qa', 'Enter'); };

test('hand tasks to developers: >name, the owner chip, the Team page', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => window.T.clients.add('Acme'));
  await page.evaluate(() => location.hash = 'team');
  await expect(page.locator('#view')).toContainText('Add your team');
  await page.click('#view [data-act=manage-team] >> nth=0');
  await page.fill('#tm-new', 'Sam Patel'); await page.fill('#tm-role', 'Deluge dev'); await page.press('#tm-new', 'Enter');
  await expect(page.locator('#modal .tm-row')).toHaveCount(1);
  await page.click('#modal [data-act=close-modal]');
  // >sam matches the teammate by first name; >riley adds a new one
  await page.evaluate(() => location.hash = 'today');
  await quick(page, 'Fix the blueprint transition @acme >sam');
  await quick(page, 'Build the Books sync >riley tomorrow');
  await quick(page, 'Send SOW @acme ^sam');   // ^ matching a teammate goes to the team too
  const ts = await page.evaluate(() => window.T.tasks.list().map(t => ({ title: t.title, owner: t.owner, a: t.assignee, at: !!t.assignedAt })));
  expect(ts.find(t => t.title.startsWith('Fix')).a).toBe('Sam Patel');
  expect(ts.find(t => t.title.startsWith('Build')).a).toBe('Riley');
  expect(ts.every(t => t.owner === 'team' && t.at)).toBe(true);
  expect(await page.evaluate(() => window.T.team.list().map(p => p.name))).toEqual(['Sam Patel', 'Riley']);
  // they leave my Today, and show on the Team page
  await expect(page.locator('#side-main a[href="#team"] .n')).toHaveText('3');
  await page.evaluate(() => location.hash = 'team');
  await expect(page.locator('.tm-card')).toHaveCount(2);
  await expect(page.locator('.tm-card', { hasText: 'Sam Patel' })).toContainText('2 open');
  await page.click('.tm-card:has-text("Riley")');
  await expect(page.locator('#view .task')).toHaveCount(1);
  // hand one back to me from the owner chip
  await page.click('#view .task .t-title');
  await page.click('.task.open [data-te=owner]');
  await page.click('.pop-i[data-o=me]');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title.startsWith('Build'))[0].owner)).toBe('me');
  // and to Sam from the popover
  await page.evaluate(() => location.hash = 'upcoming');
  await page.click('#view .task .t-title >> text=Build the Books sync');
  await page.click('.task.open [data-te=owner]');
  await page.click('.pop-i[data-p="Sam Patel"]');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title.startsWith('Build'))[0].assignee)).toBe('Sam Patel');
  // client page shows "With the team"
  await page.evaluate(() => location.hash = 'client-' + window.T.clients.list()[0].id);
  await expect(page.locator('.group-h.team')).toContainText('With the team');
  expect(errs).toEqual([]);
});

test('Desk tickets: quick add, chips, board, SLA, closing with the task', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => window.T.clients.add('Acme'));
  await page.fill('#qa', 'Sync error on Deals @acme tkt 4821 ');
  await expect(page.locator('#qa-chips')).toContainText('#4821');
  await page.press('#qa', 'Enter');
  await quick(page, 'Portal login loop @acme https://desk.zoho.com/agent/acme/acme/tickets/details/123456789012345 !1');
  const ks = await page.evaluate(() => window.T.tasks.list(t => t.ticket).map(t => ({ title: t.title, k: t.ticket, tags: t.tags })));
  expect(ks).toHaveLength(2);
  expect(ks[0].title).toBe('Sync error on Deals'); expect(ks[0].k.no).toBe('4821'); expect(ks[0].tags).toContain('desk');
  expect(ks[1].k.url).toContain('desk.zoho.com'); expect(ks[1].title).toBe('Portal login loop');
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
  await page.click('.pop-i:has-text("Desk ticket")');
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
