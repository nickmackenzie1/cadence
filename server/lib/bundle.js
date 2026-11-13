'use strict';
/* One download instead of ~70: index.html marks its app scripts with <!-- bundle --> … <!-- /bundle -->. When the page is
   served, that block becomes a single <script src="bundle.js?v=HASH">, and bundle.js carries every file's source.
   It runs each one as its own inline <script> in the same order, so it behaves exactly like the separate tags did:
   files share the page's global scope, and one plugin that throws doesn't stop the rest. Each keeps its own name in
   devtools (sourceURL). bundle.js is gzipped once and cached by the browser until any file in it changes (new hash).
   Opening the app with ?nobundle, or setting CADENCE_BUNDLE=0 in the NAS .env, serves the plain tags for debugging.
   Nothing to build or commit: it's assembled from public/ in memory, rebuilt when a file's size or time changes. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { PUBLIC_DIR } = require('../config');

const BLOCK = /<!-- bundle -->([\s\S]*?)<!-- \/bundle -->/;
let cache = null; // { sig, hash, js, gz }

const enabled = url => process.env.CADENCE_BUNDLE !== '0' && !url.searchParams.has('nobundle');
const srcsOf = html => { const m = html.match(BLOCK); return m ? [...m[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map(x => x[1]) : null; };

function build(srcs) {
  const stats = srcs.map(s => { try { const st = fs.statSync(path.join(PUBLIC_DIR, s)); return `${s}:${st.size}:${st.mtimeMs}`; } catch (e) { return `${s}:missing`; } });
  const sig = stats.join('|');
  if (cache && cache.sig === sig) return cache;
  const files = srcs.map(s => { try { return [s, fs.readFileSync(path.join(PUBLIC_DIR, s), 'utf8')]; } catch (e) { return [s, `console.warn(${JSON.stringify('Cadence: missing ' + s)})`]; } });
  const js = `/* Cadence bundle: ${files.length} files, see server/lib/bundle.js */\n(function(F){for(var i=0;i<F.length;i++){var s=document.createElement('script');s.dataset.src=F[i][0];s.text=F[i][1]+'\\n//# sourceURL='+F[i][0];document.body.appendChild(s);}})(${JSON.stringify(files)});\n`;
  const buf = Buffer.from(js);
  cache = { sig, hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12), js: buf, gz: zlib.gzipSync(buf, { level: 6 }) };
  return cache;
}

// index.html with the block swapped for one tag (or untouched when bundling is off / the markers are missing)
function page(html, url) {
  const text = html.toString('utf8'), srcs = enabled(url) && srcsOf(text);
  if (!srcs || !srcs.length) return html;
  const b = build(srcs);
  return text.replace(BLOCK, `<script src="bundle.js?v=${b.hash}"></script>`);
}

// GET bundle.js — immutable when asked for by the current hash, otherwise revalidate
function serve(req, res, url) {
  let html; try { html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8'); } catch (e) { res.writeHead(404); return res.end(); }
  const srcs = srcsOf(html) || [], b = build(srcs), etag = `"${b.hash}"`;
  const head = { 'Content-Type': 'text/javascript; charset=utf-8', ETag: etag, Vary: 'Accept-Encoding', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': url.searchParams.get('v') === b.hash ? 'private, max-age=31536000, immutable' : 'no-cache' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, gz ? { ...head, 'Content-Encoding': 'gzip' } : head);
  res.end(gz ? b.gz : b.js);
}

module.exports = { page, serve };
