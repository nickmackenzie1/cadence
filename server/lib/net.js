'use strict';
/* Safe outbound fetch: public hosts only, redirects checked hop by hop, size limits. Every fetch the server makes
   on your behalf goes through here, so a feed or a website can never reach into your home network. */
const dns = require('dns').promises;
const net = require('net');

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

module.exports = { DOMAIN_RE, assertPublic, privateIp, safeFetch };
