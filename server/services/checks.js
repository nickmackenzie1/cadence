'use strict';
/* "Check outside services" (user, 2026-11-19, from the app review): the button on Background work asks every outside
   service THING uses once, at the same time, and says which answered and whether THING could read the answer. For
   the station playlists it runs the real readers, so a changed page shows up here instead of as a blank card.
   Services that need a key and have none say so instead of being asked. Nothing is saved; one check at a time. */
const { safeFetch } = require('../lib/net');

const UA = { 'User-Agent': 'Cadence/1 (self-hosted to-do app; checking services)' };
const key = n => !!String(process.env[n] || '').trim();
const json = buf => JSON.parse(buf.toString('utf8'));
const text = buf => buf.toString('utf8');

// each: id, name, what (what in THING uses it), url (or a function), needs (env key), read(body) → a short note, or
// throws when THING can't read it
const radio = () => require('./radio');
const CHECKS = [
  { id: 'radiobrowser', name: 'Radio Browser', what: 'Finding radio streams', url: 'https://de1.api.radio-browser.info/json/stations/byname/kexp?limit=1', read: b => { const j = json(b); if (!Array.isArray(j)) throw new Error('not a station list'); return `${j.length ? 'found KEXP' : 'answered'}`; } },
  { id: 'kexp', name: 'KEXP', what: 'Now playing, KEXP history', url: 'https://api.kexp.org/v2/plays/?format=json&limit=1', read: b => { const j = json(b); if (!Array.isArray(j.results)) throw new Error('no plays in the answer'); return 'latest play read'; } },
  { id: 'wxyc', name: 'WXYC playlist', what: 'Now playing on WXYC', url: 'https://api.wxyc.org/flowsheet', read: b => { const v = radio().parseWxyc(json(b), null); if (!v) throw new Error("THING couldn't find a song in it"); return `${v.artist} – ${v.song}`; } },
  { id: 'ksua', name: 'KSUA playlist (Spinitron)', what: 'Now playing on KSUA', url: 'https://widgets.spinitron.com/widget/now-playing-v2?station=ksua&num=1&cover=1', read: b => { const v = radio().parseSpinitron(text(b), null); if (!v) throw new Error("THING couldn't find a song in the page: its layout may differ"); return `${v.artist} – ${v.song}`; } },
  { id: 'wfuv', name: 'WFUV playlist', what: 'Now playing on WFUV', url: 'https://wfuv.org/playlist', read: b => { const v = radio().parseWfuv(text(b), null); if (!v) throw new Error("THING couldn't find a song in the page: its layout may differ"); return `${v.artist} – ${v.song}`; } },
  { id: 'somafm', name: 'SomaFM', what: 'SomaFM channels', url: 'https://somafm.com/channels.json', read: b => `${(json(b).channels || []).length} channels` },
  { id: 'musicbrainz', name: 'MusicBrainz', what: 'Artist pages, Radar', url: 'https://musicbrainz.org/ws/2/artist?query=wet%20leg&limit=1&fmt=json', read: b => { const j = json(b); if (!Array.isArray(j.artists)) throw new Error('no artists in the answer'); return 'search works'; } },
  { id: 'listenbrainz', name: 'ListenBrainz', what: 'Radar charts and listener counts, scrobbling', url: 'https://api.listenbrainz.org/1/stats/sitewide/artists?count=1&range=week', read: b => { const a = ((json(b).payload || {}).artists || []); return a.length ? `top this week: ${a[0].artist_name}` : 'answered (no chart yet)'; } },
  { id: 'lrclib', name: 'LRCLIB', what: 'Lyrics', url: 'https://lrclib.net/api/search?track_name=Chaise%20Longue&artist_name=Wet%20Leg', read: b => { const j = json(b); if (!Array.isArray(j)) throw new Error('not a list'); return `${j.length} result${j.length === 1 ? '' : 's'}`; } },
  { id: 'tmdb', name: 'TMDB', what: 'Watch list: films and shows', needs: ['TMDB_API_KEY', 'TMDB_TOKEN'], url: () => { const k = String(process.env.TMDB_API_KEY || process.env.TMDB_TOKEN).trim(); return k.length > 60 ? { u: 'https://api.themoviedb.org/3/configuration', h: { Authorization: 'Bearer ' + k } } : { u: 'https://api.themoviedb.org/3/configuration?api_key=' + encodeURIComponent(k) }; }, read: b => { if (!json(b).images) throw new Error('key not accepted'); return 'key works'; } },
  { id: 'gamesdb', name: 'TheGamesDB', what: 'Watch list: games', needs: ['GAMESDB_API_KEY'], url: () => ({ u: 'https://api.thegamesdb.net/v1/Games/ByGameName?name=hades&apikey=' + encodeURIComponent(process.env.GAMESDB_API_KEY.trim()) }), read: b => { const j = json(b); if (j.code && j.code !== 200) throw new Error(j.status || 'key not accepted'); return 'key works'; } },
  { id: 'tastedive', name: 'TasteDive', what: '"More like this"', needs: ['TASTEDIVE_API_KEY'], url: () => ({ u: 'https://tastedive.com/api/similar?q=severance&limit=1&k=' + encodeURIComponent(process.env.TASTEDIVE_API_KEY.trim()) }), read: b => { const j = json(b); if (j.error) throw new Error(String(j.error)); return 'key works'; } },
  { id: 'lastfm', name: 'Last.fm', what: 'Optional Radar counts (needs Pro from 1 Dec 2026)', needs: ['LASTFM_API_KEY'], url: () => ({ u: 'https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&limit=1&format=json&api_key=' + encodeURIComponent(process.env.LASTFM_API_KEY.trim()) }), read: b => { const j = json(b); if (j.error) throw new Error(j.message || 'key turned down'); return 'key works'; } },
  { id: 'nhl', name: 'NHL', what: 'Hockey on the Island', url: 'https://api-web.nhle.com/v1/score/now', read: b => `${(json(b).games || []).length} games today` },
  { id: 'tvmaze', name: 'TVmaze', what: 'Home bits: when your shows air', url: 'https://api.tvmaze.com/shows/1', read: b => { if (!json(b).name) throw new Error('no show in the answer'); return 'works'; } },
  { id: 'openmeteo', name: 'Open-Meteo', what: 'Weather, air and UV', url: 'https://api.open-meteo.com/v1/forecast?latitude=44.23&longitude=-76.49&current=temperature_2m', read: b => { if (!json(b).current) throw new Error('no weather in the answer'); return 'works'; } },
  { id: 'wikipedia', name: 'Wikipedia', what: 'Daily bits: on this day', url: () => { const d = new Date(); return { u: `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` }; }, read: b => `${(json(b).selected || []).length} events` },
  { id: 'xkcd', name: 'xkcd', what: 'Daily bits: comic', url: 'https://xkcd.com/info.0.json', read: b => `#${json(b).num}` },
  { id: 'hn', name: 'Hacker News', what: 'Daily bits: top stories', url: 'https://hacker-news.firebaseio.com/v0/topstories.json', read: b => `${json(b).length} stories` },
];

