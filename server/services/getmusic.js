'use strict';
/* Getting music (2026-11-24, user: "I like the downloading idea, let's use their code").
   A song (or a record) from Radar goes into a small queue on the NAS. One at a time, THING looks for it:
     songs:   Soulseek (slskd) first for the best copy, then YouTube Music (yt-dlp), then SoundCloud (yt-dlp)
     records: Usenet (a newznab indexer + SABnzbd or NZBGet), then a whole folder on Soulseek
   and puts the file in the music folder as Artist/Album/Artist - Title.ext, where Navidrome, Plex or Jellyfin see it and
   THING's player plays it in full. Each file keeps a note of where it came from and how good it is; a song that came
   from YouTube or SoundCloud is looked for again on Soulseek later, and swapped for a better copy when there is one.
   Optional (off unless you switch it on): new singles from artists you follow are fetched when they come out.
   Deezer, Tidal and Monochrome are left out on purpose: they get around the protection on paid streams.

   Ported in THING's style from Aurral (MIT licence, Copyright (c) 2026 Aurral Contributors, github.com/lklynet/aurral):
   the yt-dlp arguments (YouTube Music song search, the m4a audio stream copied as it is, embedded tags), slskd's
   search / transfer API use and finding the finished file (the remote file's folder under slskd's downloads, then a
   search by name and size), and the SABnzbd / NZBGet calls. Ideas from MusicGrabber (The Unlicense, g33kphr33k):
   one song without the whole album, SoundCloud, upgrades, and where each file came from.

   Settings (Settings → Connections, or .env): SLSKD_URL + SLSKD_API_KEY; NEWZNAB_URL + NEWZNAB_API_KEY with
   SABNZBD_URL + SABNZBD_API_KEY or NZBGET_URL (+ NZBGET_USER / NZBGET_PASS). GET_YTDLP=0 turns yt-dlp off.
   Folders inside the container (docker-compose.yml mounts them): MUSIC_DIR=/music, SLSKD_DOWNLOADS=/slskd,
   USENET_COMPLETE=/usenet. Nothing here listens to the internet: THING only asks these services, on your network. */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const env = k => String(process.env[k] || '').trim();
const base = k => env(k).replace(/\/+$/, '');
const DATA = () => process.env.DATA_DIR || '/data';
const MUSIC = () => process.env.MUSIC_DIR || '/music';
const SLSKD_ROOT = () => process.env.SLSKD_DOWNLOADS || '/slskd';
const USENET_ROOT = () => process.env.USENET_COMPLETE || '/usenet';
const FILE = () => path.join(DATA(), 'music-get.json');
const TICK = ms => +process.env.GET_TICK_MS || ms;   // tests wait less
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AUDIO = /\.(flac|mp3|m4a|aac|ogg|oga|opus|wav|aiff?|alac|wma)$/i;
const LOSSLESS = new Set(['flac', 'wav', 'aif', 'aiff', 'alac']);
const MIME = { flac: 'audio/flac', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', alac: 'audio/mp4', wma: 'audio/x-ms-wma' };

// ---- names: the same loose matching for every source ----
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => norm(s).split(' ').filter(w => w && w !== 'the' && w !== 'and');
const has = (hay, needle) => { const h = ' ' + norm(hay) + ' ', w = words(needle); return w.length > 0 && w.every(x => h.includes(' ' + x + ' ')); };
const EXTRA = /\b(live|karaoke|instrumental|cover|remix|acoustic|demo|sped up|slowed|nightcore|8d|reverb|lyrics?)\b/;
const extraOk = (cand, want) => { const m = norm(cand).match(EXTRA); return !m || norm(want).includes(m[1]) || (m[1].startsWith('lyric') && !/\bvideo\b/.test(norm(cand))); };
const safe = s => String(s || '').replace(/[/\\:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 120) || 'Unknown';
const extOf = f => path.extname(f).slice(1).toLowerCase();
const key = (a, t) => norm(a) + '|' + norm(t);
// how good a copy is: lossless 100; mp3 by bitrate; YouTube's AAC about 20; SoundCloud's mp3 about 12
function quality(ext, bitRate) {
  ext = String(ext || '').toLowerCase(); const br = +bitRate || 0;
  if (LOSSLESS.has(ext)) return 100;
  if (ext === 'mp3') return br >= 320 ? 32 : br >= 256 ? 25 : br >= 192 ? 16 : br ? 8 : 20;
  if (ext === 'm4a' || ext === 'aac') return br >= 256 ? 25 : 20;
  return br >= 256 ? 20 : 12;
}
const qualityLabel = q => q >= 100 ? 'Lossless' : q >= 32 ? 'MP3 320' : q >= 25 ? 'High' : q >= 16 ? 'Good' : 'OK';

// ---- what's kept: the queue, and where each file came from ----
let S = null, saveT = null;
function st() {
  if (!S) { try { S = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { S = null; } }
  if (!S || typeof S !== 'object') S = {};
  S.jobs = Array.isArray(S.jobs) ? S.jobs : []; S.prov = S.prov && typeof S.prov === 'object' ? S.prov : {};
  S.settings = S.settings && typeof S.settings === 'object' ? S.settings : { newSingles: false }; S.seen = Array.isArray(S.seen) ? S.seen : [];
  return S;
}
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { const f = FILE(); fs.writeFileSync(f + '.tmp', JSON.stringify(S)); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('get: save', e.message); } }, 200);
}
function set(j, patch) { Object.assign(j, patch, { at: Date.now() }); save(); }

