// KEXP play history kept on the NAS: new plays saved, air breaks skipped, the past filled in back to the limit,
// whether KEXP honours airdate_before or not (then it walks offset pages). Against a fake KEXP API.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

// ten days of plays, one every 4 minutes; every 10th is an air break, and some older-style ones are a "song" by AIRBREAK
const NOW = Date.now(), PLAYS = [];
for (let i = 0; i < 10 * 24 * 15; i++) {
  const t = NOW - i * 4 * 60e3, id = 10_000_000 - i;
  PLAYS.push(i % 10 === 5 ? { id, play_type: 'airbreak', airdate: new Date(t).toISOString() }
    : { id, play_type: 'trackplay', airdate: new Date(t).toISOString(), artist: i % 50 === 3 ? '(Various Artists) The English Beat' : i % 50 === 4 ? 'Various Artists' : i % 50 === 6 ? 'AIRBREAK' : 'Artist ' + (i % 37), song: 'Song ' + i, album: 'Album', labels: ['Sub Pop'], rotation_status: i % 3 ? null : 'Heavy', comment: i === 0 ? 'Playing Thursday at the Crocodile' : '', show: 100 + Math.floor(i / 45) });
}
const limits = new Set();   // page sizes the NAS asked for
function fakeKexp(honourDates) {
  return http.createServer((req, res) => {
    const sm = req.url.match(/^\/v2\/shows\/(\d+)\//);
    if (sm) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ id: +sm[1], program_name: 'Show ' + sm[1], program_tags: 'Eclectic', host_names: ['DJ ' + sm[1]], start_time: new Date().toISOString() })); }
    const u = new URL(req.url, 'http://x'), limit = +u.searchParams.get('limit') || 20, off = +u.searchParams.get('offset') || 0, before = u.searchParams.get('airdate_before');
    if (before || off) limits.add(limit);
    let list = PLAYS; if (honourDates && before) list = list.filter(p => Date.parse(p.airdate) <= Date.parse(before));   // inclusive, like the real API
    const page = list.slice(off, off + limit), more = off + limit < list.length;
    const next = more ? `http://localhost:${res.socket.localPort}/v2/plays/?format=json&limit=${limit}&ordering=-airdate&offset=${off + limit}${honourDates && before ? '&airdate_before=' + encodeURIComponent(before) : ''}` : null;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ next, results: page }));
  });
}
async function boot(honourDates) {
  const PORT = await freePort(), FAKE = await freePort(), dir = mkdtempSync(join(tmpdir(), 'cadence-kexp-'));
  const fake = fakeKexp(honourDates).listen(FAKE);
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
    KEXP_LOG: '1', KEXP_QUIET_MS: '1', KEXP_API: `http://localhost:${FAKE}`, KEXP_LOG_DELAY: '100', KEXP_LOG_EVERY: '60000', KEXP_BACKFILL_EVERY: '50', KEXP_BACKFILL_DAYS: '3' }, stdio: 'ignore' });
  const B = `http://localhost:${PORT}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  return { B, stop: () => { server.kill(); fake.close(); rmSync(dir, { recursive: true, force: true }); } };
}

for (const honour of [true, false]) {
  test(`keeps KEXP's plays and fills in the past (${honour ? 'by date' : 'by page'})`, async () => {
    limits.clear(); const { B, stop } = await boot(honour);
    try {
      let s;
      await expect.poll(async () => (s = await (await fetch(B + '/api/radio/kexp-history')).json()).backfill, { timeout: 30000 }).toBe('done');
      expect(s.on).toBe(true);
      expect(s.mode).toBe(honour ? 'date' : 'offset');
      expect([...limits]).toEqual([1000]);                                          // the past comes in big pages (user: "aggressively")                          // KEXP's inclusive airdate_before isn't mistaken for "ignored"
      const tops = (await (await fetch(B + '/api/radio/kexp?view=top&by=artist&period=all&limit=200')).json()).map(a => a.artist);
      expect(tops).toContain('The English Beat'); expect(tops).not.toContain('AIRBREAK'); expect(tops).not.toContain('Various Artists'); expect(tops.some(a => /^\(Various/.test(a))).toBe(false);
      expect(Date.parse(s.latest)).toBeGreaterThan(NOW - 60e3);
      expect(Date.parse(s.since)).toBeLessThanOrEqual(NOW - 3 * 864e5);           // reached the 3-day limit…
      expect(Date.parse(s.since)).toBeGreaterThan(NOW - 7 * 864e5);               // …and stopped soon after (within one 1,000-play page, ~3 days)
      // songs only: 9 of every 10, roughly 3 days and a (big) page
      expect(s.plays).toBeGreaterThan(3 * 24 * 15 * 0.9 * 0.95);
      expect(s.plays).toBeLessThan(7 * 24 * 15 * 0.9);
      // the shows behind the plays get their names (program + DJ), newest first
      await expect.poll(async () => (await (await fetch(B + '/api/radio/kexp-history')).json()).shows, { timeout: 30000 }).toBeGreaterThan(5);
      const r = await (await fetch(B + '/api/radio/kexp?view=recent&limit=1')).json();
      expect(r[0].show).toEqual(expect.objectContaining({ program: 'Show 100', hosts: 'DJ 100' }));
    } finally { stop(); }
  });
}

