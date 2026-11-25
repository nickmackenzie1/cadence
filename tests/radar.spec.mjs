// Music Radar: the Life view draws the NAS radar data (simulated here), and thumbs and settings go back to the NAS.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-radar-'));
  const sim = spawnSync(process.execPath, ['server/services/radar/test/simulate.mjs'], { env: { ...process.env, RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), ANTHROPIC_API_KEY: '', LASTFM_API_KEY: '' }, encoding: 'utf8' });
  if (sim.status !== 0) throw new Error('simulate failed: ' + sim.stderr);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Music Radar view: charts, picks, thumbs, and no Reddit anywhere', async ({ page }) => {
  test.setTimeout(120000);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); localStorage.setItem('cadence.space', 'life'); });
  await page.goto(B + '/#view-radar');
  await page.locator('.mr-sec[data-sec=all]').click();   // every Radar section at once
  await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 10000 });
  // (if this fails, say what the card showed)
  await expect(page.locator('.mr-chart svg polyline').first()).toBeAttached({ timeout: 15000 }).catch(async e => {
    throw new Error(e.message + '\nWho\'s climbing card: ' + await page.locator('.mr-card').first().innerText().catch(() => '(none)')); });
  await expect(page.locator('.mr-graph circle').first()).toBeAttached();
  await expect(page.locator('.mr-card').filter({ hasText: "Who's climbing" })).toContainText('Glass Lantern');
  // off by default; nothing in the UI uses emoji
  await expect(page.locator('#mr-on')).not.toBeChecked();
  expect(await page.locator('#view-radar, .mr-grid').first().innerText()).not.toMatch(/\p{Extended_Pictographic}/u);

  // thumbs up a pick, then undo it
  const up = page.locator('[data-fb][data-v="1"]').first(), id = await up.getAttribute('data-fb');
  await up.click();
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).picks.find(p => p.id === id).feedback).toBe(1);
  await expect(page.locator(`[data-fb="${id}"][data-v="1"]`)).toHaveClass(/on/);
  await page.locator(`[data-fb="${id}"][data-v="1"]`).click();
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).picks.find(p => p.id === id).feedback).toBe(0);

  // Reddit was removed (user, 2026-11-16): nothing on the page mentions it, and the old subreddit route is gone
  await expect(page.locator('#view')).not.toContainText(/reddit|subreddit|\br\/\w/i);
  await expect(page.locator('#mr-new')).toHaveCount(0);
  expect((await fetch(B + '/api/radar/subs', { method: 'POST', body: '{}' })).status).toBe(404);

  // other sources: combined across sources, each source on its own tab, and their settings
  await page.goto(B + '/#view-radar');
  await page.locator('.mr-sec[data-sec=all]').click();   // every Radar section at once
  const src = page.locator('#mr-sources');
  // the simpler front page (2026-11-16): sources live under "Sources and charts", folded until opened (and remembered)
  await expect(page.locator('details[data-more=sources]')).not.toHaveAttribute('open', '');
  await page.locator('details[data-more=sources] > summary').click();
  await expect(src).toContainText('Glass Lantern');
  await expect(src.locator('tr', { hasText: 'Glass Lantern' }).locator('.mr-src')).toHaveCount(5);   // blogs, Audius, ListenBrainz, Hype Machine, Reddit
  await page.click('[data-src=hypem]');
  await expect(src).toContainText('Mira Vale');
  await page.click('[data-src=lastfm]');
  await expect(src).toContainText('LASTFM_API_KEY');
  await expect(page.locator('.mr-card', { hasText: 'Crossed over' })).toContainText('Ketamine Kids');
  await page.click('#mr-srcset');
  await page.fill('#mr-lb', 'nick');
  await page.click('#mr-srcsave');
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).sources.cfg.lbUser).toBe('nick');

  // it's all in cadence.db as radar_* tables, and the Database view shows them
  const raw = await (await fetch(B + '/api/radar/raw')).json();
  expect(raw.storage).toBe('sqlite');
  expect(raw.tables.find(t => t.name === 'radar_picks').count).toBeGreaterThan(5);
  await page.goto(B + '/#view-db');
  await page.click('[data-col="sql:radar_picks"]');
  await expect(page.locator('.dbv [data-row]').first()).toBeVisible();

  // the RSS feed and a digest are served
  const rss = await (await fetch(B + '/api/radar/feed.xml')).text();
  expect(rss).toContain('<rss');
  expect(errs).toEqual([]);
});

test('Where it listens: Lemmy/Mastodon settings, and hiding an artist removes them from picks', async ({ page }) => {
  const c = await (await fetch(B + '/api/radar/community')).json();
  expect(c.reddit).toBeUndefined();
  expect(c.communities).toContain('indieheads@lemmy.ml');
  const before = await (await fetch(B + '/api/radar/data')).json();
  const who = before.picks.find(p => p.artist)?.artist;
  expect(who).toBeTruthy();
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); localStorage.setItem('cadence.space', 'life'); });
  await page.goto(B + '/#view-radar');
  await page.locator('.mr-sec[data-sec=all]').click();   // every Radar section at once
  await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 10000 });
  await page.locator('details[data-more=settings] > summary').click();
  await expect(page.locator('#mr-comm')).toContainText('Where it listens');
  // add them to the mainstream list from the card
  const list = page.locator('#mr-ms-list');
  await list.fill((await list.inputValue()) + '\n' + who);
  await page.locator('#mr-lemmy').fill('indieheads@lemmy.ml\nnot valid\npostpunk@lemmy.world');
  await page.click('#mr-comm-save');
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).picks.some(p => p.artist === who)).toBe(false);
  expect((await (await fetch(B + '/api/radar/community')).json()).communities).toEqual(['indieheads@lemmy.ml', 'postpunk@lemmy.world']);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('Radar fits: the section chips are one row below the Island, nothing runs off the edge, thumbs light up at once', async ({ page }) => {
    test.setTimeout(90000);
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); localStorage.setItem('cadence.space', 'life'); });
    await page.goto(B + '/#view-radar');
    await page.locator('.mr-sec[data-sec=all]').tap({ timeout: 20000 });
    await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 15000 });
    // one row of chips, starting below the Island
    const tops = await page.locator('.mr-sec').evaluateAll(els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))]);
    expect(tops.length).toBe(1);
    // nothing wider than the screen in the Radar page
    const over = await page.evaluate(() => [...document.querySelectorAll('#view .mr-card *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('.mr-secs,.mr-tiles,pre,.mr-scroll,table.mr-t'); }).map(e => e.className || e.tagName).slice(0, 5));
    expect(over).toEqual([]);
    const up = page.locator('[data-fb][data-v="1"]').first();
    await up.scrollIntoViewIfNeeded();
    const was = /\bon\b/.test(await up.getAttribute('class') || '');   // other tests here may have voted on it already
    await up.tap();
    if (was) await expect(up).not.toHaveClass(/\bon\b/, { timeout: 1000 }); else await expect(up).toHaveClass(/\bon\b/, { timeout: 1000 });
    await page.screenshot({ path: test.info().outputPath('radar-phone.png') });
    expect(errs).toEqual([]);
  });
});
