'use strict';
/* Web Push (RFC 8291 aes128gcm + VAPID), no dependencies. Keys and subscriptions live on the NAS only.
   Reminders are pushed from here even when no Cadence tab is open. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');
const { assertPublic } = require('../lib/net');
const { allDocs } = require('../lib/storage');

// ---- Web Push (RFC 8291 aes128gcm + VAPID), no dependencies. Keys and subscriptions live on the NAS only. ----
const PUSH_FILE = path.join(DATA_DIR, 'push.json');
const wxCache = new Map();
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function readPush() {
  let d = {}; try { d = JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8')); } catch {}
  if (!d.vapid) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' });
    d.vapid = { priv: privateKey.export({ format: 'pem', type: 'pkcs8' }), pub: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])) };
    d.subs = d.subs || []; writePush(d);
  }
  d.subs = d.subs || []; d.sent = d.sent || {}; d.cfg = Object.assign({ quiet: null, reminders: true }, d.cfg || {});
  return d;
}
function writePush(d) { try { fs.writeFileSync(PUSH_FILE, JSON.stringify(d)); fs.chmodSync(PUSH_FILE, 0o600); } catch (e) { console.error('push save', e.message); } }
const hkdf = (salt, ikm, info, len) => { const prk = crypto.createHmac('sha256', salt).update(ikm).digest(); return crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len); };
function encryptPush(sub, payload) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const asPub = ecdh.getPublicKey(), shared = ecdh.computeSecret(uaPub);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16), cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce), ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPub.length;
  return Buffer.concat([head, asPub, ct]);
}
function vapidAuth(d, endpoint) {
  const aud = new URL(endpoint).origin, enc = o => b64u(JSON.stringify(o));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:cadence@example.com' });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: d.vapid.priv, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${d.vapid.pub}`;
}
async function sendPush(d, sub, msg) {
  await assertPublic(sub.endpoint);   // push services only; never a LAN address
  const r = await fetch(sub.endpoint, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { TTL: '3600', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidAuth(d, sub.endpoint) }, body: encryptPush(sub, JSON.stringify(msg)) });
  return r.status;
}
const inQuiet = q => { if (!q || !q.from || !q.to) return false; const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), [a, b] = [q.from, q.to].map(x => { const [h, mm] = x.split(':').map(Number); return h * 60 + mm; }); return a < b ? m >= a && m < b : m >= a || m < b; };
async function pushAll(msg, opts = {}) {
  const d = readPush(); if (!d.subs.length) return { sent: 0 };
  if (!opts.force && inQuiet(d.cfg.quiet)) return { sent: 0, quiet: true };
  let sent = 0; const dead = new Set();
  for (const s of d.subs) { try { const st = await sendPush(d, s, msg); if (st === 404 || st === 410) dead.add(s.endpoint); else if (st < 300) sent++; } catch (e) { console.error('push', e.message); } }
  if (dead.size) { const cur = readPush(); cur.subs = cur.subs.filter(s => !dead.has(s.endpoint)); writePush(cur); }
  return { sent };
}
// reminders reach your phone/desktop even with no Cadence tab open
async function pushTick() {
  let d; try { d = readPush(); } catch { return; } if (!d.subs.length || !d.cfg.reminders) return;
  const now = Date.now(), docs = allDocs();
  let changed = false;
  for (const doc of docs) for (const t of doc.tasks || []) {
    if (t.done || !t.remindAt || t.remindAt > now || now - t.remindAt > 15 * 60e3) continue;
    const k = t.id + ':' + t.remindAt; if (d.sent[k]) continue;
    d.sent[k] = now; changed = true;
    const c = (doc.clients || []).find(x => x.id === t.clientId);
    pushAll({ title: 'Reminder', body: t.title + (c ? ' · ' + c.name : ''), tag: 'rem-' + t.id, url: '/#today' }).catch(() => {});
  }
  for (const [k, at] of Object.entries(d.sent)) if (now - at > 2 * 864e5) { delete d.sent[k]; changed = true; }
  if (changed) { const cur = readPush(); cur.sent = d.sent; writePush(cur); }
}
setInterval(() => pushTick().catch(e => console.error('pushTick', e.message)), 30000).unref();

module.exports = { PUSH_FILE, b64u, encryptPush, hkdf, inQuiet, pushAll, pushTick, readPush, sendPush, unb64u, vapidAuth, writePush, wxCache };
