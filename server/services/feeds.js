'use strict';
/* Feeds: RSS/Atom to compact JSON, prices for store feeds, and the history used to chart how often feeds post. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');
const { decode } = require('./company');

// ---- feeds: RSS 2.0 / Atom -> compact JSON, cached 15 min ----
const feedCache = new Map();
function parseFeed(xml, base) {
  const tag = (src, name) => { const m = src.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() : ''; };
  const attr = (src, name, a) => { const m = src.match(new RegExp(`<${name}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i')); return m ? m[1] : ''; };
  const abs = u => { try { return u ? new URL(decode(u), base).href : ''; } catch { return ''; } };
  const strip = h => decode(String(h).replace(/<[^>]+>/g, ' ')).slice(0, 280);
  const bigger = u => u.replace(/\/(\d{2,3})x(\d{2,3})x(\d)\//, '/400x400x$3/');   // Lightspeed-style thumbnail sizes
  const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const chan = atom ? xml : (tag(xml, 'channel') || xml);
  const head = chan.split(atom ? /<entry[\s>]/i : /<item[\s>]/i)[0];
  const out = { title: decode(tag(head, 'title')), link: atom ? abs(attr(head, 'link', 'href')) : abs(tag(head, 'link')), image: abs(tag(tag(head, 'image'), 'url') || attr(head, 'itunes:image', 'href') || tag(head, 'logo') || tag(head, 'icon')), items: [] };
  const blocks = chan.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, 60)) {
    const html = tag(b, 'content:encoded') || tag(b, 'content') || tag(b, 'description') || tag(b, 'summary');
    const img = attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url') || (/<enclosure[^>]+type=["']image/i.test(b) ? attr(b, 'enclosure', 'url') : '') || attr(b, 'itunes:image', 'href') || (decode(html).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    out.items.push({
      title: decode(tag(b, 'title')).slice(0, 300),
      link: atom ? abs(attr(b, 'link', 'href')) : abs(tag(b, 'link') || tag(b, 'guid')),
      date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date') || '',
      image: img ? bigger(abs(img)) : '',
      summary: strip(html),
      // podcasts
      audio: /<enclosure[^>]+type=["']audio/i.test(b) ? abs(attr(b, 'enclosure', 'url')) : '',
      duration: tag(b, 'itunes:duration').slice(0, 12),
      // news: the publisher (Google News puts it in <source>)
      source: decode(tag(b, 'source')).slice(0, 80),
      // Letterboxd diary entries
      film: tag(b, 'letterboxd:filmTitle') ? { title: decode(tag(b, 'letterboxd:filmTitle')).slice(0, 200), year: tag(b, 'letterboxd:filmYear').slice(0, 4), rating: parseFloat(tag(b, 'letterboxd:memberRating')) || null, rewatch: /yes/i.test(tag(b, 'letterboxd:rewatch')), watched: tag(b, 'letterboxd:watchedDate').slice(0, 10), liked: /yes/i.test(tag(b, 'letterboxd:memberLike')) } : null,
    });
  }
  return out;
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
setInterval(async () => {
  const L = readFeedLog();
  for (const [u, f] of Object.entries(L)) { if (Date.now() - (f.asked || 0) > 14 * 864e5) continue;
    try { const r = await safeFetch(u, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } }, 3 * 1024 * 1024); logFeed(u, parseFeed(r.buf.toString('utf8'), r.url), false); } catch {} }
}, 30 * 60e3).unref();

module.exports = { FEEDLOG, addPrices, feedCache, feedLog, feedLogT, logFeed, pagePrice, parseFeed, priceCache, readFeedLog, saveFeedLog };