async function one(c) {
  const base = { id: c.id, name: c.name, what: c.what };
  if (c.needs && !c.needs.some(key)) return { ...base, state: 'nokey', note: `No key set (${c.needs[0]}), so it isn't used` };
  const t0 = Date.now();
  try {
    const target = typeof c.url === 'function' ? c.url() : { u: c.url };
    const r = await safeFetch(target.u, { headers: { ...UA, Accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...(target.h || {}) }, timeout: 10000 }, 3 * 1024 * 1024);
    const ms = Date.now() - t0;
    if (r.status && r.status >= 400) return { ...base, state: 'down', ms, note: `answered ${r.status}` };
    let note;
    try { note = c.read(r.buf); } catch (e) { return { ...base, state: 'unreadable', ms, note: e.message || "THING couldn't read the answer" }; }
    return { ...base, state: 'ok', ms, note: String(note || 'works').slice(0, 120) };
  } catch (e) {
    const m = String(e.message || e);
    return { ...base, state: 'down', ms: Date.now() - t0, note: /timeout|timed out|abort/i.test(m) ? 'no answer within 10 seconds' : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m) ? "couldn't find it (DNS)" : m.slice(0, 120) };
  }
}

let running = null, last = null;
async function run() {
  if (running) return running;
  running = (async () => {
    const t0 = Date.now(), results = await Promise.all(CHECKS.map(one));
    last = { at: new Date().toISOString(), ms: Date.now() - t0, results };
    return last;
  })().finally(() => { running = null; });
  return running;
}

module.exports = { run, last: () => last, CHECKS, one };