test('the per-artist summary matches the plays, including plays saved while it was still being built', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-kexpsum-'));
  const out = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const K = require('./server/services/kexp-log.js'), d = K.open();
    const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const mk = (id, artist, rot, t) => K.row({ id, play_type: 'trackplay', airdate: new Date(t).toISOString(), artist, song: 's' + id, rotation: rot });
    for (let i = 1; i <= 250; i++) ins.run(...mk(i * 2, i % 3 ? 'Alvvays' : 'big thief', i === 40 ? 'Heavy' : null, Date.UTC(2020, 0, 1) + i * 36e5));
    K.buildArtistsStep();                                   // first chunk of 100 only (KEXP_ARTISTS_CHUNK)
    // while it builds: an older play (below the builder's place) and a newer one (above it) arrive
    const plays = [{ id: 1, play_type: 'trackplay', airdate: new Date(Date.UTC(2019, 0, 1)).toISOString(), artist: 'Alvvays', song: 'old' },
      { id: 9999, play_type: 'trackplay', airdate: new Date().toISOString(), artist: 'ALVVAYS', song: 'new', rotation: 'Heavy' }];
    require('./server/services/kexp-log.js')._save(plays);
    for (let i = 0; i < 10; i++) K.buildArtistsStep();
    const real = d.prepare("SELECT COUNT(*) n FROM kexp_plays WHERE artist = 'Alvvays' COLLATE NOCASE").get().n;
    console.log(JSON.stringify({ real, sum: K.playCount('alvvays'), big: [d.prepare("SELECT COUNT(*) n FROM kexp_plays WHERE artist = 'big thief' COLLATE NOCASE").get().n, K.playCount('Big Thief')],
      heavy: K.heavyFirst('Big Thief'), heavyReal: d.prepare("SELECT MIN(airdate) t FROM kexp_plays WHERE artist = 'big thief' AND rotation = 'Heavy'").get().t,
      first: d.prepare("SELECT first_at FROM kexp_artists WHERE key = 'alvvays'").get().first_at, firstReal: d.prepare("SELECT MIN(airdate) t FROM kexp_plays WHERE artist = 'Alvvays' COLLATE NOCASE").get().t }));
  `], { env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_ARTISTS_DELAY: '99999999', KEXP_ARTISTS_CHUNK: '100', KEXP_ARTISTS_GAP: '99999999', KEXP_API: 'http://127.0.0.1:9' }, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  expect(out.status, out.stderr).toBe(0);
  const r = JSON.parse(out.stdout.trim().split('\n').pop());
  expect(r.sum).toBe(r.real);                 // nothing missed, nothing counted twice
  expect(r.big[1]).toBe(r.big[0]);
  expect(r.heavy).toBe(r.heavyReal);
  expect(r.first).toBe(r.firstReal);
});

test('plays per month, the year-by-year race, and lists kept ready (served at once, made again in the background)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-kexpmon-'));
  const out = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const K = require('./server/services/kexp-log.js'), d = K.open();
    const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const mk = (id, artist, t) => K.row({ id, play_type: 'trackplay', airdate: new Date(t).toISOString(), artist, song: 's' + id });
    // 18 months: Alvvays big early, Big Thief big later, Various Artists and air breaks never count
    let id = 0;
    for (let m = 0; m < 18; m++) for (let i = 0; i < 20; i++) {
      const t = Date.UTC(2019, m, 10, 12) + i * 60e3, a = i < (m < 9 ? 12 : 4) ? 'Alvvays' : i < 18 ? 'Big Thief' : i === 18 ? 'Various Artists' : 'Air break';
      const rw = mk(++id * 2, a, t); if (rw) ins.run(...rw);
    }
    for (let i = 0; i < 20; i++) K.buildMonthlyStep();
    // a play arriving after the builder passed it is counted once
    K._save([{ id: 1, play_type: 'trackplay', airdate: new Date(Date.UTC(2019, 0, 10, 13)).toISOString(), artist: 'ALVVAYS', song: 'late' }]);
    (async () => {
      const r = await K.race(), w = await K.winners({ by: 'artist', per: 'year' });
      const t0 = Date.now(); const again = await K.winners({ by: 'artist', per: 'year' }); const quick = Date.now() - t0;
      const kept = d.prepare("SELECT COUNT(*) n FROM kexp_kept").get().n;
      const jan = d.prepare("SELECT plays FROM kexp_monthly WHERE month = '2019-01' AND key = 'alvvays'").get().plays;
      console.log(JSON.stringify({ ready: K.monthlyReady(), jan, months: r.months.length, first: r.months[0], last: r.months.at(-1),
        roll0: r.roll[0], all17: r.all[17], roll17: r.roll[17], hasVA: JSON.stringify(r).includes('Various') || JSON.stringify(r).toLowerCase().includes('air break'),
        win: w.list.map(x => [x.period, x.winner.artist, x.winner.plays]), same: JSON.stringify(w) === JSON.stringify(again), quick, kept }));
    })();
  `], { env: { ...process.env, DATA_DIR: dir, TZ: 'UTC', KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_MONTHLY_DELAY: '99999999', KEXP_LISTS_DELAY: '99999999', KEXP_ARTISTS_DELAY: '99999999', KEXP_API: 'http://127.0.0.1:9' }, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  expect(out.status, out.stderr).toBe(0);
  const r = JSON.parse(out.stdout.trim().split('\n').pop());
  expect(r.ready).toBe(true);
  expect(r.jan).toBe(13);                                       // 12 + the late one
  expect([r.months, r.first, r.last]).toEqual([18, '2019-01', '2020-06']);
  expect(r.roll0).toEqual([['Alvvays', 13], ['Big Thief', 6]]);
  expect(r.hasVA).toBe(false);
  expect(r.all17[0][0]).toBe('Big Thief');                     // overtook Alvvays over 18 months: 6*9+14*9 = 180 vs 13+12*8+4*9 = 145
  expect(r.roll17).toEqual([['Big Thief', 144], ['Alvvays', 72]]);   // the last 12 months only: 3×6 + 9×14, 3×12 + 9×4
  expect(r.win).toEqual([['2020', 'Big Thief', 84], ['2019', 'Alvvays', 121]]);
  expect(r.same).toBe(true); expect(r.quick).toBeLessThan(50); expect(r.kept).toBeGreaterThanOrEqual(2);
});

