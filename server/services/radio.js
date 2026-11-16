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
const WEEK = 7 * 864e5, DAY = 864e5, BUDGET = +process.env.RADIO_LOOKUP_MS || 2500;

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
// fresh lookup that gets BUDGET ms before the page is shown without it (it keeps going and is ready next time)
async function resolve(p) {
  if (p.url) return { url: p.url };
  const c = cache[p.id], age = c ? Date.now() - c.at : Infinity;
  if (c && age < (c.miss ? DAY : WEEK)) return c;
  const job = lookup(p).catch(e => { if (c) return c; throw e; });   // directory down: last known address beats nothing
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
async function nowPlaying(id) {
  if (id !== 'kexp') return null;
  if (Date.now() - kexpNow.at < 20000) return kexpNow.v;
  const r = await safeFetch('https://api.kexp.org/v2/plays/?format=json&limit=1', {}, 256 * 1024);
  const p = (JSON.parse(r.buf.toString('utf8')).results || [])[0] || null;
  kexpNow = { at: Date.now(), v: p ? (p.play_type === 'trackplay'
    ? { artist: p.artist, song: p.song, album: p.album, art: p.thumbnail_uri || p.image_uri || null, at: p.airdate }
    : { airbreak: true, at: p.airdate }) : null };
  return kexpNow.v;
}

// ---- relay an http:// stream (only public addresses; follows a few redirects; .pls/.m3u resolved to their first entry) ----
const PLAYLIST = /(audio\/x-scpls|audio\/x-mpegurl|audio\/mpegurl|application\/pls)/i;
function open(url, hops = 0) {
  return new Promise((resolveP, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method: 'GET', lookup: guardedLookup, agent: false, headers: { 'User-Agent': 'Cadence/1', Accept: '*/*' }, timeout: 10000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) { res.resume(); return open(new URL(res.headers.location, url).href, hops + 1).then(resolveP, reject); }
      resolveP({ res, req });
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end();
  });
}
async function relay(url, clientReq, clientRes) {
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('not a stream address'), { code: 400 });
  await assertPublic(url);
  let { res, req } = await open(url);
  // a playlist file (.pls/.m3u): play its first stream instead
  if (PLAYLIST.test(res.headers['content-type'] || '') || /\.(pls|m3u)$/i.test(new URL(url).pathname)) {
    let text = ''; for await (const c of res) { text += c; if (text.length > 64 * 1024) break; } req.destroy();
    const first = (text.match(/(?:^|\n)\s*(?:File\d+=)?(https?:\/\/[^\s]+)/i) || [])[1];
    if (!first) throw Object.assign(new Error('empty playlist'), { code: 502 });
    await assertPublic(first); ({ res, req } = await open(first));
  }
  const type = String(res.headers['content-type'] || '');
  if (res.statusCode !== 200 || !/^(audio\/|application\/ogg|application\/octet-stream|video\/mp2t)/i.test(type)) { req.destroy(); throw Object.assign(new Error('not an audio stream (' + (res.statusCode || '?') + ' ' + type + ')'), { code: 502 }); }
  clientRes.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.pipe(clientRes);
  const stop = () => { try { req.destroy(); } catch {} };
  clientReq.on('close', stop); clientRes.on('close', stop); res.on('error', stop);
}

// look the presets up shortly after the NAS starts, so the first visit to Radio doesn't wait
if (!process.env.CI && process.env.RADIO_WARM !== '0') setTimeout(() => { stations().catch(() => {}); }, 20000).unref();

module.exports = { PRESETS, stations, search, nowPlaying, relay, resolve, shape, best };
