// Cadence self-hosted server — zero dependencies, Node 18+
// Serves the app, stores your data in /data, keeps daily backups,
// and (optionally) proxies AI extraction to the Anthropic API.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const PORT = +process.env.PORT || 8484;
const DATA_DIR = process.env.DATA_DIR || '/data';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PASSWORD = process.env.APP_PASSWORD || '';          // optional login
const USERNAME = process.env.APP_USERNAME || 'cadence';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';       // optional AI
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MODEL_QUICK = process.env.ANTHROPIC_MODEL_QUICK || 'claude-haiku-5-5';
const KEEP_BACKUPS = +process.env.KEEP_BACKUPS || 30;

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ICON_DIR = path.join(DATA_DIR, 'favicons');
const BANNER_DIR = path.join(DATA_DIR, 'banners');
const COMPANY_DIR = path.join(DATA_DIR, 'companies');
fs.mkdirSync(BANNER_DIR, { recursive: true });
fs.mkdirSync(COMPANY_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(ICON_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const STARTED = Date.now();

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function authorized(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, ...p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const a = Buffer.from(u + ':' + p.join(':')), b = Buffer.from(USERNAME + ':' + PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { json: null, updatedAt: 0 }; }
}
function writeState(obj) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, STATE_FILE);
  // one backup per day
  const day = new Date().toISOString().slice(0, 10);
  const bf = path.join(BACKUP_DIR, `state-${day}.json`);
  fs.copyFileSync(STATE_FILE, bf);
  const all = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('state-')).sort();
  while (all.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
}

