'use strict';
/* Free-licence photos for themes from Wikimedia Commons (user, 2026-11-18): a theme names a subject ("Lake Ontario
   sunset", "campsite tent forest night"), and this finds wide photos under CC0, CC BY, CC BY-SA or public domain,
   preferring Commons' own Quality images, with the photographer and licence for the credit line. Looked up once
   (kept 30 days in data/commons.json); pictures come through the NAS (data/commons-img), so the browser can read their
   colours. No key needed. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

const API = () => (process.env.COMMONS_API || 'https://commons.wikimedia.org').replace(/\/$/, '');
const UA = 'Cadence/1 (self-hosted to-do app; theme backgrounds)';
async function get(url, max = 2 * 1024 * 1024) {
  // a test's stand-in (COMMONS_API set) directly; the real Commons through the public-hosts-only fetch
  if (process.env.COMMONS_API) { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return { buf: Buffer.from(await r.arrayBuffer()) }; }
  return safeFetch(url, { headers: { 'User-Agent': UA }, timeout: 15000 }, max);
}
const CACHE = () => path.join(DATA_DIR, 'commons.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE(), 'utf8')); } catch { return {}; } };
const writeCache = c => { try { fs.writeFileSync(CACHE(), JSON.stringify(c)); } catch {} };
const plain = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const FREE = /^(cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?|public domain|pd\b|attribution|fal\b)/i;

async function search(q, quality) {
  const qs = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${q} filetype:bitmap${quality ? ' incategory:Quality_images' : ''}`, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1920' });
  const j = JSON.parse((await get(`${API()}/w/api.php?${qs}`)).buf.toString('utf8'));
  const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const ii = (p.imageinfo || [])[0]; if (!ii) continue;
    const m = ii.extmetadata || {}, lic = plain(m.LicenseShortName && m.LicenseShortName.value);
    if (!FREE.test(lic) || (m.NonFree && m.NonFree.value)) continue;
    if (!(ii.width >= 1400 && ii.width >= ii.height * 1.2)) continue;   // wide enough to sit behind the app
    const who = plain(m.Artist && m.Artist.value) || plain(m.Credit && m.Credit.value) || 'Unknown photographer';
    const src = ii.thumburl || ii.url; if (!src) continue;
    out.push({ src, credit: `${who.slice(0, 80)}, ${lic}, via Wikimedia Commons`, link: ii.descriptionurl || `${API()}/wiki/${encodeURIComponent(p.title)}`, title: p.title });
  }
  return out;
}
// a subject's photos (best first), each as a NAS address with its credit
async function photos(q) {
  q = String(q || '').trim().slice(0, 100); if (!q) throw Object.assign(new Error('Which subject?'), { code: 400 });
  const key = q.toLowerCase(), c = readCache();
  if (c[key] && Date.now() - c[key].at < 30 * 86400e3) return c[key].v;
  let list = await search(q, true); if (list.length < 3) list = [...list, ...(await search(q, false)).filter(x => !list.some(y => y.src === x.src))];
  const imgs = c._img || {};
  const v = { q, photos: list.slice(0, 8).map(x => { const id = crypto.createHash('sha1').update(x.src).digest('hex').slice(0, 20); imgs[id] = x.src; return { url: `api/commons/img/${id}.jpg`, credit: x.credit, link: x.link }; }) };
  if (!v.photos.length) v.none = true;
  c._img = imgs; c[key] = { at: Date.now(), v }; writeCache(c);
  return v;
}
// one photo, kept on the NAS after the first time; only ones a search above handed out
async function img(name, res) {
  const m = /^([0-9a-f]{20})\.jpg$/.exec(name); if (!m) { res.writeHead(404); return res.end(); }
  const dir = path.join(DATA_DIR, 'commons-img'), f = path.join(dir, m[1] + '.jpg');
  let buf; try { buf = fs.readFileSync(f); } catch {}
  if (!buf) {
    const src = (readCache()._img || {})[m[1]]; if (!src) { res.writeHead(404); return res.end(); }
    try { buf = (await get(src, 12 * 1024 * 1024)).buf; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, buf); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: "Couldn't get that photo from Wikimedia Commons" })); }
  }
  const type = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=2592000', 'X-Content-Type-Options': 'nosniff' });
  res.end(buf);
}
module.exports = { photos, img };
