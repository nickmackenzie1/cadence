'use strict';
/* Routes: Health, the read-only data folder viewer and backups. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const path = require('path');
const { API_KEY, BACKUP_DIR, COMPANY_DIR, DATA_DIR, ICON_DIR, KEEP_BACKUPS, MODEL, PASSWORD, PUBLIC_DIR, STARTED, STATE_FILE } = require('../config');
const { buildId } = require('../lib/build');
const { NEXT, send } = require('../lib/http');
const { DB_FILE, dbInfo, hasDb, storageInfo } = require('../lib/storage');
const { TLS } = require('../lib/tls');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
// the release number lives in public/version.json (bumped on every push by scripts/bump.mjs)
function appVersion() { try { return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'version.json'), 'utf8')).version; } catch { return '?'; } }

module.exports = async function systemRoutes(req, res, { url, p }) {
  if (p === '/api/health') {
    const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
    const count = d => { try { return fs.readdirSync(d).length; } catch { return 0; } };
    return send(res, 200, { ok: true, https: !!TLS && !!req.socket.encrypted, build: buildId(), ai: !!API_KEY, model: API_KEY ? MODEL : null, version: appVersion(), uptime: Math.round((Date.now() - STARTED) / 1000), node: process.version,
      dataBytes: hasDb() ? size(DB_FILE) + size(DB_FILE + '-wal') : size(STATE_FILE), ...storageInfo(), backups: count(BACKUP_DIR), logos: fs.readdirSync(ICON_DIR).filter(f => f.endsWith('.img')).length, companies: count(COMPANY_DIR), auth: !!PASSWORD, time: Date.now() });
  }

  // ---- DB viewer: read-only look at the data folder (secrets are never listed by content) ----
  if (p === '/api/db' && req.method === 'GET') {
    const walk = d => { let bytes = 0, files = 0; try { for (const f of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, f)); if (st.isDirectory()) { const w = walk(path.join(d, f)); bytes += w.bytes; files += w.files; } else { bytes += st.size; files++; } } } catch {} return { bytes, files }; };
    const entries = []; try { for (const f of fs.readdirSync(DATA_DIR)) { const st = fs.statSync(path.join(DATA_DIR, f)); entries.push(st.isDirectory() ? { name: f + '/', dir: true, ...walk(path.join(DATA_DIR, f)), mtime: st.mtimeMs } : { name: f, bytes: st.size, mtime: st.mtimeMs, secret: f === 'calendars.json' || f === 'sessions.json' }); } } catch {}
    let backups = []; try { backups = fs.readdirSync(BACKUP_DIR).filter(f => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().map(f => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, bytes: st.size, mtime: st.mtimeMs }; }); } catch {}
    return send(res, 200, { dataDir: DATA_DIR, entries, backups, keep: KEEP_BACKUPS, db: dbInfo() });
  }
  if (p === '/api/db/backup' && req.method === 'GET') {
    const name = url.searchParams.get('name') || '';
    if (!/^state-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return send(res, 400, { error: 'Bad name' });
    try { return send(res, 200, JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8'))); } catch { return send(res, 404, { error: 'Not found' }); }
  }
  return NEXT;   // not ours
};
