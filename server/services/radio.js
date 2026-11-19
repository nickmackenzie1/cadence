'use strict';
/* Radio (user, 2026-11-15): live stations in the same player as Podcasts.
   Stream addresses come from Radio Browser (radio-browser.info: free, no key) and are looked up here on the NAS,
   so a station that moves its stream keeps working without a code change. KEXP's own API gives "now playing".
   The browser can't play an http:// stream on the https NAS page (mixed content), so those are relayed here. */
const http = require('http'), https = require('https');
const fs = require('fs'), path = require('path');
const { safeFetch, guardedLookup, assertPublic } = require('../lib/net');

const DATA = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CACHE_FILE = path.join(DATA, 'radio-cache.json');
const RB = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];
const WEEK = 7 * 864e5, DAY = 864e5, BUDGET = process.env.RADIO_LOOKUP_MS != null ? +process.env.RADIO_LOOKUP_MS : 300;

// Indie, college and community stations. `url` when the station publishes one; otherwise `find` is searched in Radio Browser.
const PRESETS = [
  { id: 'kexp', name: 'KEXP 90.3', place: 'Seattle', about: 'DJ-picked indie, the best early signal there is', url: 'https://kexp.streamguys1.com/kexp160.aac', home: 'https://www.kexp.org', now: 'kexp' },
  { id: 'cjai', name: 'Amherst Island Radio', place: 'Amherst Island, ON', about: 'Volunteer-run community radio from a milk house in Stella', find: ['Amherst Island', 'CJAI'], home: 'https://www.cjai.ca' },
  { id: 'cfrc', name: 'CFRC 101.9', place: 'Kingston, ON', about: "Queen's campus radio", find: ['CFRC'], home: 'https://www.cfrc.ca' },
  { id: 'ciut', name: 'CIUT 89.5', place: 'Toronto', about: 'University of Toronto community radio', find: ['CIUT'], home: 'https://ciut.fm' },
  { id: 'cjru', name: 'CJRU 1280', place: 'Toronto', about: 'The Scope at TMU, campus radio', find: ['CJRU', 'The Scope'], home: 'https://www.cjru.ca' },
  { id: 'chry', name: 'CHRY 105.5', place: 'Toronto', about: 'VIBE 105, community radio at York', find: ['CHRY', 'VIBE 105'], home: 'https://www.vibe105.ca' },
  { id: 'ckut', name: 'CKUT 90.3', place: 'Montreal', about: 'Campus-community radio at McGill', find: ['CKUT'], home: 'https://ckut.ca' },
  { id: 'wfmu', name: 'WFMU 91.1', place: 'Jersey City', about: 'Freeform, gloriously weird', find: ['WFMU'], home: 'https://wfmu.org' },
  { id: 'wxyc', name: 'WXYC 89.3', place: 'Chapel Hill, NC', about: "UNC's student-run freeform radio, streaming since 1994", find: ['WXYC 89.3', 'WXYC'], home: 'https://wxyc.org', playlist: 'wxyc' },
  { id: 'wfuv', name: 'WFUV 90.7', place: 'New York', about: "Fordham's public radio, New York's music discovery", find: ['WFUV 90.7 Fordham', 'WFUV 90.7', 'WFUV'], home: 'https://wfuv.org', playlist: 'wfuv' },
  { id: 'ksua', name: 'KSUA 91.5', place: 'Fairbanks, AK', about: 'Student radio at the University of Alaska Fairbanks', find: ['KSUA 91.5', 'KSUA'], home: 'https://www.ksuaradio.com', playlist: 'spinitron:KSUA' },
  { id: 'nts1', name: 'NTS 1', place: 'London', about: 'Underground everything, live from the studio', find: ['NTS Radio 1', 'NTS 1'], home: 'https://www.nts.live' },
  { id: 'dublab', name: 'dublab', place: 'Los Angeles', about: 'Listener-supported future roots radio', find: ['dublab'], home: 'https://www.dublab.com' },
  { id: 'kcrw', name: 'KCRW Eclectic24', place: 'Santa Monica', about: 'Eclectic music, around the clock', find: ['KCRW Eclectic24', 'Eclectic 24'], home: 'https://www.kcrw.com' },
  { id: 'somaindie', name: 'SomaFM Indie Pop Rocks!', place: 'San Francisco', about: 'New and classic indie pop, no ads', find: ['Indie Pop Rocks'], home: 'https://somafm.com/indiepop/' },
  { id: 'rp', name: 'Radio Paradise', place: 'California', about: 'Hand-mixed eclectic, no ads', find: ['Radio Paradise Main Mix', 'Radio Paradise'], home: 'https://radioparadise.com' },
];

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {}; } catch { cache = {}; }
const saveCache = () => { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (e) { console.warn('radio cache', e.message); } };