function sources() {
  return {
    ytdlp: env('GET_YTDLP') !== '0',
    slskd: !!(base('SLSKD_URL') && env('SLSKD_API_KEY')),
    usenet: !!(base('NEWZNAB_URL') && env('NEWZNAB_API_KEY') && ((base('SABNZBD_URL') && env('SABNZBD_API_KEY')) || base('NZBGET_URL'))),
    usenetClient: base('SABNZBD_URL') && env('SABNZBD_API_KEY') ? 'SABnzbd' : base('NZBGET_URL') ? 'NZBGet' : null,
  };
}
async function musicFolder() {
  const dir = MUSIC();
  try { await fsp.mkdir(dir, { recursive: true }); const p = path.join(dir, `.thing-write-test-${process.pid}`); await fsp.writeFile(p, ''); await fsp.unlink(p); return { ok: true, path: dir }; }
  catch (e) { return { ok: false, path: dir, note: `THING can't save into the music folder (${e.code || e.message}). On the NAS, give the folder read and write for everyone, or put RUN_AS_ROOT=1 in .env.` }; }
}

// ---- running a program (yt-dlp, ffmpeg) ----
function run(cmd, args, { ms = 120000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let out = '', err = '', done = false;
    const c = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const kill = () => { try { process.kill(-c.pid, 'SIGKILL'); } catch { try { c.kill('SIGKILL'); } catch {} } };
    const t = setTimeout(() => { if (!done) { done = true; kill(); reject(new Error(`${path.basename(cmd)} took too long`)); } }, ms);
    c.stdout.on('data', d => { if (out.length < 8e6) out += d; });
    c.stderr.on('data', d => { if (err.length < 2e5) err += d; });
    c.on('error', e => { if (!done) { done = true; clearTimeout(t); reject(e.code === 'ENOENT' ? new Error(`${path.basename(cmd)} isn't installed`) : e); } });
    c.on('close', code => { if (done) return; done = true; clearTimeout(t); code === 0 ? resolve({ out, err }) : reject(new Error((err.split('\n').filter(l => /ERROR/.test(l)).pop() || err.trim().split('\n').pop() || `exit ${code}`).replace(/^ERROR:\s*/, '').slice(0, 300))); });
  });
}

