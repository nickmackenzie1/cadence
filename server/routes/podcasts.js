'use strict';
/* Routes: Podcasts (Pocket Casts sync). The view's data, saving your place back, stars, and show notes. */
const { NEXT, readBody, send } = require('../lib/http');
const pc = require('../services/pocketcasts');

module.exports = async function podcastRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/podcasts')) return NEXT;
  const body = async () => { try { return JSON.parse(await readBody(req, 16 * 1024) || '{}'); } catch { return {}; } };
  const guard = async fn => { try { return send(res, 200, await fn()); } catch (e) { return send(res, e.code === 'NOCONFIG' ? 409 : 502, { error: e.message }); } };
  if (p === '/api/podcasts' && req.method === 'GET') return send(res, 200, await pc.overview(url.searchParams.has('fresh')));
  if (p === '/api/podcasts/status' && req.method === 'GET') return send(res, 200, pc.status());
  if (p === '/api/podcasts/progress' && req.method === 'POST') return guard(async () => pc.progress(await body()));
  if (p === '/api/podcasts/star' && req.method === 'POST') return guard(async () => pc.star(await body()));
  if (p.startsWith('/api/podcasts/notes/') && req.method === 'GET') return guard(() => pc.notes(p.slice('/api/podcasts/notes/'.length)));
  return send(res, 404, { error: 'Not found' });
};
