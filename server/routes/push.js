'use strict';
/* Routes: Push notifications: keys, devices, quiet hours, a test. Each handler answers or leaves the request for the next. */
const { NEXT, readBody, send } = require('../lib/http');
const { pushAll, readPush, writePush } = require('../services/push');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function pushRoutes(req, res, { p }) {
  if (p === '/api/push/key') return send(res, 200, { key: readPush().vapid.pub });
  if (p === '/api/push/config' && req.method === 'GET') { const d = readPush(); writePush(d); return send(res, 200, { cfg: d.cfg, devices: d.subs.map(s => ({ device: s.device, at: s.at, host: (() => { try { return new URL(s.endpoint).hostname; } catch { return ''; } })() })) }); }
  if (p === '/api/push/config' && req.method === 'PUT') {
    const b = JSON.parse(await readBody(req, 4096)), d = readPush(), ok = x => /^\d{1,2}:\d{2}$/.test(x || '');
    d.cfg = { reminders: b.reminders !== false, quiet: b.quiet && ok(b.quiet.from) && ok(b.quiet.to) ? { from: b.quiet.from, to: b.quiet.to } : null };
    writePush(d); return send(res, 200, { ok: true, cfg: d.cfg });
  }
  if (p === '/api/push/subscribe' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req, 8192)), sub = b.subscription || {};
    if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return send(res, 400, { error: 'bad subscription' });
    const d = readPush(); d.subs = d.subs.filter(s => s.endpoint !== sub.endpoint).concat([{ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, device: String(b.device || '').slice(0, 60), at: Date.now() }]).slice(-20);
    writePush(d); return send(res, 200, { ok: true, devices: d.subs.length });
  }
  if (p === '/api/push/unsubscribe' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req, 8192)), d = readPush(); d.subs = d.subs.filter(s => s.endpoint !== b.endpoint); writePush(d); return send(res, 200, { ok: true });
  }
  if (p === '/api/push/test' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req, 4096) || '{}');
    return send(res, 200, await pushAll({ title: String(b.title || 'Cadence').slice(0, 80), body: String(b.body || 'Push notifications are working.').slice(0, 200), tag: 'test', url: '/' }, { force: true }));
  }
  return NEXT;   // not ours
};
