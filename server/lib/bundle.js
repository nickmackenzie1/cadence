'use strict';
/* One download instead of ~70, and only the plugins you use.
   index.html marks its app scripts with <!-- bundle --> … <!-- /bundle -->. When the page is served, that block becomes
   a small inline script plus one <script src="bundle.js?v=HASH&skip=…">:
   - bundle.js carries every file's source and runs each as its own inline <script>, in order, so it behaves exactly
     like the separate tags: shared globals, one plugin that throws doesn't stop the rest, devtools names via sourceURL.
   - the inline script knows which plugins live in which file (a manifest built here by running each plugin file in a
     sandbox that only records Cadence.registerPlugin({...})), reads which plugins are switched off in your Work and
     Life spaces from this browser's saved copy, and leaves out files whose plugins are all off in both. core.js adds
     those plugins to Settings → Plugins as placeholders and fetches bundle.js?only=<file> the moment one is switched on.
   - files other code leans on (ALWAYS) are never left out.
   Gzipped once per combination, cached by the browser until a file changes (new hash).
   Opening the app with ?nobundle, or CADENCE_BUNDLE=0 in the NAS .env, serves the plain tags for debugging.
   Nothing to build or commit: it's assembled from public/ in memory, rebuilt when a file's size or time changes. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const crypto = require('crypto');
const { PUBLIC_DIR } = require('../config');

const BLOCK = /<!-- bundle -->([\s\S]*?)<!-- \/bundle -->/;
// provide globals other code uses (island toasts, the date picker, templates, chase/recap/prep, weather, the Life kit)
const ALWAYS = new Set(['plugins/island.js', 'plugins/datepick.js', 'plugins/templates.js', 'plugins/chase.js', 'plugins/recap.js', 'plugins/prep.js', 'plugins/weather.js', 'plugins/life-kit.js']);
const META = ['id', 'name', 'version', 'icon', 'color', 'category', 'tagline', 'description', 'spaces', 'builtin'];
let cache = null; // { sig, hash, files: [[src, code]], manifest, out: Map(key → { js, gz, etag }) }

const enabled = url => process.env.CADENCE_BUNDLE !== '0' && !url.searchParams.has('nobundle');
const srcsOf = html => { const m = html.match(BLOCK); return m ? [...m[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map(x => x[1]) : null; };
const skippable = src => src.startsWith('plugins/') && !src.startsWith('plugins/themes') && !ALWAYS.has(src);

// run the plugin files in a throwaway sandbox (in page order, sharing globals like the browser) and record what each registers
function manifestOf(files) {
  const stub = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === Symbol.iterator ? function* () {} : stub, apply: () => stub, construct: () => stub, set: () => true, has: () => false });
  let defs = [];
  const noop = () => 0, g = { CustomEvent: function () {}, Event: function () {}, HTMLElement: function () {}, MutationObserver: function () { return stub; }, ResizeObserver: function () { return stub; }, IntersectionObserver: function () { return stub; },
    Image: function () { return stub; }, fetch: () => new Promise(() => {}), Intl, RegExp, Number, String, Boolean, Symbol, Error, WeakMap, WeakSet, Reflect, Proxy, Math, JSON, Date, Object, Array, Promise, Map, Set, URL,
    parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent, btoa: s => s, atob: s => s, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, performance: { now: noop },
    setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop, requestIdleCallback: noop, queueMicrotask: noop, addEventListener: noop, removeEventListener: noop,
    document: stub, localStorage: stub, sessionStorage: stub, navigator: stub, location: stub, matchMedia: stub, getComputedStyle: stub, CSS: stub, CadenceKit: stub, CadenceThemes: stub,
    console: { log: noop, warn: noop, error: noop, info: noop }, Cadence: new Proxy({ registerPlugin: d => defs.push(d) }, { get: (t, k) => (k in t ? t[k] : stub) }) };
  g.window = g; g.self = g; g.globalThis = g; vm.createContext(g);
  const out = {};
  for (const [src, code] of files) {
    if (!src.startsWith('plugins/')) continue;
    defs = [];
    try { vm.runInContext(code, g, { filename: src, timeout: 1000 }); } catch (e) { continue; } // can't tell what it registers: always load it
    if (!defs.length || !skippable(src)) continue;
    out[src] = defs.filter(d => d && d.id).map(d => Object.fromEntries(META.filter(k => d[k] != null && typeof d[k] !== 'function').map(k => [k, d[k]])));
  }
  return out;
}

function build(srcs) {
  const sig = srcs.map(s => { try { const st = fs.statSync(path.join(PUBLIC_DIR, s)); return `${s}:${st.size}:${st.mtimeMs}`; } catch (e) { return `${s}:missing`; } }).join('|');
  if (cache && cache.sig === sig) return cache;
  const files = srcs.map(s => { try { return [s, fs.readFileSync(path.join(PUBLIC_DIR, s), 'utf8')]; } catch (e) { return [s, `console.warn(${JSON.stringify('Cadence: missing ' + s)})`]; } });
  const hash = crypto.createHash('sha1'); for (const [s, c] of files) hash.update(s + '\0' + c + '\0');
  let manifest = {}; try { manifest = manifestOf(files); } catch (e) { console.warn('bundle manifest', e.message); }
  cache = { sig, hash: hash.digest('hex').slice(0, 12), files, manifest, out: new Map() };
  return cache;
}

// the JS for a selection: everything minus `skip`, or just `only`
function jsFor(b, { skip = [], only = null } = {}) {
  const key = only ? 'only:' + only.join(',') : 'skip:' + skip.join(',');
  let hit = b.out.get(key); if (hit) return hit;
  const sk = new Set(skip.filter(s => b.manifest[s])), on = only && new Set(only.filter(s => b.files.some(f => f[0] === s)));
  const files = b.files.filter(([s]) => (on ? on.has(s) : !sk.has(s)));
  const js = Buffer.from(`/* Cadence bundle: ${files.length} files${sk.size ? `, ${sk.size} switched-off plugin files left out` : ''}, see server/lib/bundle.js */\n`
    + `(function(F){for(var i=0;i<F.length;i++){var s=document.createElement('script');s.dataset.src=F[i][0];s.text=F[i][1]+'\\n//# sourceURL='+F[i][0];document.body.appendChild(s);}})(${JSON.stringify(files)});\n`);
  hit = { js, gz: zlib.gzipSync(js, { level: 6 }), etag: `"${b.hash}-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}"` };
  if (b.out.size > 40) b.out.clear();
  b.out.set(key, hit);
  return hit;
}

// runs in the page before anything else: which plugin files can stay on the server for now?
// A file is left out only if every plugin in it is off (or not offered) in BOTH spaces, per this browser's saved copy.
const CHOOSER = `(function(B){var off=function(k){try{var d=JSON.parse(localStorage.getItem(k)||'null');return d&&Array.isArray(d.disabled)?d.disabled:null;}catch(e){return null;}};
var demo=/[?&]demo(?!=0)/.test(location.search)||(function(){try{return !!sessionStorage.getItem('cadence.demo');}catch(e){return false;}})();
var W=demo?null:off('cadence.v1'),L=demo?null:off('cadence.life.v1'),skip=[];
// a space this browser has never opened counts as all off: moving to it fetches what it needs
var isOff=function(p,sp,list){return (p.spaces&&p.spaces.indexOf(sp)<0)||!list||list.indexOf(p.id)>=0;};
if(W||L)for(var f in B.plugins){if(B.plugins[f].every(function(p){return isOff(p,'work',W)&&isOff(p,'life',L);}))skip.push(f);}
B.skipped=skip;document.write('<script src="bundle.js?v='+B.v+(skip.length?'&skip='+encodeURIComponent(skip.join(',')):'')+'"><\\/script>');
})(window.__cadenceBundle)`;

// index.html with the block swapped for the chooser (or untouched when bundling is off / the markers are missing)
function page(html, url) {
  const text = html.toString('utf8'), srcs = enabled(url) && srcsOf(text);
  if (!srcs || !srcs.length) return html;
  const b = build(srcs);
  const boot = JSON.stringify({ v: b.hash, plugins: b.manifest }).replace(/</g, '\\u003c');
  return text.replace(BLOCK, () => `<script>window.__cadenceBundle=${boot};\n${CHOOSER}</script>`);
}

// GET bundle.js[?skip=a,b | ?only=a] — immutable when asked for by the current hash, otherwise revalidate
function serve(req, res, url) {
  let html; try { html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8'); } catch (e) { res.writeHead(404); return res.end(); }
  const b = build(srcsOf(html) || []), list = k => (url.searchParams.get(k) || '').split(',').filter(Boolean);
  const out = jsFor(b, url.searchParams.has('only') ? { only: list('only') } : { skip: list('skip') });
  const head = { 'Content-Type': 'text/javascript; charset=utf-8', ETag: out.etag, Vary: 'Accept-Encoding', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': url.searchParams.get('v') === b.hash ? 'private, max-age=31536000, immutable' : 'no-cache' };
  if (req.headers['if-none-match'] === out.etag) { res.writeHead(304, head); return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, gz ? { ...head, 'Content-Encoding': 'gzip' } : head);
  res.end(gz ? out.gz : out.js);
}

module.exports = { page, serve, build, srcsOf, ALWAYS };