// ---- favicons: fetched once per domain, cached in data/favicons ----
const inflight = new Map();
const sniff = b => b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b.slice(0, 4).toString() === 'GIF8' ? 'image/gif' : b.slice(0, 4).toString('hex') === '00000100' ? 'image/x-icon' : /<svg/i.test(b.slice(0, 300).toString()) ? 'image/svg+xml' : b.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
async function fetchIcon(domain) {
  const sources = [
    `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const url of sources) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100 || !sniff(buf)) continue;   // empty / not an image
      return buf;
    } catch { /* try next */ }
  }
  return null;
}
async function getIcon(domain) {
  const file = path.join(ICON_DIR, domain + '.img'), none = path.join(ICON_DIR, domain + '.none');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (fs.existsSync(none) && Date.now() - fs.statSync(none).mtimeMs < 864e5) return null;
  if (!inflight.has(domain)) inflight.set(domain, fetchIcon(domain).then(buf => {
    if (buf) fs.writeFileSync(file, buf); else fs.writeFileSync(none, '');
    inflight.delete(domain); return buf;
  }));
  return inflight.get(domain);
}

// ---- safe outbound fetch: public hosts only, redirects checked hop by hop ----
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && privateIp(x.slice(7));
}
async function assertPublic(u) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error('bad protocol');
  if (net.isIP(url.hostname)) throw new Error('ip literal');
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('private address');
}
async function safeFetch(u, opts = {}, max = 2 * 1024 * 1024) {
  let url = u;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 Cadence', 'Accept-Language': 'en' , ...(opts.headers || {}) } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url).href; continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const reader = r.body.getReader(); const chunks = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { reader.cancel(); break; } chunks.push(value); }
    return { url, type: r.headers.get('content-type') || '', buf: Buffer.concat(chunks.map(c => Buffer.from(c))) };
  }
  throw new Error('too many redirects');
}

// ---- company info: logo, banner, description, industry from the client's website ----
const INDUSTRIES = {
  software:      ['software','saas','platform','cloud','app ','apps','api','developer','cybersecurity','it services','managed services','tech'],
  manufacturing: ['manufactur','factory','industrial','machining','fabrication','oem','production','plant','precision','components'],
  healthcare:    ['health','medical','clinic','patient','dental','pharma','hospital','care','wellness','therapy'],
  legal:         ['law firm','legal','attorney','lawyer','litigation','counsel','barrister','solicitor'],
  finance:       ['accounting','cpa','bookkeeping','financial','wealth','investment','bank','tax','advisory','capital'],
  insurance:     ['insurance','broker','underwriting','claims','coverage'],
  realestate:    ['real estate','realty','property','properties','homes','mortgage','realtor','leasing'],
  construction:  ['construction','contractor','builder','renovation','roofing','hvac','plumbing','electrical','engineering'],
  retail:        ['shop','store','ecommerce','e-commerce','retail','boutique','buy now','collection','fashion','apparel'],
  logistics:     ['logistics','shipping','freight','transport','trucking','warehouse','distribution','courier','supply chain'],
  education:     ['school','education','university','college','learning','training','academy','course','students'],
  nonprofit:     ['nonprofit','non-profit','charity','foundation','donate','volunteer','mission'],
  hospitality:   ['hotel','restaurant','resort','travel','tourism','catering','events','hospitality','booking'],
  marketing:     ['marketing agency','digital agency','branding','seo','advertising','creative agency','design studio','media'],
  energy:        ['energy','solar','oil','gas','utilities','renewable','power','electric'],
  automotive:    ['automotive','dealership','auto ','car ','vehicle','motors'],
};
const meta = (html, name) => { const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i'); const tag = (html.match(re) || [])[0]; if (!tag) return ''; return ((tag.match(/content=["']([^"']*)["']/i) || [])[1] || '').trim(); };
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
function guessIndustry(text) {
  const t = ' ' + text.toLowerCase() + ' '; let best = null, score = 0;
  for (const [k, words] of Object.entries(INDUSTRIES)) { const sc = words.reduce((n, w) => n + (t.split(w).length - 1), 0); if (sc > score) { score = sc; best = k; } }
  return score >= 2 ? best : (score === 1 ? best : '');
}
// ---- brand colors: CSS custom properties named like brand/primary, meta theme colors, most-used saturated colors ----
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join(''); if (h.length === 8) h = h.slice(0, 6); if (h.length !== 6) return null; const n = parseInt(h, 16); return isNaN(n) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function parseColor(c) {
  c = c.trim().toLowerCase();
  if (c.startsWith('#')) return hexToRgb(c);
  const m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?/);
  if (m) { if (m[4] && parseFloat(m[4]) < (m[4].endsWith('%') ? 50 : 0.5)) return null; return [+m[1], +m[2], +m[3]]; }
  return null;
}
function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h * 360, s, l]; }
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
function brandColors(html, cssTexts, themeColor) {
  const score = new Map();
  const add = (c, w) => { const rgb = parseColor(c); if (!rgb) return; const [, sat, l] = hsl(rgb); if (sat < 0.28 || l < 0.12 || l > 0.9) return; const k = toHex(rgb.map(v => Math.round(v / 8) * 8 > 255 ? 255 : Math.round(v / 8) * 8)); score.set(k, (score.get(k) || 0) + w * (0.6 + sat)); };
  if (themeColor) add(themeColor, 40);
  for (const n of ['msapplication-TileColor', 'msapplication-navbutton-color']) { const m = html.match(new RegExp(`<meta[^>]+name=["']${n}["'][^>]+content=["']([^"']+)`, 'i')); if (m) add(m[1], 25); }
  const mask = html.match(/<link[^>]+rel=["']mask-icon["'][^>]+color=["']([^"']+)/i); if (mask) add(mask[1], 25);
  const all = [html.match(/<style[^>]*>[\s\S]*?<\/style>/gi)?.join('\n') || '', ...cssTexts].join('\n');
  for (const m of all.matchAll(/--[\w-]*(?:brand|primary|accent|main|theme|highlight)[\w-]*\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) add(m[1], 12);
  for (const m of all.matchAll(/(?:background(?:-color)?|color|border(?:-\w+)?-color|fill|stroke)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) add(m[1], 1);
  for (const m of html.matchAll(/style=["'][^"']*(?:background|color)[^:]*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) add(m[1], 2);
  // merge near-duplicates, keep distinct hues
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]), out = [];
  for (const [hex] of ranked) { const [h] = hsl(hexToRgb(hex)); if (out.every(o => { const [oh] = hsl(hexToRgb(o)); const d = Math.abs(oh - h); return Math.min(d, 360 - d) > 18; })) out.push(hex); if (out.length >= 5) break; }
  return out;
}

async function fetchImage(u) {
  try { const r = await safeFetch(u, {}, 3 * 1024 * 1024); return sniff(r.buf) && r.buf.length > 200 ? r.buf : null; } catch { return null; }
}
async function companyInfo(domain, refresh) {
  const jf = path.join(COMPANY_DIR, domain + '.json');
  if (!refresh && fs.existsSync(jf)) { const j = JSON.parse(fs.readFileSync(jf, 'utf8')); if (Array.isArray(j.colors) || !j.ok) return j; }
  let page = null;
  for (const u of [`https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`]) { try { page = await safeFetch(u); if (/html/i.test(page.type) || /<html/i.test(page.buf.slice(0, 2000).toString())) break; } catch { page = null; } }
  const out = { domain, fetchedAt: Date.now(), colors: [], name: '', description: '', industry: '', themeColor: '', hasLogo: false, hasBanner: false, ok: !!page };
  if (page) {
    const html = page.buf.toString('utf8'), base = page.url;
    const abs = h => { try { return new URL(decode(h), base).href; } catch { return null; } };
    out.name = decode(meta(html, 'og:site_name')) || decode((html.match(/<title[^>]*>([^<]{1,120})/i) || [])[1] || '').split(/\s[|\-–—:]\s/)[0];
    out.description = decode(meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description')).slice(0, 300);
    out.themeColor = (meta(html, 'theme-color').match(/^#[0-9a-f]{3,8}$/i) || [''])[0];
    // logo candidates: JSON-LD logo > apple-touch-icon > largest <link rel=icon>
    const cands = [];
    for (const m of html.matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/gi)) cands.push({ u: abs(m[1].replace(/\\\//g, '/')), s: 1000 });
    for (const m of html.matchAll(/<link[^>]+>/gi)) {
      const tag = m[0], rel = (tag.match(/rel=["']([^"']+)["']/i) || [])[1] || '', href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
      if (!href || !/icon/i.test(rel)) continue;
      const sz = +((tag.match(/sizes=["'](\d+)x\d+/i) || [])[1] || (/apple-touch/i.test(rel) ? 180 : /\.svg/i.test(href) ? 256 : 32));
      cands.push({ u: abs(href), s: sz });
    }
    cands.sort((a, b) => b.s - a.s);
    for (const c of cands.filter(c => c.u && c.s >= 64).slice(0, 4)) { const buf = await fetchImage(c.u); if (buf) { fs.writeFileSync(path.join(ICON_DIR, domain + '.img'), buf); try { fs.unlinkSync(path.join(ICON_DIR, domain + '.none')); } catch {} out.hasLogo = true; break; } }
    // stylesheets for brand colors (same site, first few, size-capped)
    const cssTexts = [];
    for (const m of [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].slice(0, 4)) {
      const href = (m[0].match(/href=["']([^"']+)["']/i) || [])[1]; const u = href && abs(href); if (!u) continue;
      try { const r = await safeFetch(u, {}, 700 * 1024); cssTexts.push(r.buf.toString('utf8')); } catch {}
    }
    out.colors = brandColors(html, cssTexts, out.themeColor);
    const og = meta(html, 'og:image') || meta(html, 'twitter:image');
    if (og) { const buf = await fetchImage(abs(og)); if (buf && buf.length > 2000) { fs.writeFileSync(path.join(BANNER_DIR, domain + '.img'), buf); out.hasBanner = true; } }
    const text = [out.name, out.description, meta(html, 'keywords'), decode((html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')].join(' ');
    out.industry = guessIndustry(text);
    if (API_KEY && (out.description || out.name)) {
      try {
        const ans = await callClaude(`Classify this company into exactly one industry key from: ${Object.keys(INDUSTRIES).join(', ')}, other.\nAlso write a plain one-sentence description (max 20 words) of what they do.\nReturn JSON only: {"industry":"key","description":"..."}\n\nName: ${out.name}\nWebsite text: ${text.slice(0, 1500)}`, 'quick');
        const j = JSON.parse((ans.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        if (j.industry && (INDUSTRIES[j.industry] || j.industry === 'other')) out.industry = j.industry === 'other' ? out.industry : j.industry;
        if (j.description) out.description = String(j.description).slice(0, 200);
      } catch {}
    }
  }
  if (!out.hasLogo) { try { fs.unlinkSync(path.join(ICON_DIR, domain + '.none')); } catch {} out.hasLogo = !!(await getIcon(domain)); }
  fs.writeFileSync(jf, JSON.stringify(out));
  return out;
}

async function callClaude(prompt, tier) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: tier === 'quick' ? MODEL_QUICK : MODEL, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j?.error?.message || 'Anthropic API error'); e.status = r.status; throw e; }
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Cadence", charset="UTF-8"' });
      return res.end('Login required');
    }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/^.*?\/api\//, '/api/'); // works behind a sub-path reverse proxy

    if (p === '/api/health') {
      const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
      const count = d => { try { return fs.readdirSync(d).length; } catch { return 0; } };
      return send(res, 200, { ok: true, ai: !!API_KEY, model: API_KEY ? MODEL : null, version: '0.5.0', uptime: Math.round((Date.now() - STARTED) / 1000), node: process.version,
        dataBytes: size(STATE_FILE), backups: count(BACKUP_DIR), logos: fs.readdirSync(ICON_DIR).filter(f => f.endsWith('.img')).length, companies: count(COMPANY_DIR), auth: !!PASSWORD, time: Date.now() });
    }

    if (p === '/api/state' && req.method === 'GET') return send(res, 200, readState());
    if (p === '/api/state' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      if (typeof body.json !== 'string' || typeof body.updatedAt !== 'number') return send(res, 400, { error: 'Bad payload' });
      const cur = readState();
      if ((cur.updatedAt || 0) > body.updatedAt) return send(res, 409, { error: 'Newer data on server', updatedAt: cur.updatedAt });
      JSON.parse(body.json); // validate
      writeState({ json: body.json, updatedAt: body.updatedAt });
      return send(res, 200, { ok: true });
    }

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
    if (p === '/api/banner') {
      const d = String(url.searchParams.get('d') || '').toLowerCase();
      if (!DOMAIN_RE.test(d)) return send(res, 400, { error: 'Bad domain' });
      const f = path.join(BANNER_DIR, d + '.img');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      const buf = fs.readFileSync(f);
      res.writeHead(200, { 'Content-Type': sniff(buf), 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      return res.end(buf);
    }

    if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

    // static files
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => e2 ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, idx, MIME['.html']));
      send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Cadence running on :${PORT}  data=${DATA_DIR}  ai=${API_KEY ? 'on' : 'off'}  auth=${PASSWORD ? 'on' : 'off'}`));
