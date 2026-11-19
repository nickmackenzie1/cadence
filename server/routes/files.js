'use strict';
/* Routes: Meeting screenshots and the small settings that follow you between devices. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');
const { NEXT, readBody, send } = require('../lib/http');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function filesRoutes(req, res, { url, p }) {
  if (p === '/api/shots' && req.method === 'POST') {
    const type = String(req.headers['content-type'] || ''), ext = /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpg' : /webp/.test(type) ? 'webp' : null;
    if (!ext) return send(res, 400, { error: 'Images only' });
    const buf = await new Promise((resolve, reject) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > 12 * 1024 * 1024) { reject(new Error('Image too large (12 MB max)')); req.destroy(); } else ch.push(c); }); req.on('end', () => resolve(Buffer.concat(ch))); req.on('error', reject); });
    const dir = path.join(DATA_DIR, 'shots'); fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(9).toString('hex') + '.' + ext; fs.writeFileSync(path.join(dir, id), buf);
    return send(res, 200, { url: 'api/shots/' + id });
  }
  if (p.startsWith('/api/shots/') && req.method === 'GET') {
    const id = p.slice(11); if (!/^[a-f0-9]{18}\.(png|jpg|webp)$/.test(id)) return send(res, 404, { error: 'Not found' });
    const f = path.join(DATA_DIR, 'shots', id); if (!fs.existsSync(f)) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': id.endsWith('png') ? 'image/png' : id.endsWith('webp') ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' });
    return res.end(fs.readFileSync(f));
  }
  // pictures and sounds you add to a theme (2026-11-18): data/theme-media, images up to 12 MB, sounds up to 5 MB
  if (p === '/api/theme-media' && req.method === 'POST') {
    const type = String(req.headers['content-type'] || '').toLowerCase();
    const ext = /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpg' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif' : /mpeg|mp3/.test(type) ? 'mp3' : /ogg/.test(type) ? 'ogg' : /wav/.test(type) ? 'wav' : /mp4|m4a|aac/.test(type) ? 'm4a' : null;
    if (!ext) return send(res, 400, { error: 'Pictures (PNG, JPEG, WebP, GIF) or sounds (MP3, OGG, WAV, M4A) only' });
    const max = /mp3|ogg|wav|m4a/.test(ext) ? 5 : 12;
    let buf; try { buf = await new Promise((resolve, reject) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > max * 1024 * 1024) { reject(new Error(`Too large (${max} MB max)`)); req.destroy(); } else ch.push(c); }); req.on('end', () => resolve(Buffer.concat(ch))); req.on('error', reject); }); }
    catch (e) { return send(res, 413, { error: e.message }); }
    const dir = path.join(DATA_DIR, 'theme-media'); fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(9).toString('hex') + '.' + ext; fs.writeFileSync(path.join(dir, id), buf);
    return send(res, 200, { url: 'api/theme-media/' + id });
  }
  if (p.startsWith('/api/theme-media/') && req.method === 'GET') {
    const id = p.slice(17); if (!/^[a-f0-9]{18}\.(png|jpg|webp|gif|mp3|ogg|wav|m4a)$/.test(id)) return send(res, 404, { error: 'Not found' });
    const f = path.join(DATA_DIR, 'theme-media', id); if (!fs.existsSync(f)) return send(res, 404, { error: 'Not found' });
    const ext = id.split('.').pop();
    res.writeHead(200, { 'Content-Type': { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' }[ext], 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    return res.end(fs.readFileSync(f));
  }
  // film and TV pictures for themes (TMDB; needs TMDB_API_KEY)
  if (p === '/api/commons' && req.method === 'GET') {
    try { return send(res, 200, await require('../services/commons').photos(url.searchParams.get('q'))); }
    catch (e) { return send(res, e.code || 502, { error: e.code ? e.message : "Couldn't reach Wikimedia Commons just now" }); }
  }
  if (p.startsWith('/api/commons/img/') && req.method === 'GET') return require('../services/commons').img(p.slice(17), res);
  if (p === '/api/tmdb/art' && req.method === 'GET') {
    try { return send(res, 200, await require('../services/tmdb').art(Object.fromEntries(url.searchParams))); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.code === 400 ? e.message : "Couldn't reach TMDB just now" }); }
  }
  // "more like this" from TasteDive (services/tastedive.js)
  if (p === '/api/similar' && req.method === 'GET') {
    try { return send(res, 200, await require('../services/tastedive').similar(Object.fromEntries(url.searchParams))); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.message }); }
  }
  // lyrics from LRCLIB, kept on the NAS (services/lyrics.js)
  if (p === '/api/lyrics' && req.method === 'GET') {
    try { const q = Object.fromEntries(url.searchParams); return send(res, 200, await require('../services/lyrics').get({ artist: q.artist, track: q.track, album: q.album, duration: q.duration })); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.code === 400 ? e.message : "Couldn't reach the lyrics library just now" }); }
  }
  // the watch list: find a film or show, then one in full
  if ((p === '/api/tmdb/find' || p === '/api/tmdb/title' || p === '/api/tmdb/next') && req.method === 'GET') {
    try { const t = require('../services/tmdb'); return send(res, 200, await t[p.slice(10)](Object.fromEntries(url.searchParams))); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.code === 400 ? e.message : "Couldn't reach TMDB just now" }); }
  }
  { const m = /^\/api\/tmdb\/img\/(w\d+)\/([^/]+)$/.exec(p); if (m && req.method === 'GET') return require('../services/tmdb').img(m[1], m[2], res); }
  // game pictures for themes (TheGamesDB; needs THEGAMESDB_API_KEY)
  if (p === '/api/gdb/art' && req.method === 'GET') {
    try { return send(res, 200, await require('../services/gamesdb').art(Object.fromEntries(url.searchParams))); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.code === 400 ? e.message : "Couldn't reach TheGamesDB just now" }); }
  }
  if (p === '/api/gdb/find' && req.method === 'GET') {
    try { return send(res, 200, await require('../services/gamesdb').find(Object.fromEntries(url.searchParams))); }
    catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.code === 400 ? e.message : "Couldn't reach TheGamesDB just now" }); }
  }
  if (p.startsWith('/api/gdb/img/') && req.method === 'GET') return require('../services/gamesdb').img(p.slice(13), res);
  // fonts you add yourself (ones Cadence can't ship, e.g. fan fonts for themes): drop the file into the NAS data/fonts
  // folder; api/fonts/hylia-serif finds HyliaSerif*.otf/.ttf/.woff/.woff2 there. Missing → 404 and the theme falls back.
  if (p.startsWith('/api/fonts/') && req.method === 'GET') {
    const want = p.slice(11).toLowerCase().replace(/[^a-z0-9]/g, ''); if (!want) return send(res, 404, { error: 'Not found' });
    const dir = path.join(DATA_DIR, 'fonts'); let files = []; try { files = fs.readdirSync(dir); } catch {}
    const f = files.find(n => /\.(otf|ttf|woff2?)$/i.test(n) && n.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '').startsWith(want));
    if (!f) return send(res, 404, { error: 'Not found' });
    const ext = f.split('.').pop().toLowerCase();
    res.writeHead(200, { 'Content-Type': { otf: 'font/otf', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2' }[ext], 'Cache-Control': 'private, max-age=86400' });
    return res.end(fs.readFileSync(path.join(dir, f)));
  }
  // small settings that follow you between devices (weather town, effects, timers…): last write wins per key
  if (p === '/api/prefs') {
    const F = path.join(DATA_DIR, 'prefs.json'); let d = {}; try { d = JSON.parse(fs.readFileSync(F, 'utf8')); } catch {}
    if (req.method === 'GET') return send(res, 200, d);
    if (req.method === 'PUT') {
      const b = JSON.parse(await readBody(req, 256 * 1024)); let n = 0;
      for (const [k, x] of Object.entries(b || {})) { if (!/^cadence\.[\w.-]{1,60}$/.test(k) || !x || typeof x.at !== 'number') continue; if (!d[k] || d[k].at < x.at) { d[k] = { v: x.v == null ? null : String(x.v).slice(0, 64 * 1024), at: x.at }; n++; } }
      if (n) { fs.writeFileSync(F, JSON.stringify(d)); require('../lib/live').broadcast({ kind: 'prefs', tab: String(url.searchParams.get('tab') || '').slice(0, 24) }); }
      return send(res, 200, { ok: true, changed: n });
    }
  }
  return NEXT;   // not ours
};
