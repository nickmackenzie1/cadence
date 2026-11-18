// KEXP's two-week archive (2026-11-17): a moment → the show's file and where in it; shows you keep are saved after they
// air (newest few per program), listed with their playlist, served with seeking, and tidied when you stop keeping them.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const now = Math.floor(Date.now() / 1000), H = 3600, D = 86400;
// shows: Positive Vibrations 3 days ago and 10 days ago (and 20 days ago: past the archive), the shows after them
const SHOWS = [[1, 'Positive Vibrations', now - 3 * D], [2, 'The Afternoon Show', now - 3 * D + 3 * H], [3, 'Positive Vibrations', now - 10 * D], [4, 'Expansions', now - 10 * D + 3 * H],
  [5, 'Positive Vibrations', now - 20 * D], [6, 'Expansions', now - 20 * D + 3 * H], [7, 'The Morning Show', now - H]];
const MP3 = Buffer.alloc(64 * 1024, 7);
let fake, FAKE, PORT, B, server, dir;
const asked = [];
test.beforeAll(async () => {
  // a fake KEXP: get_streaming_url answers for moments inside a known show, files allow ranges
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/get_streaming_url/') {
      const t = Date.parse(u.searchParams.get('timestamp')) / 1000; asked.push(u.searchParams.get('timestamp'));
      const sh = SHOWS.filter(s => s[2] <= t + 1).sort((a, b) => b[2] - a[2])[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(sh && sh[0] !== 7 ? { 'sg-url': `${FAKE}/content/kexp/${sh[0]}.mp3`, 'sg-url-next': `${FAKE}/content/kexp/${sh[0] + 1}.mp3`, 'sg-offset': 592 + Math.round(t - sh[2]) } : { 'sg-url': null, 'sg-url-next': null, 'sg-offset': null }));
    }
    if (u.pathname.startsWith('/content/kexp/')) { res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': MP3.length }); return res.end(MP3); }
    if (u.pathname.startsWith('/v2/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"results":[],"next":null}'); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); FAKE = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-arch-'));
  // KEXP history with the shows and a few plays in show 1
  const d = new DatabaseSync(join(dir, 'kexp.db'));
  d.exec(`CREATE TABLE kexp_plays (id INTEGER PRIMARY KEY, airdate INTEGER NOT NULL, artist TEXT, song TEXT, album TEXT, label TEXT, release_date TEXT, rotation TEXT, comment TEXT, live INTEGER, local INTEGER, request INTEGER, image TEXT, show_id INTEGER);
    CREATE TABLE kexp_shows (id INTEGER PRIMARY KEY, program TEXT, tags TEXT, hosts TEXT, start INTEGER, tagline TEXT, image TEXT);
    CREATE TABLE kexp_meta (k TEXT PRIMARY KEY, v TEXT);`);
  for (const [id, p, st] of SHOWS) d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(id, p, null, id === 1 ? 'Larry Rose' : null, st, null, null);
  [[11, SHOWS[0][2] + 120, 'Toots & The Maytals', 'Pressure Drop'], [12, SHOWS[0][2] + 400, 'Burning Spear', 'Marcus Garvey']].forEach(([id, t, a, s]) => d.prepare('INSERT INTO kexp_plays (id, airdate, artist, song, show_id) VALUES (?,?,?,?,?)').run(id, t, a, s, 1));
  d.close();
  PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, KEXP_LOG: '1', KEXP_API: FAKE, KEXP_ARCHIVE_TEST: FAKE, KEXP_OLD_ARCHIVE: '0',
    KEXP_KEEP_DELAY: '99999999', KEXP_LOG_DELAY: '99999999', KEXP_KEEP_MIN_GB: '0', MUSIC_PROCESS: '0', RADIO_WARM: '0', STG: '0', KINGSTONLIVE: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });
const get = p => fetch(B + p).then(r => r.json());
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());

test('a moment in the last two weeks gives the show file and the second to start at; older or too new does not', async () => {
  const at = new Date((SHOWS[0][2] + 400) * 1000).toISOString();
  const a = await get('/api/radio/kexp?view=archive&at=' + encodeURIComponent(at));
  expect(a).toMatchObject({ url: `${FAKE}/content/kexp/1.mp3`, next: `${FAKE}/content/kexp/2.mp3`, offset: 992 });
  expect(asked.at(-1)).toMatch(/Z$/);   // asked in UTC, whole seconds
  expect((await get('/api/radio/kexp?view=archive&at=' + encodeURIComponent(new Date((now - 15 * D) * 1000).toISOString()))).none).toBe(true);
  expect((await get('/api/radio/kexp?view=archive&at=' + encodeURIComponent(new Date().toISOString()))).none).toBe(true);
  expect((await get('/api/radio/kexp?view=archive&at=' + encodeURIComponent(new Date((now - 50 * 60) * 1000).toISOString()))).why).toContain("doesn't have");
});

