'use strict';
/* Favicons: fetched once per domain and cached in data/favicons. */
const fs = require('fs');
const path = require('path');
const { ICON_DIR } = require('../config');

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

// A logo at a known address (a radio station's own logo, say), fetched by the NAS and kept, so the browser never asks
// the station's server directly. Public addresses only, images only, 4 MB at most (band banners and fan art); a miss is remembered for a day.
const crypto = require('crypto');
async function getImage(u) {
  if (!/^https?:\/\//i.test(u) || u.length > 1500) return null;
  const id = 'u-' + crypto.createHash('sha1').update(u).digest('hex').slice(0, 24), file = path.join(ICON_DIR, id + '.img'), none = path.join(ICON_DIR, id + '.none');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (fs.existsSync(none) && Date.now() - fs.statSync(none).mtimeMs < 864e5) return null;
  if (!inflight.has(id)) inflight.set(id, (async () => {
    let buf = null;
    try { const { safeFetch } = require('../lib/net'); const r = await safeFetch(u, { headers: { Accept: 'image/*' }, timeout: 10000 }, 4 * 1024 * 1024); if (r.buf && r.buf.length >= 60 && sniff(r.buf)) buf = r.buf; } catch {}
    try { if (buf) fs.writeFileSync(file, buf); else fs.writeFileSync(none, ''); } catch {}
    inflight.delete(id); return buf;
  })());
  return inflight.get(id);
}

module.exports = { fetchIcon, getIcon, getImage, inflight, sniff };
