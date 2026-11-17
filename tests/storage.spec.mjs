// Storage: moving an existing NAS from state.json to SQLite (then retiring state.json), daily JSON snapshots, and rolling back safely.
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

test('an existing state.json is imported into SQLite unchanged, then retired to backups', async () => {
  const old = doc([{ id: 't1', title: 'One' }, { id: 't2', title: 'Two' }], 1000);
  writeFileSync(join(dir, 'state.json'), JSON.stringify(old));
  const s = await start(dir);
  const h = await (await fetch(s.url + '/api/health')).json();
  expect(h.storage).toBe('sqlite');
  expect(await (await fetch(s.url + '/api/state')).json()).toEqual(old);
  const info = (await (await fetch(s.url + '/api/db')).json()).db;
  expect(info.rows).toEqual({ tasks: 2, clients: 1, meetings: 0, plugins: 1 });
  expect(readdirSync(join(dir, 'backups')).some(f => f.startsWith('state-before-sqlite-'))).toBe(true);
  // state.json is moved aside so a stale copy can never win again
  expect(existsSync(join(dir, 'state.json'))).toBe(false);
  expect(readdirSync(join(dir, 'backups')).some(f => f.startsWith('state-retired-'))).toBe(true);
  // a write goes to the database and the daily backups (one readable JSON snapshot a day); removed records are kept, marked deleted
  expect((await put(s.url, doc([{ id: 't1', title: 'One, edited' }], 2000))).status).toBe(200);
  expect(existsSync(join(dir, 'state.json'))).toBe(false);
  expect(readdirSync(join(dir, 'backups')).some(f => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f))).toBe(true);
  await expect.poll(() => readdirSync(join(dir, 'backups')).some(f => /^cadence-\d{4}-\d{2}-\d{2}\.db$/.test(f))).toBe(true);   // made in the background
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

test('daily backups keep your data and Radar history, but not what downloads again (KEXP history, artist pages)', async () => {
  // a NAS that has been collecting: KEXP's playlist, a Music Radar pick (with its index), a kept artist page
  const pre = new DatabaseSync(join(dir, 'cadence.db'));
  pre.exec(`CREATE TABLE kexp_plays (id INTEGER PRIMARY KEY, airdate INTEGER, artist TEXT); CREATE INDEX kexp_plays_artist ON kexp_plays(artist COLLATE NOCASE);
    CREATE TABLE kexp_meta (k TEXT PRIMARY KEY, v TEXT); CREATE TABLE radar_artist_pages (key TEXT PRIMARY KEY, json TEXT, at INTEGER, opened INTEGER);
    CREATE TABLE radar_picks (id TEXT PRIMARY KEY, ts INTEGER, artist TEXT, json TEXT); CREATE INDEX radar_picks_ts ON radar_picks(ts);`);
  const ins = pre.prepare('INSERT INTO kexp_plays VALUES (?, ?, ?)'); for (let i = 0; i < 500; i++) ins.run(i, i, 'Artist ' + i);
  pre.prepare("INSERT INTO radar_picks VALUES ('p1', 1, 'Glass Lantern', '{}')").run();
  pre.prepare("INSERT INTO radar_artist_pages VALUES ('glass lantern', '{}', 1, 1)").run();
  pre.close();
  const s = await start(dir);
  expect((await put(s.url, doc([{ id: 't1', title: 'Keep me' }], 1000))).status).toBe(200);
  await expect.poll(() => readdirSync(join(dir, 'backups')).find(f => /^cadence-\d{4}-\d{2}-\d{2}\.db$/.test(f)) || '').toMatch(/cadence-/);
  await s.stop();
  const f = readdirSync(join(dir, 'backups')).find(f => /^cadence-\d{4}-\d{2}-\d{2}\.db$/.test(f));
  const b = new DatabaseSync(join(dir, 'backups', f), { readOnly: true });
  const names = b.prepare("SELECT name FROM sqlite_master").all().map(r => r.name);
  expect(names).not.toContain('kexp_plays'); expect(names).not.toContain('kexp_meta'); expect(names).not.toContain('kexp_plays_artist'); expect(names).not.toContain('radar_artist_pages');
  expect(names).toContain('radar_picks_ts');                                              // indexes come along
  expect(b.prepare('SELECT artist FROM radar_picks').get().artist).toBe('Glass Lantern');
  expect(JSON.parse(b.prepare("SELECT data FROM records WHERE kind='task' AND id='t1'").get().data).title).toBe('Keep me');
  expect(b.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
  b.close();
});
