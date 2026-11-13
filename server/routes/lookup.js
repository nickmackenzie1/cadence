'use strict';
/* Routes: Things looked up on the web for you: AI, favicons, company info, site text, images, banners. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const path = require('path');
const { API_KEY, BANNER_DIR, COMPANY_DIR, ICON_DIR } = require('../config');
const { NEXT, readBody, send } = require('../lib/http');
const { DOMAIN_RE, safeFetch } = require('../lib/net');
const { callClaude } = require('../services/ai');
const { companyInfo, decode } = require('../services/company');
const { getIcon, sniff } = require('../services/favicons');

let imgCache = null;   // recently fetched images, in memory

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function lookupRoutes(req, res, { url, p }) {
  if (p === '/api/ai' && req.method === 'POST') {
    if (!API_KEY) return send(res, 501, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    const { prompt, tier } = JSON.parse(await readBody(req, 2 * 1024 * 1024));
    if (typeof prompt !== 'string' || !prompt) return send(res, 400, { error: 'Missing prompt' });
    try { return send(res, 200, { text: await callClaude(prompt, tier) }); }
    catch (e) { return send(res, e.status === 429 ? 429 : 502, { error: e.message }); }
  }

  if (p === '/api/favicon') {
    const d = String(url.searchParams.get('d') || '').toLowerCase();
    if (!DOMAIN_RE.test(d)) return send(res, 400, { error: 'Bad domain' });
    const buf = await getIcon(d);
    if (!buf) { res.writeHead(404, { 'Cache-Control': 'max-age=3600' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': sniff(buf), 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    return res.end(buf);
  }

  if (p === '/api/company') {
    const d = String(url.searchParams.get('d') || '').toLowerCase();
    if (!DOMAIN_RE.test(d)) return send(res, 400, { error: 'Bad domain' });
    const refresh = url.searchParams.get('refresh') === '1';
    if (refresh) { for (const f of [path.join(ICON_DIR, d + '.img'), path.join(ICON_DIR, d + '.none'), path.join(BANNER_DIR, d + '.img')]) { try { fs.unlinkSync(f); } catch {} } }
    return send(res, 200, await companyInfo(d, refresh));
  }
  // a client's website as plain text (homepage + about page), for AI research. Cached a week on the NAS.
  if (p === '/api/sitetext') {
    const d = String(url.searchParams.get('d') || '').toLowerCase();
    if (!DOMAIN_RE.test(d)) return send(res, 400, { error: 'Bad domain' });
    const f = path.join(COMPANY_DIR, d + '.text.json');
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (Date.now() - j.at < 7 * 864e5 && url.searchParams.get('refresh') !== '1') return send(res, 200, j); } catch {}
    const strip = h => decode(String(h).replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const pages = [];
    for (const u of [`https://${d}/`, `https://www.${d}/`]) { try { const r = await safeFetch(u, { headers: { Accept: 'text/html' } }, 2 * 1024 * 1024); pages.push({ url: r.url, text: strip(r.buf.toString('utf8')).slice(0, 6000) }); break; } catch {} }
    for (const sub of ['about', 'about-us', 'company']) { if (pages.length > 1) break; try { const r = await safeFetch(`https://${d}/${sub}`, { headers: { Accept: 'text/html' } }, 2 * 1024 * 1024); if (/html/i.test(r.type)) pages.push({ url: r.url, text: strip(r.buf.toString('utf8')).slice(0, 5000) }); } catch {} }
    const out = { at: Date.now(), domain: d, pages };
    try { fs.writeFileSync(f, JSON.stringify(out)); } catch {}
    return send(res, 200, out);
  }
  // image proxy (mural mosaic targets): raster images only, SSRF-safe, small memory cache
  if (p === '/api/img') {
    const u = url.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(u)) return send(res, 400, { error: 'Bad url' });
    imgCache = imgCache || new Map();
    let hit = imgCache.get(u);
    if (!hit) {
      try { const r = await safeFetch(u, { headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*' } }, 8 * 1024 * 1024); const type = sniff(r.buf); if (!type || type === 'image/svg+xml') return send(res, 415, { error: 'Not a raster image' }); hit = { type, buf: r.buf }; imgCache.set(u, hit); if (imgCache.size > 24) imgCache.delete(imgCache.keys().next().value); }
      catch (e) { return send(res, 502, { error: e.message }); }
    }
    res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' }); return res.end(hit.buf);
  }

  if (p === '/api/banner') {
    const d = String(url.searchParams.get('d') || '').toLowerCase();
    if (!DOMAIN_RE.test(d)) return send(res, 400, { error: 'Bad domain' });
    const f = path.join(BANNER_DIR, d + '.img');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const buf = fs.readFileSync(f);
    res.writeHead(200, { 'Content-Type': sniff(buf), 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    return res.end(buf);
  }
  return NEXT;   // not ours
};
