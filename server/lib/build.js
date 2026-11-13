'use strict';
/* Build id: changes whenever a file in public/ changes, so open tabs know to offer a reload. */
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

// build id: changes whenever any file in public/ changes (public/ is mounted live, so updates land without a restart)
let buildCache = { at: 0, id: '' };
function buildId() {
  if (Date.now() - buildCache.at < 10000) return buildCache.id;
  let m = 0; const walk = d => { try { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else m = Math.max(m, fs.statSync(p).mtimeMs); } } catch {} };
  walk(PUBLIC_DIR); buildCache = { at: Date.now(), id: Math.round(m).toString(36) }; return buildCache.id;
}

module.exports = { buildCache, buildId };