// yt-dlp: the official standalone build (Python inside it, so the image needs none), the one for this processor and
// for Alpine's C library, kept in data/bin and brought up to date weekly (YouTube changes often, and an old yt-dlp
// stops working); one in PATH, or GET_YTDLP_BIN, works too.
const musl = () => fs.existsSync('/etc/alpine-release');
const YTDLP_URL = () => `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_${musl() ? 'musllinux' : 'linux'}${process.arch === 'arm64' ? '_aarch64' : ''}`;
const zipapp = () => path.join(DATA(), 'bin', 'yt-dlp');
async function fetchYtdlp() {
  const r = await fetch(YTDLP_URL(), { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Couldn't download yt-dlp (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 5e6) throw new Error("yt-dlp's download looks wrong");
  await fsp.mkdir(path.dirname(zipapp()), { recursive: true }); await fsp.writeFile(zipapp() + '.new', buf, { mode: 0o755 }); await fsp.rename(zipapp() + '.new', zipapp());
}
function inPath(b) { return String(process.env.PATH || '').split(path.delimiter).some(d => { try { fs.accessSync(path.join(d, b), fs.constants.X_OK); return true; } catch { return false; } }); }
async function ytCmd() {
  if (env('GET_YTDLP_BIN')) return [env('GET_YTDLP_BIN'), []];
  if (!fs.existsSync(zipapp()) && !inPath('yt-dlp')) await fetchYtdlp();
  return fs.existsSync(zipapp()) ? [zipapp(), []] : ['yt-dlp', []];
}
async function yt(args, ms) { const [cmd, pre] = await ytCmd(); return run(cmd, [...pre, ...(inPath('node') ? ['--js-runtimes', 'node'] : []), ...args], { ms }); }
const jsonLines = out => out.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// ---- yt-dlp: YouTube Music, then YouTube, then SoundCloud ----
async function ytFind(j, where) {
  const q = `${j.artist} ${j.title}`;
  const url = where === 'soundcloud' ? `scsearch8:${q}` : where === 'youtube' ? `ytsearch8:${q}` : `https://music.youtube.com/search?q=${encodeURIComponent(q)}#songs`;
  const { out } = await yt(['--flat-playlist', '--dump-json', '--no-warnings', '--playlist-end', '8', '--', url], 90000);
  for (const e of jsonLines(out)) {
    const title = String(e.track || e.title || ''), who = [e.artist, ...(Array.isArray(e.artists) ? e.artists : []), e.uploader, e.channel].filter(Boolean).join(' ');
    if (!has(title, j.title) || !extraOk(title, j.title)) continue;
    if (!(has(who + ' ' + title, j.artist) || (where === 'music' && !who))) continue;
    const d = +e.duration || 0; if (d && (d < 45 || d > 1500)) continue;
    const link = e.webpage_url || (String(e.url || '').startsWith('http') ? e.url : '') || (e.id && (where === 'soundcloud' ? '' : `https://${where === 'music' ? 'music.' : 'www.'}youtube.com/watch?v=${e.id}`));
    if (link) return { url: link, title };
  }
  return null;
}
async function viaYt(j, where) {
  const hit = await ytFind(j, where); if (!hit) return null;
  set(j, { status: 'getting', note: `From ${where === 'soundcloud' ? 'SoundCloud' : where === 'youtube' ? 'YouTube' : 'YouTube Music'}` });
  await fsp.mkdir(path.join(DATA(), 'get-tmp'), { recursive: true });
  const dir = await fsp.mkdtemp(path.join(DATA(), 'get-tmp', 'yt-'));
  const fmt = where === 'soundcloud' ? ['-f', 'ba/b', '-x'] : ['-f', 'ba[ext=m4a]/ba', '-x', '--audio-format', 'm4a', '--audio-quality', '0'];
  await yt(['--no-playlist', '--no-warnings', ...fmt, '--embed-metadata', '-o', path.join(dir, '%(id)s.%(ext)s'), '--', hit.url], 15 * 60e3);
  const f = (await fsp.readdir(dir)).find(n => AUDIO.test(n));
  if (!f) { await fsp.rm(dir, { recursive: true, force: true }); throw new Error("yt-dlp finished but there's no audio file"); }
  const file = path.join(dir, f);
  await retag(file, j);
  return { source: where === 'soundcloud' ? 'SoundCloud' : where === 'youtube' ? 'YouTube' : 'YouTube Music', link: hit.url, files: [{ path: file, name: f }], quality: where === 'soundcloud' ? 12 : quality(extOf(f)), cleanup: () => fsp.rm(dir, { recursive: true, force: true }) };
}
// the artist and title you asked for, in the file's own tags (YouTube's are often the channel name and a video title)
async function retag(file, j) {
  if (!inPath('ffmpeg')) return;
  const out = file.replace(/(\.[^.]+)$/, '.tag$1');
  const meta = [['artist', j.artist], ['title', j.title], ...(j.album ? [['album', j.album]] : []), ['comment', '']].flatMap(([k, v]) => ['-metadata', `${k}=${v}`]);
  try { await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-map', '0', '-c', 'copy', ...meta, out], { ms: 120000 }); await fsp.rename(out, file); }
  catch { await fsp.rm(out, { force: true }); }
}

// ---- Soulseek, through slskd ----
async function slsk(p, opts = {}) {
  const r = await fetch(base('SLSKD_URL') + '/api/v0' + p, { method: opts.method || 'GET', body: opts.body, headers: { 'X-API-Key': env('SLSKD_API_KEY'), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(opts.ms || 30000) });
  if (r.status === 401 || r.status === 403) throw new Error("slskd didn't accept the API key");
  if (r.status === 409) throw new Error("slskd isn't signed in to Soulseek");
  if (!r.ok) { if (r.status === 404) return null; throw new Error(`slskd answered ${r.status}`); }
  const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch { return null; }
}
async function slskSearch(text) {
  const id = crypto.randomUUID();
  await slsk('/searches', { method: 'POST', body: JSON.stringify({ id, searchText: text, searchTimeout: 15000, filterResponses: true, minimumResponseFileCount: 1 }) });
  const end = Date.now() + TICK(40000);
  while (Date.now() < end) { await sleep(TICK(2500)); const s = await slsk(`/searches/${id}`); if (!s || /Completed/i.test(String(s.state || ''))) break; }
  const resp = (await slsk(`/searches/${id}/responses`)) || [];
  slsk(`/searches/${id}`, { method: 'DELETE' }).catch(() => {});
  return Array.isArray(resp) ? resp : [];
}
const slashed = f => String(f || '').replace(/\\/g, '/');
const peerScore = r => (r.hasFreeUploadSlot ? 40 : 0) - Math.min(40, +r.queueLength || 0) + Math.min(30, (+r.uploadSpeed || 0) / 200000);
function pickTrack(responses, j, minQ) {
  let best = null;
  for (const r of responses) for (const f of r.files || []) {
    const name = slashed(f.filename), file = name.split('/').pop();
    if (!AUDIO.test(file) || !has(file, j.title) || !has(name, j.artist) || !extraOk(file, j.title)) continue;
    const q = quality(extOf(file), f.bitRate); if (q < minQ) continue;
    const score = q * 3 + peerScore(r);
    if (!best || score > best.score) best = { score, q, user: r.username, files: [f] };
  }
  return best;
}
function pickFolder(responses, j, minQ) {
  let best = null;
  for (const r of responses) {
    const dirs = new Map();
    for (const f of r.files || []) { const name = slashed(f.filename); if (!AUDIO.test(name)) continue; const d = name.slice(0, name.lastIndexOf('/')); (dirs.get(d) || dirs.set(d, []).get(d)).push(f); }
    for (const [d, files] of dirs) {
      if (files.length < 3 || !has(d, j.album) || !has(d + ' ' + files.map(f => f.filename).join(' '), j.artist)) continue;
      const q = Math.min(...files.map(f => quality(extOf(f.filename), f.bitRate))); if (q < minQ) continue;
      const score = q * 3 + peerScore(r) + Math.min(20, files.length);
      if (!best || score > best.score) best = { score, q, user: r.username, files };
    }
  }
  return best;
}
async function slskFetch(j, pick) {
  set(j, { status: 'getting', note: `From Soulseek (${qualityLabel(pick.q)})` });
  await slsk(`/transfers/downloads/${encodeURIComponent(pick.user)}`, { method: 'POST', body: JSON.stringify(pick.files.map(f => ({ filename: f.filename, size: f.size }))) });
  const want = new Set(pick.files.map(f => f.filename)), end = Date.now() + (+process.env.GET_SLSKD_WAIT_MS || 30 * 60e3);
  for (;;) {
    if (Date.now() > end) throw new Error('Soulseek took too long');
    await sleep(TICK(4000));
    const d = await slsk(`/transfers/downloads/${encodeURIComponent(pick.user)}`);
    const all = ((d && d.directories) || []).flatMap(x => x.files || []).filter(f => want.has(f.filename));
    if (all.some(f => /Rejected|Errored|TimedOut|Cancelled|Aborted/i.test(String(f.state)))) throw new Error('The Soulseek user stopped the transfer');
    if (all.length >= want.size && all.every(f => /Succeeded/i.test(String(f.state)))) break;
  }
  const files = [];
  for (const f of pick.files) {
    const p = await locate(SLSKD_ROOT(), slashed(f.filename), +f.size || 0);
    if (!p) throw new Error(`Soulseek finished, but THING can't see the file in slskd's downloads folder (${SLSKD_ROOT()})`);
    files.push({ path: p, name: path.basename(p) });
  }
  return { source: 'Soulseek', link: '', files, quality: pick.q, cleanup: async () => { for (const f of files) { try { const d = path.dirname(f.path); if (d !== SLSKD_ROOT() && !(await fsp.readdir(d)).length) await fsp.rmdir(d); } catch {} } } };
}
// slskd saves a file as <downloads>/<its folder's name>/<file>; otherwise look for the name and size
async function locate(root, remote, size) {
  const parts = remote.split('/'), name = parts.pop(), dir = parts.pop() || '';
  for (const c of [path.join(root, dir, name), path.join(root, name)]) { try { const s = await fsp.stat(c); if (s.isFile() && (!size || s.size === size)) return c; } catch {} }
  return walkFind(root, n => n === name, size, 4);
}
async function walkFind(dir, test, size, depth) {
  let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of ents) if (e.isFile() && test(e.name)) { const p = path.join(dir, e.name); if (!size || (await fsp.stat(p)).size === size) return p; }
  if (depth > 0) for (const e of ents) if (e.isDirectory()) { const r = await walkFind(path.join(dir, e.name), test, size, depth - 1); if (r) return r; }
  return null;
}
async function viaSlskd(j, minQ) {
  set(j, { status: 'looking', note: 'Looking on Soulseek' });
  const res = await slskSearch(`${j.artist} ${j.kind === 'album' ? j.album : j.title}`);
  const pick = j.kind === 'album' ? pickFolder(res, j, minQ) : pickTrack(res, j, minQ);
  return pick ? slskFetch(j, pick) : null;
}

// ---- Usenet: a newznab indexer, then SABnzbd or NZBGet ----
const arr = v => Array.isArray(v) ? v : v ? [v] : [];
async function nzbSearch(j) {
  const b = base('NEWZNAB_URL'), u = new URL(/\/api$/.test(b) ? b : b + '/api');
  u.search = new URLSearchParams({ t: 'search', q: `${j.artist} ${j.album || j.title}`, cat: '3000', apikey: env('NEWZNAB_API_KEY'), o: 'json', limit: '60' }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(`The Usenet indexer answered ${r.status}`);
  const d = await r.json().catch(() => ({}));
  const items = arr((d.channel && d.channel.item) || d.item || d.items);
  const attrs = it => Object.fromEntries(arr(it.attr || it['newznab:attr']).map(a => a['@attributes'] || a).map(a => [a.name, a.value]));
  let best = null;
  for (const it of items) {
    const title = String(it.title || ''), enc = (it.enclosure && (it.enclosure['@attributes'] || it.enclosure)) || {};
    const link = String(enc.url || it.link || ''), size = +(enc.length || attrs(it).size || it.size || 0);
    if (!link || !has(title, j.artist) || !has(title, j.album || j.title)) continue;
    if (/\b(discography|anthology|collection|box ?set)\b/i.test(title) && !/\b(discography|anthology|collection|box ?set)\b/i.test(j.album || '')) continue;
    if (size && (size < 15e6 || size > 3e9)) continue;
    const q = /\bflac\b|lossless|\b24 ?bit/i.test(title) ? 100 : /\b320\b/.test(title) ? 32 : /\bv0\b/i.test(title) ? 28 : 20;
    const score = q * 3 + (/\bweb\b/i.test(title) ? 5 : 0);
    if (!best || score > best.score) best = { score, q, title, link };
  }
  return best;
}
async function sab(params) {
  const u = new URL(base('SABNZBD_URL') + '/api'); u.search = new URLSearchParams({ ...params, apikey: env('SABNZBD_API_KEY'), output: 'json' }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`SABnzbd answered ${r.status}`);
  return r.json();
}
async function nzbget(method, params = []) {
  const h = { 'Content-Type': 'application/json' };
  if (env('NZBGET_USER')) h.Authorization = 'Basic ' + Buffer.from(`${env('NZBGET_USER')}:${env('NZBGET_PASS')}`).toString('base64');
  const r = await fetch(base('NZBGET_URL') + '/jsonrpc', { method: 'POST', headers: h, body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`NZBGet answered ${r.status}`);
  const d = await r.json(); if (d.error) throw new Error(`NZBGet: ${d.error.message || d.error}`); return d.result;
}
async function viaUsenet(j) {
  set(j, { status: 'looking', note: 'Looking on Usenet' });
  const rel = await nzbSearch(j); if (!rel) return null;
  set(j, { status: 'getting', note: `From Usenet (${qualityLabel(rel.q)})` });
  const cat = env('USENET_CATEGORY') || 'music', useSab = !!(base('SABNZBD_URL') && env('SABNZBD_API_KEY'));
  let id;
  if (useSab) { const r = await sab({ mode: 'addurl', name: rel.link, nzbname: rel.title, cat }); id = arr(r.nzo_ids)[0]; if (!id) throw new Error("SABnzbd didn't take the release"); }
  else { id = await nzbget('append', ['', rel.link, cat, 0, false, false, '', 0, 'SCORE', []]); if (!(id > 0)) throw new Error("NZBGet didn't take the release"); }
  const end = Date.now() + (+process.env.GET_USENET_WAIT_MS || 3 * 3600e3);
  let where = null;
  while (!where) {
    if (Date.now() > end) throw new Error('Usenet took too long');
    await sleep(TICK(10000));
    if (useSab) {
      const h = await sab({ mode: 'history', nzo_ids: id }), s = arr(h.history && h.history.slots)[0];
      if (s && /Failed/i.test(s.status)) throw new Error(`SABnzbd couldn't finish it${s.fail_message ? ': ' + s.fail_message : ''}`);
      if (s && /Completed/i.test(s.status)) where = s.storage || s.path || s.name;
    } else {
      const s = arr(await nzbget('history', [false])).find(x => x.NZBID === id);
      if (s && /^(FAILURE|DELETED|WARNING)/.test(String(s.Status))) throw new Error(`NZBGet couldn't finish it (${s.Status})`);
      if (s && /^SUCCESS/.test(String(s.Status))) where = s.FinalDir || s.DestDir || s.NZBName;
    }
  }
  // the download program reports its own path; find the same folder name in what THING sees of it
  const name = path.basename(slashed(where)), root = USENET_ROOT();
  const dir = (await fsp.stat(path.join(root, name)).then(s => s.isDirectory() && path.join(root, name), () => null)) || (await findDir(root, name, 3));
  if (!dir) throw new Error(`Usenet finished, but THING can't see "${name}" in the completed folder (${root})`);
  const files = (await listAudio(dir, 3)).map(p => ({ path: p, name: path.basename(p) }));
  if (!files.length) throw new Error('The Usenet release had no music in it');
  return { source: 'Usenet', link: '', files, quality: rel.q, cleanup: () => fsp.rm(dir, { recursive: true, force: true }) };
}
async function findDir(dir, name, depth) {
  let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of ents) if (e.isDirectory() && e.name === name) return path.join(dir, e.name);
  if (depth > 0) for (const e of ents) if (e.isDirectory()) { const r = await findDir(path.join(dir, e.name), name, depth - 1); if (r) return r; }
  return null;
}
async function listAudio(dir, depth, out = []) {
  let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isFile() && AUDIO.test(e.name)) out.push(p); else if (e.isDirectory() && depth > 0) await listAudio(p, depth - 1, out); }
  return out.sort();
}

// ---- into the music folder ----
async function move(from, to) {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  try { await fsp.rename(from, to); } catch (e) { if (e.code !== 'EXDEV') throw e; await fsp.copyFile(from, to); await fsp.unlink(from); }
}
async function freeName(p) { if (!fs.existsSync(p)) return p; const x = path.extname(p), b = p.slice(0, -x.length); for (let i = 2; i < 100; i++) { const c = `${b} (${i})${x}`; if (!fs.existsSync(c)) return c; } return `${b} ${Date.now()}${x}`; }
const rel = p => path.relative(MUSIC(), p).split(path.sep).join('/');
async function place(j, got) {
  const mf = await musicFolder(); if (!mf.ok) throw new Error(mf.note);
  const artistDir = path.join(MUSIC(), safe(j.artist)), out = [];
  const old = j.upgrade ? [...(j.files || [])] : [];
  for (const f of got.files) {
    const x = extOf(f.name);
    const to = j.kind === 'album' ? path.join(artistDir, safe(j.album), safe(f.name.replace(/\.[^.]+$/, '')) + '.' + x)
      : path.join(artistDir, safe(j.album || 'Singles'), `${safe(j.artist)} - ${safe(j.title)}.${x}`);
    const dest = await freeName(to);
    await move(f.path, dest);
    const r = rel(dest); out.push(r);
    st().prov[r] = { source: got.source, link: got.link || '', q: got.quality, at: Date.now(), artist: j.artist, title: j.kind === 'album' ? null : j.title, album: j.album || null };
    lib.add(r, j);
  }
  // an upgrade: the better copy is in, so the old one goes
  for (const r of old) if (!out.includes(r)) { try { await fsp.unlink(path.join(MUSIC(), r)); } catch {} delete st().prov[r]; lib.drop(r); }
  try { await got.cleanup(); } catch {}
  set(j, { status: 'done', files: out, source: got.source, quality: got.quality, note: '', done: Date.now(), upgrade: false });
}

// ---- the queue ----
let running = false;
async function pump() {
  if (running) return; running = true;
  try { for (;;) { const j = st().jobs.find(x => x.status === 'waiting'); if (!j) break; await runJob(j); } }
  finally { running = false; }
}
async function runJob(j) {
  const src = sources(), minQ = j.upgrade ? Math.max(25, (j.quality || 0) + 5) : 8;
  const order = j.kind === 'album' ? ['usenet', 'slskd'] : j.upgrade ? ['slskd'] : ['slskd', 'music', 'youtube', 'soundcloud'];
  let err = null; const tried = [];
  set(j, { status: 'looking', note: '' });
  for (const s of order) {
    if (s === 'usenet' ? !src.usenet : s === 'slskd' ? !src.slskd : !src.ytdlp) continue;
    tried.push({ usenet: 'Usenet', slskd: 'Soulseek', music: 'YouTube Music', youtube: 'YouTube', soundcloud: 'SoundCloud' }[s]);
    try {
      const got = s === 'usenet' ? await viaUsenet(j) : s === 'slskd' ? await viaSlskd(j, minQ) : await viaYt(j, s);
      if (got && got.files.length) { await place(j, got); return; }
    } catch (e) { err = e; console.error('get:', s, e.message); set(j, { status: 'looking' }); }
  }
  if (j.upgrade) return set(j, { status: 'done', upgrade: false, note: 'No better copy yet', checked: Date.now() });
  const none = !Object.values(src).some(v => v === true);
  set(j, { status: none ? 'failed' : err ? 'failed' : 'none', done: Date.now(), note: none ? 'No sources are set up yet' : err ? err.message : `Looked on ${tried.join(', ').replace(/, ([^,]*)$/, ' and $1')}` });
}
function add(b = {}) {
  const kind = b.kind === 'album' ? 'album' : 'track';
  const j = { id: crypto.randomUUID().slice(0, 12), kind, artist: String(b.artist || '').trim().slice(0, 120), title: String(b.title || '').trim().slice(0, 200), album: String(b.album || '').trim().slice(0, 200), from: String(b.from || '').slice(0, 40), added: Date.now() };
  if (!j.artist || (kind === 'track' ? !j.title : !j.album)) return { error: 'Needs an artist and a song or record' };
  if (kind === 'album' && !j.title) j.title = j.album;
  const same = st().jobs.find(x => x.kind === kind && key(x.artist, kind === 'album' ? x.album : x.title) === key(j.artist, kind === 'album' ? j.album : j.title) && x.status !== 'failed' && x.status !== 'none');
  if (kind === 'track' && !b.again) { const have = lib.find(j.artist, j.title) || (same && same.status === 'done' && same.files && same.files[0]); if (have) return { owned: { p: have, q: (st().prov[have] || {}).q || quality(extOf(have)) } }; }
  if (same) return { job: same, already: true };
  st().jobs.unshift({ ...j, status: 'waiting', at: Date.now() }); st().jobs = st().jobs.slice(0, 1000); save();
  setImmediate(() => pump().catch(e => console.error('get: queue', e)));
  return { job: st().jobs[0] };
}
function control({ id, act } = {}) {
  const j = st().jobs.find(x => x.id === String(id)); if (!j) return null;
  if (act === 'retry' && ['failed', 'none'].includes(j.status)) set(j, { status: 'waiting', note: '' });
  else if (act === 'better' && j.status === 'done' && j.kind === 'track' && (j.quality || 0) < 100 && sources().slskd) set(j, { status: 'waiting', upgrade: true, note: 'Looking for a better copy' });
  else if (act === 'remove' && !['looking', 'getting'].includes(j.status)) { st().jobs = st().jobs.filter(x => x !== j); save(); return { removed: true }; }
  setImmediate(() => pump().catch(() => {}));
  return { job: j };
}
function view() {
  const s = sources();
  return musicFolder().then(music => ({ sources: s, music, settings: st().settings, running, jobs: st().jobs.slice(0, 300).map(j => ({ ...j, qualityLabel: j.quality ? qualityLabel(j.quality) : '' })) }));
}
const settingsOn = () => !!st().settings.newSingles;
function settings(b = {}) { if (b.newSingles !== undefined) st().settings.newSingles = !!b.newSingles; save(); return st().settings; }

// ---- what's already in the music folder (folders as Artist/Album/file; the file name gives the song) ----
const lib = {
  items: new Map(), at: 0, scanning: null,
  title(file) { return file.replace(/\.[^.]+$/, '').replace(/^\s*(\d{1,2}[-.]?)?\d{1,3}\s*[-._)]?\s+/, '').replace(/\s*\(\d+\)$/, ''); },
  put(r, artist, title) { const k = key(artist, title); if (!this.items.has(k)) this.items.set(k, r); },
  add(r, j) { if (j.kind === 'album') { const parts = r.split('/'); this.put(r, j.artist, this.title(parts.pop()).replace(new RegExp('^' + j.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i'), '')); } else this.put(r, j.artist, j.title); },
  drop(r) { for (const [k, v] of this.items) if (v === r) this.items.delete(k); },
  async scan() {
    if (this.scanning) return this.scanning;
    this.scanning = (async () => {
      const found = new Map(), root = MUSIC(); let n = 0;
      const walk = async (dir, depth, artist) => {
        let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of ents) {
          if (n > 300000) return;
          if (e.isDirectory() && depth < 4 && !e.name.startsWith('.')) await walk(path.join(dir, e.name), depth + 1, depth === 0 ? e.name : artist);
          else if (e.isFile() && AUDIO.test(e.name) && artist) {
            n++; let t = this.title(e.name); const r = rel(path.join(dir, e.name));
            const m = t.match(/^(.+?)\s+-\s+(.+)$/); if (m && norm(m[1]) === norm(artist)) t = m[2];
            const pv = st().prov[r];
            const k = key(pv && pv.artist || artist, pv && pv.title || t); if (!found.has(k)) found.set(k, r);
          }
        }
      };
      await walk(root, 0, null);
      this.items = found; this.at = Date.now(); this.scanning = null;
      return found.size;
    })();
    return this.scanning;
  },
  find(artist, title) { return this.items.get(key(artist, title)) || null; },
};
async function owned(list = []) {
  if (!lib.at || Date.now() - lib.at > 6 * 3600e3) await lib.scan();
  const out = {};
  for (const x of arr(list).slice(0, 500)) { const r = lib.find(x.artist, x.title); if (r) out[key(x.artist, x.title)] = { p: r, q: (st().prov[r] || {}).q || quality(extOf(r)) }; }
  return out;
}
// a file from the music folder, for THING's player (Range, so seeking works)
async function stream(req, res, p) {
  const root = path.resolve(MUSIC()), full = path.resolve(root, String(p || ''));
  if (!full.startsWith(root + path.sep) || !AUDIO.test(full)) { res.writeHead(404); return res.end(); }
  let s; try { s = await fsp.stat(full); } catch { res.writeHead(404); return res.end(); }
  const type = MIME[extOf(full)] || 'application/octet-stream', m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? +m[1] : Math.max(0, s.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], s.size - 1) : s.size - 1;
    if (start >= s.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${s.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${s.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    return fs.createReadStream(full, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': s.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}

// ---- background: new singles from artists you follow (when switched on), better copies, yt-dlp updates ----
function newSingles(list = []) {
  if (!st().settings.newSingles) return 0;
  const seen = new Set(st().seen); let n = 0;
  for (const r of list) {
    const k = key(r.artist, r.title); if (seen.has(k) || !/single|track/i.test(r.type || '')) continue;
    seen.add(k); const a = add({ artist: r.artist, title: r.title, from: 'new single' }); if (a.job && !a.already) n++;
  }
  st().seen = [...seen].slice(-3000); save(); return n;
}
function upgradeSome(max = 10) {
  if (!sources().slskd) return 0;
  const week = Date.now() - 7 * 86400e3; let n = 0;
  for (const j of st().jobs) {
    if (n >= max) break;
    if (j.status === 'done' && j.kind === 'track' && (j.quality || 0) < 32 && (j.checked || j.done || 0) < week) { set(j, { status: 'waiting', upgrade: true, note: 'Looking for a better copy' }); n++; }
  }
  if (n) setImmediate(() => pump().catch(() => {}));
  return n;
}
async function updateYtdlp() { if (env('GET_YTDLP') === '0' || env('GET_YTDLP_BIN') || !fs.existsSync(zipapp())) return false; await fetchYtdlp(); return true; }
// a restart in the middle: whatever was being looked for starts again
function resume() { setTimeout(() => lib.scan().catch(() => {}), 5000).unref(); for (const j of st().jobs) if (j.status === 'looking' || j.status === 'getting') set(j, { status: 'waiting' }); if (st().jobs.some(j => j.status === 'waiting')) setTimeout(() => pump().catch(() => {}), 3000).unref(); }

module.exports = { settingsOn, add, control, view, settings, owned, stream, newSingles, upgradeSome, updateYtdlp, resume, sources, _lib: lib, _test: { pickTrack, pickFolder, quality, has, extraOk } };
