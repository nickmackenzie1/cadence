// Database upkeep: plugin data keeps only its last few versions, tasks keep full history, old deletes and history are
// cleaned up, and pushes no longer rebuild the whole document (it's assembled when something reads it).
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'cadence-tidy-'));
const require = createRequire(import.meta.url);
const S = require('../server/lib/storage.js');

test('plugin history is capped, task history is kept, tidy removes old deletes', async () => {
  const push = (kind, id, data, extra = {}) => S.syncPush([{ kind, id, data, at: Date.now(), ...extra }], 'dev', 0);
  for (let i = 0; i < 12; i++) { push('plugin', 'rss', { n: i }); push('task', 't1', { id: 't1', title: 'v' + i }); }
  const H = (k, id) => S.historyCount(k, id);
  expect(H('plugin', 'rss')).toBe(5);
  expect(H('task', 't1')).toBe(12);
  // the document is assembled on read, and reflects the latest push
  expect(JSON.parse(S.readState().json).tasks[0].title).toBe('v11');
  // a record deleted 100 days ago disappears with its history; one deleted yesterday stays
  push('task', 'old', { id: 'old', title: 'gone' }); push('task', 'new', { id: 'new', title: 'recent' });
  S.syncPush([{ kind: 'task', id: 'old', deleted: true, at: Date.now() - 100 * 864e5, baseRev: S.recordRev('task', 'old') }], 'dev', 0);
  S.syncPush([{ kind: 'task', id: 'new', deleted: true, at: Date.now() - 1 * 864e5, baseRev: S.recordRev('task', 'new') }], 'dev', 0);
  const r = S.tidy();
  expect(r.tombstones).toBe(1);
  expect(S.recordRev('task', 'old')).toBe(0);
  expect(S.recordRev('task', 'new')).toBeGreaterThan(0);
  expect(H('task', 'old')).toBe(0);
  // the one-off compaction runs cleanly (window-function delete + VACUUM)
  const c = S.compact();
  expect(c.after).toBeGreaterThan(0);
  expect(H('plugin', 'rss')).toBe(5);
});
