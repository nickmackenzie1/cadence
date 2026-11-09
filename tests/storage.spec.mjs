// Storage: moving an existing NAS from state.json to SQLite, keeping the JSON mirror, and rolling back safely.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const base = 9400 + Math.floor(Math.random() * 150);
let n = 0;
async function start(dataDir, env = {}) {
  const port = base + n++;
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, TLS_DIR: join(dataDir, 'no-certs'), ...env }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const url = `http://localhost:${port}`;
  return { url, stop: () => new Promise(r => { p.once('exit', r); p.kill('SIGTERM'); }) };
}
const doc = (tasks, at) => ({ json: JSON.stringify({ v: 1, clients: [{ id: 'c1', name: 'Acme' }], tasks, meetings: [], settings: { myName: 'Nick' }, pluginData: { stocks: { opts: { rows: 5 } } }, updatedAt: at }), updatedAt: at });
const put = (url, body) => fetch(url + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let dir;
test.beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cadence-store-')); mkdirSync(join(dir, 'backups')); });
test.afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('an existing state.json is imported into SQLite unchanged, and kept as a safety copy', async () => {
  const old = doc([{ id: 't1', title: 'One' }, { id: 't2', title: 'Two' }], 1000);
  writeFileSync(join(dir, 'state.json'), JSON.stringify(old));
  const s = await start(dir);
  const h = await (await fetch(s.url + '/api/health')).json();
  expect(h.storage).toBe('sqlite');
  expect(await (await fetch(s.url + '/api/state')).json()).toEqual(old);
  const info = (await (await fetch(s.url + '/api/db')).json()).db;
  expect(info.rows).toEqual({ tasks: 2, clients: 1, meetings: 0, plugins: 1 });
  expect(readdirSync(join(dir, 'backups')).some(f => f.startsWith('state-before-sqlite-'))).toBe(true);
  // a write goes to the database, the mirror and the daily backups; removed records are kept, marked deleted
  expect((await put(s.url, doc([{ id: 't1', title: 'One, edited' }], 2000))).status).toBe(200);
  expect(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).updatedAt).toBe(2000);
  expect(readdirSync(join(dir, 'backups')).some(f => /^cadence-\d{4}-\d{2}-\d{2}\.db$/.test(f))).toBe(true);
  // stale writes are still refused
  expect((await put(s.url, doc([], 1500))).status).toBe(409);
  await s.stop();
  const db = new DatabaseSync(join(dir, 'cadence.db'), { readOnly: true });
  expect(db.prepare("SELECT deleted FROM records WHERE kind='task' AND id='t2'").get().deleted).toBe(1);
  expect(JSON.parse(db.prepare("SELECT data FROM records WHERE kind='task' AND id='t1'").get().data).title).toBe('One, edited');
  expect(db.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
  db.close();
});

test('if state.json is newer than the database (after a rollback), it wins on the next start', async () => {
  writeFileSync(join(dir, 'state.json'), JSON.stringify(doc([{ id: 'a', title: 'A' }], 1000)));
  let s = await start(dir); await s.stop();
  // an older Cadence (or STORAGE=json) keeps working on state.json alone
  s = await start(dir, { STORAGE: 'json' });
  expect((await (await fetch(s.url + '/api/health')).json()).storage).toBe('json');
  expect((await put(s.url, doc([{ id: 'a', title: 'A' }, { id: 'b', title: 'Made while rolled back' }], 5000))).status).toBe(200);
  await s.stop();
  s = await start(dir);
  const st = await (await fetch(s.url + '/api/state')).json();
  expect(st.updatedAt).toBe(5000);
  expect(JSON.parse(st.json).tasks.map(t => t.id)).toEqual(['a', 'b']);
  await s.stop();
});

test('a fresh install starts empty on SQLite', async () => {
  const s = await start(dir);
  expect(await (await fetch(s.url + '/api/state')).json()).toEqual({ json: null, updatedAt: 0 });
  expect(existsSync(join(dir, 'cadence.db'))).toBe(true);
  await s.stop();
});
