'use strict';
/* Routes: Feeds and their activity history. Each handler answers or leaves the request for the next. */
const { NEXT, send } = require('../lib/http');
const { LOCAL_TZ } = require('../services/calendar');
const { addPrices, feedCache, fetchFeed, logFeed, readFeedLog } = require('../services/feeds');
const refreshing = new Set();

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function feedsRoutes(req, res, { url, p }) {
  if (p === '/api/feed/stats') {
    // per feed: items per day by when Cadence first saw them and by their publish date, plus weekday/hour patterns
    const L = readFeedLog(), want = url.searchParams.get('url'), dayKey = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: LOCAL_TZ });
    const out = Object.entries(L).filter(([u]) => !want || u === want).map(([u, f]) => {
      const seen = {}, pub = {}, wd = Array(7).fill(0), hr = Array(24).fill(0); let first = Infinity, last = 0;
      for (const [s1, p1] of Object.values(f.seen)) { if (s1) { seen[dayKey(s1)] = (seen[dayKey(s1)] || 0) + 1; first = Math.min(first, s1); }
        if (p1) { pub[dayKey(p1)] = (pub[dayKey(p1)] || 0) + 1; last = Math.max(last, p1); const d = new Date(new Date(p1).toLocaleString('en-US', { timeZone: LOCAL_TZ })); wd[d.getDay()]++; hr[d.getHours()]++; } }
      return { url: u, title: f.title, seen, published: pub, weekday: wd, hour: hr, since: first === Infinity ? null : first, lastPublished: last || null, total: Object.keys(f.seen).length };
    });
    return send(res, 200, { feeds: out, tz: LOCAL_TZ });
  }
  if (p === '/api/feed') {
    const u = String(url.searchParams.get('url') || '');
    if (!/^https?:\/\//i.test(u) || u.length > 2000) return send(res, 400, { error: 'Bad feed URL' });
    const hit = feedCache.get(u);
    const ttl = Math.max(2, Math.min(60, +url.searchParams.get('ttl') || 15)) * 60 * 1000;   // minutes, 2–60 (status pages want fresher data)
    const wantPrices = url.searchParams.get('prices') === '1';
    if (hit && Date.now() - hit.at < ttl && url.searchParams.get('refresh') !== '1') { if (wantPrices) await addPrices(hit.data, u, 1500); return send(res, 200, hit.data); }
    // kept but older than asked for: answer with it now and fetch a fresh copy behind the scenes (2026-11-18)
    if (hit && url.searchParams.get('refresh') !== '1') {
      if (!refreshing.has(u)) { refreshing.add(u); fetchFeed(u).then(d => logFeed(u, d, true), () => {}).finally(() => refreshing.delete(u)); }
      if (wantPrices) await addPrices(hit.data, u, 1500);
      return send(res, 200, hit.data);
    }
    try {
      const data = await fetchFeed(u);
      if (!data.items.length && !data.title) return send(res, 422, { error: 'That URL is not an RSS or Atom feed' });
      if (wantPrices) await addPrices(data, u, 6000);
      logFeed(u, data, true);
      return send(res, 200, data);
    } catch (e) { return hit ? send(res, 200, hit.data) : send(res, 502, { error: "Couldn't reach this feed just now. It'll try again next time.", detail: e.message }); }
  }
  return NEXT;   // not ours
};
