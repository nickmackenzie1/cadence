'use strict';
/* Routes: Meeting screenshots and the small settings that follow you between devices. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');
const { NEXT, readBody, send } = require('../lib/http');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function filesRoutes(req, res, { p }) {
  if (p === '/api/shots' && req.method === 'POST') {
    const type = String(req.headers['content-type'] || ''), ext = /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpg' : /webp/.test(type) ? 'webp' : null;
    if (!ext) return send(res, 400, { error: 'Images only' });
    const buf = await new Promise((resolve, reject) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > 12 * 1024 * 1024) { reject(new Error('Image too large (12 MB max)')); req.destroy(); } else ch.push(c); }); req.on('end', () => resolve(Buffer.concat(ch))); req.on('error', reject); });
    const dir = path.join(DATA_DIR, 'shots'); fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(9).toString('hex') + '.' + ext; fs.writeFileSync(path.join(dir, id), buf);
    return send(res, 200, { url: 'api/shots/' + id });
  }
  if (p.startsWith('/api/shots/') && req.method === 'GET') {
    const id = p.slice(11); if (!/^[a-f0-9]{18}\.(png|jpg|webp)$/.test(id)) return send(res, 404, { error: 'Not found' });
    const f = path.join(DATA_DIR, 'shots', id); if (!fs.existsSync(f)) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': id.endsWith('png') ? 'image/png' : id.endsWith('webp') ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' });
    return res.end(fs.readFileSync(f));
  }
  // small settings that follow you between devices (weather town, effects, timers…): last write wins per key
  if (p === '/api/prefs') {
    const F = path.join(DATA_DIR, 'prefs.json'); let d = {}; try { d = JSON.parse(fs.readFileSync(F, 'utf8')); } catch {}
    if (req.method === 'GET') return send(res, 200, d);
    if (req.method === 'PUT') {
      const b = JSON.parse(await readBody(req, 256 * 1024)); let n = 0;
      for (const [k, x] of Object.entries(b || {})) { if (!/^cadence\.[\w.-]{1,60}$/.test(k) || !x || typeof x.at !== 'number') continue; if (!d[k] || d[k].at < x.at) { d[k] = { v: x.v == null ? null : String(x.v).slice(0, 64 * 1024), at: x.at }; n++; } }
      if (n) fs.writeFileSync(F, JSON.stringify(d)); return send(res, 200, { ok: true, changed: n });
    }
  }
  return NEXT;   // not ours
};
