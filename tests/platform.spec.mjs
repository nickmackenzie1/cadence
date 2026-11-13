// Platform checks: settings that follow you between devices, and a sweep of every plugin's settings and every view.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-plat-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterEach(async () => { if (server) { const gone = new Promise(r => server.once('exit', r)); server.kill(); await gone; } rmSync(dir, { recursive: true, force: true }); });

async function open(page) {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return errs;
}

test('settings saved in one browser follow you to another', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext();
  const pa = await a.newPage(); await open(pa);
  await pa.evaluate(() => { localStorage.setItem('cadence.weather', JSON.stringify({ place: { name: 'Toronto', lat: 43.7, lon: -79.4 }, units: 'c', today: true })); localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'fire' })); });
  await expect.poll(async () => (await (await fetch(B + '/api/prefs')).json())['cadence.typing']?.v || '').toContain('fire');
  const pb = await b.newPage(); await open(pb);
  await expect.poll(() => pb.evaluate(() => JSON.parse(localStorage.getItem('cadence.weather') || '{}').place?.name)).toBe('Toronto');
  expect(await pb.evaluate(() => document.documentElement.dataset.tfx)).toBe('fire');   // the plugin picked it up
  // and a change on b flows back to a
  await pb.evaluate(() => localStorage.setItem('cadence.typing', JSON.stringify({ mode: 'ice' })));
  await expect.poll(async () => (await (await fetch(B + '/api/prefs')).json())['cadence.typing'].v).toContain('ice');
  await pa.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => pa.evaluate(() => JSON.parse(localStorage.getItem('cadence.typing')).mode)).toBe('ice');
  await a.close(); await b.close();
});

// every enabled plugin's settings and every view, in both spaces: no errors, no duplicate element ids,
// nothing blown up to full screen (the snow-toggle bug), no empty settings dialogs
test('sweep: every plugin settings dialog and every view renders cleanly', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await open(page);
  const dups = () => page.evaluate(() => { const m = {}; document.querySelectorAll('[id]').forEach(e => m[e.id] = (m[e.id] || 0) + 1); return Object.keys(m).filter(k => m[k] > 1); });
  // effects on, so their layers are in the page too (the snow canvas once shared an id with a settings toggle)
  await page.evaluate(() => { window.__xmas.reset({ chaos: 1, build: false }); window.__xmas.flip('snow'); window.__xmas.flip('lights'); });
  const problems = [];
  for (const space of ['work', 'life']) {
    if (space === 'life') { await page.keyboard.press('Escape'); await page.click('[data-act=space][data-s=life]'); await expect(page.locator('html[data-space=life]')).toHaveCount(1); await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } })); }
    const ids = await page.evaluate(() => window.T.plugins.list().filter(x => x.enabled).map(x => x.id));
    for (const id of ids) {
      const opened = await page.evaluate(id => { const b = document.createElement('button'); b.dataset.act = 'pl-settings'; b.dataset.pid = id; document.body.appendChild(b); b.click(); b.remove(); return true; }, id);
      await page.waitForTimeout(120);
      const r = await page.evaluate(() => { const m = document.querySelector('#scrim.open') && document.querySelector('#modal'); if (!m || !m.innerHTML) return null;
        return { big: [...m.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > innerHeight * .95 && !/modal/.test(e.className)).map(e => e.tagName + '#' + e.id), text: m.innerText.trim().length }; });
      const d = await dups();
      if (r && (r.big.length || r.text < 20)) problems.push(`${space} ${id} settings: ${JSON.stringify(r)}`);
      if (d.length) problems.push(`${space} ${id} settings: duplicate ids ${d.join(',')}`);
      await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('.mk-ov,#rw-ov,#kiosk')?.remove());
    }
    await page.click('[data-act=all-views]');
    const views = await page.evaluate(() => [...new Set([...document.querySelectorAll('#modal a[href^="#view-"]')].map(a => a.getAttribute('href').slice(1)))]);
    await page.keyboard.press('Escape');
    expect(views.length).toBeGreaterThan(5);
    for (const v of views) { await page.evaluate(v => location.hash = v, v); await page.waitForTimeout(150);
      const d = await dups(), len = await page.evaluate(() => document.getElementById('view').innerText.trim().length);
      if (d.length) problems.push(`${space} ${v}: duplicate ids ${d.join(',')}`); if (len < 15) problems.push(`${space} ${v}: empty view`); }
  }
  expect(problems).toEqual([]);
  expect(errs).toEqual([]);
});

