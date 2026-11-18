'use strict';
/* Routes: Radio. Stations (stream addresses looked up on the NAS), search, KEXP now playing, and a relay for http streams. */
const { NEXT, readBody, send } = require('../lib/http');
const readJson = async req => { try { return JSON.parse(await readBody(req, 16 * 1024) || '{}'); } catch { return {}; } };
const radio = require('../services/radio');

module.exports = async function radioRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/radio')) return NEXT;
  if (p === '/api/radio/follow' && req.method === 'POST') {
    try { return send(res, 200, radio.follow(await readJson(req))); } catch (e) { return send(res, e.code === 400 ? 400 : 500, { error: e.message }); }
  }
  if (p === '/api/radio/kexp-keep' && req.method === 'POST') {
    try { return send(res, 200, require('../services/kexp-archive').setKeep(await readJson(req))); } catch (e) { return send(res, e.code === 400 ? 400 : 500, { error: e.message }); }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  { const m = /^\/api\/radio\/kexp-kept\/(\d+)\.mp3$/.exec(p); if (m) return require('../services/kexp-archive').serveKept(m[1], req, res); }
  if (p === '/api/radio/kexp-keep') return send(res, 200, require('../services/kexp-archive').keep());
  const guard = async fn => { try { return send(res, 200, await fn()); } catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.message }); } };
  if (p === '/api/radio/soma') return guard(() => radio.soma());
  if (p === '/api/radio/stations') return guard(() => radio.stations());
  if (p === '/api/radio/search') return guard(() => radio.search(url.searchParams.get('q')));
  if (p === '/api/radio/kexp-history') return send(res, 200, await require('../services/kexp-log').status());
  if (p === '/api/radio/kexp') {
    const K = require('../services/kexp-log'), q = Object.fromEntries(url.searchParams), v = q.view;
    return guard(async () => {
      if (v === 'top') return K.top(q);
      if (v === 'search') return K.search(q);
      if (v === 'artist') return K.artist(q.artist);
      if (v === 'song') return K.song(q.artist, q.song);
      if (v === 'around') return K.around(q.id, q.n);
      if (v === 'recent') return K.recent({ limit: q.limit, comments: q.comments === '1' });
      if (v === 'new') return K.newArtists(q);
      if (v === 'onair') return K.onAir(q);
      if (v === 'winners') return K.winners(q);
      if (v === 'race') return K.race();
      if (v === 'crate') return K.crate(q);
      if (v === 'hosts') return K.hosts();
      if (v === 'archive') return require('../services/kexp-archive').archiveAt(q.at);
      throw Object.assign(new Error('unknown view'), { code: 400 });
    });
  }
  if (p === '/api/radio/now') return guard(() => radio.nowPlaying(url.searchParams.get('id'), url.searchParams.get('u')));
  if (p === '/api/radio/history') return guard(async () => radio.history(url.searchParams.get('id'), url.searchParams.get('limit')));
  if (p === '/api/radio/stream') {
    try { await radio.relay(String(url.searchParams.get('u') || ''), req, res); }
    catch (e) { if (!res.headersSent) send(res, typeof e.code === 'number' ? e.code : 502, { error: e.message }); else res.destroy(); }
    return;
  }
  return send(res, 404, { error: 'Not found' });
};
