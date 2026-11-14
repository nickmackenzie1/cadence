'use strict';
/* Pocket Casts sync, NAS-side only. Pocket Casts has no official API; this uses the unofficial one its own web player
   talks to (as documented by community clients: furgoose/Pocket-Casts, madisonrickert/pocketcasts-api). Your email and
   password live in the NAS .env (POCKETCASTS_EMAIL / POCKETCASTS_PASSWORD) and are only ever sent to Pocket Casts; the
   browser gets episode lists and audio URLs, never the login or the token. If Pocket Casts changes the API this fails
   quietly: the app shows one calm line and the player keeps working with what it already has.
   POCKETCASTS_API overrides the base URL (tests point it at a local fake). */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const API = () => (process.env.POCKETCASTS_API || 'https://api.pocketcasts.com').replace(/\/$/, '');
const CACHE = () => (process.env.POCKETCASTS_CACHE || 'https://cache.pocketcasts.com').replace(/\/$/, '');
const TOKEN_FILE = path.join(DATA_DIR, 'pocketcasts.json');
const configured = () => !!(process.env.POCKETCASTS_EMAIL && process.env.POCKETCASTS_PASSWORD);

let token = (() => { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).token || null; } catch { return null; } })();
let lastError = null, lastSync = 0;
const cache = new Map();   // key → { at, data }

async function login() {
  const r = await fetch(API() + '/user/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ email: process.env.POCKETCASTS_EMAIL, password: process.env.POCKETCASTS_PASSWORD, scope: 'webplayer' }) });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 400 ? 'Pocket Casts didn’t accept the email or password in the NAS .env' : 'Pocket Casts sign-in failed (HTTP ' + r.status + ')');
  const j = await r.json(); token = j.token || j.accessToken; if (!token) throw new Error('Pocket Casts sign-in returned no token');
  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, at: Date.now() }), { mode: 0o600 }); } catch {}
}
// POST to the API with the token; one re-login if the token has expired
async function call(p, body = {}, retry = true) {
  if (!configured()) throw Object.assign(new Error('not configured'), { code: 'NOCONFIG' });
  if (!token) await login();
  const r = await fetch(API() + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  if ((r.status === 401 || r.status === 403) && retry) { token = null; return call(p, body, false); }
  if (!r.ok) throw new Error('Pocket Casts ' + p + ': HTTP ' + r.status);
  const t = await r.text(); return t ? JSON.parse(t) : {};
}
// the API has used a few field names over the years: normalise to one shape
const ep = e => e && ({
  uuid: e.uuid, podcast: e.podcastUuid || e.podcast || (e.podcast_uuid), podcastTitle: e.podcastTitle || e.podcast_title || '',
  title: e.title || '', url: e.url || e.fileUrl || '', published: e.published || e.publishedAt || null, duration: +e.duration || 0,
  position: +(e.playedUpTo ?? e.played_up_to ?? 0) || 0, status: +(e.playingStatus ?? e.playing_status ?? 0) || 0, starred: !!e.starred,
  art: (e.podcastUuid || e.podcast) ? `https://static.pocketcasts.com/discover/images/webp/200/${e.podcastUuid || e.podcast}.webp` : '',
});
const pod = p => p && ({ uuid: p.uuid, title: p.title || '', author: p.author || '', art: `https://static.pocketcasts.com/discover/images/webp/200/${p.uuid}.webp`, lastEpisode: p.lastEpisodePublished || null });

async function cached(key, ms, fn) { const c = cache.get(key); if (c && Date.now() - c.at < ms) return c.data; const data = await fn(); cache.set(key, { at: Date.now(), data }); return data; }

// everything the Podcasts view needs, in one go (cached a minute; ?fresh skips the cache)
async function overview(fresh) {
  if (!configured()) return { configured: false };
  if (fresh) cache.clear();
  try {
    const [subs, news, inprog, up] = await Promise.all([
      cached('subs', 10 * 60e3, () => call('/user/podcast/list', { v: 1 })),
      cached('new', 60e3, () => call('/user/new_releases', {})),
      cached('inprog', 60e3, () => call('/user/in_progress', {})),
      cached('upnext', 60e3, () => call('/up_next/list', { version: 2, model: 'webplayer', showPlayStatus: true }).catch(() => ({ episodes: [] }))),
    ]);
    lastError = null; lastSync = Date.now();
    return { configured: true, syncedAt: lastSync,
      shows: (subs.podcasts || []).map(pod).filter(Boolean),
      newEpisodes: (news.episodes || []).map(ep).filter(Boolean).slice(0, 40),
      inProgress: (inprog.episodes || []).map(ep).filter(Boolean),
      upNext: (up.episodes || []).map(ep).filter(Boolean) };
  } catch (e) {
    lastError = e.message;
    return { configured: true, error: 'Pocket Casts sync paused: ' + e.message, syncedAt: lastSync };
  }
}
// your place in an episode, back to Pocket Casts (status 2 = in progress, 3 = played)
async function progress({ uuid, podcast, position, played }) {
  if (!uuid || !podcast) throw new Error('uuid and podcast needed');
  await call('/sync/update_episode', { uuid, podcast, position: String(Math.max(0, Math.round(+position || 0))), status: played ? 3 : 2 });
  cache.delete('inprog'); cache.delete('new');
  return { ok: true };
}
async function star({ uuid, podcast, starred }) { await call('/sync/update_episode_star', { uuid, podcast, star: !!starred }); return { ok: true }; }
async function notes(uuid) {
  return cached('notes:' + uuid, 3600e3, async () => {
    const r = await fetch(`${CACHE()}/episode/show_notes/${encodeURIComponent(uuid)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { notes: '' };
    const j = await r.json(); return { notes: (j.show_notes || j.showNotes || '').slice(0, 60000) };
  });
}
const status = () => ({ configured: configured(), signedIn: !!token, lastError, lastSync });

module.exports = { overview, progress, star, notes, status };
