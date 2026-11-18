'use strict';
/* Routes: Problems (lib/problems.js). GET the list, DELETE to clear, POST /api/problems/browser from the app's error handler. */
const { NEXT, readBody, send } = require('../lib/http');
const P = require('../lib/problems');
let window0 = { at: 0, n: 0 };
module.exports = async function problemsRoutes(req, res, { p }) {
  // background jobs in this process (lib/scheduler.js); the music side's are at /api/radar/jobs
  if (p === '/api/jobs' && req.method === 'GET') return send(res, 200, require('../lib/scheduler').list('app'));
  if (!p.startsWith('/api/problems')) return NEXT;
  if (p === '/api/problems' && req.method === 'GET') return send(res, 200, P.list());
  if (p === '/api/problems' && req.method === 'DELETE') { P.clear(); return send(res, 200, { ok: true }); }
  if (p === '/api/problems/browser' && req.method === 'POST') {
    if (Date.now() - window0.at > 60e3) window0 = { at: Date.now(), n: 0 };
    if (++window0.n > 30) return send(res, 429, { error: 'enough for now' });
    let b = {}; try { b = JSON.parse(await readBody(req, 16 * 1024) || '{}'); } catch {}
    P.record('browser', String(b.msg || 'Unknown error').slice(0, 300), { stack: b.stack ? String(b.stack).slice(0, 3000) : null, where: b.where ? String(b.where).slice(0, 120) : null, version: b.version ? String(b.version).slice(0, 20) : null });
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'Not found' });
};