test('DJ comment links, crate digging and the DJ list', async () => {
  const { createServer } = await import('node:http');
  const fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/v1/host/') { res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(u.searchParams.get('offset') ? { next: null, results: [{ name: 'Chilly', imageuri: 'https://www.kexp.org/media/chilly.jpg', isactive: false }] }
        : { next: `http://127.0.0.1:${fake.address().port}/v1/host/?format=json&limit=100&offset=100`, results: [{ name: 'Cheryl Waters', newimageuri: 'https://www.kexp.org/media/cheryl.jpg', imageuri: '', isactive: true }] })); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'cadence-kexplinks-'));
  try {
    const out = await new Promise((ok, no) => { const c = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
      const K = require('./server/services/kexp-log.js'), d = K.open();
      const ins = d.prepare('INSERT INTO kexp_plays (id, airdate, artist, song, release_date, comment) VALUES (?,?,?,?,?,?)'), t = Math.floor(Date.now() / 1000);
      ins.run(1, t - 3600, 'IREKE', 'Abanije', '2026-02-01', 'IREKE is a French project.\\n\\nhttps://ireke.bandcamp.com/album/ayo-dele');
      ins.run(2, t - 7200, 'IREKE', 'Tout est bizarre', '2026-02-01', 'Sugar cane. https://ireke.bandcamp.com/track/tout-est-bizarre. Also https://youtu.be/EmVFBIyFI7c?si=x and a review at https://pitchfork.com/reviews/x');
      ins.run(3, t - 9000, 'DAM', 'Ya weli', '2019-05-01', 'Palestinian hip-hop.\\n\\nInstagram: @dampalestine');
      ins.run(4, t - 5000, 'Elias Rahbani', 'Dance of Maria', '1972-01-01', 'Lebanese psych. https://nowagainrecords.bandcamp.com/track/dance-of-maria');
      ins.run(5, t - 6000, 'Los Hijos del Sol', 'Carinito', '1981', null);
      ins.run(6, t - 86400 * 400, 'Old Play', 'x', '1960', null);
      (async () => {
        const c = await K.crate({ period: 'month' }), h = await K.hosts();
        console.log(JSON.stringify({ ireke: K.commentLinks('ireke'), dam: K.commentLinks('DAM'), elias: K.commentLinks('Elias Rahbani'), art: K.artist('IREKE').links.length,
          crate: c.plays.map(p => p.artist), decades: c.decades, hosts: h }));
      })();
    `], { env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_API: `http://127.0.0.1:${fake.address().port}` } });
      let o = '', e = ''; c.stdout.on('data', x => o += x); c.stderr.on('data', x => e += x); c.on('exit', code => code ? no(new Error(e)) : ok(o)); });
    const r = JSON.parse(out.trim().split('\n').pop());
    // the artist's Bandcamp first (both releases), YouTube kept, a review site that isn't theirs left out
    expect(r.ireke).toEqual([{ kind: 'bandcamp', url: 'https://ireke.bandcamp.com/album/ayo-dele' }, { kind: 'bandcamp', url: 'https://ireke.bandcamp.com/track/tout-est-bizarre' }, { kind: 'youtube', url: 'https://youtu.be/EmVFBIyFI7c?si=x' }]);
    expect(r.dam).toEqual([{ kind: 'instagram', url: 'https://instagram.com/dampalestine' }]);
    expect(r.elias).toEqual([{ kind: 'bandcamp', url: 'https://nowagainrecords.bandcamp.com/track/dance-of-maria' }]);   // a label's page for the record
    expect(r.art).toBe(3);
    // crate digging: 20+ years old, played this month, newest play first; the decades counted
    expect(r.crate).toEqual(['Elias Rahbani', 'Los Hijos del Sol']);
    expect(r.decades).toEqual([{ decade: 1970, plays: 1 }, { decade: 1980, plays: 1 }]);
    // DJs, every page of the list
    expect(r.hosts).toEqual({ 'Cheryl Waters': { image: 'https://www.kexp.org/media/cheryl.jpg', active: true }, Chilly: { image: 'https://www.kexp.org/media/chilly.jpg', active: false } });
  } finally { fake.close(); rmSync(dir, { recursive: true, force: true }); }
});
