'use strict';
/* Music Radar on the NAS (Nick's music-radar app, in server/services/radar/). Once you switch it on in Life → Music
   Radar, it reads music communities on Lemmy and Mastodon every 6 hours (plus blogs, charts and radio as "other
   sources") and writes the weekly digest every 7 days. Off by default. Reddit was removed 2026-11-16 at the user's
   request. Its own data lives in data/radar; optional keys (Last.fm, Spotify, ntfy, and the Anthropic key THING
   already uses) come from the NAS .env and never leave the NAS. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { DATA_DIR } = require('../config');

process.env.RADAR_DATA = process.env.RADAR_DATA || path.join(DATA_DIR, 'radar');
const DIR = process.env.RADAR_DATA;
const SETTINGS = path.join(DIR, 'cadence.json');
const SCAN_EVERY = 6 * 3600e3, DIGEST_EVERY = 7 * 86400e3;

// the app is ES modules; load them on first use
let mods = null;
async function load() {
  if (mods) return mods;
  const m = n => import(pathToFileURL(path.join(__dirname, 'radar', n)).href);
  const [radar, digest, store, data, rss, spotify, sources, srcData] = await Promise.all(['radar.mjs', 'digest.mjs', 'lib/store.mjs', 'lib/dashboard-data.mjs', 'lib/rss.mjs', 'lib/spotify.mjs', 'lib/sources.mjs', 'lib/sources-data.mjs'].map(m));
  return (mods = { radar, digest, store, data, rss, spotify, sources, srcData });
}

const readSettings = () => { try { return { on: false, lastScan: 0, lastDigest: 0, lastError: null, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch { return { on: false, lastScan: 0, lastDigest: 0, lastError: null }; } };
const writeSettings = s => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(s)); };
function settings(patch) { const s = { ...readSettings(), ...(patch || {}) }; if (patch) writeSettings(s); return s; }

// one job at a time: a scan, the digest, or checking the other sources
let job = null;
const log = [];
const note = line => { log.push(`${new Date().toISOString().slice(11, 19)} ${line}`); if (log.length > 60) log.shift(); };
// Everything the scanner prints during a job (Reddit refusals included) goes into the log, and each job is kept
// in the radar_jobs table so the Database view can show what happened even after a restart.
let jobDone = Promise.resolve();   // the running scan/digest, so the scheduler can wait for it
function runJob(kind, fn) {
  if (job) return false;
  job = { kind, since: Date.now() };
  const lines = [], errors = [];
  const tee = orig => (...a) => { orig(...a); const t = a.map(x => (typeof x === 'string' ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(' ').trim(); if (!t) return; lines.push(t); if (/^!|\bHTTP [45]\d\d\b|failed|skipped|error/i.test(t)) errors.push(t); note(t); };
  const keep = { log: console.log, warn: console.warn, error: console.error };
  console.log = tee(keep.log); console.warn = tee(keep.warn); console.error = tee(keep.error);
  note(`${kind} started`);
  const finish = (ok, err) => {
    Object.assign(console, keep);
    const ms = Date.now() - job.since;
    // a scan that reached none of the communities (Lemmy / Mastodon) isn't a success; some failing is normal
    const failed = errors.filter(e => /^!\s+\S+[@#]|^!\s+#/.test(e)), done = lines.filter(l => /: done$/.test(l)).length;
    let problem = err ? `${kind}: ${err.message}` : null;
    if (kind === 'scan') settings({ redditNote: null });
    if (!problem && kind === 'scan' && failed.length && !done) problem = `scan: couldn't reach any of the communities, e.g. ${failed[0].replace(/^!\s*/, '')}.`;
    note(problem ? `${kind} finished with problems` : `${kind} done`);
    settings({ lastError: problem });
    load().then(({ store }) => store.addJob({ ts: Date.now(), kind, ok: !problem, ms, errors: errors.length, problem, lines: lines.slice(-80) })).catch(e => console.error('radar job log', e));
    job = null;
  };
  jobDone = Promise.resolve().then(fn).then(() => { bust(); finish(true); }, e => { console.error('radar', kind, e); bust(); finish(false, e); });
  return true;
}
const runSources = async only => { const { store, sources, srcData } = await load(); console.log('Checking other sources…'); await sources.runSources(srcData.sourcesCfg(), { store, state: store.loadState(), only }); };
const scan = () => runJob('scan', async () => {
  const { radar } = await load();
  await radar.run({ quiet: false, playlist: false });
  settings({ lastScan: Date.now() });
  await runSources();   // each source records its own errors; none of them fails the scan
});
const sourcesNow = only => runJob('sources', () => runSources(only));
async function sourcesSettings(patch) {
  const { store, srcData } = await load(), cur = srcData.sourcesCfg();
  if (patch) {
    const next = { ...cur, ...patch, on: { ...cur.on, ...(patch.on || {}) } };
    if (patch.blogs) next.blogs = patch.blogs.filter(b => b && /^https?:\/\//.test(b.url)).map(b => ({ name: String(b.name || new URL(b.url).hostname).slice(0, 60), url: String(b.url).slice(0, 400), ...(b.tier === 'big' || b.tier === 'small' ? { tier: b.tier } : {}) })).slice(0, 30);
    if (patch.tags) next.tags = patch.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10);
    if (patch.audiusGenres) next.audiusGenres = patch.audiusGenres.map(String).slice(0, 8);
    next.lbUser = String(next.lbUser || '').trim().slice(0, 60); next.appleCountry = String(next.appleCountry || 'ca').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'ca';
    delete next.tagsUsed; store.setKv('sourcesCfg', next); bust();
  }
  return srcData.sourcesCfg();
}
const digestNow = () => runJob('digest', async () => { const { digest } = await load(); await digest.digest({}); settings({ lastDigest: Date.now() }); });

// the schedule: checked every 10 minutes, only while switched on. Through the shared scheduler (lib/scheduler.js), so
// a scan waits while you're using Cadence and never runs at the same time as KEXP's heavy work (2026-11-17).
const sched = require('../lib/scheduler');
sched.add('radar-scan', async () => {
  const s = readSettings(); if (!s.on) return { note: 'Radar is switched off' }; if (job) return { note: 'a scan was already running' };
  const started = Date.now() - s.lastScan >= SCAN_EVERY ? scan() : s.lastScan && Date.now() - s.lastDigest >= DIGEST_EVERY ? digestNow() : false;
  if (!started) return { note: 'nothing due' };
  await jobDone; return { note: job ? null : 'done' };
}, { label: 'Music Radar: scans and the weekly digest', heavy: true, quiet: true, every: 10 * 60e3 });

// Koito's address for a "Your listening" link (the address only; its token stays on the NAS)
function koitoLink() {
  const u = String(process.env.KOITO_URL || '').trim().replace(/\/+$/, '').replace(/\/apis\/listenbrainz(\/1)?$/, '');
  return process.env.KOITO_TOKEN && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}
function status() {
  const s = readSettings();
  // Last.fm keys need Pro from 1 Dec 2026: when it turned the key down, say so (ListenBrainz counts are used instead)
  let lastfmDown = null; try { const r = mods && mods.store.getKv('lastfmRejected'); if (r && process.env.LASTFM_API_KEY && r.key === process.env.LASTFM_API_KEY.slice(-6)) lastfmDown = r.at; } catch {}
  return { ...s, job, log: log.slice(-40), koito: koitoLink(), keys: { ai: !!process.env.ANTHROPIC_API_KEY, lastfm: !!process.env.LASTFM_API_KEY && !lastfmDown, lastfmDown, ntfy: !!process.env.NTFY_TOPIC, spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) } };
}
// ---- raw tables for the Database view (read-only): the radar_* tables in cadence.db, KEXP's in kexp.db ----
async function raw(name, offset = 0, limit = 50) {
  const { store } = await load();
  let K = null; try { K = require('./kexp-log'); } catch (e) {}
  const kt = K ? await K.tables().catch(() => []) : [];
  const ts = (store.tables() || []).filter(t => !kt.some(k => k.name === t.name));
  if (!store.tables() && !kt.length) return { storage: 'files', note: store.storageNote, tables: [] };
  if (!name) return { storage: 'sqlite', file: path.basename(store.DB_FILE), tables: [...ts, ...kt].map(t => ({ name: t.name, count: t.count, bytes: t.bytes ?? null, file: t.file || path.basename(store.DB_FILE), columns: t.columns })) };
  const r = kt.some(t => t.name === name) ? await K.tableRows(name, { offset, limit }) : store.tableRows(name, { offset, limit });
  if (!r) return null;
  r.rows = r.rows.map(row => row.map(v => (typeof v === 'string' && v.length > 600 ? v.slice(0, 600) + '…' : v)));
  return r;
}
// The Radar page's data is kept a minute: building it reads all of Radar (seconds on the NAS), and the page asks
// often. Anything you change in Radar (every POST to /api/radar) starts it fresh (2026-11-17).
// Radar's whole picture takes about 2 s to work out on the NAS, on the music side's main thread, so everything else
// waits meanwhile. It's kept until something changes it (bust(): scans, follows, listening, Not for me, sources,
// feedback), or 15 minutes at most (2026-11-18: it was 60 s, so browsing the music pages rebuilt it every minute).
let dataMemo = { at: 0, v: null, p: null };
let dataGen = 0;   // a rebuild that started before a change doesn't get kept after it
function bust() { dataGen++; dataMemo = { at: 0, v: null, p: null }; }
// soften(): something changed in the background (a listen, hometowns or similar artists arriving). The page keeps the
// copy it has and the NAS works out the new one quietly, so nobody waits for it (2026-11-24). bust() is for your own changes.
function soften() { dataMemo.at = 0; }
const DATA_KEEP = +process.env.RADAR_DATA_KEEP_MS || 15 * 60e3;
async function data() {
  if (dataMemo.v && Date.now() - dataMemo.at < DATA_KEEP) return dataMemo.v;
  if (!dataMemo.p) { const g = dataGen, p = dataFresh().then(v => { if (g === dataGen) dataMemo = { at: Date.now(), v, p: null }; return v; }, e => { if (dataMemo.p === p) dataMemo.p = null; throw e; }); dataMemo.p = p; }
  if (dataMemo.v) { dataMemo.p.catch(() => {}); return dataMemo.v; }   // old copy now, the new one is on its way
  return dataMemo.p;
}
async function dataFresh() { const { store, data } = await load(); return data.dashboardData(store.loadState()); }
// what you listened to (the player sends one line per song heard; nothing about you leaves the NAS)
const fyLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'foryou.mjs')).href);
async function listen(b = {}) {
  const { store } = await load(), { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  const artist = String(b.artist || '').trim().slice(0, 120), kind = ['preview', 'live', 'kexp'].includes(b.kind) ? b.kind : null;
  const secs = Math.max(0, Math.min(3 * 3600, Math.round(+b.secs || 0)));
  if (!artist || !kind || secs < 1) return { ok: false };
  const row = { ts: Math.floor(Date.now() / 1000), artist, artist_key: norm(artist), title: b.title ? String(b.title).slice(0, 200) : null, kind, station: b.station ? String(b.station).slice(0, 80) : null, secs, skipped: !!b.skipped };
  store.addListen(row); soften();
  // and to ListenBrainz, when you've given Cadence your token (in the background: the page doesn't wait)
  if (process.env.LISTENBRAINZ_TOKEN || (process.env.KOITO_URL && process.env.KOITO_TOKEN)) import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'scrobble.mjs')).href).then(S => S.worthSending(row) && S.scrobble(row)).catch(() => {});
  return { ok: true };
}
// the sound of a song, read from its preview in your browser (Essentia.js): tempo, key, danceability, loudness
// your Discogs records (needs DISCOGS_TOKEN): a copy every 6 hours, a summary for the page, wantlist changes when asked
const discogsLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'discogs.mjs')).href);
async function discogs(q = {}) { await load(); const D = await discogsLib(); return D.discogsSummary(q); }
async function discogsIndex() { await load(); const D = await discogsLib(); const ix = D.discogsIndex(); return { artists: [...ix.artists], own: [...ix.own], want: [...ix.want] }; }
async function discogsSync() { await load(); const D = await discogsLib(); const r = await D.discogsSync(); bust(); return r; }
async function discogsWant(b = {}) { await load(); const D = await discogsLib(); const r = await D.discogsWant(b); bust(); return r; }
if (!process.env.CI) {   // the token can arrive later (Settings → Connections): until then the job does nothing
  sched.add('discogs', async () => { if (!process.env.DISCOGS_TOKEN) return undefined; const r = await discogsSync(); return r && r.records != null ? { note: `Discogs: ${r.records} records, ${r.wants} wanted` } : undefined; },
    { label: 'Discogs: your collection and wantlist', quiet: true, every: 6 * 3600e3, first: 2 * 60e3, retry: 3600e3 });
}
async function sound(b = {}) {
  const S = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'sound.mjs')).href);
  const r = S.keepSound(b); if (r.ok) bust(); return r;
}
async function notForMe(b) {
  const F = await fyLib();
  if (b && b.type) { F.setNfm(String(b.type), b.value, b.on !== false); bust(); }
  return F.nfmCfg();
}
// Friday mix, Out this week, Called it (radar/lib/extras.mjs)
const exLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extras.mjs')).href);
const kexpHeavy = () => { try { const K = require('./kexp-log'); return !K.isOn() ? () => null : n => K.heavyFirst(n); } catch (e) { return () => null; } };
async function releases() { return (await exLib()).releases(); }
// getting music (services/getmusic.js): picks up after a restart; new singles from artists you follow (only when that's
// switched on in Downloads), better copies for songs that came from YouTube or SoundCloud, and keeping yt-dlp current
{
  const G = require('./getmusic'); G.resume();
  if (!process.env.CI) {
    sched.add('get-singles', async () => {
      if (!G.settingsOn || !G.settingsOn()) return undefined;
      const { store } = await load(), X = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
      const follows = new Set((store.getKv('follows', []) || []).map(f => f.key));
      const n = G.newSingles(((await releases()).thisWeek || []).filter(r => follows.has(X.norm(r.artist)) && r.date <= new Date().toISOString().slice(0, 10)));
      return n ? { note: `Getting ${n} new single${n === 1 ? '' : 's'} from artists you follow` } : undefined;
    }, { label: 'Downloads: new singles from artists you follow', quiet: true, every: 12 * 3600e3, first: 20 * 60e3, retry: 3600e3 });
    sched.add('get-better', async () => { const n = G.upgradeSome(); return n ? { note: `Looking for better copies of ${n} songs` } : undefined; },
      { label: 'Downloads: better copies of songs from YouTube or SoundCloud', quiet: true, every: 24 * 3600e3, first: 40 * 60e3, retry: 3600e3 });
    sched.add('ytdlp-update', async () => (await G.updateYtdlp()) ? { note: 'yt-dlp brought up to date' } : undefined,
      { label: 'Downloads: keep yt-dlp up to date', quiet: true, every: 7 * 86400e3, first: 90 * 60e3, retry: 6 * 3600e3 });
  }
}
async function mix({ week, again } = {}) {
  const X = await exLib();
  if (week && week !== X.mixWeek()) return X.pastMix(String(week)) || { error: 'No mix that week' };
  // this week's mix is made once and kept: hand it back without working out all of Radar first (that took ~2 s)
  if (!again) { const kept = X.mixKept(); if (kept) return kept; }
  return X.fridayMix(await data(), { again: !!again, rel: X.releases() });
}
let called = { v: null, at: 0, running: false };
async function calledIt() {
  const { store } = await load();
  if (!called.v) { const kept = store.getKv('calledIt'); if (kept && kept.v) called = { ...called, v: kept.v, at: kept.at }; }
  if (!called.running && (!called.v || Date.now() - called.at > 3600e3)) {
    called.running = true;
    let kexp = false; try { kexp = require('./kexp-log').isOn(); } catch (e) {}
    const { Worker } = require('worker_threads');
    try {
      const w = new Worker(path.join(__dirname, 'radar', 'called-worker.mjs'), { workerData: { kexp, dbFile: require('./kexp-log').FILE } });
      w.once('message', m => { if (m && m.v) { called.v = m.v; called.at = Date.now(); try { store.setKv('calledIt', { v: m.v, at: called.at }); } catch (e) {} } else if (m && m.error) console.error('radar called it', m.error); });
      w.once('error', e => console.error('radar called it', e.message));
      w.once('exit', () => { called.running = false; });
    } catch (e) { called.running = false; console.error('radar called it', e.message); }
  }
  return called.v ? { ...called.v, list: called.v.all.slice(0, 12) } : { list: [], count: 0, median: null, pending: true };
}
// Close to home (user, 2026-11-16): Kingston and Canadian artists, from what Cadence already hears:
//   Kingston  Kingston Live listings, CFRC (Queen's) and Amherst Island Radio plays, MusicBrainz "from Kingston"
//   Canada    the !earshot campus charts, Canadian campus stations' plays, MusicBrainz / TheAudioDB country
// "Local and rising": the same artists ranked by how much they're being talked about across Radar's sources.
const KINGSTON_STATIONS = ['cfrc', 'cjai'], CANADA_STATIONS = ['ciut', 'cjru', 'chry', 'ckut'];
// Wikidata hometowns for Close to home's artists (and the ones you like), twice a day; the page reads only what's kept
let closeCandidates = [];
if (!process.env.CI && process.env.RADAR_WIKIDATA !== '0') {
  sched.add('wd-origin', async () => {
    const { store } = await load(), O = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'origin.mjs')).href), F = await fyLib();
    if (!closeCandidates.length) await closeToHome().catch(() => {});
    const liked = [...F.tasteProfile(store.loadState()).artists.values()].filter(a => a.w > 0).map(a => ({ name: a.name, mbid: (store.getKv('mba:' + a.key) || {}).mbid })).filter(a => a.mbid);
    const n = await O.originWarm([...closeCandidates, ...liked]);
    if (n) soften();
    return n ? { note: `Wikidata: hometowns for ${n} artists` } : undefined;
  }, { label: 'Wikidata: where artists are from (Close to home)', quiet: true, every: 12 * 3600e3, first: 8 * 60e3, retry: 3600e3 });
}
async function closeToHome() {
  const { store } = await load(), { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  const t = Math.floor(Date.now() / 1000), A = new Map();
  const hit = (name, where, why, w) => {
    if (!name) return; const k = norm(name); if (!k) return;
    const a = A.get(k) || { artist: name, key: k, kingston: 0, canada: 0, why: [] }; A.set(k, a);
    a[where] += w; if (!a.why.includes(why)) a.why.push(why);
  };
  const R = require('./radio'), stName = id => (R.PRESETS.find(x => x.id === id) || {}).name || id;
  for (const r of R.artistCounts(KINGSTON_STATIONS, t - 60 * 86400)) hit(r.artist, 'kingston', `played on ${stName(r.station)}${r.n > 1 ? ` ${r.n} times` : ''}`, Math.min(5, 1 + r.n));
  for (const r of R.artistCounts(CANADA_STATIONS, t - 60 * 86400)) hit(r.artist, 'canada', `played on ${stName(r.station)}`, Math.min(3, r.n) * 0.6);
  let shows = []; try { const S = await showsLib(); shows = S.cachedShows(); if (!shows.length) { await (await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'shows.mjs')).href)).shows([]).catch(() => {}); shows = S.cachedShows(); } } catch (e) {}
  for (const e of shows.filter(x => String(x.id).startsWith('kl:'))) for (const a of (e.artists || []).slice(0, 4)) hit(a, 'kingston', `playing ${e.venue || 'Kingston'}${e.date ? ' on ' + new Date(e.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}`, 3);
  for (const s of store.signals({ since: t - 60 * 86400, source: 'earshot', limit: 2000 })) hit(s.artist, 'canada', `on the !earshot charts${s.best_rank ? ' (best #' + s.best_rank + ')' : ''}`, 2);
  // MusicBrainz / TheAudioDB answers already kept for these (no new look-ups from here)
  for (const a of A.values()) {
    const mb = store.getKv('mba:' + a.key) || {}, ad = store.getKv('adb:' + a.key) || {}, wd = store.getKv('wdo:' + a.key);
    // Wikidata's place, by distance from home, when known (2026-11-17); otherwise MusicBrainz's area, Jamaica aside
    if (wd && !wd.none) {
      if (wd.km <= 60) { a.kingston += 4; a.why.unshift(wd.km < 5 ? `from ${wd.place}` : `from ${wd.place}, ${wd.km} km away`); }
      else if (wd.canada) { a.canada += 2; a.why.unshift(`from ${wd.place}`); }
    } else if (/kingston/i.test(mb.from || '') && mb.country !== 'JM') { a.kingston += 3; a.why.unshift('from Kingston'); }
    else if (mb.country === 'CA' || /canada/i.test(ad.country || '')) { a.canada += 2; a.why.unshift('Canadian'); }
  }
  // how much Radar's sources are talking about them: mentions in the last 30 days
  const buzz = new Map(); try { for (const r of store.signals({ since: t - 30 * 86400, limit: 50000 })) { const k = r.artist_key || norm(r.artist); if (A.has(k)) buzz.set(k, (buzz.get(k) || 0) + 1); } } catch (e) {}
  let nfm = new Set(); try { nfm = new Set((await fyLib()).nfmCfg().artists.map(norm)); } catch (e) {}
  closeCandidates = [...A.values()].map(a => ({ name: a.artist, mbid: (store.getKv('mba:' + a.key) || {}).mbid })).filter(a => a.mbid);
  const list = [...A.values()].filter(a => !nfm.has(a.key)).map(a => ({ ...a, buzz: buzz.get(a.key) || 0, why: a.why.slice(0, 3) }));
  const rank = (x, y) => (y.buzz - x.buzz) || ((y.kingston + y.canada) - (x.kingston + x.canada));
  return {
    kingston: list.filter(a => a.kingston > 0).sort((x, y) => (y.kingston - x.kingston) || (y.buzz - x.buzz)).slice(0, 15),
    canada: list.filter(a => a.canada > 0 && !a.kingston).sort((x, y) => (y.canada - x.canada) || (y.buzz - x.buzz)).slice(0, 15),
    rising: list.filter(a => a.buzz > 0).sort(rank).slice(0, 10),
  };
}
// Your year in music (user, 2026-11-16): from what you actually listened to (radar_listens), a calm recap
async function yearInMusic(y) {
  const { store } = await load(), F = await fyLib(), X = await exLib();
  const year = +y || new Date().getFullYear(), from = Math.floor(new Date(year, 0, 1) / 1000), to = Math.floor(new Date(year + 1, 0, 1) / 1000);
  const rows = store.listensSince(from, 200000).filter(r => r.ts < to && r.artist);
  const years = [...new Set(store.listensSince(0, 200000).map(r => new Date(r.ts * 1000).getFullYear()))].sort().reverse();
  const by = new Map(), st = new Map(), months = Array(12).fill(0);
  let secs = 0, previews = 0, live = 0;
  for (const r of rows) {
    if (r.kind === 'preview' && r.skipped) continue;
    secs += r.secs; months[new Date(r.ts * 1000).getMonth()] += r.secs;
    if (r.kind === 'preview') previews++; else { live++; if (r.station) st.set(r.station, (st.get(r.station) || 0) + r.secs); }
    const a = by.get(r.artist_key) || { artist: r.artist, key: r.artist_key, secs: 0, n: 0, first: r.ts, songs: new Set() }; by.set(r.artist_key, a);
    a.secs += r.secs; a.n++; a.first = Math.min(a.first, r.ts); if (r.title) a.songs.add(r.title);
  }
  const artists = [...by.values()].sort((a, b) => b.secs - a.secs);
  // genres of the artists you spent the most time with
  const G = new Map(), state = store.loadState();
  for (const a of artists.slice(0, 40)) for (const [g, n] of F.genresOf(a.key, state)) G.set(g, (G.get(g) || 0) + a.secs * Math.min(1, n / 2));
  // found early: artists you listened to before the Apple chart or KEXP heavy rotation caught up
  const early = [];
  for (const a of artists.slice(0, 80)) {
    const c = X.calledItFor(state, a.artist, { kexpHeavy: kexpHeavy() }); if (!c || !c.milestones.length) continue;
    const m = c.milestones.map(m => ({ ...m, mine: Math.round((Date.parse(m.at) / 1000 - a.first) / 86400) })).filter(m => m.mine >= 3).sort((p, q) => q.mine - p.mine)[0];
    if (m) early.push({ artist: a.artist, days: m.mine, what: m.what });
  }
  const follows = (store.getKv('follows', []) || []).filter(f => f.since >= from && f.since < to).length;
  const secOf = v => (typeof v === 'number' ? v / 1000 : Date.parse(v) / 1000), saved = (store.getKv('wantToHear', []) || []).filter(w => w.at && secOf(w.at) >= from && secOf(w.at) < to).length;
  return {
    year, years: years.length ? years : [year], minutes: Math.round(secs / 60), songs: rows.length, previews, live, artistsCount: artists.length, follows, saved,
    artists: artists.slice(0, 15).map(a => ({ artist: a.artist, minutes: Math.round(a.secs / 60), plays: a.n, songs: [...a.songs].slice(0, 3) })),
    stations: [...st].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([station, s]) => ({ station, minutes: Math.round(s / 60) })),
    genres: [...G].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g),
    months: months.map(s => Math.round(s / 60)),
    early: early.sort((a, b) => b.days - a.days).slice(0, 8),
  };
}
// Mixcloud (user, 2026-11-16): shows by the KEXP DJs who play your favourite artists most (KEXP history), found with
// Mixcloud's public search (no key). Favourites: who you listened to most this year, then who you follow. Kept 6 hours.
let mcCache = { at: 0, v: null };
async function mixcloud({ refresh } = {}) {
  if (mcCache.v && !refresh && Date.now() - mcCache.at < 6 * 3600e3) return mcCache.v;
  const { store } = await load(), { safeFetch } = require('../lib/net');
  let K = null; try { K = require('./kexp-log'); if (!K.isOn()) K = null; } catch (e) {}
  if (!K) return { djs: [], note: 'Mixcloud picks come from KEXP history, which is off on this NAS.' };
  const favs = new Map();
  for (const r of store.listensSince(Math.floor(Date.now() / 1000) - 365 * 86400, 20000)) if (!(r.kind === 'preview' && r.skipped)) favs.set(r.artist, (favs.get(r.artist) || 0) + r.secs);
  for (const f of store.getKv('follows', []) || []) favs.set(f.name, (favs.get(f.name) || 0) + 3600);
  const top = [...favs].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([a]) => a);
  if (!top.length) return { djs: [], note: 'Follow a few artists or listen for a while, and shows from the DJs who play them show up here.' };
  const D = new Map();
  let rows = []; try { rows = await K.djsFor(top); } catch (e) {}
  for (const d of rows) for (const host of String(d.hosts || '').split(/,\s*/).filter(Boolean)) {
    const a = top.find(t => t.toLowerCase() === String(d.artist || '').toLowerCase()) || d.artist;
    const x = D.get(host) || { dj: host, program: d.program, plays: 0, because: [] }; D.set(host, x); x.plays += d.plays; if (!x.because.includes(a)) x.because.push(a); }
  const djs = [...D.values()].sort((a, b) => b.plays - a.plays).slice(0, 5), base = (process.env.MIXCLOUD_API || 'https://api.mixcloud.com').replace(/\/$/, '');
  for (const d of djs) {
    try {
      const r = await safeFetch(`${base}/search/?q=${encodeURIComponent(d.dj + ' KEXP')}&type=cloudcast&limit=10`, { headers: { Accept: 'application/json' }, timeout: 8000 }, 1024 * 1024);
      const words = d.dj.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      d.shows = (JSON.parse(r.buf.toString('utf8')).data || []).filter(c => { const t = ((c.name || '') + ' ' + ((c.user || {}).name || '')).toLowerCase(); return words.some(w => t.includes(w)); })
        .slice(0, 4).map(c => ({ name: String(c.name || '').slice(0, 160), url: c.url, key: c.key, by: (c.user || {}).name || null, at: c.created_time || null, mins: c.audio_length ? Math.round(c.audio_length / 60) : null, art: (c.pictures || {}).medium || null }));
    } catch (e) { d.shows = []; d.error = 'Mixcloud didn\'t answer'; }
  }
  mcCache = { at: Date.now(), v: { djs: djs.filter(d => (d.shows || []).length || d.error) } };
  return mcCache.v;
}
async function feedback(id, v) {
  const { store } = await load(); const state = store.loadState();
  if (!state.picks.some(p => p.id === id)) return false;
  if (v === 0) delete state.feedback[id]; else state.feedback[id] = v > 0 ? 1 : -1;
  store.saveState(state);
  // keep the cached page and just mark this pick (2026-11-24: throwing the cache away made the page's refresh rebuild
  // everything on the NAS, and on a phone those requests failed with "Load failed")
  const pk = dataMemo.v && Array.isArray(dataMemo.v.picks) && dataMemo.v.picks.find(p => p.id === id);
  if (pk) pk.feedback = v === 0 ? 0 : v > 0 ? 1 : -1; else bust();
  return true;
}
// community sources (Lemmy communities, Mastodon hashtags) and the mainstream filter
async function community(input) {
  const { store } = await load();
  const F = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'fediverse.mjs')).href);
  const M = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'mainstream.mjs')).href);
  const lines = v => Array.isArray(v) ? v : String(v || '').split(/[\n,]+/);
  if (input) {
    const cur = store.getKv('fediCfg', {}) || {}, next = { ...cur };
    delete next.reddit;
    if (input.communities !== undefined) next.communities = [...new Set(lines(input.communities).map(F.parseCommunity).filter(Boolean).map(c => `${c.name}@${c.host}`))].slice(0, 40);
    if (input.tags !== undefined) next.tags = [...new Set(lines(input.tags).map(F.parseTag).filter(Boolean).map(t => '#' + t.tag + (t.host === 'mastodon.social' ? '' : '@' + t.host)))].slice(0, 20);
    store.setKv('fediCfg', next);
    if (input.mainstream) M.saveMainstreamCfg(input.mainstream);
    bust();   // the mainstream list hides picks
  }
  const f = store.getKv('fediCfg', {}) || {};
  return { communities: f.communities || F.DEFAULT_COMMUNITIES, tags: f.tags || F.DEFAULT_TAGS, mainstream: M.mainstreamCfg() };
}
// one artist, everything known (Radar + sources + charts + KEXP + MusicBrainz)
// Artist pages are kept once built (user, 2026-11-16: "should cache and update in background … its slow"): opening one
// answers from the kept copy at once and rebuilds it behind the scenes when it's over 15 minutes old (or MusicBrainz
// was still being asked); pages opened in the last 60 days are refreshed hourly. ?fresh=1 waits for a new build.
const PAGE_FRESH = 15 * 60e3, building = new Map();
const storeLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'store.mjs')).href);
async function artist(name, { fresh = false } = {}) {
  name = String(name || '').trim().slice(0, 120); if (!name) return null;
  const { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href), S = await storeLib();
  const key = norm(name); let kept = null;
  if (!fresh) try { kept = S.getPage(key); } catch (e) { kept = null; }
  const rebuild = () => {
    if (!building.has(key)) building.set(key, buildArtist(name).then(d => { if (d) try { S.setPage(key, d); } catch (e) {} return d; }).finally(() => building.delete(key)));
    return building.get(key);
  };
  if (!kept) return rebuild();
  const age = Date.now() - kept.at;
  if (age > PAGE_FRESH || kept.d.mbPending || kept.d.adbPending) rebuild().catch(e => console.error('artist page', e.message));
  return { ...kept.d, cachedAt: kept.at, refreshing: building.has(key) };
}
// keep recently opened pages warm: hourly, one page every few seconds
if (!process.env.CI && process.env.ARTIST_WARM !== '0') {
  const warm = async () => {
    try {
      const S = await storeLib();
      for (const r of S.pagesToRefresh(55 * 60e3, 40)) { if (r.name) { await artist(r.name, { fresh: true }).catch(() => {}); await new Promise(f => setTimeout(f, 3000).unref()); } }
    } catch (e) { console.error('artist warm', e.message); }
  };
  sched.add('artist-warm', warm, { label: 'Artist pages: keeping recent ones fresh', heavy: true, quiet: true, every: 3600e3, first: 120e3 });
}
// ListenBrainz similar artists for the ones you like (For you's links), a few a second, every 6 hours
if (!process.env.CI && process.env.RADAR_LB_SIMILAR !== '0') {
  sched.add('lb-similar', async () => {
    const { store } = await load(), F = await fyLib(), Sim = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'similar.mjs')).href);
    const liked = [...F.tasteProfile(store.loadState()).artists.values()].filter(a => a.w > 0).sort((a, b) => b.w - a.w).map(a => a.name);
    const n = await Sim.lbWarm(liked);
    if (n) soften();
    return n ? { note: `ListenBrainz: similar artists for ${n} of yours` } : undefined;
  }, { label: 'ListenBrainz: similar artists for the ones you like', quiet: true, every: 6 * 3600e3, first: 5 * 60e3, retry: 3600e3 });
}
async function buildArtist(name) {
  const A = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'artist.mjs')).href);
  let kexp = null; try { const K = require('./kexp-log'); if (K.isOn()) kexp = K.artist(name); } catch (e) { kexp = null; }
  const d = A.artistData(name, { kexp });
  if (d) try { d.stg = (await stgLib()).stgFor(d.name).concat(d.name !== name ? (await stgLib()).stgFor(name) : []).filter((x, i, l) => l.findIndex(y => y.year === x.year && y.kind === x.kind && y.title === x.title) === i); } catch (e) { d.stg = []; }
  if (d) try { d.similar = await (await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'similar.mjs')).href)).similar(d.name); } catch (e) { d.similar = []; }
  if (d) try { const { store } = await load(); d.called = (await exLib()).calledItFor({ artists: { [d.key]: store.artistRecord(d.key) || {} } }, d.name, { kexpHeavy: kexpHeavy() }); } catch (e) { d.called = null; }
  return d;
}
// ---- Said the Gramophone's yearly best-of lists: read once in the background (a page every few seconds), then the
// newest year is looked for again daily around December/January. STG=0 turns it off; off under CI unless STG=1.
const stgLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'stg.mjs')).href);
const STG_ON = process.env.STG === '1' || (process.env.STG !== '0' && !process.env.CI);
if (STG_ON) {
  sched.add('stg', () => stgLib().then(S => S.stgImport()), { label: "Said the Gramophone's best-of lists", heavy: true, quiet: true, every: 24 * 3600e3, first: Number(process.env.STG_DELAY_MS || 90e3), retry: 3600e3 });
}
async function stg({ year, refresh } = {}) {
  const S = await stgLib();
  if (refresh) S.stgImport({ force: refresh === 'all' }).catch(e => console.error('stg import', e.message));
  return { ...S.stgData(year ? Number(year) : null), on: STG_ON };
}
// ---- listening: 30-second previews from Deezer (public API, no key) and the Want to hear list ----
// Preview addresses are signed and expire, so they're fetched when you press play and kept only half an hour.
const DEEZER = () => (process.env.DEEZER_API || 'https://api.deezer.com').replace(/\/$/, '');
const previewCache = new Map();
async function preview({ artist, title }) {
  artist = String(artist || '').trim().slice(0, 120); title = String(title || '').trim().slice(0, 200);
  if (!artist) throw Object.assign(new Error('Which artist?'), { code: 400 });
  const ck = (artist + '|' + title).toLowerCase(), hit = previewCache.get(ck);
  if (hit && Date.now() - hit.at < 30 * 60e3) return hit.v;
  const { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  const { safeFetch } = require('../lib/net');
  const get = async u => JSON.parse((process.env.DEEZER_API ? Buffer.from(await (await fetch(u)).arrayBuffer()) : (await safeFetch(u, { headers: { Accept: 'application/json' }, timeout: 8000 })).buf).toString('utf8'));
  const q = s => `"${s.replace(/"/g, '')}"`, want = norm(artist), same = t => t && t.artist && norm(t.artist.name) === want && t.preview;
  let track = null;
  if (title) {
    for (const field of ['track', 'album']) {   // the pick might be a song or a record
      const r = await get(`${DEEZER()}/search?limit=10&q=${encodeURIComponent(`artist:${q(artist)} ${field}:${q(title)}`)}`);
      track = (r.data || []).find(same); if (track) break;
    }
  }
  if (!track) {   // no title, or nothing matched: their most popular track
    const r = await get(`${DEEZER()}/search/artist?limit=5&q=${encodeURIComponent(artist)}`);
    const a = (r.data || []).find(x => norm(x.name) === want);
    if (a) { const top = await get(`${DEEZER()}/artist/${a.id}/top?limit=5`); track = (top.data || []).find(t => t.preview) || null; }
  }
  const v = track ? { found: true, preview: track.preview, title: track.title, artist: track.artist.name, album: track.album && track.album.title, cover: track.album && (track.album.cover_medium || track.album.cover) || null, link: track.link || null, exact: !!title && norm(track.title) === norm(title) }
    : { found: false };
  previewCache.set(ck, { at: Date.now(), v });
  return v;
}
// ---- artist search suggestions (user, 2026-11-17: "the artist search sucks, can we have suggested?") ----
// As you type on Music → Artists: artists you already know about (Radar, KEXP history through its search index) and
// Deezer's artist search (public, no key: photo, fans, albums). Deezer answers are kept a day; it gets 2.5 s, and the
// local ones show without it if it's slow or unreachable. Under CI it's skipped unless DEEZER_API points at a fake.
const findCache = new Map();
async function deezerArtists(q) {
  if (process.env.CI && !process.env.DEEZER_API) return [];
  const k = q.toLowerCase(), hit = findCache.get(k); if (hit && Date.now() - hit.at < 864e5) return hit.v;
  const { safeFetch } = require('../lib/net'), u = `${DEEZER()}/search/artist?limit=8&q=${encodeURIComponent(q)}`;
  const buf = process.env.DEEZER_API ? Buffer.from(await (await fetch(u)).arrayBuffer()) : (await safeFetch(u, { headers: { Accept: 'application/json' } }, 512 * 1024)).buf;
  const v = (JSON.parse(buf.toString('utf8')).data || []).filter(a => a && a.name).map(a => ({ name: a.name, image: a.picture_medium || a.picture || null, fans: a.nb_fan || 0, albums: a.nb_album || 0, deezer: a.link || null }));
  findCache.set(k, { at: Date.now(), v }); if (findCache.size > 500) findCache.delete(findCache.keys().next().value);
  return v;
}
async function find(q) {
  q = String(q || '').trim().slice(0, 80); if (q.length < 2) return [];
  const { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  const { store } = await load();
  let K = null; try { K = require('./kexp-log'); if (!K.isOn()) K = null; } catch (e) {}
  const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms).unref())]);
  const [radar, kexp, dz] = await Promise.all([
    Promise.resolve().then(() => store.findArtists(q, 8)).catch(() => []),
    K ? within(K.search({ q, group: 'artist', limit: 8 }), 2500).catch(() => null) : null,
    within(deezerArtists(q), 2500).catch(() => null),
  ]);
  const want = norm(q), by = new Map(), get = name => { const k = norm(name); if (!k) return null; if (!by.has(k)) by.set(k, { name, key: k, score: 0 }); return by.get(k); };
  (dz || []).forEach((a, i) => { const x = get(a.name); if (!x) return; Object.assign(x, { image: a.image, fans: a.fans, albums: a.albums, deezer: a.deezer }); if (i === 0 || x.name !== a.name && a.fans > (x.fans || 0)) x.name = a.name; x.score += 40 - i * 4 + Math.log10(1 + a.fans) * 4; });
  for (const a of radar || []) { const x = get(a.name); if (x) { x.radar = true; x.score += 30; } }
  for (const a of kexp || []) { const x = get(a.artist); if (x) { x.kexp = a.plays; x.score += 20 + Math.log10(1 + a.plays) * 6; } }
  for (const x of by.values()) { if (x.key === want) x.score += 200; else if (x.key.startsWith(want)) x.score += 50; }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, 8).map(({ score, key, ...x }) => x);
}
// Want to hear: a list on the NAS (same in both spaces and on every device)
// ---- following artists (user, 2026-11-16): a list kept on the NAS, and calm notes about what's new for each since you
// last looked: blog posts, chart entries, releases (every Radar source), KEXP plays, plays on stations whose history is
// kept, and nearby shows. radar_kv: follows [{ name, key, since }], followSeen { key: unix s }, followShows [ids].
const CHART_SRC = new Set(['apple', 'audius', 'lastfm', 'lbcharts', 'hypem', 'earshot', 'kexpchart']);
async function follow(input = {}) {
  const { store } = await load(), X = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  let list = store.getKv('follows', []) || [];
  const now = Math.round(Date.now() / 1000);
  if (input.add) { const name = String(input.add).trim().slice(0, 120), key = X.norm(name);
    if (key && !list.some(f => f.key === key)) list = [{ name, key, since: now }, ...list].slice(0, 500); }
  if (input.remove) { const key = X.norm(String(input.remove)); list = list.filter(f => f.key !== key); }
  if (input.add || input.remove) { store.setKv('follows', list); bust(); }
  // following someone takes them off your mainstream list (and the automatic checks skip them: mainstream.mjs)
  if (input.add) { try { const M = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'mainstream.mjs')).href), c = M.mainstreamCfg(), key = X.norm(String(input.add));
    if (c.list.some(n => X.norm(n) === key)) M.saveMainstreamCfg({ ...c, list: c.list.filter(n => X.norm(n) !== key) }); } catch (e) { console.warn('follow: mainstream list', e.message); } }
  if (input.seen) { const seen = store.getKv('followSeen', {}) || {}; for (const f of list) if (input.seen === true || X.norm(input.seen) === f.key) seen[f.key] = now; store.setKv('followSeen', seen);
    if (input.seen === true) { try { const S = await showsLib(); store.setKv('followShows', [...new Set([...(store.getKv('followShows', []) || []), ...S.cachedShows().map(e => e.id)])].slice(-2000)); } catch {} } }
  return { follows: list, news: input.news === false ? [] : await followNews(list) };
}
async function followNews(list) {
  const { store } = await load(), X = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
  let SRC = {}; try { SRC = (await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'sources.mjs')).href)).SOURCES; } catch {}
  const seen = store.getKv('followSeen', {}) || {}, shownShows = new Set(store.getKv('followShows', []) || []);
  let K = null; try { K = require('./kexp-log'); if (!K.isOn()) K = null; } catch { K = null; }
  let R = null; try { R = require('./radio'); } catch { R = null; }
  let shows = []; try { shows = (await showsLib()).cachedShows(); } catch {}
  const out = [], iso = sec => new Date(sec * 1000).toISOString(), src = id => (SRC[id] && SRC[id].name) || id;
  for (const f of list) {
    const since = Math.max(f.since || 0, seen[f.key] || 0);
    for (const s of store.signalsFor(f.key, 100)) {
      if (s.first_seen <= since || s.source === 'kexp') continue;   // KEXP plays are counted below
      const t = s.title && s.title !== s.artist ? s.title : null;
      const text = CHART_SRC.has(s.source) ? `On ${s.source === 'kexpchart' ? 'KEXP\'s charts' + (s.feed ? ' (' + s.feed + ')' : '') : src(s.source)}${s.best_rank ? ' at #' + s.best_rank : ''}${t ? ': ' + t : ''}`
        : s.source === 'blogs' ? `${s.feed || 'A blog'} wrote about them${t ? ': ' + t : ''}`
        : /album|ep|release/.test(s.type || '') ? `New release${t ? ': ' + t : ''} (${src(s.source)})` : `Mentioned on ${src(s.source)}${t ? ': ' + t : ''}`;
      out.push({ artist: f.name, key: f.key, kind: CHART_SRC.has(s.source) ? 'chart' : s.source === 'blogs' ? 'blog' : 'release', text, url: s.url || null, at: iso(s.first_seen) });
    }
    if (K) { const p = K.playsSince(f.name, since); if (p.length) out.push({ artist: f.name, key: f.key, kind: 'kexp', at: iso(p[0].at),
      text: `KEXP played them ${p.length === 1 ? 'once' : p.length === 2 ? 'twice' : p.length + (p.length === 20 ? '+' : '') + ' times'}: latest “${p[0].song || 'a song'}”${p[0].program ? ' on ' + p[0].program : ''}` }); }
    if (R) { const p = R.playsFor(f.name, since); const by = {}; for (const x of p) (by[x.name] ||= []).push(x);
      for (const [st, l] of Object.entries(by)) out.push({ artist: f.name, key: f.key, kind: 'radio', at: iso(l[0].at), text: `${st} played “${l[0].song || 'a song'}”${l.length > 1 ? ` and ${l.length - 1} more` : ''}` }); }
    for (const e of shows) if (!shownShows.has(e.id) && e.artists.some(a => X.norm(a) === f.key))
      out.push({ artist: f.name, key: f.key, kind: 'show', at: new Date().toISOString(), url: e.url || null, showId: e.id, text: `Playing ${e.venue || 'nearby'}${e.city ? ', ' + e.city : ''} on ${e.date || 'a date to be announced'}` });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200);
}
// ---- local shows: concerts near home, matched to artists you care about (radar/lib/shows.mjs) ----
const showsLib = () => import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'shows.mjs')).href);
// Where an artist has turned up anywhere Cadence looks (user, 2026-11-16: "used to show where they were mentioned, if
// they were mentioned on any source"): Radar's sources and communities, Said the Gramophone, KEXP, your radio stations.
// Short plain phrases, kept 10 minutes per name.
const heardCache = new Map();
async function heardFor(name) {
  const k = String(name || '').toLowerCase().trim(); if (!k) return [];
  const hit = heardCache.get(k); if (hit && Date.now() - hit.at < 10 * 60e3) return hit.v;
  const out = [];
  try {
    const { store } = await load(), { norm } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'extract.mjs')).href);
    const { SOURCES } = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'sources.mjs')).href);
    const key = norm(name), sig = store.signalsFor(key, 100);
    const names = [...new Set(sig.map(s => (s.source === 'blogs' && s.feed) || (s.source === 'community' ? 'Lemmy & Mastodon' : (SOURCES[s.source] && SOURCES[s.source].name) || s.source)))];
    if (names.length) out.push(names.slice(0, 4).join(', ') + (names.length > 4 ? ` and ${names.length - 4} more` : ''));
    if (store.picksForArtist(key, name).some(p => p.key === key || norm(p.artist || '') === key) && !names.includes('Lemmy & Mastodon')) out.push('Lemmy & Mastodon');
  } catch (e) {}
  try { const g = (await stgLib()).stgFor(name); if (g.length) { const ys = [...new Set(g.map(x => x.year))]; out.push(`Said the Gramophone's best-of ${ys.slice(0, 3).join(', ')}${ys.length > 3 ? ' and earlier' : ''}`); } } catch (e) {}
  try { const K = require('./kexp-log'); const n = K.playCount(name); if (n) out.push(`KEXP (${n.toLocaleString('en-CA')} play${n === 1 ? '' : 's'})`); } catch (e) {}
  try { const n = require('./radio').playsFor(name, 0, 500).length; if (n) out.push(`your radio stations (${n} play${n === 1 ? '' : 's'})`); } catch (e) {}
  heardCache.set(k, { v: out, at: Date.now() }); if (heardCache.size > 3000) heardCache.clear();
  return out;
}
async function shows(input = {}) {
  const S = await showsLib(), { store } = await load();
  if (input.settings) S.saveShowsCfg(input.settings);
  const interest = [];
  const add = (name, why) => { if (name) interest.push({ name: String(name).slice(0, 120), why }); };
  for (const f of store.getKv('follows', []) || []) add(f.name, 'You follow them');
  for (const w of store.getKv('wantToHear', []) || []) add(w.artist, 'In your Want to hear');
  for (const r of (Array.isArray(input.recent) ? input.recent : []).slice(0, 40)) add(r, 'You looked them up');
  try { const d = await data(); for (const r of [...(d.rise.top || []), ...(d.rise.risers || [])]) add(r.artist, 'Climbing on Music Radar');
    for (const a of ((d.sources && d.sources.combined) || []).slice(0, 30)) add(a.artist, 'Showing up in ' + Object.keys(a.sources).length + ' Radar sources'); } catch {}
  try { const K = require('./kexp-log'); if (K.isOn()) for (const a of await K.top({ by: 'artist', period: 'year', limit: 80 })) add(a.artist, `KEXP played them ${a.plays} times this year`); } catch {}
  try { const G = (await stgLib()).stgData(); for (const a of G.artists.slice(0, 60)) add(a.artist, `On Said the Gramophone's best-of ${a.n} time${a.n === 1 ? '' : 's'}`); } catch {}
  const r = await S.shows(interest, { force: !!input.refresh });
  // each act in a lineup: where they've turned up (only acts with something to say)
  for (const e of [...(r.matches || []), ...(r.local || []), ...(r.nearby || [])]) {
    const heard = [];
    for (const a of (e.artists || []).slice(0, 8)) { const h = await heardFor(a); if (h.length) heard.push({ artist: a, where: h }); }
    if (heard.length) e.heard = heard;
  }
  return r;
}
async function want(input) {
  const { store } = await load();
  let list = store.getKv('wantToHear', []) || [];
  if (input && input.add && input.add.artist) {
    const it = { artist: String(input.add.artist).slice(0, 120), title: input.add.title ? String(input.add.title).slice(0, 200) : null, type: input.add.type || null, from: input.add.from ? String(input.add.from).slice(0, 60) : null, at: Date.now() };
    const k = x => (x.artist + '|' + (x.title || '')).toLowerCase();
    if (!list.some(x => k(x) === k(it))) list = [it, ...list].slice(0, 300);
  }
  if (input && input.remove) { const r = input.remove, k = (r.artist + '|' + (r.title || '')).toLowerCase(); list = list.filter(x => (x.artist + '|' + (x.title || '')).toLowerCase() !== k); }
  if (input) { store.setKv('wantToHear', list); bust(); }   // feeds For you
  return list;
}
async function rss(base) { const { store, rss } = await load(); return rss.buildRss(store.loadState(), 80, base); }
async function digestFile(name) {
  const f = path.join(DIR, 'digests', path.basename(String(name)));
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const { store } = await load(), d = store.loadState().digests.find(x => x.file === path.basename(String(name)));   // kept in radar_digests
  return d ? Buffer.from(`<!doctype html><meta charset="utf-8"><title>${String(d.title).replace(/</g, '&lt;')}</title><body style="font-family:system-ui,sans-serif;max-width:680px;margin:2rem auto;padding:0 1rem;line-height:1.5">${d.html}</body>`) : null;
}
async function spotify() { const { spotify } = await load(); return spotify; }

module.exports = { discogs, discogsIndex, discogsSync, discogsWant, sound, find, bust, mixcloud, yearInMusic, closeToHome, releases, mix, calledIt, listen, notForMe, artist, stg, shows, follow, preview, want, community, sourcesNow, sourcesSettings, raw, settings, status, scan, digestNow, data, feedback, rss, digestFile, spotify };