async function rb(pathAndQuery) {
  let last;
  for (const host of RB) {
    try { const r = await safeFetch(host + pathAndQuery, { headers: { 'User-Agent': 'Cadence/1 (self-hosted to-do app)' }, timeout: 4000 }, 1024 * 1024); return JSON.parse(r.buf.toString('utf8')); }
    catch (e) { last = e; }
  }
  throw new Error('Radio Browser unreachable: ' + (last && last.message));
}
// a Radio Browser station in the shape the app uses; HLS needs Safari, so it's skipped unless nothing else exists
const shape = s => ({
  id: 'rb:' + s.stationuuid, name: String(s.name || '').trim().slice(0, 80), place: [s.state, s.country].filter(Boolean).join(', ').slice(0, 80),
  about: String(s.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 4).join(', '),
  url: s.url_resolved || s.url, home: s.homepage || null, art: s.favicon || null, codec: s.codec || null, bitrate: +s.bitrate || null, hls: !!s.hls, ok: s.lastcheckok === 1, votes: +s.votes || 0,
});
const best = list => list.filter(s => s.url && !s.hls).sort((a, b) => (b.ok - a.ok) || (/^https:/.test(b.url) - /^https:/.test(a.url)) || (b.votes - a.votes))[0] || null;

async function search(q, limit = 25) {
  q = String(q || '').trim().slice(0, 80); if (q.length < 2) return [];
  const list = await rb(`/json/stations/search?name=${encodeURIComponent(q)}&hidebroken=true&order=votes&reverse=true&limit=${limit}`);
  return (Array.isArray(list) ? list : []).map(shape).filter(s => s.url && !s.hls);
}

// Looking up a preset's stream in Radio Browser. Kept a week when found and a day when not (so a station that isn't
// listed doesn't cost a search every time Radio opens). One lookup per station at a time.
const inflight = new Map();
function lookup(p) {
  if (inflight.has(p.id)) return inflight.get(p.id);
  const job = (async () => {
    for (const name of p.find || [p.name]) {
      const hit = best(await search(name, 10));
      if (hit) { cache[p.id] = { url: hit.url, art: hit.art, at: Date.now() }; saveCache(); return cache[p.id]; }
    }
    cache[p.id] = { url: null, miss: true, at: Date.now() }; saveCache(); return cache[p.id];
  })().finally(() => inflight.delete(p.id));
  inflight.set(p.id, job);
  return job;
}
// the stream for a preset: its own address, else what we know (refreshed in the background when it's old), else a
// fresh lookup that gets BUDGET ms (300) before the list goes out without it: the page shows the station as "looking"
// and asks again a few seconds later. A lookup that failed (directory unreachable) is remembered 10 minutes, so it
// doesn't hold up every visit.
const failed = new Map();
async function resolve(p) {
  if (p.url) return { url: p.url };
  const c = cache[p.id], age = c ? Date.now() - c.at : Infinity;
  if (c && age < (c.miss ? DAY : WEEK)) return c;
  const f = failed.get(p.id);
  if (!c && f && Date.now() - f < 10 * 60e3) return { url: null, pending: false, failed: true };
  const job = lookup(p).catch(e => { failed.set(p.id, Date.now()); if (c) return c; throw e; });   // directory down: last known address beats nothing
  if (c) { job.catch(() => {}); return c; }
  const timeout = new Promise(r => setTimeout(() => r({ url: null, pending: true }), BUDGET).unref());
  return Promise.race([job, timeout]);
}

