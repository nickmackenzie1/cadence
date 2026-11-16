'use strict';
/* Routes: free daily data fetched on the NAS (services/daily.js). GET only, cached, no keys. */
const { NEXT, send } = require('../lib/http');
const D = require('../services/daily');
const MAP = { outdoors: D.outdoors, onthisday: D.onThisDay, xkcd: D.xkcd, lichess: D.lichess, hn: D.hn, meals: D.meals, food: D.food, 'tv-search': D.tvSearch, tv: D.tvUpcoming };

module.exports = async function dailyRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/daily/')) return NEXT;
  const fn = MAP[p.slice('/api/daily/'.length)];
  if (!fn) return send(res, 404, { error: 'Not found' });
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  try { return send(res, 200, await fn(Object.fromEntries(url.searchParams))); }
  catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.message }); }
};
