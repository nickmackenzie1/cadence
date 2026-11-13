'use strict';
/* Routes: Sign in, sign out, and "who am I". Each handler answers or leaves the request for the next. */
const crypto = require('crypto');
const { HTTPS_PUBLIC_PORT, PASSWORD, USERNAME } = require('../config');
const { LONG, authorized, createSession, dropSession, fails, lockedFor, noteFail, safeEq, session, setCookie } = require('../lib/auth');
const { NEXT, readBody, send } = require('../lib/http');
const { TLS } = require('../lib/tls');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function authRoutes(req, res, { p }) {
  if (p === '/api/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || '?';
    const wait = lockedFor(ip); if (wait) return send(res, 429, { error: `Too many tries. Wait ${wait}s.`, wait });
    let b = {}; try { b = JSON.parse(await readBody(req, 4096)); } catch {}
    if (!PASSWORD) return send(res, 200, { ok: true, open: true });
    if (!(safeEq(b.username || '', USERNAME) & safeEq(b.password || '', PASSWORD))) {
      noteFail(ip); console.warn(`login failed from ${ip}`);
      await new Promise(r => setTimeout(r, 400));
      return send(res, 401, { error: 'Wrong username or password', wait: lockedFor(ip) });
    }
    fails.delete(ip);
    const tok = crypto.randomBytes(32).toString('base64url'), keep = !!b.keep;
    createSession(tok, keep, String(req.headers['user-agent'] || '').slice(0, 120));
    setCookie(req, res, tok, keep ? LONG / 1000 : null);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/logout' && req.method === 'POST') {
    const s = session(req); if (s) dropSession(s.id);
    setCookie(req, res, '', 0);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/whoami') return send(res, 200, { httpsPort: TLS ? HTTPS_PUBLIC_PORT : null, auth: !!PASSWORD, signedIn: authorized(req), user: authorized(req) && PASSWORD ? USERNAME : null, https: !!req.socket.encrypted });
  return NEXT;   // not ours
};