async function stations() {
  return Promise.all(PRESETS.map(async p => {
    const { find, ...pub } = p;
    try { const r = await resolve(p); return { ...pub, url: r.url || null, art: r.art || null, missing: !r.url && !r.pending, pending: !!r.pending }; }
    catch (e) { return { ...pub, url: null, missing: true, error: e.message }; }
  }));
}

// KEXP: what's on right now (cached 20 s so every open tab doesn't ask)
let kexpNow = { at: 0, v: null };
async function nowPlaying(id, u) {
  if (id !== 'kexp') return id ? stationNow(String(id), u) : null;
  if (Date.now() - kexpNow.at < 20000) return kexpNow.v;
  const r = await safeFetch('https://api.kexp.org/v2/plays/?format=json&limit=1', {}, 256 * 1024);
  const p = (JSON.parse(r.buf.toString('utf8')).results || [])[0] || null;
  const show = p && p.show ? await kexpShow(p.show).catch(() => null) : null;
  kexpNow = { at: Date.now(), v: p ? { ...(p.play_type === 'trackplay'
    ? { artist: p.artist, song: p.song, album: p.album, art: p.thumbnail_uri || p.image_uri || null, at: p.airdate }
    : { airbreak: true, at: p.airdate }), ...(show ? { show } : {}) } : null };
  return kexpNow.v;
}
// the show on air and its DJs, with their photos (for the KEXP live theme); a show is asked about once
const kexpShows = new Map();
async function kexpShow(id) {
  if (kexpShows.has(id)) return kexpShows.get(id);
  const r = await safeFetch(`https://api.kexp.org/v2/shows/${encodeURIComponent(id)}/?format=json`, {}, 256 * 1024), s = JSON.parse(r.buf.toString('utf8'));
  let faces = {}; try { faces = await require('./kexp-log').hosts(); } catch {}
  const names = (s.host_names || []).filter(Boolean);
  const v = { id, program: s.program_name || null, tagline: s.tagline || null, image: s.program_image_uri || s.image_uri || null,
    hosts: names.map(n => ({ name: n, image: (faces[n] && faces[n].image) || null })) };
  kexpShows.set(id, v); if (kexpShows.size > 50) kexpShows.delete(kexpShows.keys().next().value);
  return v;
}

