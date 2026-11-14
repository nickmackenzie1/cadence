'use strict';
/* Sign-in: cookie sessions (stored hashed in data/sessions.json), Basic auth for scripts, login lockouts,
   and the same-origin check for anything that changes data. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, PASSWORD, USERNAME } = require('../config');

// ---- login: cookie sessions (stored hashed in data/sessions.json), Basic auth still accepted for scripts ----
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const COOKIE = 'cadence_session';
const LONG = 30 * 864e5, SHORT = 12 * 3600e3;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const PW_TAG = sha('cadence:' + USERNAME + ':' + PASSWORD).slice(0, 16);   // changing the password signs everyone out
let sessions = (() => { try { const j = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); return j.pw === PW_TAG ? j.list || {} : {}; } catch { return {}; } })();
let sessTimer = null;
function saveSessions() {
  clearTimeout(sessTimer);
  sessTimer = setTimeout(() => { try { const tmp = SESSIONS_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ pw: PW_TAG, list: sessions }), { mode: 0o600 }); fs.renameSync(tmp, SESSIONS_FILE); } catch (e) { console.error('sessions', e.message); } }, 200);
}
function cookies(req) { const out = {}; for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } return out; }
function session(req) {
  const tok = cookies(req)[COOKIE]; if (!tok || tok.length > 100) return null;
  const id = sha(tok), s = sessions[id];
  if (!s) return null;
  if (s.exp < Date.now()) { delete sessions[id]; saveSessions(); return null; }
  if (Date.now() - (s.seen || 0) > 3600e3) { s.seen = Date.now(); if (s.keep) s.exp = Date.now() + LONG; saveSessions(); }   // sliding expiry for "keep me signed in"
  return { id, ...s };
}
function safeEq(a, b) { const x = Buffer.from(sha(String(a))), y = Buffer.from(sha(String(b))); return crypto.timingSafeEqual(x, y); }
// Basic auth (scripts, curl) goes through the same lockout as the sign-in page: while an address is locked out,
// even a correct password is refused, and every wrong one counts toward the lock
function basicOK(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const ip = req.socket.remoteAddress || '?';
  if (lockedFor(ip)) return false;
  const [u, ...p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const ok = !!(safeEq(u, USERNAME) & safeEq(p.join(':'), PASSWORD));
  // a wrong password repeated (one bad saved login, many requests) counts once; each new guess counts
  if (ok) fails.delete(ip); else { const f = fails.get(ip), tag = sha(h); if (!f || f.last !== tag) { noteFail(ip); fails.get(ip).last = tag; } }
  return ok;
}
function authorized(req) { return !PASSWORD || !!session(req) || basicOK(req); }
// brute-force guard: per address, doubling lockout after 5 misses (max 15 min)
const fails = new Map();
function lockedFor(ip) { const f = fails.get(ip); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
function noteFail(ip) { const f = fails.get(ip) || { n: 0, until: 0 }; f.n++; if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (f.n - 5)); fails.set(ip, f); if (fails.size > 1000) fails.delete(fails.keys().next().value); }
function setCookie(req, res, value, maxAge) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secure}${maxAge != null ? '; Max-Age=' + maxAge : ''}`);
}
// requests that change things must come from this app (cookie is SameSite=Strict too)
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
// pages and files you can load before signing in
const OPEN = new Set(['/login', '/login.html', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-32.png', '/icons/icon-192.png', '/icons/icon-512.png', '/api/login', '/api/logout', '/api/whoami']);
function createSession(tok, keep, ua) { sessions[sha(tok)] = { created: Date.now(), seen: Date.now(), exp: Date.now() + (keep ? LONG : SHORT), keep, ua }; saveSessions(); }
function dropSession(id) { delete sessions[id]; saveSessions(); }

module.exports = { COOKIE, LONG, OPEN, PW_TAG, SESSIONS_FILE, SHORT, authorized, basicOK, cookies, createSession, dropSession, fails, lockedFor, noteFail, safeEq, sameOrigin, saveSessions, sessTimer, session, sessions, setCookie, sha };