test('Cadence dialogs instead of browser popups: ask() returns values, cancel returns null', async ({ page }) => {
  const errs = await open(page);
  page.on('dialog', d => { errs.push('browser dialog: ' + d.message()); d.dismiss(); });
  const p1 = page.evaluate(() => window.T.ui.ask('Name your rival', [{ k: 'n', label: 'Name', def: 'Morgan' }]));
  await page.fill('#ask-n', 'Riley'); await page.press('#ask-n', 'Enter');
  expect(await p1).toEqual({ n: 'Riley' });
  const p2 = page.evaluate(() => window.T.ui.ask('x', [{ k: 'a', label: 'A' }]));
  await page.click('#ask-no'); expect(await p2).toBe(null);
  expect(errs).toEqual([]);
});

test('views: a few pinned in the sidebar, the rest under All views, pins stick', async ({ page }) => {
  const errs = await open(page);
  const tiles = () => page.locator('.vgrid .vt:not(.more)').count();
  const before = await tiles();
  expect(before).toBeLessThanOrEqual(8);
  await page.click('[data-act=all-views]');
  await expect(page.locator('#modal .av-g').first()).toBeVisible();
  const unpinned = page.locator('#modal .av-pin:not(.on)').first(); const id = await unpinned.getAttribute('data-av-pin');
  await unpinned.click();
  await expect(page.locator(`.vgrid a[href="#view-${id}"]`)).toHaveCount(1);
  await page.locator(`#modal a[href="#view-${id}"]`).click();
  await expect(page).toHaveURL(new RegExp('#view-' + id));
  expect(await tiles()).toBe(before + 1);
  expect(errs).toEqual([]);
});

test('accessibility: every visible icon-only button has a name', async ({ page }) => {
  await open(page);
  for (const h of ['today', 'upcoming', 'view-kanban', 'view-calendar']) {
    await page.evaluate(h => location.hash = h, h); await page.waitForTimeout(250);
    const nameless = await page.evaluate(() => [...document.querySelectorAll('button,a[href],[role=button]')].filter(el => el.offsetParent && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map(el => el.outerHTML.slice(0, 90)));
    expect(nameless, h).toEqual([]);
  }
});

test('havoc: switch between Physics and Elements from the toolbar, Esc puts the page back', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => localStorage.setItem('cadence.havoc', 'elements'));
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+H');
  await page.waitForFunction(() => window.__elements && window.__elements.active && window.__elements.stats, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__elements.stats.pieces)).toBeGreaterThan(20);   // the screen was read into pieces
  await page.evaluate(() => document.querySelector('#elements-host').shadowRoot.querySelector('[data-mode=physics]').click());
  await page.waitForFunction(() => window.__havoc && window.__havoc.active && !window.__elements.active, null, { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('cadence.havoc'))).toBe('physics');
  await page.evaluate(() => document.querySelector('#havoc-host').shadowRoot.querySelector('[data-mode=elements]').click());
  await page.waitForFunction(() => window.__elements.active && !window.__havoc.active, null, { timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#elements-host') || window.__elements.active)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  expect(errs).toEqual([]);
});

test('coming back to the tab refetches, and a new version on the NAS reloads unless something is half-typed', async ({ page }) => {
  let build = 'v1', health = 0;
  await page.route('**/api/health', async r => { health++; const res = await r.fetch(); const j = await res.json(); await r.fulfill({ json: { ...j, build } }); });
  await open(page);
  await expect.poll(() => health, { timeout: 10000 }).toBeGreaterThan(0);   // the first check learns v1
  await page.waitForTimeout(4200);                                   // let any refocus from page load pass the 4s throttle
  // something half-typed: no reload, the banner asks instead
  build = 'v2';
  await page.evaluate(() => { const i = document.createElement('textarea'); i.id = 'tmp-busy'; i.value = 'typing…'; document.body.appendChild(i); i.focus(); window.__mark = 1; dispatchEvent(new Event('focus')); });
  await expect(page.locator('#upd-bar')).toBeVisible();
  expect(await page.evaluate(() => window.__mark)).toBe(1);         // still the same page
  // nothing half-typed: focusing the window reloads straight away
  await page.evaluate(() => { document.getElementById('tmp-busy').remove(); document.activeElement && document.activeElement.blur(); });
  await page.waitForTimeout(4200);                                   // refocus is throttled to once every 4s
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  await reloaded;
  expect(await page.evaluate(() => window.__mark)).toBeUndefined();
  expect(health).toBeGreaterThan(2);
});

