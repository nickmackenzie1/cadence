'use strict';
/* Game pictures for themes, from TheGamesDB (user, 2026-11-18). Needs THEGAMESDB_API_KEY in .env (requested on their
   forums: forums.thegamesdb.net). Their monthly allowance is small, so a game is looked up once and kept 30 days
   (data/gamesdb.json), and pictures come through the NAS and are kept there (data/gamesdb-img).
   Games: fanart (1920×1080) for backgrounds, the clear logo for a corner. Consoles: the platform's own pictures. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

const API = () => (process.env.GAMESDB_API || 'https://api.thegamesdb.net').replace(/\/$/, '');
const CDN = () => (process.env.GAMESDB_CDN || 'https://cdn.thegamesdb.net').replace(/\/$/, '');
const KEY = () => String(process.env.THEGAMESDB_API_KEY || '').trim();
const on = () => !!KEY();
async function get(url, max = 2 * 1024 * 1024) {
  if (process.env.GAMESDB_API || process.env.GAMESDB_CDN) { const r = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return { buf: Buffer.from(await r.arrayBuffer()) }; }
  return safeFetch(url, { headers: { Accept: '*/*' }, timeout: 10000 }, max);
}
const api = async (p, q) => JSON.parse((await get(`${API()}/v1${p}?${new URLSearchParams({ apikey: KEY(), ...q })}`)).buf.toString('utf8'));
const CACHE = () => path.join(DATA_DIR, 'gamesdb.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE(), 'utf8')); } catch { return {}; } };
const pic = f => 'api/gdb/img/' + String(f).replace(/^\/+/, '');

// a game by name (or a console by its TheGamesDB platform id): its backgrounds and logo
async function art({ kind = 'game', q = '', platform = '' } = {}) {
  if (!on()) return { off: true };
  kind = kind === 'platform' ? 'platform' : 'game'; q = String(q).trim().slice(0, 120); platform = String(platform).replace(/\D/g, '');
  if (!q) throw Object.assign(new Error('Which game?'), { code: 400 });
  const key = `${kind}|${q.toLowerCase()}|${platform}`, c = readCache();
  if (c[key] && Date.now() - c[key].at < 30 * 86400e3) return c[key].v;
  let v = { none: true };
  if (kind === 'game') {
    const s = await api('/Games/ByGameName', { name: q, fields: 'platform', ...(platform ? { 'filter[platform]': platform } : {}) });
    const games = (s.data && s.data.games) || [];
    // the closest title: an exact name first, then the earliest release (the original, not a remaster)
    const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = games.find(g => norm(g.game_title) === norm(q)) || games.sort((a, b) => String(a.release_date || '9').localeCompare(String(b.release_date || '9')))[0];
    if (hit) {
      const im = await api('/Games/Images', { games_id: String(hit.id), 'filter[type]': 'fanart,clearlogo,screenshot' });
      const list = ((im.data && im.data.images) || {})[hit.id] || [];
      const fan = list.filter(i => i.type === 'fanart'), shots = list.filter(i => i.type === 'screenshot'), logo = list.find(i => i.type === 'clearlogo');
      const backs = (fan.length ? fan : shots).slice(0, 8).map(i => pic('original/' + i.filename));
      v = { title: hit.game_title, year: String(hit.release_date || '').slice(0, 4), link: `https://thegamesdb.net/game.php?id=${hit.id}`, backdrops: backs,
        logo: logo ? pic('original/' + logo.filename) : null, credit: `${hit.game_title}, pictures from TheGamesDB`, source: 'TheGamesDB' };
    }
  } else {
    const id = platform || q;
    const im = await api('/Platforms/Images', { platforms_id: id, 'filter[type]': 'fanart,banner' });
    const list = ((im.data && im.data.images) || {})[id] || [];
    const fan = list.filter(i => i.type === 'fanart'), ban = list.filter(i => i.type === 'banner');
    if (fan.length || ban.length) v = { title: q, link: `https://thegamesdb.net/platform.php?id=${id}`, backdrops: (fan.length ? fan : ban).slice(0, 8).map(i => pic('original/' + i.filename)), logo: null, credit: 'pictures from TheGamesDB', source: 'TheGamesDB' };
  }
  c[key] = { at: Date.now(), v }; try { fs.writeFileSync(CACHE(), JSON.stringify(c)); } catch {}
  return v;
}
// the watch list's "play Hades": games matching a name, with their box art, year and consoles (kept 30 days: the
// monthly allowance is small, and a name is only looked up once)
async function find({ q = '' } = {}) {
  if (!on()) return { off: true };
  q = String(q).trim().slice(0, 120); if (!q) throw Object.assign(new Error('Which game?'), { code: 400 });
  const key = `find|${q.toLowerCase()}`, c = readCache();
  if (c[key] && Date.now() - c[key].at < 30 * 86400e3) return c[key].v;
  const s = await api('/Games/ByGameName', { name: q, fields: 'overview,platform', include: 'boxart,platform' });
  const games = ((s.data && s.data.games) || []).slice(0, 20), inc = s.include || {};
  const box = (inc.boxart && inc.boxart.data) || {}, plats = (inc.platform && (inc.platform.data || inc.platform)) || {};
  const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
  // an exact name first, then the earliest (the original before its remasters)
  games.sort((a, b) => (norm(b.game_title) === norm(q)) - (norm(a.game_title) === norm(q)) || String(a.release_date || '9').localeCompare(String(b.release_date || '9')));
  const results = games.slice(0, 8).map(g => { const f = (box[g.id] || []).find(b => b.side === 'front');
    const pl = plats[g.platform] && plats[g.platform].name;
    return { id: g.id, type: 'game', title: g.game_title, year: String(g.release_date || '').slice(0, 4), platform: pl || '',
      poster: f ? pic('medium/' + f.filename) : null, released: g.release_date || null, overview: String(g.overview || '').slice(0, 600), link: `https://thegamesdb.net/game.php?id=${g.id}` }; });
  const v = { results };
  const c2 = readCache(); c2[key] = { at: Date.now(), v }; try { fs.writeFileSync(CACHE(), JSON.stringify(c2)); } catch {}
  return v;
}
// one picture, kept on the NAS after the first time (paths like original/fanart/121-1.jpg, original/clearlogo/121.png)
async function img(rest, res) {
  const m = /^(original|large|medium|small)\/((?:platform\/)?(?:fanart|clearlogo|screenshots?|banners?|boxart\/front|boxart\/back)\/[A-Za-z0-9_-]{1,40}\.(?:jpg|jpeg|png|webp))$/.exec(rest);
  if (!m) { res.writeHead(404); return res.end(); }
  const dir = path.join(DATA_DIR, 'gamesdb-img'), f = path.join(dir, rest.replace(/\//g, '_'));
  let buf; try { buf = fs.readFileSync(f); } catch {}
  if (!buf) {
    if (!on()) { res.writeHead(404); return res.end(); }
    try { buf = (await get(`${CDN()}/images/${rest}`, 10 * 1024 * 1024)).buf; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, buf); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: "Couldn't get that picture from TheGamesDB" })); }
  }
  const type = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=2592000', 'X-Content-Type-Options': 'nosniff' });
  res.end(buf);
}
module.exports = { on, art, img, find };
