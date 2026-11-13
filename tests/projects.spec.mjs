// Internal projects (Work): their own sidebar section and page, convertible from a client, kept out of client-only plugins.
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
  // sidebar: it's in Recent (just opened), and in the All clients & projects picker, marked as a project
  await expect(page.locator('#side-main .nav a[data-cid]', { hasText: 'Catalyst Connect' })).toBeVisible();
  await page.click('[data-act=all-clients]');
  await expect(page.locator('#pop .pop-i', { hasText: 'Catalyst Connect' })).toContainText('project');
  await page.keyboard.press('Escape');
  // a brand-new project from the palette
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'add-project'; document.body.appendChild(b); b.click(); b.remove(); });
  await page.fill('#pj-name', 'Website refresh');
  await page.click('#pj-save');
  await expect(page.locator('.c-hero.proj h1')).toContainText('Website refresh');
  await expect(page.locator('#side-main .nav a[data-cid]', { hasText: 'Website refresh' })).toBeVisible();
  // finishing it takes it out of Recent
  await page.click('[data-act=edit-project]'); await page.click('#pj-status [data-v=done]'); await page.click('#pj-save');
  await expect(page.locator('#side-main .nav a[data-cid]', { hasText: 'Website refresh' })).toHaveCount(0);
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

test('a new build on the NAS offers a reload while something is half-typed', async ({ page }) => {
  let ver = 'old';
  await page.route('**/api/health', async r => { const res = await r.fetch(); const j = await res.json(); j.build = ver; await r.fulfill({ json: j }); });
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.waitForTimeout(3000);   // first check records the build
  ver = 'new';
  // with something half-typed it asks instead of reloading (with nothing typed it reloads: platform.spec)
  await page.evaluate(() => { const i = document.createElement('textarea'); i.value = 'typing…'; document.body.appendChild(i); i.focus(); document.dispatchEvent(new Event('visibilitychange')); });
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
  await page.check('#xm-on'); await page.click('#xm-look [data-v="classic"]'); await page.click('#xm-chaos [data-v="3"]'); await page.click('#xm-save');
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
  await page.evaluate(() => window.__xmas.reset({ look: 'classic' }));
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

test('snow drifts stay on a page after you leave and come back, until shovelled', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => window.__xmas.reset({ chaos: 3, tune: null, build: true, look: 'classic' }));
  await page.evaluate(() => window.__xmas.flip('snow'));
  await page.mouse.move(2, 2);
  await page.waitForTimeout(6000);
  const stored = () => page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); const s = JSON.parse(localStorage.getItem('cadence.snow') || '{}'); return Object.keys(s); });
  const before = await stored();
  expect(before.some(k => k.startsWith('today|'))).toBe(true);
  await page.evaluate(() => location.hash = 'inbox'); await page.waitForTimeout(800);
  await page.evaluate(() => location.hash = 'today'); await page.waitForTimeout(800);
  expect((await stored()).some(k => k.startsWith('today|'))).toBe(true);
  // shovelling saves straight away (snow keeps falling afterwards, so read what the shovel wrote)
  expect(await page.evaluate(() => { window.__xmas.shovelPage(); return Object.keys(JSON.parse(localStorage.getItem('cadence.snow') || '{}')).some(k => k.startsWith('today|')); })).toBe(false);
  // stopping the snow clears every drift
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__xmas.flip('snow'));
  expect((await stored()).length).toBe(0);
  await page.waitForTimeout(1200);
});

test('switching Work and Life with snow on keeps a single snow engine', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => { window.__xmas.reset({ chaos: 1, tune: null, look: 'classic' }); window.__xmas.flip('snow'); });
  for (let i = 0; i < 6; i++) { await page.click(`.space-sw [data-s=${i % 2 ? 'work' : 'life'}]`); await page.waitForTimeout(400); }
  await expect(page.locator('#xm-snow')).toHaveCount(1);
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(n / 1.5); }; requestAnimationFrame(f); }));
  expect(fps).toBeGreaterThan(30);
  await page.evaluate(() => window.__xmas.flip('snow'));
  await page.waitForTimeout(1200);
  expect(errs).toEqual([]);
});

test('Elements look: Christmas snow and lights, typing fire and the sand jar share one matter layer', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', 'x'); if (!sessionStorage.getItem('fx1')) { sessionStorage.setItem('fx1', 1); localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'fire', matter: true, helper: false })); localStorage.removeItem('cadence.sandjar'); } });
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => window.__xmas.reset({ look: 'elements', chaos: 1, tune: null }));
  await page.evaluate(() => { window.__xmas.flip('lights'); window.__xmas.flip('snow'); });
  await expect(page.locator('#elements-ambient')).toHaveCount(1);
  await expect(page.locator('#xm-snow')).toHaveCount(0);                       // no classic snow canvas
  await expect.poll(() => page.evaluate(async () => { const c = window.__fx ? await window.__fx.counts() : {}; return (c[16] || 0) + (c[17] || 0); }), { timeout: 10000 }).toBeGreaterThan(50);   // wire and bulbs
  // typing fire puts real fire in the layer
  await page.click('#qa'); await page.keyboard.type('fire', { delay: 30 });
  await expect.poll(() => page.evaluate(async () => { const c = await window.__fx.counts(); return (c[4] || 0) + (c[10] || 0) + (c[12] || 0); }), { timeout: 15000 }).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  // finishing a task pours sand into the jar
  await page.evaluate(() => { localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'off' })); });
  const id = await page.evaluate(async () => { const r = await new Promise(res => Cadence.registerPlugin({ id: 'fx-hook', name: 't', setup(api) { res(api); } })); const t = r.tasks.add({ title: 'Sand me', dueDate: r.util.todayKey() }); r.ui.refresh(); return t.id; });
  await page.click(`#view .task[data-id="${id}"] .check`);
  await expect.poll(() => page.evaluate(() => window.__fx.count(window.__sandjar.rect(), window.__fx.M.SAND)), { timeout: 20000 }).toBeGreaterThan(10);
  expect(await page.evaluate(() => window.__sandjar.read().n)).toBe(1);
  // turning Christmas off takes the lights down
  await page.evaluate(() => { window.__xmas.flip('lights'); window.__xmas.flip('snow'); });
  await expect.poll(() => page.evaluate(async () => { const c = await window.__fx.counts(); return (c[16] || 0) + (c[17] || 0); }), { timeout: 15000 }).toBe(0);
  expect(errs).toEqual([]);
});
