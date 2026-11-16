'use strict';
/* Routes: Radio. Stations (stream addresses looked up on the NAS), search, KEXP now playing, and a relay for http streams. */
const { NEXT, send } = require('../lib/http');
const radio = require('../services/radio');

module.exports = async function radioRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/radio')) return NEXT;
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const guard = async fn => { try { return send(res, 200, await fn()); } catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.message }); } };
  if (p === '/api/radio/stations') return guard(() => radio.stations());
  if (p === '/api/radio/search') return guard(() => radio.search(url.searchParams.get('q')));
  if (p === '/api/radio/now') return guard(() => radio.nowPlaying(url.searchParams.get('id')));
  if (p === '/api/radio/stream') {
    try { await radio.relay(String(url.searchParams.get('u') || ''), req, res); }
    catch (e) { if (!res.headersSent) send(res, typeof e.code === 'number' ? e.code : 502, { error: e.message }); else res.destroy(); }
    return;
  }
  return send(res, 404, { error: 'Not found' });
};
