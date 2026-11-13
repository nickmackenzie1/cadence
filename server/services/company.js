'use strict';
/* Company info: logo, banner, description, industry and brand colours from a client's website. */
const fs = require('fs');
const path = require('path');
const { API_KEY, BANNER_DIR, COMPANY_DIR, ICON_DIR } = require('../config');
const { safeFetch } = require('../lib/net');
const { callClaude } = require('./ai');
const { getIcon, sniff } = require('./favicons');

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

module.exports = { ENT, INDUSTRIES, brandColors, companyInfo, decode, fetchImage, guessIndustry, hexToRgb, hsl, meta, parseColor, toHex };
