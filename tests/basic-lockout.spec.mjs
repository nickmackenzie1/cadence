// Basic auth (for scripts) goes through the same lockout as the sign-in page.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-basic-'));
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, APP_USERNAME: 'nick', APP_PASSWORD: 's3cret:pw' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`${B}/api/whoami`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

const basic = pw => ({ Authorization: 'Basic ' + Buffer.from('nick:' + pw).toString('base64') });
const state = pw => fetch(`${B}/api/state`, { headers: basic(pw) }).then(r => r.status);

test('Basic auth: the right password works, guesses get locked out, and a lock holds even for the right one', async () => {
  expect(await state('s3cret:pw')).toBe(200);
  for (let i = 0; i < 3; i++) expect(await state('same-wrong')).toBe(401);   // one bad saved login repeated counts once
  expect(await state('s3cret:pw')).toBe(200);                                 // …so it isn't locked, and success clears it
  for (let i = 0; i < 5; i++) expect(await state('guess' + i)).toBe(401);     // five different guesses
  expect(await state('s3cret:pw')).toBe(401);                                 // locked: even the right password waits
  const r = await fetch(`${B}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'nick', password: 's3cret:pw' }) });
  expect(r.status).toBe(429);                                                 // and the sign-in page shares the same lock
});
