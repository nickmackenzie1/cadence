'use strict';
/* Routes: Problems (lib/problems.js). GET the list, DELETE to clear, POST /api/problems/browser from the app's error handler. */
const { NEXT, readBody, send } = require('../lib/http');
const P = require('../lib/problems');
let window0 = { at: 0, n: 0 };
module.exports = async function problemsRoutes(req, res, { p }) {
  // background jobs in this process (lib/scheduler.js); the music side's are at /api/radar/jobs
  // "Check outside services" on Background work (server/services/checks.js): POST runs every check once, GET gives the last
  if (p === '/api/checks' && req.method === 'POST') return send(res, 200, await require('../services/checks').run());
  if (p === '/api/checks' && req.method === 'GET') return send(res, 200, require('../services/checks').last() || {});
  if (p === '/api/jobs' && req.method === 'GET') return send(res, 200, require('../lib/scheduler').list('app'));
  // run now, pause, resume, how often (the Background work page)
  if (p.startsWith('/api/jobs/')) {
    const m = /^\/api\/jobs\/([\w.:-]{1,60})$/.exec(p);
    if (m && req.method === 'POST') { let b = {}; try { b = JSON.parse(await readBody(req, 4096) || '{}'); } catch {}
      try { const r = require('../lib/scheduler').control(m[1], b, 'app'); return r ? send(res, 200, r) : send(res, 404, { error: 'No such job' }); }
      catch (e) { return send(res, e.code === 400 ? 400 : 500, { error: e.message }); } }
  }
  if (!p.startsWith('/api/problems')) return NEXT;
  if (p === '/api/problems' && req.method === 'GET') return send(res, 200, P.list());
  if (p === '/api/problems' && req.method === 'DELETE') { P.clear(); return send(res, 200, { ok: true }); }
  if (p === '/api/problems/browser' && req.method === 'POST') {
    if (Date.now() - window0.at > 60e3) window0 = { at: Date.now(), n: 0 };
    if (++window0.n > 30) return send(res, 429, { error: 'enough for now' });
    let b = {}; try { b = JSON.parse(await readBody(req, 16 * 1024) || '{}'); } catch {}
    // kind 'slow': a freeze or a slow step measured in the browser (core.js Slow), with how big the spaces are
    if (b.kind === 'slow') { P.record('slow', String(b.msg || 'The page froze').slice(0, 300), { where: b.where ? String(b.where).slice(0, 120) : null, version: b.version ? String(b.version).slice(0, 20) : null, detail: b.detail ? String(b.detail).slice(0, 600) : null, from: 'browser', mb: null }); return send(res, 200, { ok: true }); }
    P.record('browser', String(b.msg || 'Unknown error').slice(0, 300), { stack: b.stack ? String(b.stack).slice(0, 3000) : null, where: b.where ? String(b.where).slice(0, 120) : null, version: b.version ? String(b.version).slice(0, 20) : null });
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'Not found' });
};
