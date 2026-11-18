'use strict';
/* KEXP's two-week streaming archive (user, 2026-11-17).
   - Listen from here: any moment of the last 14 days. KEXP answers GET /get_streaming_url/?timestamp=… with the show's
     MP3 (one file per show, starting about 10 minutes before it) and sg-offset, the second in that file for the moment
     asked about, plus sg-url-next (the show after). The files allow seeking.
   - Keep a show: programs you pick are saved to the NAS after each episode ends (data/kexp-shows/<show id>.mp3), the
     newest few of each kept, older ones deleted. Nothing is saved when the disk has less than KEXP_KEEP_MIN_GB free.
   Under CI the API is a fake (KEXP_API). Files come only from KEXP's archive host (*.streamguys1.com). */
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const K = require('./kexp-log');

const API = () => (process.env.KEXP_API || 'https://api.kexp.org').replace(/\/$/, '');
const DEPTH = 336 * 3600e3;                   // exactly 14 days
// the older archive (api.kexp.org/v1/play: each play's archive_urls): a stream that starts at ?date=, plain http,
// played through the NAS relay. Used when the newer endpoint has no file for a moment. Not seekable, so not kept.
const OLD_ARCHIVE = () => (process.env.KEXP_OLD_ARCHIVE || 'http://50.234.71.239:8090').replace(/\/$/, '');
const archiveHost = u => { try { const x = new URL(u); return (x.protocol === 'https:' && /(^|\.)streamguys1\.com$/i.test(x.hostname)) || (!!process.env.KEXP_ARCHIVE_TEST && x.origin === process.env.KEXP_ARCHIVE_TEST); } catch { return false; } };
const dir = () => path.join(path.dirname(K.FILE), 'kexp-shows');

