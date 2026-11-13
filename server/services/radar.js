'use strict';
/* Music Radar on the NAS (Nick's music-radar app, in server/services/radar/). Once you switch it on in Life → Music
   Radar, it scans music subreddits every 6 hours and writes the weekly digest every 7 days. Off by default, so
   nothing reaches Reddit until you ask. Its own data lives in data/radar; optional keys (Last.fm, Reddit, Spotify,
   ntfy, and the Anthropic key Cadence already uses) come from the NAS .env and never leave the NAS. */
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
  const [radar, digest, backfill, store, data, rss, spotify] = await Promise.all(['radar.mjs', 'digest.mjs', 'backfill.mjs', 'lib/store.mjs', 'lib/dashboard-data.mjs', 'lib/rss.mjs', 'lib/spotify.mjs'].map(m));
  return (mods = { radar, digest, backfill, store, data, rss, spotify });
}

const readSettings = () => { try { return { on: false, lastScan: 0, lastDigest: 0, lastError: null, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch { return { on: false, lastScan: 0, lastDigest: 0, lastError: null }; } };
const writeSettings = s => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(s)); };
function settings(patch) { const s = { ...readSettings(), ...(patch || {}) }; if (patch) writeSettings(s); return s; }

// one job at a time: a scan, the digest, or the archive backfill
let job = null, stopBackfill = false;
const log = [];
const note = line => { log.push(`${new Date().toISOString().slice(11, 19)} ${line}`); if (log.length > 60) log.shift(); };
function runJob(kind, fn) {
  if (job) return false;
  job = { kind, since: Date.now() };
  note(`${kind} started`);
  Promise.resolve().then(fn).then(() => { note(`${kind} done`); settings({ lastError: null }); })
    .catch(e => { note(`${kind} failed: ${e.message}`); settings({ lastError: `${kind}: ${e.message}` }); console.error('radar', kind, e); })
    .finally(() => { job = null; });
  return true;
}
const scan = () => runJob('scan', async () => { const { radar } = await load(); await radar.run({ quiet: true, playlist: false }); settings({ lastScan: Date.now() }); });
const digestNow = () => runJob('digest', async () => { const { digest } = await load(); await digest.digest({}); settings({ lastDigest: Date.now() }); });
const backfill = opts => { stopBackfill = false; return runJob('backfill', async () => { const { backfill } = await load(); await backfill.backfill({ ...(opts || {}), log: note, stop: () => stopBackfill }); }); };
const stop = () => { stopBackfill = true; };

// the schedule: checked every 10 minutes, only while switched on
setInterval(() => {
  const s = readSettings(); if (!s.on || job) return;
  if (Date.now() - s.lastScan >= SCAN_EVERY) scan();
  else if (s.lastScan && Date.now() - s.lastDigest >= DIGEST_EVERY) digestNow();
}, 10 * 60e3).unref();

function status() {
  const s = readSettings();
  return { ...s, job, log: log.slice(-12), keys: { ai: !!process.env.ANTHROPIC_API_KEY, lastfm: !!process.env.LASTFM_API_KEY, reddit: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET), ntfy: !!process.env.NTFY_TOPIC, spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) } };
}
async function data() { const { store, data } = await load(); return data.dashboardData(store.loadState()); }
async function feedback(id, v) {
  const { store } = await load(); const state = store.loadState();
  if (!state.picks.some(p => p.id === id)) return false;
  if (v === 0) delete state.feedback[id]; else state.feedback[id] = v > 0 ? 1 : -1;
  store.saveState(state); return true;
}
async function subs({ add, remove }) {
  const { store } = await load(); const cfg = await import(pathToFileURL(path.join(__dirname, 'radar', 'lib', 'config.mjs')).href);
  const state = store.loadState(); let list = state.subs || [...cfg.DEFAULT_SUBS];
  if (add && /^[A-Za-z0-9_]{2,21}$/.test(add) && !list.some(s => s.toLowerCase() === add.toLowerCase())) list.push(add);
  if (remove) list = list.filter(s => s.toLowerCase() !== String(remove).toLowerCase());
  state.subs = list; state.subSuggestions = state.subSuggestions.filter(s => s.sub.toLowerCase() !== String(add || '').toLowerCase());
  store.saveState(state); return list;
}
async function rss(base) { const { store, rss } = await load(); return rss.buildRss(store.loadState(), 80, base); }
function digestFile(name) { const f = path.join(DIR, 'digests', path.basename(String(name))); return fs.existsSync(f) ? fs.readFileSync(f) : null; }
async function spotify() { const { spotify } = await load(); return spotify; }

module.exports = { settings, status, scan, digestNow, backfill, stop, data, feedback, subs, rss, digestFile, spotify };
