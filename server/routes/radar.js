'use strict';
/* Routes: Music Radar (Life). Its status and switch, running a scan / digest / archive pull, the dashboard data,
   thumbs up and down, community sources, the RSS feed, weekly digests, and connecting Spotify. */
const { NEXT, readBody, send } = require('../lib/http');
const radar = require('../services/radar');

// the address this Cadence was reached at, for links in the feed and Spotify's redirect
const baseOf = req => `${req.socket.encrypted ? 'https' : 'http'}://${String(req.headers.host || 'localhost').replace(/[^\w.\-:[\]]/g, '')}`;

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function radarRoutes(req, res, { url, p }) {
  if (!p.startsWith('/api/radar')) return NEXT;
  const body = async () => { try { return JSON.parse(await readBody(req, 64 * 1024) || '{}'); } catch { return {}; } };

  // (no blanket refresh on every POST: each change refreshes only what it touches, in services/radar.js. Clearing it all on a
  // thumbs or a Not for me made the NAS rebuild the whole page, and on a phone that showed as "Load failed".)
  // getting music: the queue, what's in the music folder, and playing a file from it (services/getmusic.js)
  if (p === '/api/radar/get' || p.startsWith('/api/radar/get/')) {
    const G = require('../services/getmusic');
    if (p === '/api/radar/get' && req.method === 'GET') return send(res, 200, await G.view());
    if (p === '/api/radar/get' && req.method === 'POST') { const r = G.add(await body()); return send(res, r.error ? 400 : 200, r); }
    if (p === '/api/radar/get/job' && req.method === 'POST') { const r = G.control(await body()); return send(res, r ? 200 : 404, r || { error: 'No such download' }); }
    if (p === '/api/radar/get/owned' && req.method === 'POST') return send(res, 200, await G.owned((await body()).items));
    if (p === '/api/radar/get/settings' && req.method === 'POST') return send(res, 200, G.settings(await body()));
    if (p === '/api/radar/get/file' && req.method === 'GET') return G.stream(req, res, url.searchParams.get('p'));
    return send(res, 404, { error: 'Not found' });
  }
  if (p === '/api/radar/find' && req.method === 'GET') return send(res, 200, await radar.find(url.searchParams.get('q')));   // artist suggestions as you type
  if (p === '/api/radar/jobs' && req.method === 'GET') return send(res, 200, require('../lib/scheduler').list('music'));
  if (p.startsWith('/api/radar/jobs/')) {
    const m = /^\/api\/radar\/jobs\/([\w.:-]{1,60})$/.exec(p);
    if (m && req.method === 'POST') { let b = {}; try { b = JSON.parse(await readBody(req, 4096) || '{}'); } catch {}
      try { const r = require('../lib/scheduler').control(m[1], b, 'music'); return r ? send(res, 200, r) : send(res, 404, { error: 'No such job' }); }
      catch (e) { return send(res, e.code === 400 ? 400 : 500, { error: e.message }); } }
  }
  if (p === '/api/radar/status' && req.method === 'GET') return send(res, 200, radar.status());
  if (p === '/api/radar/settings' && req.method === 'POST') { const b = await body(); radar.settings({ on: !!b.on }); return send(res, 200, radar.status()); }
  if (p === '/api/radar/run' && req.method === 'POST') {
    const b = await body();
    const started = b.what === 'digest' ? radar.digestNow() : b.what === 'sources' ? radar.sourcesNow(Array.isArray(b.only) ? b.only.map(String) : null) : radar.scan();
    return send(res, started ? 200 : 409, { started, ...radar.status() });
  }
  if (p === '/api/radar/sources' && req.method === 'POST') return send(res, 200, await radar.sourcesSettings(await body()));   // other sources: on/off, username, country, tags, blogs
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
  if (p === '/api/radar/artist') { const d = await radar.artist(url.searchParams.get('name'), { fresh: url.searchParams.get('fresh') === '1' }); return d ? send(res, 200, d) : send(res, 400, { error: 'Which artist?' }); }
  if (p === '/api/radar/preview') { try { return send(res, 200, await radar.preview(Object.fromEntries(url.searchParams))); } catch (e) { return send(res, e.code === 400 ? 400 : 502, { error: e.message }); } }
  if (p === '/api/radar/follow') { try { return send(res, 200, await radar.follow(req.method === 'POST' ? await body() : {})); } catch (e) { return send(res, 500, { error: e.message }); } }
  if (p === '/api/radar/shows') { try { return send(res, 200, await radar.shows(req.method === 'POST' ? await body() : {})); } catch (e) { return send(res, 502, { error: e.message }); } }
  if (p === '/api/radar/stg') return send(res, 200, await radar.stg(req.method === 'POST' ? { ...(await body()), year: url.searchParams.get('year') } : { year: url.searchParams.get('year') }));
  if (p === '/api/radar/mix') return send(res, 200, await radar.mix(req.method === 'POST' ? await body() : { week: url.searchParams.get('week') }));
  if (p === '/api/radar/mixcloud') return send(res, 200, await radar.mixcloud({ refresh: url.searchParams.get('refresh') === '1' }));
  if (p === '/api/radar/year') return send(res, 200, await radar.yearInMusic(url.searchParams.get('y')));
  if (p === '/api/radar/home') return send(res, 200, await radar.closeToHome());
  if (p === '/api/radar/releases') return send(res, 200, await radar.releases());
  if (p === '/api/radar/calledit') return send(res, 200, await radar.calledIt());
  if (p === '/api/radar/listen' && req.method === 'POST') return send(res, 200, await radar.listen(await body()));
  if (p === '/api/radar/discogs' && req.method === 'GET') return send(res, 200, url.searchParams.get('index') ? await radar.discogsIndex() : await radar.discogs(Object.fromEntries(url.searchParams)));
  if (p === '/api/radar/discogs/sync' && req.method === 'POST') { try { return send(res, 200, await radar.discogsSync()); } catch (e) { return send(res, 502, { error: e.message }); } }
  if (p === '/api/radar/discogs/want' && req.method === 'POST') { try { return send(res, 200, await radar.discogsWant(await body())); } catch (e) { return send(res, 502, { error: e.message }); } }
  if (p === '/api/radar/sound' && req.method === 'POST') return send(res, 200, await radar.sound(await body()));
  if (p === '/api/radar/nfm') return send(res, 200, await radar.notForMe(req.method === 'POST' ? await body() : null));
  if (p === '/api/radar/want') return send(res, 200, await radar.want(req.method === 'POST' ? await body() : null));
  if (p === '/api/radar/community') return send(res, 200, await radar.community(req.method === 'POST' ? await body() : null));
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
