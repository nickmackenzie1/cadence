'use strict';
/* Feeds: RSS/Atom to compact JSON, prices for store feeds, and the history used to chart how often feeds post. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');
const { decode, parseFeed } = require('../lib/feedparse');

// ---- feeds: RSS 2.0 / Atom -> compact JSON, cached 15 min ----
const feedCache = new Map();

// Parsing happens in a worker thread (2026-11-18, server speed-ups): a big feed no longer holds up every other request
// while it's read. One worker, kept for the life of the server; if it can't start, parsing falls back to here.
let worker = null, seq = 0;
const waiting = new Map();
function parseOff(text, url) {
  if (!worker) {
    try {
      worker = new (require('worker_threads').Worker)(path.join(__dirname, 'feed-worker.js'));
      worker.unref();
      worker.on('message', m => { const w = waiting.get(m.id); if (!w) return; waiting.delete(m.id); m.error ? w.reject(new Error(m.error)) : w.resolve(m.data); });
      worker.on('error', e => { for (const w of waiting.values()) w.reject(e); waiting.clear(); worker = null; });
      worker.on('exit', () => { worker = null; });
    } catch { return Promise.resolve(parseFeed(text, url)); }
  }
  const id = ++seq;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ id, text, url }); })
    .catch(() => parseFeed(text, url));
}
// fetch and parse one feed, and keep it (the route and the background job both use this)
async function fetchFeed(u) {
  const r = await safeFetch(u, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } }, 3 * 1024 * 1024);
  const data = { ...await parseOff(r.buf.toString('utf8'), r.url), fetchedAt: Date.now() };
  if (data.items.length || data.title) { feedCache.set(u, { at: Date.now(), data }); if (feedCache.size > 50) feedCache.delete(feedCache.keys().next().value); }
  return data;
}

// ---- prices for store feeds: many shop RSS feeds (e.g. record stores) carry no price, but each product page shows it.
// Only pages on the feed's own site are read, a few at a time, cached for 12h on the NAS.
const priceCache = new Map();
async function pagePrice(link) {
  const hit = priceCache.get(link); if (hit && Date.now() - hit.at < 12 * 3600e3) return hit.price;
  let price = null;
  try {
    const r = await safeFetch(link, { headers: { Accept: 'text/html' } }, 1.5 * 1024 * 1024);
    const html = r.buf.toString('utf8');
    const meta = html.match(/<meta[^>]+(?:property|itemprop|name)=["'](?:og:price:amount|product:price:amount|price)["'][^>]*content=["']([\d.,]+)["']/i) || html.match(/"price"\s*:\s*"?([\d.]+)"?/);
    const body = html.slice(Math.max(0, html.search(/<h1[\s>]/i)));   // the product's price comes after its heading; skips "Cart $0.00"
    const text = decode(body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
    const vis = text.match(/(C\$|CA\$|CAD\s?\$?|US\$|\$|£|€)\s?(\d{1,4}(?:[.,]\d{2})?)/);
    if (meta && +meta[1].replace(',', '.') > 0) price = (vis && /C/.test(vis[1]) ? 'C$' : '$') + (+meta[1].replace(',', '.')).toFixed(2);
    else if (vis && +vis[2].replace(',', '.') > 0) price = vis[1].replace(/\s/g, '').replace(/^CAD\$?$/, 'C$') + vis[2];
  } catch {}
  priceCache.set(link, { at: Date.now(), price }); if (priceCache.size > 800) priceCache.delete(priceCache.keys().next().value);
  return price;
}
async function addPrices(data, feedUrl, budgetMs) {
  let host; try { host = new URL(feedUrl).hostname.replace(/^www\./, ''); } catch { return; }
  const mine = data.items.filter(it => { try { return new URL(it.link).hostname.replace(/^www\./, '') === host; } catch { return false; } });
  const todo = mine.filter(it => { const h = priceCache.get(it.link); return !(h && Date.now() - h.at < 12 * 3600e3); });
  const work = (async () => { for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(it => pagePrice(it.link))); })();
  await Promise.race([work, new Promise(r => setTimeout(r, budgetMs))]);   // what's not ready yet fills in on the next refresh
  for (const it of mine) { const h = priceCache.get(it.link); if (h && h.price) it.price = h.price; }
}

// ---- feed history: every item a feed has ever shown, with when it first appeared, so we can chart how often a
// feed updates. Feeds you've opened in the last two weeks are also checked every 30 minutes in the background. ----
const FEEDLOG = path.join(DATA_DIR, 'feedlog.json');
let feedLog = null, feedLogT = 0;
const readFeedLog = () => { if (!feedLog) { try { feedLog = JSON.parse(fs.readFileSync(FEEDLOG, 'utf8')); } catch { feedLog = {}; } } return feedLog; };
const saveFeedLog = () => { clearTimeout(feedLogT); feedLogT = setTimeout(() => { try { fs.writeFileSync(FEEDLOG, JSON.stringify(feedLog)); } catch (e) { console.error('feedlog', e.message); } }, 2000); };
function logFeed(u, data, asked) {
  const L = readFeedLog(), fresh = !L[u], f = L[u] = L[u] || { title: '', seen: {}, asked: 0 }, now = Date.now();   // the first look is a baseline, not "new"
  f.title = data.title || f.title; if (asked) f.asked = now;
  for (const it of data.items || []) { const k = String(it.link || it.title || '').slice(0, 300); if (!k || f.seen[k]) continue; const pub = Date.parse(it.date) || 0; f.seen[k] = [fresh ? 0 : now, pub && pub < now + 864e5 ? pub : 0]; }
  const ks = Object.keys(f.seen); if (ks.length > 3000) for (const k of ks.slice(0, ks.length - 3000)) delete f.seen[k];
  saveFeedLog();
}
// feed history: recent feeds checked every 30 minutes, through the scheduler (one heavy job at a time, waits while you
// use Cadence). What it reads is kept, so opening one of these feeds is answered straight away.
require('../lib/scheduler').add('feeds', async () => {
  const L = readFeedLog();
  for (const [u, f] of Object.entries(L)) { if (Date.now() - (f.asked || 0) > 14 * 864e5) continue;
    try { logFeed(u, await fetchFeed(u), false); } catch {} }
}, { label: 'Feeds: checking for new items', heavy: true, quiet: true, every: 30 * 60e3 });

module.exports = { FEEDLOG, addPrices, feedCache, fetchFeed, parseOff, feedLog, feedLogT, logFeed, pagePrice, parseFeed, priceCache, readFeedLog, saveFeedLog };
