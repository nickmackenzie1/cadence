'use strict';
/* Havoc from the phone (2026-11-24, user picked "phone as a controller"): the Mac with Havoc open listens on
   GET /api/havoc/remote/host (Server-Sent Events) and says what it has (mode, tools, screen size) with
   PUT /api/havoc/remote/host. A phone asks GET /api/havoc/remote whether one is open, and sends what you do
   (tilt, touches, tool keys) with POST /api/havoc/remote; each message goes straight to the listening Mac(s).
   Nothing is stored, it all stays inside the NAS, and both ends are signed in like the rest of the app. */
const { NEXT, readBody, send } = require('../lib/http');

const hosts = new Set();
let info = null, infoAt = 0;
const MAX_HOSTS = 4;
let win = { at: 0, n: 0 };   // a phone sends at most ~80 messages a second

function relay(msg) {
  const line = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of hosts) { try { res.write(line); } catch { hosts.delete(res); } }
}

module.exports = async function havocRoutes(req, res, { p }) {
  if (!p.startsWith('/api/havoc/remote')) return NEXT;
  if (p === '/api/havoc/remote/host' && req.method === 'GET') {
    if (hosts.size >= MAX_HOSTS) { const old = hosts.values().next().value; try { old.end(); } catch {} hosts.delete(old); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    res.write('retry: 2000\n\n');
    hosts.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20e3);
    const drop = () => { clearInterval(ping); hosts.delete(res); if (!hosts.size) info = null; relay({ t: 'hosts', n: hosts.size }); };
    req.on('close', drop); res.on('error', drop);
    return;
  }
  if (p === '/api/havoc/remote/host' && req.method === 'PUT') {
    let b = {}; try { b = JSON.parse(await readBody(req, 8 * 1024) || '{}'); } catch {}
    info = { mode: b.mode === 'elements' ? 'elements' : 'physics', w: +b.w || 1440, h: +b.h || 900, tool: String(b.tool || '').slice(0, 20),
      tools: (Array.isArray(b.tools) ? b.tools : []).slice(0, 40).map(t => ({ key: String(t.key || '').slice(0, 2), name: String(t.name || '').slice(0, 24), id: String(t.id || '').slice(0, 20), color: /^#[0-9a-f]{3,8}$/i.test(t.color || '') ? t.color : '' })) };
    infoAt = Date.now();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/havoc/remote' && req.method === 'GET') return send(res, 200, { open: hosts.size > 0 && !!info, ...(hosts.size && info ? info : {}) });
  if (p === '/api/havoc/remote' && req.method === 'POST') {
    const now = Date.now(); if (now - win.at > 1000) win = { at: now, n: 0 }; if (++win.n > 80) return send(res, 429, { error: 'Too fast' });
    let b = {}; try { b = JSON.parse(await readBody(req, 2048) || '{}'); } catch {}
    const t = String(b.t || '');
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
    let msg = null;
    if (t === 'tilt') msg = { t, v: num(b.v, -1, 1) };
    else if (t === 'down' || t === 'move' || t === 'up') msg = { t, x: num(b.x, 0, 1), y: num(b.y, 0, 1) };
    else if (t === 'key') msg = { t, key: String(b.key || '').slice(0, 12) };
    else if (t === 'hello' || t === 'bye') msg = { t };
    if (!msg) return send(res, 400, { error: 'Unknown message' });
    relay(msg);
    return send(res, 200, { ok: true, hosts: hosts.size });
  }
  return NEXT;
};
