// Platform checks: settings that follow you between devices, and a sweep of every plugin's settings and every view.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 10500 + Math.floor(Math.random() * 200), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-plat-'));
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
      const r = await page.evaluate(() => { const m = document.querySelector('.modal-bg:not([hidden]) .modal'); if (!m) return null;
        return { big: [...m.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > innerHeight * .95 && !/modal/.test(e.className)).map(e => e.tagName + '#' + e.id), text: m.innerText.trim().length }; });
      const d = await dups();
      if (r && (r.big.length || r.text < 20)) problems.push(`${space} ${id} settings: ${JSON.stringify(r)}`);
      if (d.length) problems.push(`${space} ${id} settings: duplicate ids ${d.join(',')}`);
      await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('.mk-ov,#rw-ov,#kiosk')?.remove());
    }
    const views = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#view-"]')].map(a => a.getAttribute('href').slice(1)))]);
    expect(views.length).toBeGreaterThan(5);
    for (const v of views) { await page.evaluate(v => location.hash = v, v); await page.waitForTimeout(150);
      const d = await dups(), len = await page.evaluate(() => document.getElementById('view').innerText.trim().length);
      if (d.length) problems.push(`${space} ${v}: duplicate ids ${d.join(',')}`); if (len < 15) problems.push(`${space} ${v}: empty view`); }
  }
  expect(problems).toEqual([]);
  expect(errs).toEqual([]);
});
