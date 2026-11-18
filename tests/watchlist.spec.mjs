// Watch list (2026-11-18): "watch Dune" / "play Hades" in quick add (Life), the Watch list page, the shelf.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDKgCwAAJ6kD/ap+YmUAAAAASUVORK5CYII=', 'base64');
let fake, F, B, server, dir, asked = [];
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); asked.push(u.pathname + u.search);
    const json = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const q = (u.searchParams.get('query') || u.searchParams.get('name') || '').toLowerCase();
    if (u.pathname === '/3/search/multi') return json({ results: q === 'dune' ? [
      { id: 438631, media_type: 'movie', title: 'Dune', release_date: '2021-09-15', poster_path: '/dune2021.jpg', overview: 'Paul Atreides…' },
      { id: 841, media_type: 'movie', title: 'Dune', release_date: '1984-12-14', poster_path: '/dune1984.jpg' },
      { id: 99, media_type: 'person', name: 'Someone Dune' }] : q === 'severance' ? [{ id: 95396, media_type: 'tv', name: 'Severance', first_air_date: '2022-02-17', poster_path: '/sev00001.jpg' }] : [] });
    if (u.pathname === '/3/movie/438631') return json({ id: 438631, title: 'Dune', release_date: '2021-09-15', runtime: 155, genres: [{ name: 'Science Fiction' }], poster_path: '/dune2021.jpg', credits: { crew: [{ job: 'Director', name: 'Denis Villeneuve' }], cast: [{ name: 'Timothée Chalamet' }] } });
    if (u.pathname === '/3/movie/841') return json({ id: 841, title: 'Dune', release_date: '1984-12-14', runtime: 137, genres: [], poster_path: '/dune1984.jpg', credits: { crew: [{ job: 'Director', name: 'David Lynch' }], cast: [] } });
    if (u.pathname === '/3/tv/95396') return json({ id: 95396, name: 'Severance', first_air_date: '2022-02-17', episode_run_time: [50], number_of_seasons: 2, genres: [{ name: 'Drama' }], created_by: [{ name: 'Dan Erickson' }], poster_path: '/sev00001.jpg', credits: { cast: [] } });
    if (u.pathname.startsWith('/t/p/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/v1/Games/ByGameName') return json({ data: { games: q === 'hades' ? [{ id: 2, game_title: 'Hades II', release_date: '2024-05-06', platform: 1 }, { id: 1, game_title: 'Hades', release_date: '2020-09-17', platform: 1 }] : [] },
      include: { boxart: { base_url: {}, data: { 1: [{ side: 'front', filename: 'boxart/front/1-1.jpg' }] } }, platform: { data: { 1: { id: 1, name: 'PC' } } } } });
    if (u.pathname.startsWith('/images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); F = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-wq-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), TMDB_API_KEY: 'k123', TMDB_API: F, TMDB_IMG: F, THEGAMESDB_API_KEY: 'g456', GAMESDB_API: F, GAMESDB_CDN: F }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('the NAS finds films, shows and games, with posters through the NAS', async () => {
  const f = await (await fetch(B + '/api/tmdb/find?q=Dune')).json();
  expect(f.results.map(x => x.year)).toEqual(['2021', '1984']); // people left out
  expect(f.results[0]).toMatchObject({ type: 'movie', title: 'Dune', poster: 'api/tmdb/img/w342/dune2021.jpg' });
  const t = await (await fetch(B + '/api/tmdb/title?type=movie&id=438631')).json();
  expect(t).toMatchObject({ runtime: 155, by: ['Denis Villeneuve'], genres: ['Science Fiction'] });
  expect((await fetch(B + '/' + f.results[0].poster)).headers.get('content-type')).toBe('image/png');
  const g = await (await fetch(B + '/api/gdb/find?q=Hades')).json();
  expect(g.results[0]).toMatchObject({ title: 'Hades', year: '2020', platform: 'PC', poster: 'api/gdb/img/medium/boxart/front/1-1.jpg' });
  // asked once: the second time is from the NAS's copy
  const n = asked.length; await fetch(B + '/api/tmdb/find?q=Dune'); expect(asked.length).toBe(n);
});

test('"watch Dune" in Life quick add: poster, year, runtime, the Watch list area, other matches, the shelf', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today');
  await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  await page.click('[data-act=space][data-s=life]');
  await expect(page.locator('[data-act=space][data-s=life].on')).toBeVisible();
  await page.fill('#qa', 'watch dune'); await page.press('#qa', 'Enter');
  // out of Today (no date), into the Watch list area
  await page.locator('#side .nav a', { hasText: 'Watch list' }).click({ timeout: 8000 });
  const row = page.locator('#view .task', { hasText: 'Dune' }).first();
  await expect(row.locator('.wq-chip')).toContainText('Film · 2021 · 2h 35m', { timeout: 8000 });
  const t = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cadence.life.v1')); const t = s.tasks.find(x => x.media); return { t, area: s.clients.find(c => c.id === t.clientId) }; });
  expect(t.t.title).toBe('Dune'); expect(t.t.dueDate).toBeFalsy(); // not due today just because it was typed on Today expect(t.area.name).toBe('Watch list'); expect(t.t.media.alts.map(a => a.year)).toEqual(['1984']);
  // the other Dune, from the task's card
  await page.locator('#view .task', { hasText: 'Dune' }).first().locator('.t-title').click();
  await page.click('.wq-alt');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cadence.life.v1')).tasks.find(x => x.media).media.by)).toEqual(['David Lynch']);
  await page.keyboard.press('Escape');
  // the page: add a show and a game from its search box
  await page.goto(B + '/#view-watch');
  await page.fill('#wq-q', 'Severance');
  await page.locator('[data-wq-add]').first().click();
  await page.click('[data-wq-kind=game]');
  await page.fill('#wq-q', 'Hades');
  await expect(page.locator('[data-wq-add]')).toHaveCount(2);
  await page.press('#wq-q', 'Enter'); // the exact name, not Hades II
  await expect(page.locator('.wq-it')).toHaveCount(3);
  await expect(page.locator('.wq-it', { hasText: 'Severance' })).toContainText('2022 · 2 seasons');
  await expect(page.locator('.wq-it', { hasText: 'Hades' })).toContainText('2020 · PC');
  await expect(page.locator('.wq-it img')).toHaveCount(3);
  // watched: onto the shelf
  await page.locator('.wq-it', { hasText: 'Severance' }).locator('[data-wq-done]').click();
  await expect(page.locator('.wq-it')).toHaveCount(2);
  await page.click('[data-wq-tab=shelf]');
  await expect(page.locator('.wq-it')).toHaveCount(1);
  await expect(page.locator('.wq-it')).toContainText(/Watched \w+ \d+/);
  expect(errs).toEqual([]);
});

test('"play tennis" that isn\'t a game: one tap keeps it an ordinary task, as you wrote it', async ({ page }) => {
  await page.goto(B + '/#today');
  await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  await page.click('[data-act=space][data-s=life]');
  await page.fill('#qa', 'play tennis'); await page.press('#qa', 'Enter');
  await page.getByRole('button', { name: 'Not for the list' }).click();
  await expect.poll(() => page.evaluate(() => { const t = JSON.parse(localStorage.getItem('cadence.life.v1')).tasks.find(x => /^play tennis$/i.test(x.title)); return t && [t.media, t.clientId]; })).toEqual([null, null]);
});
