'use strict';
/* Lyrics from LRCLIB (lrclib.net; user, 2026-11-19): plain and time-synced lyrics for a song, from its artist and title.
   Free and open, no key. Their rules, kept here: name the app in User-Agent, one request at a time with a short gap,
   and when they say "too many" (429), wait before trying again. Every answer is kept on the NAS
   (data/lyrics-cache.json): found lyrics for 60 days, "none found" for 3, so a song is looked up about once.
   get({ artist, track, album, duration }) → { found, synced: [[ms, line]…] | null, plain, instrumental, id, … }
   LRCLIB_API points at a test's stand-in. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR, PUBLIC_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

const API = () => (process.env.LRCLIB_API || 'https://lrclib.net').replace(/\/$/, '');
const FILE = () => path.join(DATA_DIR, 'lyrics-cache.json');
const HIT = 60 * 86400e3, MISS = 3 * 86400e3, GAP = 350, MAX = 4000;
const version = () => { try { return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'version.json'), 'utf8')).version; } catch { return 'dev'; } };
const UA = () => `THING/${version()} (personal self-hosted to-do and music app; https://github.com/nickmackenzie1/cadence)`;

let cache = null, saveT = 0;
const load = () => { if (!cache) { try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { cache = {}; } } return cache; };
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => {
  const ks = Object.keys(cache); if (ks.length > MAX) for (const k of ks.sort((a, b) => cache[a].at - cache[b].at).slice(0, ks.length - MAX)) delete cache[k];
  try { fs.writeFileSync(FILE(), JSON.stringify(cache)); } catch (e) { console.error('lyrics cache', e.message); } }, 1500); saveT.unref && saveT.unref(); };

// one request at a time, with a gap (LRCLIB asks for this)
let chain = Promise.resolve();
const queued = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, GAP))); return p; };
async function getJson(u) {
  const headers = { 'User-Agent': UA(), 'Lrclib-Client': UA(), Accept: 'application/json' };
  const once = async () => {
    if (process.env.LRCLIB_API) { const r = await fetch(u, { headers, signal: AbortSignal.timeout(10000) }); if (r.status === 404) return null; if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status }); return r.json(); }
    try { const r = await safeFetch(u, { headers, timeout: 10000 }, 1024 * 1024); return JSON.parse(r.buf.toString('utf8')); }
    catch (e) { if (/HTTP 404/.test(e.message)) return null; const m = /HTTP (\d+)/.exec(e.message); throw Object.assign(e, { status: m ? +m[1] : 0 }); }
  };
  return queued(async () => {
    try { return await once(); }
    catch (e) { if (e.status !== 429 && e.status !== 503) throw e; await new Promise(r => setTimeout(r, 2000 * (1 + Math.random() * 0.3))); return once(); }   // they asked us to wait
  });
}

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s*[([].*?(remaster|live|version|edit|mix|feat)[^)\]]*[)\]]/g, '').replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
// "[01:23.45] line" (a line can carry several times) → [[ms, line]…], in order
function parseLRC(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const times = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]; if (!times.length) continue;
    const line = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const t of times) out.push([Math.round((+t[1] * 60 + parseFloat(t[2].replace(':', '.'))) * 1000), line]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
const shape = r => r ? { found: true, id: r.id, artist: r.artistName, track: r.trackName, album: r.albumName, duration: r.duration, instrumental: !!r.instrumental,
  synced: r.syncedLyrics ? parseLRC(r.syncedLyrics) : null, plain: r.plainLyrics || null, source: 'LRCLIB' } : { found: false };

async function get({ artist = '', track = '', album = '', duration = 0 } = {}) {
  artist = String(artist).slice(0, 200).trim(); track = String(track).slice(0, 200).trim();
  if (!artist || !track) throw Object.assign(new Error('Which song?'), { code: 400 });
  const key = norm(artist) + '|' + norm(track), c = load()[key];
  if (c && Date.now() - c.at < (c.v.found ? HIT : MISS)) return c.v;
  const q = new URLSearchParams({ artist_name: artist, track_name: track }); if (album) q.set('album_name', String(album).slice(0, 200)); if (+duration > 0 && +duration < 3600) q.set('duration', String(Math.round(+duration)));
  let rec = await getJson(`${API()}/api/get?${q}`);
  if (!rec) {
    // no exact match: search, and take the closest (same names first, then synced, then nearest length)
    const list = (await getJson(`${API()}/api/search?${new URLSearchParams({ track_name: track, artist_name: artist })}`)) || [];
    const a = norm(artist), t = norm(track);
    const score = r => (norm(r.trackName) === t ? 4 : norm(r.trackName).includes(t) ? 2 : 0) + (norm(r.artistName) === a ? 3 : norm(r.artistName).includes(a) ? 1 : 0)
      + (r.syncedLyrics ? 1 : 0) - (+duration > 0 && r.duration ? Math.min(2, Math.abs(r.duration - duration) / 30) : 0);
    rec = (Array.isArray(list) ? list : []).filter(r => r && (r.plainLyrics || r.syncedLyrics || r.instrumental) && norm(r.trackName).includes(t.split(' ')[0] || ''))
      .sort((x, y) => score(y) - score(x)).find(r => score(r) >= 4) || null;
  }
  const v = shape(rec);
  load()[key] = { at: Date.now(), v }; save();
  return v;
}

module.exports = { get, parseLRC };
