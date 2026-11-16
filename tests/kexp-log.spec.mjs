// KEXP play history kept on the NAS: new plays saved, air breaks skipped, the past filled in back to the limit,
// whether KEXP honours airdate_before or not (then it walks offset pages). Against a fake KEXP API.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

// ten days of plays, one every 4 minutes; every 10th is an air break
const NOW = Date.now(), PLAYS = [];
for (let i = 0; i < 10 * 24 * 15; i++) {
  const t = NOW - i * 4 * 60e3, id = 10_000_000 - i;
  PLAYS.push(i % 10 === 5 ? { id, play_type: 'airbreak', airdate: new Date(t).toISOString() }
    : { id, play_type: 'trackplay', airdate: new Date(t).toISOString(), artist: 'Artist ' + (i % 37), song: 'Song ' + i, album: 'Album', labels: ['Sub Pop'], rotation_status: i % 3 ? null : 'Heavy', comment: i === 0 ? 'Playing Thursday at the Crocodile' : '', show: 100 + Math.floor(i / 45) });
}
function fakeKexp(honourDates) {
  return http.createServer((req, res) => {
    const sm = req.url.match(/^\/v2\/shows\/(\d+)\//);
    if (sm) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ id: +sm[1], program_name: 'Show ' + sm[1], program_tags: 'Eclectic', host_names: ['DJ ' + sm[1]], start_time: new Date().toISOString() })); }
    const u = new URL(req.url, 'http://x'), limit = +u.searchParams.get('limit') || 20, off = +u.searchParams.get('offset') || 0, before = u.searchParams.get('airdate_before');
    let list = PLAYS; if (honourDates && before) list = list.filter(p => Date.parse(p.airdate) < Date.parse(before));
    const page = list.slice(off, off + limit), more = off + limit < list.length;
    const next = more ? `http://localhost:${res.socket.localPort}/v2/plays/?format=json&limit=${limit}&ordering=-airdate&offset=${off + limit}${honourDates && before ? '&airdate_before=' + encodeURIComponent(before) : ''}` : null;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ next, results: page }));
  });
}
async function boot(honourDates) {
  const PORT = await freePort(), FAKE = await freePort(), dir = mkdtempSync(join(tmpdir(), 'cadence-kexp-'));
  const fake = fakeKexp(honourDates).listen(FAKE);
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
    KEXP_LOG: '1', KEXP_API: `http://localhost:${FAKE}`, KEXP_LOG_DELAY: '100', KEXP_LOG_EVERY: '60000', KEXP_BACKFILL_EVERY: '50', KEXP_BACKFILL_DAYS: '3' }, stdio: 'ignore' });
  const B = `http://localhost:${PORT}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  return { B, stop: () => { server.kill(); fake.close(); rmSync(dir, { recursive: true, force: true }); } };
}

for (const honour of [true, false]) {
  test(`keeps KEXP's plays and fills in the past (${honour ? 'by date' : 'by page'})`, async () => {
    const { B, stop } = await boot(honour);
    try {
      let s;
      await expect.poll(async () => (s = await (await fetch(B + '/api/radio/kexp-history')).json()).backfill, { timeout: 30000 }).toBe('done');
      expect(s.on).toBe(true);
      expect(Date.parse(s.latest)).toBeGreaterThan(NOW - 60e3);
      expect(Date.parse(s.since)).toBeLessThanOrEqual(NOW - 3 * 864e5);           // reached the 3-day limit…
      expect(Date.parse(s.since)).toBeGreaterThan(NOW - 5 * 864e5);               // …and stopped soon after
      // songs only: 9 of every 10, roughly 3 days and a page
      expect(s.plays).toBeGreaterThan(3 * 24 * 15 * 0.9 * 0.95);
      expect(s.plays).toBeLessThan(5 * 24 * 15 * 0.9);
      // the shows behind the plays get their names (program + DJ), newest first
      await expect.poll(async () => (await (await fetch(B + '/api/radio/kexp-history')).json()).shows, { timeout: 30000 }).toBeGreaterThan(5);
      const r = await (await fetch(B + '/api/radio/kexp?view=recent&limit=1')).json();
      expect(r[0].show).toEqual(expect.objectContaining({ program: 'Show 100', hosts: 'DJ 100' }));
    } finally { stop(); }
  });
}
