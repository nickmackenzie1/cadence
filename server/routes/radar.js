'use strict';
/* Routes: Music Radar (Life). Its status and switch, running a scan / digest / archive pull, the dashboard data,
   thumbs up and down, the subreddit list, the RSS feed, weekly digests, and connecting Spotify. */
const { NEXT, readBody, send } = require('../lib/http');
const radar = require('../services/radar');

// the address this Cadence was reached at, for links in the feed and Spotify's redirect
const baseOf = req => `${req.socket.encrypted ? 'https' : 'http'}://${String(req.headers.host || 'localhost').replace(/[^\w.\-:[\]]/g, '')}`;

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function radarRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/radar')) return NEXT;
  const body = async () => { try { return JSON.parse(await readBody(req, 64 * 1024) || '{}'); } catch { return {}; } };

  if (p === '/api/radar/status' && req.method === 'GET') return send(res, 200, radar.status());
  if (p === '/api/radar/settings' && req.method === 'POST') { const b = await body(); radar.settings({ on: !!b.on }); return send(res, 200, radar.status()); }
  if (p === '/api/radar/run' && req.method === 'POST') {
    const b = await body();
    const started = b.what === 'digest' ? radar.digestNow() : b.what === 'backfill' ? radar.backfill(b.options) : b.what === 'stop' ? (radar.stop(), true) : radar.scan();
    return send(res, started ? 200 : 409, { started, ...radar.status() });
  }
  if (p === '/api/radar/raw' && req.method === 'GET') {   // read-only tables for the Database view
    const q = url.searchParams, r = await radar.raw(q.get('table') || '', Math.max(0, +q.get('offset') || 0), Math.min(500, Math.max(1, +q.get('limit') || 50)));
    return r ? send(res, 200, r) : send(res, 404, { error: 'No such table' });
  }
  if (p === '/api/radar/data' && req.method === 'GET') return send(res, 200, await radar.data());
  if (p === '/api/radar/feedback') {
    // POST from the app; GET from the thumbs links inside the RSS feed
    if (req.method === 'POST') { const b = await body(); return send(res, 200, { ok: await radar.feedback(String(b.id), Number(b.v)) }); }
    const v = Number(url.searchParams.get('v')), ok = await radar.feedback(String(url.searchParams.get('id')), v);
    return send(res, ok ? 200 : 404, `<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;padding:2rem">${ok ? (v > 0 ? 'Got it: more like this.' : 'Got it: less like this.') : 'Pick not found.'}<p><a href="${baseOf(req)}/#view-radar">Open Music Radar</a></p>`, 'text/html; charset=utf-8');
  }
  if (p === '/api/radar/subs' && req.method === 'POST') return send(res, 200, { subs: await radar.subs(await body()) });
  if (p === '/api/radar/feed.xml' && req.method === 'GET') return send(res, 200, await radar.rss(baseOf(req)), 'application/rss+xml; charset=utf-8');
  if (p.startsWith('/api/radar/digests/') && req.method === 'GET') {
    const f = await radar.digestFile(p.slice('/api/radar/digests/'.length));
    return f ? send(res, 200, f, 'text/html; charset=utf-8') : send(res, 404, { error: 'Not found' });
  }
  if (p === '/api/radar/spotify/login' && req.method === 'GET') {
    const sp = await radar.spotify();
    if (!sp.hasSpotifyApp()) return send(res, 400, 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the NAS .env first.', 'text/plain; charset=utf-8');
    if (!process.env.RADAR_URL && !process.env.CADENCE_URL) sp.setRedirectBase(baseOf(req));
    res.writeHead(302, { Location: sp.authUrl() }); return res.end();
  }
  if (p === '/api/radar/spotify/callback' && req.method === 'GET') {
    const sp = await radar.spotify();
    if (!process.env.RADAR_URL && !process.env.CADENCE_URL) sp.setRedirectBase(baseOf(req));
    await sp.handleCallback(url.searchParams.get('code'));
    res.writeHead(302, { Location: '/#view-radar' }); return res.end();
  }
  if (p === '/api/radar/spotify' && req.method === 'GET') {
    const sp = await radar.spotify();
    if (!process.env.RADAR_URL && !process.env.CADENCE_URL) sp.setRedirectBase(baseOf(req));
    return send(res, 200, { redirect: sp.redirectUri() });
  }
  return send(res, 404, { error: 'Not found' });
};
