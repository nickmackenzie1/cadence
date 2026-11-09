// HTTPS mode: with certs in TLS_DIR the app is served over TLS and plain HTTP only redirects.
import { test, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

const PORT = 9011 + Math.floor(Math.random() * 300), HPORT = PORT + 400;
let server, dir;
const get = (url, opts = {}) => new Promise((ok, bad) => https.get(url, opts, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => ok({ status: r.statusCode, body: b })); }).on('error', bad));

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-tls-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { stdio: 'ignore' });
  copyFileSync(join(dir, 'cert.pem'), join(dir, 'rootCA.pem'));
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), HTTPS_PORT: String(HPORT), TLS_DIR: dir, DATA_DIR: dir, APP_PASSWORD: 'pw' }, stdio: 'ignore' });
  const ca = readFileSync(join(dir, 'rootCA.pem'));
  for (let i = 0; i < 50; i++) { try { await get(`https://localhost:${HPORT}/api/health`, { ca }); return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('https server did not start');
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('plain http redirects to https before asking for a password, and serves only the public CA', async () => {
  const r = await fetch(`http://localhost:${PORT}/#today`, { redirect: 'manual' });
  expect(r.status).toBe(307);
  expect(r.headers.get('location')).toBe(`https://localhost:${HPORT}/`);
  const api = await fetch(`http://localhost:${PORT}/api/state`, { redirect: 'manual' });
  expect(api.status).toBe(307);
  const ca = await fetch(`http://localhost:${PORT}/ca.crt`);
  expect(ca.status).toBe(200);
  const body = await ca.text();
  expect(body).toContain('BEGIN CERTIFICATE');
  expect(body).not.toContain('PRIVATE KEY');
});

test('https serves the app with the certificate and keeps the login', async () => {
  const ca = readFileSync(join(dir, 'rootCA.pem'));
  expect((await get(`https://localhost:${HPORT}/`, { ca })).status).toBe(302);   // to the login page
  expect((await get(`https://localhost:${HPORT}/api/state`, { ca })).status).toBe(401);
  const h = await get(`https://localhost:${HPORT}/api/health`, { ca, auth: 'cadence:pw' });
  expect(h.status).toBe(200);
  expect(JSON.parse(h.body).https).toBe(true);
});