test('keep a show: newest episodes saved after they air, playlist alongside, seeking works, tidied when you stop', async () => {
  let k = await post('/api/radio/kexp-keep', { program: 'Positive Vibrations', on: true, per: 1 });
  expect(k.programs).toEqual(['Positive Vibrations']); expect(k.per).toBe(1);
  expect(k.choices).toEqual(expect.arrayContaining(['Positive Vibrations', 'Expansions', 'The Morning Show']));
  // the job (run here directly, against the server's data folder)
  const job = spawnJob();
  expect((await job()).note).toContain('Saved Positive Vibrations');
  expect((await job())).toBeFalsy();                                // only the newest one (per = 1)
  k = await get('/api/radio/kexp-keep');
  expect(k.kept).toHaveLength(1);
  expect(k.kept[0]).toMatchObject({ id: 1, program: 'Positive Vibrations', hosts: 'Larry Rose', offset: 592, bytes: MP3.length, url: 'api/radio/kexp-kept/1.mp3' });
  expect(k.kept[0].plays).toEqual([{ sec: 712, artist: 'Toots & The Maytals', song: 'Pressure Drop', album: null }, { sec: 992, artist: 'Burning Spear', song: 'Marcus Garvey', album: null }]);
  // served with seeking
  const r = await fetch(B + '/api/radio/kexp-kept/1.mp3', { headers: { Range: 'bytes=100-199' } });
  expect(r.status).toBe(206); expect(r.headers.get('content-range')).toBe(`bytes 100-199/${MP3.length}`); expect((await r.arrayBuffer()).byteLength).toBe(100);
  // two per program: the one from 10 days ago too (20 days ago is past the archive)
  await post('/api/radio/kexp-keep', { per: 2 });
  expect((await job()).note).toContain('Saved Positive Vibrations');
  expect(await job()).toBeFalsy();
  expect((await get('/api/radio/kexp-keep')).kept.map(x => x.id)).toEqual([1, 3]);
  // stop keeping it: the files go
  await post('/api/radio/kexp-keep', { program: 'Positive Vibrations', on: false });
  expect((await get('/api/radio/kexp-keep')).kept).toEqual([]);
  expect(readdirSync(join(dir, 'kexp-shows')).filter(f => f.endsWith('.mp3'))).toEqual([]);
});

// the background step, run in a child process against the same data folder (as the server's job would)
function spawnJob() {
  return () => new Promise((ok, no) => {
    const c = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `require('./server/services/kexp-archive.js').keepStep().then(r => { console.log(JSON.stringify(r ?? null)); process.exit(0); }, e => { console.error(e.stack); process.exit(1); })`],
      { env: { ...process.env, DATA_DIR: dir, KEXP_API: FAKE, KEXP_ARCHIVE_TEST: FAKE, KEXP_KEEP_MIN_GB: '0', KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_KEEP_DELAY: '99999999', KEXP_MONTHLY_DELAY: '99999999', KEXP_LISTS_DELAY: '99999999', KEXP_ARTISTS_DELAY: '99999999', KEXP_FTS_DELAY: '99999999' } });
    let out = '', err = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    c.on('exit', code => code ? no(new Error(err)) : ok(JSON.parse(out.trim().split('\n').pop())));
  });
}

test('in the app: Listen from here starts the show at that moment; the Podcasts card keeps shows and jumps to a song', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(u => u.hostname === '127.0.0.1' && u.pathname.startsWith('/content/kexp/'), r => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 }));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  // listen from a moment: the show's file, from the second asked for, marked as the archive
  const at = new Date((SHOWS[0][2] + 400) * 1000).toISOString();
  expect(await page.evaluate(at => window.CadenceKexpArchive.play(at, { title: 'Burning Spear – Marcus Garvey', show: 'Positive Vibrations' }), at)).toBe(true);
  expect(await page.evaluate(() => ({ url: CadencePodcasts.current.url, pos: CadencePodcasts.current.position, archive: CadencePodcasts.current.archive, t: CadencePodcasts.current.podcastTitle })))
    .toEqual({ url: `${FAKE}/content/kexp/1.mp3`, pos: 992, archive: true, t: 'KEXP · Positive Vibrations' });
  // a moment the archive doesn't have: a calm note, nothing changes
  expect(await page.evaluate(() => window.CadenceKexpArchive.play(new Date(Date.now() - 50 * 60e3).toISOString()))).toBe(false);
  await expect(page.getByText("KEXP's archive doesn't have that moment").first()).toBeVisible();
  // Podcasts: the card, keep a show from the choices
  await page.evaluate(() => { location.hash = 'view-podcasts'; });
  const card = page.locator('.pc-card.kk'); await expect(card).toBeVisible();
  await expect(card).toContainText('Pick KEXP shows below');
  await card.locator('[data-kk-prog="Positive Vibrations"]').click();
  await expect(card.locator('[data-kk-prog="Positive Vibrations"]')).toHaveAttribute('aria-pressed', 'true');
  // after the job saved one (run here), the episode and its playlist; a song starts the episode right there
  await spawnJob()();
  await page.evaluate(() => { location.hash = 'today'; }); await page.evaluate(() => { location.hash = 'view-podcasts'; });
  await page.reload(); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await expect(card.locator('.kk-ep')).toHaveCount(1);
  await card.locator('details summary', { hasText: 'Playlist (2 songs)' }).click();
  await card.locator('[data-kk-seek]', { hasText: 'Burning Spear' }).click();
  await expect.poll(() => page.evaluate(() => CadencePodcasts.current && [CadencePodcasts.current.url, CadencePodcasts.current.position])).toEqual(['api/radio/kexp-kept/1.mp3', 992]);
  await post('/api/radio/kexp-keep', { program: 'Positive Vibrations', on: false });
  expect(errs).toEqual([]);
});
