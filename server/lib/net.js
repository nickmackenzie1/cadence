'use strict';
/* Safe outbound fetch: public hosts only, redirects checked hop by hop, size limits. Every fetch the server makes
   on your behalf goes through here, so a feed or a website can never reach into your home network. */
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

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
// The address is checked again inside the connection's own DNS lookup, so a hostile domain can't pass the check
// above with a public address and then switch to a LAN address for the actual connection (DNS rebinding).
function guardedLookup(host, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  dns.lookup(host, { all: true }).then(addrs => {
    if (!addrs.length || addrs.some(a => privateIp(a.address))) return cb(Object.assign(new Error('private address'), { code: 'EPRIVATE' }));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  }, cb);
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 Cadence';
// one GET through node:http(s) with the guarded lookup; decompresses, stops reading past `max` bytes
function getOnce(url, headers, max, ms) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method: 'GET', lookup: guardedLookup, agent: false, headers: { 'User-Agent': UA, 'Accept-Language': 'en', 'Accept-Encoding': 'gzip, deflate, br', ...headers } }, res => {
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const body = enc === 'gzip' || enc === 'x-gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks = []; let size = 0, done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }); };
      if (res.statusCode >= 300 && res.statusCode < 400) { res.resume(); return finish(); }
      body.on('data', c => { if (done) return; size += c.length; if (size > max) { chunks.push(c.subarray(0, c.length - (size - max))); finish(); req.destroy(); return; } chunks.push(c); });
      body.on('end', finish);
      body.on('error', e => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
    const timer = setTimeout(() => req.destroy(new Error('timeout')), ms);
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.end();
  });
}
async function safeFetch(u, opts = {}, max = 2 * 1024 * 1024) {
  let url = u;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const r = await getOnce(url, opts.headers || {}, max, 8000);
    if (r.status >= 300 && r.status < 400 && r.headers.location) { url = new URL(r.headers.location, url).href; continue; }
    if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
    return { url, type: String(r.headers['content-type'] || ''), buf: r.buf };
  }
  throw new Error('too many redirects');
}

module.exports = { DOMAIN_RE, assertPublic, guardedLookup, privateIp, safeFetch };