test('havoc physics plays out in real matter: a blast leaves fire, rain is real water', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => dispatchEvent(new CustomEvent('havoc:fx', { detail: { type: 'blast', x: 700, y: 400 } })));
  await expect.poll(() => page.evaluate(async () => { const c = window.__fx ? await window.__fx.counts() : {}; return (c[4] || 0) + (c[10] || 0) + (c[12] || 0) + (c[6] || 0); }), { timeout: 10000 }).toBeGreaterThan(0);
  await page.evaluate(() => dispatchEvent(new CustomEvent('havoc:fx', { detail: { type: 'rain', on: true } })));
  await expect.poll(() => page.evaluate(async () => { const c = await window.__fx.counts(); return c[2] || 0; })).toBeGreaterThan(0);
  await page.evaluate(() => dispatchEvent(new CustomEvent('havoc:fx', { detail: { type: 'stop' } })));
  expect(errs).toEqual([]);
});

test('havoc elements: a picture from another site is still read in (through the image proxy, or a plain fill) so it burns instead of vanishing', async ({ page }) => {
  const http = await import('node:http');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
  const other = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(png); }).listen(0);
  const port = other.address().port;
  try {
    const errs = await open(page);
    await page.evaluate(() => localStorage.setItem('cadence.havoc', 'elements'));
    const base = async () => { await page.keyboard.press('Shift+H'); await page.waitForFunction(() => window.__elements && window.__elements.active && window.__elements.stats, null, { timeout: 15000 }); const n = await page.evaluate(() => window.__elements.stats.foreign); await page.keyboard.press('Escape'); await expect.poll(() => page.evaluate(() => window.__elements.active)).toBe(false); return n; };
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const before = await base();
    await page.evaluate(src => new Promise(res => { const i = new Image(); i.onload = res; i.src = src; i.style.cssText = 'position:fixed;left:400px;top:300px;width:160px;height:160px;z-index:5'; i.id = 'xo'; document.body.appendChild(i); }), `http://127.0.0.1:${port}/a.png`);
    const after = await base();
    expect(after).toBeGreaterThan(before);              // and the picture became material either way
    expect(errs.filter(e => !/502|Bad Gateway/.test(e))).toEqual([]);   // the proxy refuses localhost on purpose
  } finally { other.close(); }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('nothing scrolls sideways, the menu slides over and closes on use, stats fit, the meeting bar wraps', async ({ page }) => {
    test.setTimeout(90000);
    const errs = await open(page);
    await page.evaluate(() => { const T = window.T, A = T.clients.add('Acme'); for (let i = 0; i < 6; i++) T.tasks.add({ title: 'A fairly long task title number ' + i, clientId: A.id, dueDate: T.util.todayKey() }); T.ui.refresh(); });
    for (const r of ['today', 'upcoming', 'inbox', 'waiting', 'dev', 'done', 'insights', 'plugins', 'view-kanban', 'view-calendar', 'view-dash', 'view-db', 'view-themes']) {
      await page.evaluate(r => { location.hash = r; }, r); await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), r).toBeLessThanOrEqual(1);
    }
    // stats two to a row
    await page.evaluate(() => { location.hash = 'dev'; }); await page.waitForTimeout(200);
    const tops = await page.locator('.stats .stat').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
    // the menu
    await expect(page.locator('.nav-btn')).toBeVisible();
    await page.tap('.nav-btn');
    await expect(page.locator('body.nav-open')).toHaveCount(1);
    await page.locator('.side a[href="#upcoming"], .side [data-r="upcoming"], .side .ntile', { hasText: 'Upcoming' }).first().tap();
    await expect(page.locator('body.nav-open')).toHaveCount(0);
    // a meeting from the menu: the menu closes, its button hides, the bar wraps inside the screen
    await page.tap('.nav-btn'); await page.locator('.side .meet-btn').tap();
    await expect(page.locator('#meeting.open')).toHaveCount(1);
    await expect(page.locator('body.nav-open')).toHaveCount(0);
    await expect(page.locator('.nav-btn')).toBeHidden();
    const head = await page.locator('#meeting .m-head').boundingBox();
    expect(head.x + head.width).toBeLessThanOrEqual(391);
    expect(errs).toEqual([]);
  });
});
