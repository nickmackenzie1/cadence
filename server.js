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
const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
const decode = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();
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
  const out = { title: decode(tag(head, 'title')), link: atom ? abs(attr(head, 'link', 'href')) : abs(tag(head, 'link')), image: abs(tag(tag(head, 'image'), 'url') || tag(head, 'logo') || tag(head, 'icon')), items: [] };
  const blocks = chan.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, 40)) {
    const html = tag(b, 'content:encoded') || tag(b, 'content') || tag(b, 'description') || tag(b, 'summary');
    const img = attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url') || (/<enclosure[^>]+type=["']image/i.test(b) ? attr(b, 'enclosure', 'url') : '') || attr(b, 'itunes:image', 'href') || (decode(html).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    out.items.push({
      title: decode(tag(b, 'title')).slice(0, 300),
      link: atom ? abs(attr(b, 'link', 'href')) : abs(tag(b, 'link') || tag(b, 'guid')),
      date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date') || '',
      image: img ? bigger(abs(img)) : '',
      summary: strip(html),
    });
  }
  return out;
}

// ---- calendars: iCal (.ics) feeds -> events, with recurrence + time zones. URLs stay on the NAS. ----
const CAL_FILE = path.join(DATA_DIR, 'calendars.json');
let imgCache = null;
const icsCache = new Map();
const WINTZ = { 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles', 'Atlantic Standard Time': 'America/Halifax', 'Newfoundland Standard Time': 'America/St_Johns', 'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest', 'India Standard Time': 'Asia/Kolkata', 'AUS Eastern Standard Time': 'Australia/Sydney', 'UTC': 'UTC' };
const LOCAL_TZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
function tzOffset(ms, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  } catch { return 0; }
}
function zoned(y, mo, d, h, mi, s, tz) { const g = Date.UTC(y, mo, d, h, mi, s); let t = g - tzOffset(g, tz); t = g - tzOffset(t, tz); return t; }
function readCals() { try { return JSON.parse(fs.readFileSync(CAL_FILE, 'utf8')); } catch { return { calendars: [] }; } }
function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const evs = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, exdate: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1), [name, ...ps] = head.split(';');
    const params = Object.fromEntries(ps.map(p => { const [k, v] = p.split('='); return [k.toUpperCase(), (v || '').replace(/^"|"$/g, '')]; }));
    const key = name.toUpperCase();
    if (key === 'EXDATE') cur.exdate.push(...val.split(',').map(v => ({ v, params })));
    else if (key === 'ATTENDEE') (cur.att = cur.att || []).push({ v: val, params });
    else cur.props[key] = { v: val, params };
  }
  return evs;
}
const unesc = s => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
function icsTime(p) {
  if (!p) return null;
  const v = p.v.trim(), m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2] - 1, +m[3]];
  if (!m[4] || p.params.VALUE === 'DATE') return { allDay: true, wall: [y, mo, d, 0, 0, 0], tz: LOCAL_TZ, ms: zoned(y, mo, d, 0, 0, 0, LOCAL_TZ) };
  const wall = [y, mo, d, +m[4], +m[5], +(m[6] || 0)];
  if (m[7]) return { allDay: false, wall, tz: 'UTC', ms: Date.UTC(...wall) };
  const tz = WINTZ[p.params.TZID] || p.params.TZID || LOCAL_TZ;
  return { allDay: false, wall, tz, ms: zoned(...wall, tz) };
}
const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function expand(ev, from, to) {
  const st = icsTime(ev.props.DTSTART); if (!st) return [];
  const en = icsTime(ev.props.DTEND); const dur = en ? en.ms - st.ms : (st.allDay ? 864e5 : 30 * 60e3);
  const rule = ev.props.RRULE && Object.fromEntries(ev.props.RRULE.v.split(';').map(kv => kv.split('=')));
  const ex = new Set(ev.exdate.map(e => { const t = icsTime(e); return t && t.ms; }).filter(Boolean));
  if (!rule) return st.ms + dur >= from && st.ms <= to ? [st.ms] : [];
  const freq = rule.FREQ, interval = +(rule.INTERVAL || 1), count = rule.COUNT ? +rule.COUNT : Infinity;
  const until = rule.UNTIL ? (icsTime({ v: rule.UNTIL, params: {} }) || {}).ms : Infinity;
  const byday = rule.BYDAY ? rule.BYDAY.split(',').map(x => DAYS[x.slice(-2)]).filter(x => x != null) : null;
  const [y0, m0, d0, h, mi, s] = st.wall, out = []; let n = 0;
  const at = (y, mo, d) => zoned(y, mo, d, h, mi, s, st.tz);
  const day0 = Date.UTC(y0, m0, d0);
  const push = ms => { if (ms < st.ms) return true; if (ms > until || n >= count) return false; n++; if (!ex.has(ms) && ms + dur >= from && ms <= to) out.push(ms); return ms <= to; };
  for (let k = 0; k < 2000; k++) {
    let cont = true;
    if (freq === 'DAILY') { const t = new Date(day0 + k * interval * 864e5); cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
    else if (freq === 'WEEKLY') {
      const wk = day0 - new Date(day0).getUTCDay() * 864e5 + k * interval * 7 * 864e5;
      for (const dw of (byday || [new Date(day0).getUTCDay()]).slice().sort()) { const t = new Date(wk + dw * 864e5); if (!(cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())))) break; }
    } else if (freq === 'MONTHLY') { const t = new Date(Date.UTC(y0, m0 + k * interval, 1)); const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); const dd = +(rule.BYMONTHDAY || d0); if (dd <= dim) cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), dd)); }
    else if (freq === 'YEARLY') { cont = push(at(y0 + k * interval, m0, d0)); }
    else break;
    if (!cont) break;
  }
  return out;
}
async function calendarEvents(days) {
  const from = Date.now() - 864e5, to = Date.now() + days * 864e5, out = [];
  for (const cal of readCals().calendars) {
    if (!cal.url) continue;
    let text; const hit = icsCache.get(cal.url);
    if (hit && Date.now() - hit.at < 10 * 60e3) text = hit.text;
    else { try { const r = await safeFetch(cal.url.replace(/^webcal:/i, 'https:'), {}, 8 * 1024 * 1024); text = r.buf.toString('utf8'); icsCache.set(cal.url, { at: Date.now(), text }); } catch (e) { if (hit) text = hit.text; else { out.push({ error: true, cal: cal.id, message: e.message }); continue; } } }
    const evs = parseICS(text), overrides = new Map();
    for (const ev of evs) if (ev.props['RECURRENCE-ID']) { const t = icsTime(ev.props['RECURRENCE-ID']); if (t) overrides.set((ev.props.UID || {}).v + '|' + t.ms, ev); }
    for (const ev of evs) {
      if (ev.props['RECURRENCE-ID']) continue;
      const uid = (ev.props.UID || {}).v || Math.random().toString(36);
      for (const ms of expand(ev, from, to)) {
        const e = overrides.get(uid + '|' + ms) || ev;
        if (/CANCELLED/i.test((e.props.STATUS || {}).v || '')) continue;
        const st = icsTime(e.props.DTSTART), en = icsTime(e.props.DTEND), base = e === ev ? ms : st.ms;
        const dur = en && st ? en.ms - st.ms : (st && st.allDay ? 864e5 : 30 * 60e3);
        const desc = unesc((e.props.DESCRIPTION || {}).v), loc = unesc((e.props.LOCATION || {}).v);
        const join = ((desc + ' ' + loc).match(/https:\/\/[^\s<>"]*(zoom\.us\/[jw]\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|webex\.com\/)[^\s<>"]*/i) || [])[0] || '';
        out.push({ id: uid + '@' + base, cal: cal.id, title: unesc((e.props.SUMMARY || {}).v) || '(no title)', start: base, end: base + dur, allDay: !!(st && st.allDay),
          location: loc.slice(0, 200), join, description: desc.slice(0, 600),
          attendees: (e.att || []).map(a => ({ email: a.v.replace(/^mailto:/i, '').toLowerCase(), name: a.params.CN || '' })).slice(0, 40),
          organizer: ((e.props.ORGANIZER || {}).v || '').replace(/^mailto:/i, '').toLowerCase() });
      }
    }
  }
  return out.sort((a, b) => (a.start || 0) - (b.start || 0));
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

    // ---- DB viewer: read-only look at the data folder (secrets are never listed by content) ----
    if (p === '/api/db' && req.method === 'GET') {
      const walk = d => { let bytes = 0, files = 0; try { for (const f of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, f)); if (st.isDirectory()) { const w = walk(path.join(d, f)); bytes += w.bytes; files += w.files; } else { bytes += st.size; files++; } } } catch {} return { bytes, files }; };
      const entries = []; try { for (const f of fs.readdirSync(DATA_DIR)) { const st = fs.statSync(path.join(DATA_DIR, f)); entries.push(st.isDirectory() ? { name: f + '/', dir: true, ...walk(path.join(DATA_DIR, f)), mtime: st.mtimeMs } : { name: f, bytes: st.size, mtime: st.mtimeMs, secret: f === 'calendars.json' }); } } catch {}
      let backups = []; try { backups = fs.readdirSync(BACKUP_DIR).filter(f => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().map(f => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, bytes: st.size, mtime: st.mtimeMs }; }); } catch {}
      return send(res, 200, { dataDir: DATA_DIR, entries, backups, keep: KEEP_BACKUPS });
    }
    if (p === '/api/db/backup' && req.method === 'GET') {
      const name = url.searchParams.get('name') || '';
      if (!/^state-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return send(res, 400, { error: 'Bad name' });
      try { return send(res, 200, JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8'))); } catch { return send(res, 404, { error: 'Not found' }); }
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

    if (p === '/api/feed') {
      const u = String(url.searchParams.get('url') || '');
      if (!/^https?:\/\//i.test(u) || u.length > 2000) return send(res, 400, { error: 'Bad feed URL' });
      const hit = feedCache.get(u);
      if (hit && Date.now() - hit.at < 15 * 60 * 1000 && url.searchParams.get('refresh') !== '1') return send(res, 200, hit.data);
      try {
        const r = await safeFetch(u, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } }, 3 * 1024 * 1024);
        const data = { ...parseFeed(r.buf.toString('utf8'), r.url), fetchedAt: Date.now() };
        if (!data.items.length && !data.title) return send(res, 422, { error: 'That URL is not an RSS or Atom feed' });
        feedCache.set(u, { at: Date.now(), data }); if (feedCache.size > 50) feedCache.delete(feedCache.keys().next().value);
        return send(res, 200, data);
      } catch (e) { return hit ? send(res, 200, hit.data) : send(res, 502, { error: 'Could not fetch feed: ' + e.message }); }
    }
    if (p === '/api/calendar/config' && req.method === 'GET') {
      // never send the secret URLs back to the browser
      return send(res, 200, { calendars: readCals().calendars.map(c => ({ id: c.id, name: c.name, color: c.color, host: (() => { try { return new URL(c.url.replace(/^webcal:/i, 'https:')).hostname; } catch { return ''; } })() })) });
    }
    if (p === '/api/calendar/config' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req, 64 * 1024)), old = readCals().calendars;
      const cals = (body.calendars || []).slice(0, 10).map(c => ({ id: String(c.id || Date.now()).slice(0, 40), name: String(c.name || 'Calendar').slice(0, 60), color: /^#[0-9a-f]{3,8}$/i.test(c.color || '') ? c.color : '#5b5bd6', url: c.url ? String(c.url).trim() : ((old.find(o => o.id === c.id) || {}).url || '') }))
        .filter(c => /^(https?|webcal):\/\//i.test(c.url));
      fs.writeFileSync(CAL_FILE, JSON.stringify({ calendars: cals })); try { fs.chmodSync(CAL_FILE, 0o600); } catch {}
      icsCache.clear(); return send(res, 200, { ok: true, count: cals.length });
    }
    if (p === '/api/calendar/events') {
      const days = Math.min(60, Math.max(1, +url.searchParams.get('days') || 14));
      if (url.searchParams.get('refresh') === '1') icsCache.clear();
      return send(res, 200, { events: await calendarEvents(days), tz: LOCAL_TZ, at: Date.now() });
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
