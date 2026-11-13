'use strict';
/* Routes: Data: per-record sync, conflicts, and the whole-document API older tabs use. Each handler answers or leaves the request for the next. */
const { NEXT, readBody, send } = require('../lib/http');
const { hasDb, listConflicts, resolveConflicts, readState, syncPull, syncPush, writeState } = require('../lib/storage');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function syncRoutes(req, res, { url, p }) {
  // ---- per-record sync ----
  if (p === '/api/sync' && req.method === 'GET') {
    if (!hasDb()) return send(res, 501, { error: 'Record sync needs SQLite storage' });
    return send(res, 200, syncPull(url.searchParams.get('since')));
  }
  if (p === '/api/sync' && req.method === 'POST') {
    if (!hasDb()) return send(res, 501, { error: 'Record sync needs SQLite storage' });
    const body = JSON.parse(await readBody(req));
    if (!Array.isArray(body.changes) || body.changes.length > 5000) return send(res, 400, { error: 'Bad payload' });
    return send(res, 200, syncPush(body.changes, String(body.device || '').slice(0, 60), body.since));
  }
  if (p === '/api/conflicts' && req.method === 'GET') return send(res, 200, { conflicts: hasDb() ? listConflicts() : [] });
  if (p === '/api/conflicts/resolve' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req, 64 * 1024));
    resolveConflicts([].concat(body.cid || []));
    return send(res, 200, { ok: true });
  }

  if (p === '/api/state' && req.method === 'GET') return send(res, 200, readState());
  if (p === '/api/state' && req.method === 'PUT') {
    const body = JSON.parse(await readBody(req));
    if (typeof body.json !== 'string' || typeof body.updatedAt !== 'number') return send(res, 400, { error: 'Bad payload' });
    const cur = readState();
    if ((cur.updatedAt || 0) > body.updatedAt) return send(res, 409, { error: 'Newer data on server', updatedAt: cur.updatedAt });
    JSON.parse(body.json); // validate
    writeState({ json: body.json, updatedAt: body.updatedAt });
    return send(res, 200, { ok: true });
  }
  return NEXT;   // not ours
};