// ---- now playing from a station's own playlist (2026-11-19), for stations that don't put titles in the stream ----
// WXYC: the flowsheet JSON their own apps read. KSUA: Spinitron's public now-playing widget. WFUV: their on-air playlist
// page. Each gives artist and song (WXYC also album and cover). An entry older than 20 minutes means talk, a break or
// automation, so it isn't shown as playing now. Anything that fails falls back to the title in the stream.
const OLD = 20 * 60e3;
const unent = t => String(t || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, ' ').trim();
const fresh = (at, now) => now === null || !at || !isFinite(at) || now - at < OLD;   // now === null: any age (the service check)
// { entries: [{ id, add_time, entry_type, artist_name, track_title, album_title, artwork_url }], on_air: { dj_name } | null }
function parseWxyc(j, now = Date.now()) {
  const e = (j && Array.isArray(j.entries) ? j.entries : []).filter(x => x && (x.entry_type || 'track') === 'track' && x.artist_name && x.track_title)
    .sort((a, b) => (+b.id || 0) - (+a.id || 0))[0];
  if (!e) return null;
  const at = Date.parse(e.add_time);
  if (!fresh(at, now)) return null;
  return { artist: String(e.artist_name).trim(), song: String(e.track_title).trim(), album: e.album_title || null, label: e.record_label || null,
    art: /^https:\/\//.test(e.artwork_url || '') ? e.artwork_url : null, at: isFinite(at) ? new Date(at).toISOString() : null,
    dj: j.on_air && j.on_air.dj_name ? String(j.on_air.dj_name).slice(0, 80) : null };
}
// Spinitron's widget markup: the newest spin first, with <span class="artist">, "song", "release" and a <time> or
// "spin-time" (a cover <img> sometimes)
function parseSpinitron(html, now = Date.now()) {
  html = String(html || '');
  const pick = cls => { const m = html.match(new RegExp(`<[a-z]+[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</[a-z]+>`, 'i')); return m ? unent(m[1]) : ''; };
  const artist = pick('artist'), song = pick('song');
  if (!artist || !song) return null;
  const dt = (html.match(/<time[^>]*datetime="([^"]+)"/i) || [])[1], at = dt ? Date.parse(dt) : NaN;
  if (!fresh(at, now)) return null;
  const img = (html.match(/<img[^>]*src="(https:\/\/[^"]+)"/i) || [])[1] || null;
  return { artist, song, album: pick('release') || null, art: img && !/placeholder|default/i.test(img) ? img : null, at: isFinite(at) ? new Date(at).toISOString() : null };
}
// a wall-clock time in New York → epoch ms (WFUV's page says "11/19, 1:35am" in New York time)
function nyTime(mon, day, h, min, now = Date.now()) {
  let y = new Date(now).getUTCFullYear();
  const guess = yy => Date.UTC(yy, mon - 1, day, h, min);
  const off = t => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
    const g = k => +p.find(x => x.type === k).value; return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - t; };
  let t = guess(y); t -= off(t);
  if (t - now > 2 * 864e5) { t = guess(y - 1); t -= off(t); }   // late December looking at early January
  return t;
}
// WFUV's on-air playlist table: rows of Time | Song Title | Artist, newest first
function parseWfuv(html, now = Date.now()) {
  for (const row of String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const td = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(unent);
    if (td.length < 3 || !td[1] || !td[2]) continue;
    const m = td[0].match(/(\d{1,2})\/(\d{1,2}),?\s*(\d{1,2}):(\d{2})\s*([ap])\.?m/i);
    const at = m ? nyTime(+m[1], +m[2], (+m[3] % 12) + (/p/i.test(m[5]) ? 12 : 0), +m[4], now ?? Date.now()) : NaN;
    if (!fresh(at, now)) return null;
    return { artist: td[2], song: td[1], album: td[3] || null, at: isFinite(at) ? new Date(at).toISOString() : null };
  }
  return null;
}
const PLAYLIST_URL = {
  wxyc: () => process.env.WXYC_API || 'https://api.wxyc.org/flowsheet',
  wfuv: () => process.env.WFUV_PLAYLIST || 'https://wfuv.org/playlist',
  spinitron: st => `${process.env.SPINITRON_WIDGETS || 'https://widgets.spinitron.com'}/widget/now-playing-v2?station=${encodeURIComponent(st.toLowerCase())}&num=1&cover=1`,
};
async function playlistNow(src) {
  const [kind, arg] = String(src).split(':');
  const url = PLAYLIST_URL[kind] && PLAYLIST_URL[kind](arg || '');
  if (!url) return null;
  const r = await safeFetch(url, { headers: { 'User-Agent': 'Cadence/1 (self-hosted to-do app)', Accept: kind === 'wxyc' ? 'application/json' : 'text/html' }, timeout: 5000 }, 1024 * 1024);
  const body = r.buf.toString('utf8');
  const v = kind === 'wxyc' ? parseWxyc(JSON.parse(body)) : kind === 'wfuv' ? parseWfuv(body) : parseSpinitron(body);
  return v ? { ...v, raw: `${v.artist} - ${v.song}`, from: 'playlist' } : null;
}
// ---- now playing for any station: the song title carried inside the stream (ICY / SHOUTcast metadata) ----
// Ask with "Icy-MetaData: 1"; the server says how many audio bytes come between titles (icy-metaint); read that much,
// then one length byte (×16) and "StreamTitle='Artist - Song';". About 8–64 KB per look, then hang up.
function parseIcy(block) {
  const raw = block.toString('utf8').includes('\uFFFD') ? block.toString('latin1') : block.toString('utf8');
  const m = raw.match(/StreamTitle='([\s\S]*?)';/); if (!m) return null;
  const t = m[1].replace(/\0+$/, '').trim(); return t || null;
}
function splitTitle(t) {
  if (!t) return null;
  const m = t.match(/^(.{1,150}?)\s+[-–—]\s+(.{1,250})$/);
  return m ? { artist: m[1].trim(), song: m[2].trim(), raw: t } : { artist: null, song: t, raw: t };
}
async function icyTitle(url) {
  const { res, req } = await openStream(url, { 'Icy-MetaData': '1' });
  return readIcy(res, req);
}
// the part that reads a response (separate so tests can hand it a local stream)
function readIcy(res, req) {
  const every = +res.headers['icy-metaint'];
  if (!every || every > 512 * 1024) { req.destroy(); return { none: true }; }
  return new Promise((done, fail) => {
    let buf = Buffer.alloc(0); const stop = (v, e) => { clearTimeout(timer); try { req.destroy(); } catch {} e ? fail(e) : done(v); };
    const timer = setTimeout(() => stop(null, new Error('the station took too long to send a title')), 12000);
    res.on('data', c => {
      buf = Buffer.concat([buf, c]);
      if (buf.length <= every) return;
      const len = buf[every] * 16;
      if (len === 0) return stop({ title: null });                 // nothing this time: the station isn't sending a title now
      if (buf.length >= every + 1 + len) stop({ title: parseIcy(buf.subarray(every + 1, every + 1 + len)) });
    });
    res.on('error', e => stop(null, e)); res.on('end', () => stop({ title: null }));
  });
}

