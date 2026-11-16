'use strict';
/* Music Radar on the NAS (Nick's music-radar app, in server/services/radar/). Once you switch it on in Life → Music
   Radar, it reads music communities on Lemmy and Mastodon every 6 hours (plus blogs, charts and radio as "other
   sources") and writes the weekly digest every 7 days. Off by default. Reddit was removed 2026-11-16 at the user's
   request. Its own data lives in data/radar; optional keys (Last.fm, Spotify, ntfy, and the Anthropic key Cadence
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
  Promise.resolve().then(fn).then(() => finish(true), e => { console.error('radar', kind, e); finish(false, e); });
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
    delete next.tagsUsed; store.setKv('sourcesCfg', next);
  }
  return srcData.sourcesCfg();
}
const digestNow = () => runJob('digest', async () => { const { digest } = await load(); await digest.digest({}); settings({ lastDigest: Date.now() }); });

// the schedule: checked every 10 minutes, only while switched on
setInterval(() => {
  const s = readSettings(); if (!s.on || job) return;
  if (Date.now() - s.lastScan >= SCAN_EVERY) scan();
  else if (s.lastScan && Date.now() - s.lastDigest >= DIGEST_EVERY) digestNow();
}, 10 * 60e3).unref();

function status() {
  const s = readSettings();
  return { ...s, job, log: log.slice(-40), keys: { ai: !!process.env.ANTHROPIC_API_KEY, lastfm: !!process.env.LASTFM_API_KEY, ntfy: !!process.env.NTFY_TOPIC, spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) } };
}
// ---- raw tables for the Database view (read-only): the radar_* tables in cadence.db ----
async function raw(name, offset = 0, limit = 50) {
  const { store } = await load();
  const ts = store.tables();
  if (!ts) return { storage: 'files', note: store.storageNote, tables: [] };
  if (!name) return { storage: 'sqlite', file: path.basename(store.DB_FILE), tables: ts.map(t => ({ name: t.name, count: t.count, columns: t.columns })) };
  const r = store.tableRows(name, { offset, limit });
  if (!r) return null;
  r.rows = r.rows.map(row => row.map(v => (typeof v === 'string' && v.length > 600 ? v.slice(0, 600) + '…' : v)));
  return r;
}
async function data() { const { store, data } = await load(); return data.dashboardData(store.loadState()); }
async function feedback(id, v) {
  const { store } = await load(); const state = store.loadState();
  if (!state.picks.some(p => p.id === id)) return false;
  if (v === 0) delete state.feedback[id]; else state.feedback[id] = v > 0 ? 1 : -1;
  store.saveState(state); return true;
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
  }
  const f = store.getKv('fediCfg', {}) || {};
  return { communities: f.communities || F.DEFAULT_COMMUNITIES, tags: f.tags || F.DEFAULT_TAGS, mainstream: M.mainstreamCfg() };
}
async function rss(base) { const { store, rss } = await load(); return rss.buildRss(store.loadState(), 80, base); }
async function digestFile(name) {
  const f = path.join(DIR, 'digests', path.basename(String(name)));
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const { store } = await load(), d = store.loadState().digests.find(x => x.file === path.basename(String(name)));   // kept in radar_digests
  return d ? Buffer.from(`<!doctype html><meta charset="utf-8"><title>${String(d.title).replace(/</g, '&lt;')}</title><body style="font-family:system-ui,sans-serif;max-width:680px;margin:2rem auto;padding:0 1rem;line-height:1.5">${d.html}</body>`) : null;
}
async function spotify() { const { spotify } = await load(); return spotify; }

module.exports = { community, sourcesNow, sourcesSettings, raw, settings, status, scan, digestNow, data, feedback, rss, digestFile, spotify };
