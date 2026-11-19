'use strict';
/* "More like this" from TasteDive (user, 2026-11-19): films, shows, games and music similar to one you name. Needs
   TASTEDIVE_API_KEY in .env (free, from tastedive.com/read/api). TasteDive allows 300 requests an hour: answers are
   kept 30 days on the NAS (data/tastedive-cache.json) and this stops at 250 an hour. It's a legacy API that TasteDive
   says it will keep running while it moves to Qloo, so anything that goes wrong just means no suggestions: the
   callers hide the section. TASTEDIVE_API points at a test's stand-in. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

const API = () => (process.env.TASTEDIVE_API || 'https://tastedive.com').replace(/\/$/, '');
const KEY = () => String(process.env.TASTEDIVE_API_KEY || '').trim();
const FILE = () => path.join(DATA_DIR, 'tastedive-cache.json');
const KEEP = 30 * 86400e3, TYPES = new Set(['movie', 'show', 'game', 'music', 'book', 'podcast']);
let cache = null, saveT = 0;
const sent = [];
const load = () => { if (!cache) { try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { cache = {}; } } return cache; };
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => {
  const ks = Object.keys(cache); if (ks.length > 3000) for (const k of ks.sort((a, b) => cache[a].at - cache[b].at).slice(0, ks.length - 3000)) delete cache[k];
  try { fs.writeFileSync(FILE(), JSON.stringify(cache)); } catch {} }, 1500); saveT.unref && saveT.unref(); };

async function getJson(u) {
  if (process.env.TASTEDIVE_API) { const r = await fetch(u, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  const r = await safeFetch(u, { headers: { Accept: 'application/json' }, timeout: 10000 }, 512 * 1024); return JSON.parse(r.buf.toString('utf8'));
}
// { results: [{ name, type, teaser, wiki, youtube }] } | { off: true } | { failed: true }
async function similar({ q = '', type = 'movie' } = {}) {
  if (!KEY()) return { off: true };
  q = String(q).trim().slice(0, 120); type = TYPES.has(type) ? type : 'movie';
  if (!q) throw Object.assign(new Error('Similar to what?'), { code: 400 });
  const k = `${type}|${q.toLowerCase()}`, c = load()[k];
  if (c && Date.now() - c.at < KEEP) return c.v;
  while (sent.length && Date.now() - sent[0] > 3600e3) sent.shift();
  if (sent.length >= 250) return { failed: true, busy: true };
  sent.push(Date.now());
  let d; try {
    d = await getJson(`${API()}/api/similar?${new URLSearchParams({ q: `${type}:${q}`, type, info: '1', limit: '12', k: KEY() })}`);
  } catch (e) { return { failed: true }; }
  const S = d && (d.similar || d.Similar) || {}, list = S.results || S.Results || [];
  if (d && d.error) return { failed: true };
  const v = { results: list.slice(0, 12).map(x => ({ name: x.name || x.Name, type: x.type || x.Type, teaser: String(x.wTeaser || x.description || '').slice(0, 300), wiki: x.wUrl || null, youtube: x.yUrl || null })).filter(x => x.name) };
  load()[k] = { at: Date.now(), v }; save();
  return v;
}
module.exports = { similar };