// what each station played: saved when the title changes (cadence.db, table radio_plays)
let hdb = null;
function hist() {
  if (hdb) return hdb;
  const { DatabaseSync } = require('node:sqlite');
  hdb = new DatabaseSync(path.join(DATA, 'cadence.db'));
  require('../lib/sqlite-tune').tune(hdb, { cacheMB: 8, mmapMB: 64 });
  hdb.exec(`CREATE TABLE IF NOT EXISTS radio_plays (id INTEGER PRIMARY KEY AUTOINCREMENT, station TEXT NOT NULL, at INTEGER NOT NULL, artist TEXT, song TEXT, raw TEXT);
    CREATE INDEX IF NOT EXISTS radio_plays_station ON radio_plays(station, at);
    CREATE TABLE IF NOT EXISTS radio_follow (station TEXT PRIMARY KEY, name TEXT, url TEXT, since INTEGER);`);
  return hdb;
}
function remember(station, n) {
  if (!n || !n.raw) return;
  try {
    const d = hist(), last = d.prepare('SELECT raw FROM radio_plays WHERE station = ? ORDER BY at DESC, id DESC LIMIT 1').get(station);
    if (!last || last.raw !== n.raw) d.prepare('INSERT INTO radio_plays (station, at, artist, song, raw) VALUES (?, ?, ?, ?, ?)').run(station, Math.round(Date.now() / 1000), n.artist, n.song, n.raw);
  } catch (e) { console.warn('radio history', e.message); }
}
// station id → its stream: a preset (looked up), or a saved station whose address the page sends along
async function streamFor(id, u) {
  const p = PRESETS.find(x => x.id === id);
  if (p) { const r = await resolve(p); return r.url || null; }
  if (u && /^https?:\/\//i.test(u)) return String(u).slice(0, 2000);
  try { const f = hist().prepare('SELECT url FROM radio_follow WHERE station = ?').get(id); return f ? f.url : null; } catch { return null; }
}
const nowCache = new Map(), nowInflight = new Map();
async function stationNow(id, u) {
  const c = nowCache.get(id); if (c && Date.now() - c.at < 20000) return c.v;
  if (nowInflight.has(id)) return nowInflight.get(id);
  const job = (async () => {
    const p = PRESETS.find(x => x.id === id);
    let v = null;
    if (p && p.playlist) { try { v = await playlistNow(p.playlist); } catch { v = null; } }
    if (v) { remember(id, v); nowCache.set(id, { at: Date.now(), v }); return v; }
    const url = await streamFor(id, u); if (!url) return null;
    try { const r = await icyTitle(url); v = r.none ? { none: true } : r.title ? { ...splitTitle(r.title), at: new Date().toISOString() } : { quiet: true }; }
    catch (e) { v = { error: e.message.slice(0, 120) }; }
    if (v && v.raw) remember(id, v);
    nowCache.set(id, { at: Date.now(), v }); return v;
  })().finally(() => nowInflight.delete(id));
  nowInflight.set(id, job); return job;
}
// SomaFM (user, 2026-11-16, from their API list): ~40 listener-supported channels, no ads, each with what's playing.
// Their channel list is public JSON; kept 10 minutes. Streams are .pls playlists, which the NAS relay opens.
let somaCache = { at: 0, v: null };
async function soma() {
  if (somaCache.v && Date.now() - somaCache.at < 10 * 60e3) return somaCache.v;
  const base = (process.env.SOMAFM_API || 'https://somafm.com').replace(/\/$/, '');
  const r = await safeFetch(base + '/channels.json', { headers: { Accept: 'application/json' }, timeout: 8000 }, 2 * 1024 * 1024);
  const j = JSON.parse(r.buf.toString('utf8'));
  const pick = c => { const l = (c.playlists || []).filter(p => p && p.url); return (l.find(p => p.format === 'mp3' && p.quality === 'highest') || l.find(p => p.format === 'mp3') || l.find(p => /aac/.test(p.format || '')) || l[0] || {}).url || null; };
  const v = (j.channels || []).map(c => ({ id: 'soma:' + String(c.id || '').replace(/[^a-z0-9_-]/gi, ''), name: String(c.title || c.id || '').slice(0, 80), place: String(c.genre || '').replace(/\|/g, ', ').slice(0, 80),
    about: String(c.description || '').slice(0, 200), now: c.lastPlaying ? String(c.lastPlaying).slice(0, 160) : null, listeners: +c.listeners || 0,
    art: c.largeimage || c.xlimage || c.image || null, home: `https://somafm.com/${encodeURIComponent(c.id || '')}/`, url: pick(c) }))
    .filter(c => c.url && c.id !== 'soma:').sort((a, b) => b.listeners - a.listeners);
  somaCache = { at: Date.now(), v }; return v;
}
// who these stations played lately, most first (Music Radar's Close to home)
function artistCounts(stations, sinceSec, limit = 300) {
  try {
    return hist().prepare(`SELECT MIN(artist) AS artist, station, COUNT(*) AS n FROM radio_plays WHERE station IN (${stations.map(() => '?').join(',')}) AND at > ? AND artist IS NOT NULL AND artist != '' GROUP BY artist COLLATE NOCASE, station ORDER BY n DESC LIMIT ?`).all(...stations, Math.floor(sinceSec), limit);
  } catch (e) { return []; }
}
function history(id, limit = 50) {
  const n = Math.max(1, Math.min(500, +limit || 50));
  let list = [];
  if (id === 'kexp') { try { list = require('./kexp-log').recent({ limit: n }).map(p => ({ at: p.at, artist: p.artist, song: p.song, album: p.album })); } catch { list = []; } }
  else list = hist().prepare('SELECT at, artist, song, raw FROM radio_plays WHERE station = ? ORDER BY at DESC, id DESC LIMIT ?').all(String(id), n).map(r => ({ ...r, at: new Date(r.at * 1000).toISOString() }));
  const f = id === 'kexp' ? null : hist().prepare('SELECT since FROM radio_follow WHERE station = ?').get(String(id));
  return { station: id, follow: id === 'kexp' ? 'kexp' : !!f, since: f ? new Date(f.since * 1000).toISOString() : null, plays: list };
}
// followed artists: plays on stations whose history the NAS keeps (or that you listened to), since a time
function playsFor(name, sinceSec, limit = 20) {
  try {
    return hist().prepare(`SELECT p.station, p.at, p.song, f.name FROM radio_plays p LEFT JOIN radio_follow f ON f.station = p.station
      WHERE p.artist = ? COLLATE NOCASE AND p.at > ? ORDER BY p.at DESC LIMIT ?`).all(String(name), Math.floor(sinceSec), limit)
      .map(r => ({ ...r, name: r.name || (PRESETS.find(x => x.id === r.station) || {}).name || r.station }));
  } catch (e) { return []; }
}
// "Keep a history": the NAS looks every couple of minutes, even when nobody is listening
function follow({ id, name, url, on }) {
  if (!id || id === 'kexp') throw Object.assign(new Error('Which station?'), { code: 400 });
  const d = hist();
  if (on) d.prepare('INSERT OR REPLACE INTO radio_follow (station, name, url, since) VALUES (?, ?, ?, COALESCE((SELECT since FROM radio_follow WHERE station = ?), ?))')
    .run(String(id), String(name || id).slice(0, 120), url && /^https?:\/\//i.test(url) ? String(url).slice(0, 2000) : null, String(id), Math.round(Date.now() / 1000));
  else d.prepare('DELETE FROM radio_follow WHERE station = ?').run(String(id));
  return history(id, 20);
}
const FOLLOW_EVERY = +process.env.RADIO_FOLLOW_EVERY || 120e3;
if (process.env.RADIO_HISTORY === '1' || (!process.env.CI && process.env.RADIO_HISTORY !== '0')) {
  const tick = async () => { try { for (const f of hist().prepare('SELECT station, url FROM radio_follow').all()) await stationNow(f.station, f.url).catch(() => {}); } catch (e) { console.warn('radio follow', e.message); } };
  require('../lib/scheduler').add('radio-follow', tick, { label: "Radio: what your kept stations are playing", every: FOLLOW_EVERY, first: +process.env.RADIO_FOLLOW_DELAY || 30000 });
}

// ---- relay an http:// stream (only public addresses; follows a few redirects; .pls/.m3u resolved to their first entry) ----
const PLAYLIST = /(audio\/x-scpls|audio\/x-mpegurl|audio\/mpegurl|application\/pls)/i;
function open(url, hops = 0, extra = {}) {
  return new Promise((resolveP, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method: 'GET', lookup: guardedLookup, agent: false, headers: { 'User-Agent': 'Cadence/1', Accept: '*/*', ...extra }, timeout: 10000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) { res.resume(); return open(new URL(res.headers.location, url).href, hops + 1, extra).then(resolveP, reject); }
      resolveP({ res, req });
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end();
  });
}
// open a stream address (public addresses only); a playlist file (.pls/.m3u) opens its first stream instead
async function openStream(url, extra = {}) {
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('not a stream address'), { code: 400 });
  await assertPublic(url);
  let { res, req } = await open(url, 0, extra);
  if (PLAYLIST.test(res.headers['content-type'] || '') || /\.(pls|m3u8?)$/i.test(new URL(url).pathname)) {
    let text = ''; for await (const c of res) { text += c; if (text.length > 64 * 1024) break; } req.destroy();
    const first = (text.match(/(?:^|\n)\s*(?:File\d+=)?(https?:\/\/[^\s]+)/i) || [])[1];
    if (!first) throw Object.assign(new Error('empty playlist'), { code: 502 });
    await assertPublic(first); ({ res, req } = await open(first, 0, extra));
  }
  return { res, req };
}
// Also the player's relay for anything it plays while a visualizer is on (2026-11-16): a browser can only analyse sound
// from its own server. Seeking passes through (Range → 206), so podcasts can still jump around.
async function relay(url, clientReq, clientRes) {
  const range = clientReq.headers.range && /^bytes=\d*-\d*$/.test(clientReq.headers.range) ? { Range: clientReq.headers.range } : {};
  let { res, req } = await openStream(url, range);
  const type = String(res.headers['content-type'] || '');
  if ((res.statusCode !== 200 && res.statusCode !== 206) || !/^(audio\/|application\/ogg|application\/octet-stream|binary\/octet-stream|video\/mp2t|video\/mp4)/i.test(type)) { req.destroy(); throw Object.assign(new Error('not an audio stream (' + (res.statusCode || '?') + ' ' + type + ')'), { code: 502 }); }
  const h = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  for (const k of ['content-length', 'content-range', 'accept-ranges']) if (res.headers[k]) h[k.replace(/(^|-)\w/g, m => m.toUpperCase())] = res.headers[k];
  clientRes.writeHead(res.statusCode, h);
  res.pipe(clientRes);
  const stop = () => { try { req.destroy(); } catch {} };
  clientReq.on('close', stop); clientRes.on('close', stop); res.on('error', stop);
}

// look the presets up shortly after the NAS starts, so the first visit to Radio doesn't wait
if (!process.env.CI && process.env.RADIO_WARM !== '0') setTimeout(() => { stations().catch(() => {}); }, 20000).unref();

module.exports = { parseWxyc, parseSpinitron, parseWfuv, nyTime, soma, artistCounts, PRESETS, stations, search, nowPlaying, history, follow, playsFor, relay, resolve, shape, best, parseIcy, splitTitle, readIcy };
