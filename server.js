// Cadence self-hosted server — zero dependencies, Node 18+
// Serves the app, stores your data in /data, keeps daily backups,
// and (optionally) proxies AI extraction to the Anthropic API.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8484;
const DATA_DIR = process.env.DATA_DIR || '/data';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PASSWORD = process.env.APP_PASSWORD || '';          // optional login
const USERNAME = process.env.APP_USERNAME || 'cadence';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';       // optional AI
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MODEL_QUICK = process.env.ANTHROPIC_MODEL_QUICK || 'claude-haiku-5-5';
const KEEP_BACKUPS = +process.env.KEEP_BACKUPS || 30;

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function authorized(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, ...p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const a = Buffer.from(u + ':' + p.join(':')), b = Buffer.from(USERNAME + ':' + PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { json: null, updatedAt: 0 }; }
}
function writeState(obj) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, STATE_FILE);
  // one backup per day
  const day = new Date().toISOString().slice(0, 10);
  const bf = path.join(BACKUP_DIR, `state-${day}.json`);
  fs.copyFileSync(STATE_FILE, bf);
  const all = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('state-')).sort();
  while (all.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
}

async function callClaude(prompt, tier) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: tier === 'quick' ? MODEL_QUICK : MODEL, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j?.error?.message || 'Anthropic API error'); e.status = r.status; throw e; }
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Cadence", charset="UTF-8"' });
      return res.end('Login required');
    }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/^.*?\/api\//, '/api/'); // works behind a sub-path reverse proxy

    if (p === '/api/health') return send(res, 200, { ok: true, ai: !!API_KEY, version: '0.2.0' });

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

    if (p === '/api/ai' && req.method === 'POST') {
      if (!API_KEY) return send(res, 501, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
      const { prompt, tier } = JSON.parse(await readBody(req, 2 * 1024 * 1024));
      if (typeof prompt !== 'string' || !prompt) return send(res, 400, { error: 'Missing prompt' });
      try { return send(res, 200, { text: await callClaude(prompt, tier) }); }
      catch (e) { return send(res, e.status === 429 ? 429 : 502, { error: e.message }); }
    }

    if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

    // static files
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => e2 ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, idx, MIME['.html']));
      send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Cadence running on :${PORT}  data=${DATA_DIR}  ai=${API_KEY ? 'on' : 'off'}  auth=${PASSWORD ? 'on' : 'off'}`));
