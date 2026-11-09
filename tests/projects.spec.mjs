// Internal projects (Work): their own sidebar section and page, convertible from a client, kept out of client-only plugins.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 10400 + Math.floor(Math.random() * 200), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-proj-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('a client becomes an internal project with progress, a target date and its own sidebar section', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  const id = await page.evaluate(() => { const c = window.T.clients.add('Catalyst Connect'); window.T.clients.add('Acme');
    const a = window.T.tasks.add({ title: 'Write the onboarding checklist', clientId: c.id, dueDate: window.T.util.todayKey() });
    window.T.tasks.add({ title: 'Pick a logo', clientId: c.id }); window.T.tasks.add({ title: 'Legal review', clientId: c.id, owner: 'client' });
    window.T.tasks.add({ title: 'Draft the pricing page', clientId: c.id }); window.T.tasks.complete(a.id); return c.id; });
  await page.evaluate(id => location.hash = 'client-' + id, id);
  await page.click('[data-act=client-menu]').catch(() => {});
  // edit client → Make it a project
  await page.evaluate(id => { const b = document.createElement('button'); b.dataset.act = 'edit-client'; b.dataset.cid = id; document.body.appendChild(b); b.click(); b.remove(); }, id);
  await page.click('[data-act=make-project]');
  await expect(page.locator('#modal')).toContainText('Edit project');
  await page.fill('#pj-target', '2030-01-15');
  await page.click('#pj-save');
  // its page: progress and target, no meetings
  await expect(page.locator('.c-hero.proj')).toBeVisible();
  await expect(page.locator('.pj-pct')).toContainText('25%');
  await expect(page.locator('.pj-tgt')).toContainText('left');
  expect(await page.locator('.pj-bar').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(200);
  await expect(page.locator('#view')).toContainText('Waiting on others');
  await expect(page.locator('#view')).toContainText('Recently done');
  await expect(page.locator('#view [data-act=meeting]')).toHaveCount(0);
  // sidebar: under Projects, not Clients
  const sect = await page.evaluate(() => [...document.querySelectorAll('#side-main .sect')].map(s => s.textContent.trim()));
  expect(sect.some(s => s.startsWith('Projects'))).toBe(true);
  const projNav = page.locator('#side-main .sect:has-text("Projects") + .nav');
  await expect(projNav).toContainText('Catalyst Connect');
  await expect(page.locator('#side-main .sect:has-text("Clients") + .nav')).not.toContainText('Catalyst Connect');
  // a brand-new project from the sidebar
  await page.click('[data-act=add-project] >> nth=0');
  await page.fill('#pj-name', 'Website refresh');
  await page.click('#pj-save');
  await expect(page.locator('.c-hero.proj h1')).toContainText('Website refresh');
  await expect(projNav).toContainText('Website refresh');
  // finishing moves it to the collapsed Finished list
  await page.click('[data-act=edit-project]'); await page.click('#pj-status [data-v=done]'); await page.click('#pj-save');
  await expect(projNav.locator('.more')).toContainText('Finished');
  expect(errs).toEqual([]);
});

test('a long task title wraps in the editor instead of running off the card', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook2', name: 'test', setup(api) { window.T = api; } }));
  await page.evaluate(() => { window.T.tasks.add({ title: 'Follow up about the blueprint migration because the transition rules need rebuilding before quarter end and the sales team waits on the layout rules too', dueDate: window.T.util.todayKey() }); window.T.ui.refresh(); });
  await page.click('.task .t-title >> nth=0');
  const box = await page.locator('.task.open .te-title').evaluate(el => ({ h: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth }));
  expect(box.h).toBeGreaterThan(30);   // more than one line
  expect(box.sw).toBeLessThanOrEqual(box.cw + 1);
});

test('a new build on the NAS offers a reload', async ({ page }) => {
  let ver = 'old';
  await page.route('**/api/health', async r => { const res = await r.fetch(); const j = await res.json(); j.build = ver; await r.fulfill({ json: j }); });
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.waitForTimeout(3000);   // first check records the build
  ver = 'new';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#upd-bar')).toBeVisible();
  await expect(page.locator('#upd-bar')).toContainText('updated');
});

test('meeting review tidies action items and uses the date picker', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook3', name: 'test', setup(api) { window.T = api; } }));
  await page.evaluate(() => { const c = window.T.clients.add('Tidyco'); location.hash = 'client-' + c.id; });
  await page.click('#view [data-act=meeting]');
  for (const line of ['- [ ] Sarah will send the SOW by friday (12:41)', 'Action item: I\'ll update the blueprint.', '• update the blueprint']) { await page.fill('#m-in', line); await page.press('#m-in', 'Enter'); }
  await page.click('[data-act=m-review]');
  const titles = await page.locator('.rv-item [data-rv=title]').evaluateAll(els => els.map(e => e.value));
  expect(titles).toContain('Send the SOW');
  expect(titles).toContain('Update the blueprint');
  expect(titles.filter(t => t === 'Update the blueprint')).toHaveLength(1);   // duplicate removed
  await expect(page.locator('.rv-item', { hasText: 'Sarah' })).toBeVisible();
  await expect(page.locator('.rv-item:has([value="Send the SOW"]) .rv-due')).toHaveClass(/on/);
  // the nicer date picker
  await page.click('.rv-item:has([value="Update the blueprint"]) .rv-due');
  await expect(page.locator('.dp, .dp-pop, [class*=dp]').first()).toBeVisible();
  expect(errs).toEqual([]);
});

test('Christmas mode: lights, snow that settles on the page, and the shovel', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => window.__xmas.settings());
  await page.check('#xm-on'); await page.click('#xm-chaos [data-v="3"]'); await page.click('#xm-save');
  await expect(page.locator('#xm-string i').first()).toBeVisible();
  await expect(page.locator('#xm-snow')).toBeAttached();
  await page.waitForTimeout(4000);
  // turning it off removes everything
  await page.evaluate(() => window.__xmas.settings()); await page.uncheck('#xm-on'); await page.click('#xm-save');
  await expect(page.locator('#xm-snow')).toHaveCount(0);
  await expect(page.locator('#xm-string')).toHaveCount(0);
  await page.waitForTimeout(1200);   // let the "off" reach the NAS before the next test
  expect(errs).toEqual([]);
});

test('snow and lights switch on independently, any day', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  // start from off (an earlier test may still have been saving its state)
  await page.evaluate(() => window.__xmas.settings()); await page.uncheck('#xm-on'); await page.click('#xm-save');
  await page.evaluate(() => window.__xmas.flip('lights'));
  await expect(page.locator('#xm-string')).toBeAttached(); await expect(page.locator('#xm-snow')).toHaveCount(0);
  await page.evaluate(() => window.__xmas.flip('snow'));
  await expect(page.locator('#xm-snow')).toBeAttached();
  // a click on a card knocks snow and throws no errors
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.waitForTimeout(1500); await page.mouse.click(600, 200); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__xmas.flip('lights'); window.__xmas.flip('snow'); });
  await expect(page.locator('#xm-snow')).toHaveCount(0); await expect(page.locator('#xm-string')).toHaveCount(0);
  expect(errs).toEqual([]);
});
