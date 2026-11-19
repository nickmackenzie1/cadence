'use strict';
/* Film and TV pictures for themes, from TMDB (user, 2026-11-18). Needs TMDB_API_KEY (a free v3 key, or the v4 read
   token) in .env; without it themes simply don't get them. A title is looked up once (kept 30 days in
   data/tmdb.json); pictures come through the NAS (kept in data/tmdb-img), so the browser can read their colours.
   "This product uses the TMDB API but is not endorsed or certified by TMDB." */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

const API = () => (process.env.TMDB_API || 'https://api.themoviedb.org').replace(/\/$/, '');
const IMG = () => (process.env.TMDB_IMG || 'https://image.tmdb.org').replace(/\/$/, '');
const KEY = () => String(process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || '').trim();
const on = () => !!KEY();
// the real TMDB through the public-hosts-only fetch; a test's stand-in (TMDB_API set) directly
async function get(url, headers = {}, max = 2 * 1024 * 1024) {
  if (process.env.TMDB_API || process.env.TMDB_IMG) { const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return { type: r.headers.get('content-type') || '', buf: Buffer.from(await r.arrayBuffer()) }; }
  return safeFetch(url, { headers, timeout: 10000 }, max);
}
async function api(p, q = {}) {
  const k = KEY(), v4 = k.length > 60, qs = new URLSearchParams({ ...q, ...(v4 ? {} : { api_key: k }) });
  const r = await get(`${API()}/3${p}?${qs}`, { Accept: 'application/json', ...(v4 ? { Authorization: 'Bearer ' + k } : {}) });
  return JSON.parse(r.buf.toString('utf8'));
}
const CACHE = () => path.join(DATA_DIR, 'tmdb.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE(), 'utf8')); } catch { return {}; } };

// a title's pictures: backdrops without words on them first (TMDB's "no language"), best rated first
async function art({ type = 'movie', q = '', year = '' } = {}) {
  if (!on()) return { off: true };
  type = type === 'tv' ? 'tv' : 'movie'; q = String(q).trim().slice(0, 120); year = String(year).replace(/\D/g, '').slice(0, 4);
  if (!q) throw Object.assign(new Error('Which title?'), { code: 400 });
  const key = `${type}|${q.toLowerCase()}|${year}`, c = readCache();
  if (c[key] && Date.now() - c[key].at < 30 * 86400e3) return c[key].v;
  const s = await api(`/search/${type}`, { query: q, include_adult: 'false', ...(year ? (type === 'tv' ? { first_air_date_year: year } : { primary_release_year: year }) : {}) });
  const hit = (s.results || [])[0];
  let v = { none: true };
  if (hit) {
    const im = await api(`/${type}/${hit.id}/images`, { include_image_language: 'null,en' });
    const bd = (im.backdrops || []).filter(b => b.file_path).sort((a, b) => (a.iso_639_1 ? 1 : 0) - (b.iso_639_1 ? 1 : 0) || (b.vote_average || 0) - (a.vote_average || 0) || (b.width || 0) - (a.width || 0));
    const po = (im.posters || []).filter(p => p.file_path && (p.iso_639_1 === 'en' || !p.iso_639_1)).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    const title = hit.title || hit.name, yr = String(hit.release_date || hit.first_air_date || '').slice(0, 4);
    const pic = (size, fp) => `api/tmdb/img/${size}${fp}`;
    v = { title, year: yr, link: `https://www.themoviedb.org/${type}/${hit.id}`,
      backdrops: bd.slice(0, 8).map(b => pic('w1280', b.file_path)), poster: po[0] ? pic('w500', po[0].file_path) : null,
      credit: `${title}${yr ? ' (' + yr + ')' : ''}, picture from TMDB` };
  }
  c[key] = { at: Date.now(), v }; try { fs.writeFileSync(CACHE(), JSON.stringify(c)); } catch {}
  return v;
}
// the watch list (user, 2026-11-18: "watch Dune" in quick add, and a Movies to watch page). Kept 30 days like art.
const memo = async (key, fn) => {
  const c = readCache(); if (c[key] && Date.now() - c[key].at < 30 * 86400e3) return c[key].v;
  const v = await fn(); const c2 = readCache(); c2[key] = { at: Date.now(), v }; try { fs.writeFileSync(CACHE(), JSON.stringify(c2)); } catch {}
  return v;
};
const yearOf = x => String(x.release_date || x.first_air_date || '').slice(0, 4);
// films and shows matching what you typed, most likely first (TMDB's own order: by how well known they are)
async function find({ q = '', type = '' } = {}) {
  if (!on()) return { off: true };
  q = String(q).trim().slice(0, 120); if (!q) throw Object.assign(new Error('Which title?'), { code: 400 });
  const only = type === 'movie' || type === 'tv' ? type : '';
  return memo(`find|${only}|${q.toLowerCase()}`, async () => {
    const s = await api(only ? `/search/${only}` : '/search/multi', { query: q, include_adult: 'false' });
    const results = (s.results || []).map(x => ({ ...x, media_type: x.media_type || only })).filter(x => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 8).map(x => ({
      id: x.id, type: x.media_type, title: x.title || x.name, year: yearOf(x), poster: x.poster_path ? `api/tmdb/img/w342${x.poster_path}` : null,
      overview: String(x.overview || '').slice(0, 280) }));
    return { results };
  });
}
// one film or show in full: runtime (or seasons), genres, who made it, what it's about
async function title({ type = 'movie', id = '' } = {}) {
  if (!on()) return { off: true };
  type = type === 'tv' ? 'tv' : 'movie'; id = String(id).replace(/\D/g, '').slice(0, 12);
  if (!id) throw Object.assign(new Error('Which title?'), { code: 400 });
  return memo(`title2|${type}|${id}`, async () => {
    const x = await api(`/${type}/${id}`, { append_to_response: 'credits' });
    const by = type === 'tv' ? (x.created_by || []).map(c => c.name) : ((x.credits && x.credits.crew) || []).filter(c => c.job === 'Director').map(c => c.name);
    const cast = ((x.credits && x.credits.cast) || []).slice(0, 4).map(c => c.name);
    const rt = type === 'tv' ? ((x.episode_run_time || [])[0] || 0) : (x.runtime || 0);
    return { id: x.id, type, title: x.title || x.name, year: yearOf(x), runtime: rt, seasons: type === 'tv' ? x.number_of_seasons || 0 : 0,
      genres: (x.genres || []).map(g => g.name).slice(0, 3), by: by.slice(0, 2), cast, overview: String(x.overview || '').slice(0, 600),
      tagline: String(x.tagline || '').slice(0, 160), poster: x.poster_path ? `api/tmdb/img/w342${x.poster_path}` : null,
      released: x.release_date || x.first_air_date || null, status: x.status || null,
      link: `https://www.themoviedb.org/${type}/${x.id}` };
  });
}
// a show's next episode (for the Watch list's "new season starts today"): asked at most every 12 hours, kept in memory
const nextKept = new Map();
async function next({ id = '' } = {}) {
  if (!on()) return { off: true };
  id = String(id).replace(/\D/g, '').slice(0, 12); if (!id) throw Object.assign(new Error('Which show?'), { code: 400 });
  const h = nextKept.get(id); if (h && Date.now() - h.at < 12 * 3600e3) return h.v;
  const x = await api(`/tv/${id}`), n = x.next_episode_to_air;
  const v = { status: x.status || null, next: n ? { date: n.air_date || null, season: n.season_number || null, episode: n.episode_number || null, name: String(n.name || '').slice(0, 120) } : null,
    seasons: x.number_of_seasons || 0, last: x.last_air_date || null };
  nextKept.set(id, { at: Date.now(), v }); if (nextKept.size > 500) nextKept.delete(nextKept.keys().next().value);
  return v;
}
// one picture, kept on the NAS after the first time
async function img(size, file, res) {
  if (!['w185', 'w300', 'w342', 'w500', 'w780', 'w1280'].includes(size) || !/^[A-Za-z0-9_-]{6,64}\.(jpg|jpeg|png|webp)$/.test(file)) { res.writeHead(404); return res.end(); }
  const dir = path.join(DATA_DIR, 'tmdb-img'), f = path.join(dir, size + '_' + file);
  let buf; try { buf = fs.readFileSync(f); } catch {}
  if (!buf) {
    if (!on()) { res.writeHead(404); return res.end(); }
    try { const r = await get(`${IMG()}/t/p/${size}/${file}`, { Accept: 'image/*' }, 8 * 1024 * 1024); buf = r.buf; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, buf); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: "Couldn't get that picture from TMDB" })); }
  }
  // the type from the picture's own first bytes
  const type = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=2592000', 'X-Content-Type-Options': 'nosniff' });
  res.end(buf);
}
module.exports = { on, art, img, find, title, next };