// ---- the archive at one moment ----
const asked = new Map();   // kept a few minutes: the same moment asked twice doesn't ask KEXP twice
async function archiveAt(at) {
  const t = typeof at === 'number' ? at * 1000 : Date.parse(at);
  if (!isFinite(t)) throw Object.assign(new Error('Which moment?'), { code: 400 });
  if (t > Date.now() - 60e3) return { none: true, why: 'That hasn\'t reached the archive yet.' };
  if (Date.now() - t > DEPTH - 10 * 60e3) return { none: true, why: 'KEXP keeps two weeks; that\'s older.' };
  const iso = new Date(Math.floor(t / 1000) * 1000).toISOString().replace('.000Z', 'Z'), c = asked.get(iso);
  if (c && Date.now() - c.at < 5 * 60e3) return c.v;
  const r = await fetch(`${API()}/get_streaming_url/?bitrate=256&timestamp=${encodeURIComponent(iso)}`, { headers: { 'User-Agent': 'Cadence/1 (self-hosted)', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error('KEXP archive: HTTP ' + r.status), { code: 502 });
  const j = await r.json();
  const url = j['sg-url'], next = j['sg-url-next'];
  const v = url && archiveHost(url)
    ? { url, next: next && archiveHost(next) ? next : null, offset: Math.max(0, +j['sg-offset'] || 0), at: iso }
    : process.env.KEXP_OLD_ARCHIVE !== '0'
      ? { url: `${OLD_ARCHIVE()}/stream-256.mp3?date=${encodeURIComponent(iso)}`, stream: true, offset: 0, at: iso }
      : { none: true, why: 'KEXP\'s archive doesn\'t have that moment.' };
  asked.set(iso, { at: Date.now(), v }); if (asked.size > 200) asked.delete(asked.keys().next().value);
  return v;
}

// ---- keeping shows ----
function db() {
  const d = K.open();
  d.exec(`CREATE TABLE IF NOT EXISTS kexp_kept_shows (id INTEGER PRIMARY KEY, program TEXT, start INTEGER, bytes INTEGER, offset INTEGER, saved INTEGER)`);
  return d;
}
const meta = (k, v) => { const d = db(); if (v === undefined) return (d.prepare('SELECT v FROM kexp_meta WHERE k = ?').get(k) || {}).v; d.prepare('INSERT OR REPLACE INTO kexp_meta (k, v) VALUES (?, ?)').run(k, String(v)); };
function keepCfg() { let c = {}; try { c = JSON.parse(meta('keep') || '{}'); } catch {} return { programs: Array.isArray(c.programs) ? c.programs : [], per: Math.max(1, Math.min(10, +c.per || 3)) }; }
function setKeep({ program, on, per } = {}) {
  const c = keepCfg();
  if (program) { const p = String(program).trim().slice(0, 120); c.programs = c.programs.filter(x => x.toLowerCase() !== p.toLowerCase()); if (on !== false) c.programs.push(p); }
  if (per != null) c.per = Math.max(1, Math.min(10, +per || 3));
  meta('keep', JSON.stringify(c));
  if (program && on === false) prune();
  return keep();
}
// what's kept, with each episode's playlist (seconds into the file, so a song can be jumped to)
function keep() {
  const d = db(), c = keepCfg();
  const kept = d.prepare('SELECT * FROM kexp_kept_shows ORDER BY start DESC').all().filter(r => fs.existsSync(path.join(dir(), r.id + '.mp3')));
  const plays = d.prepare(`SELECT airdate, artist, song, album FROM kexp_plays WHERE show_id = ? ORDER BY airdate`);
  // programs to choose from: everything KEXP aired in the last few weeks, most-heard first
  let programs = [];
  try { programs = d.prepare(`SELECT program, COUNT(*) AS n, MAX(start) AS last FROM kexp_shows WHERE program IS NOT NULL AND start > ? GROUP BY program ORDER BY n DESC, program LIMIT 80`).all(Math.floor(Date.now() / 1000) - 35 * 86400).map(r => r.program); } catch {}
  return {
    programs: c.programs, per: c.per, choices: [...new Set([...c.programs, ...programs])],
    kept: kept.map(r => {
      const sh = d.prepare('SELECT hosts, image, tagline FROM kexp_shows WHERE id = ?').get(r.id) || {};
      const fileStart = r.start - r.offset;
      return { id: r.id, program: r.program, start: new Date(r.start * 1000).toISOString(), bytes: r.bytes, offset: r.offset, hosts: sh.hosts || null, image: sh.image || null, tagline: sh.tagline || null,
        url: `api/radio/kexp-kept/${r.id}.mp3`, plays: plays.all(r.id).filter(p => p.artist).map(p => ({ sec: Math.max(0, p.airdate - fileStart), artist: p.artist, song: p.song, album: p.album })) };
    }),
  };
}
const freeGb = () => { try { fs.mkdirSync(dir(), { recursive: true }); const s = fs.statfsSync(dir()); return (s.bavail * s.bsize) / 1e9; } catch { return Infinity; } };
// one step of the background job: save the next finished episode that's wanted, then tidy up
async function keepStep() {
  const c = keepCfg(); if (!c.programs.length) return undefined;
  const d = db(), now = Math.floor(Date.now() / 1000), names = c.programs.map(p => p.toLowerCase());
  // finished episodes still in the archive (an episode ends when the next show starts; 20 minutes for KEXP to file it)
  const eps = d.prepare(`SELECT s.id, s.program, s.start, (SELECT MIN(n.start) FROM kexp_shows n WHERE n.start > s.start) AS ends FROM kexp_shows s
    WHERE s.start > ? AND s.program IS NOT NULL ORDER BY s.start DESC LIMIT 400`).all(now - Math.floor(DEPTH / 1000) + 3600)
    .filter(e => names.includes(String(e.program).toLowerCase()) && e.ends && e.ends < now - 20 * 60);
  const have = new Set(d.prepare('SELECT id FROM kexp_kept_shows').all().map(r => r.id));
  // only the newest `per` of each program are wanted
  const wanted = []; const count = {};
  for (const e of eps) { const k = e.program.toLowerCase(); count[k] = (count[k] || 0) + 1; if (count[k] <= c.per) wanted.push(e); }
  const todo = wanted.filter(e => !have.has(e.id));
  if (!todo.length) return undefined;
  const min = +process.env.KEXP_KEEP_MIN_GB || 5;
  if (freeGb() < min) return { note: `Not saving KEXP shows: less than ${min} GB free on the NAS` };
  const e = todo[0], a = await archiveAt(e.start);
  if (a.none || a.stream) return { note: `KEXP's archive had no file for ${e.program} on ${new Date(e.start * 1000).toDateString()}` };
  fs.mkdirSync(dir(), { recursive: true });
  const file = path.join(dir(), e.id + '.mp3'), tmp = file + '.part';
  const r = await fetch(a.url, { headers: { 'User-Agent': 'Cadence/1 (self-hosted)' }, signal: AbortSignal.timeout(30 * 60e3) });
  if (!r.ok || !r.body) throw new Error('KEXP archive file: HTTP ' + r.status);
  try { await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp)); fs.renameSync(tmp, file); }
  catch (err) { try { fs.unlinkSync(tmp); } catch {} throw err; }
  const bytes = fs.statSync(file).size;
  d.prepare('INSERT OR REPLACE INTO kexp_kept_shows (id, program, start, bytes, offset, saved) VALUES (?, ?, ?, ?, ?, ?)').run(e.id, e.program, e.start, bytes, a.offset, now);
  prune();   // the newest few of each stay
  return { note: `Saved ${e.program} (${new Date(e.start * 1000).toDateString()}, ${Math.round(bytes / 1e6)} MB)`, again: todo.length > 1 ? 60e3 : undefined };
}
// delete kept episodes no longer wanted (a program you stopped keeping, or older than the newest few)
function prune() {
  const d = db(), c = keepCfg(), names = c.programs.map(p => p.toLowerCase());
  const rows = d.prepare('SELECT id, program, start FROM kexp_kept_shows ORDER BY start DESC').all(), count = {};
  for (const r of rows) {
    const k = String(r.program).toLowerCase(); count[k] = (count[k] || 0) + 1;
    const keepIt = names.includes(k) && count[k] <= c.per;
    if (!keepIt) { try { fs.unlinkSync(path.join(dir(), r.id + '.mp3')); } catch {} d.prepare('DELETE FROM kexp_kept_shows WHERE id = ?').run(r.id); }
  }
}
// a kept file, with seeking (Range)
function serveKept(id, req, res) {
  const file = path.join(dir(), (+id) + '.mp3');
  let st; try { st = fs.statSync(file); } catch { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"Not kept"}'); }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''), size = st.size;
  if (m) {
    let a = m[1] === '' ? size - (+m[2] || 0) : +m[1], b = m[2] === '' || m[1] === '' ? size - 1 : Math.min(size - 1, +m[2]);
    if (!(a >= 0 && a <= b)) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': 'audio/mpeg', 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400' });
    return fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400' });
  fs.createReadStream(file).pipe(res);
}

if (K.isOn() && process.env.KEXP_KEEP !== '0') {
  require('../lib/scheduler').add('kexp-keep', keepStep, { label: 'KEXP: saving the shows you keep', quiet: true, every: 30 * 60e3, first: +process.env.KEXP_KEEP_DELAY || 4 * 60e3, retry: 15 * 60e3 });
}

module.exports = { archiveAt, keep, setKeep, keepStep, prune, serveKept, archiveHost };
