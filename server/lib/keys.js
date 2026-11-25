'use strict';
/* Keys for outside services, pasted in Settings → Connections (user, 2026-11-18: "is there a better way to input the
   api keys instead of through the env?"). Kept in data/keys.json (owner-only) on the NAS and put into the
   environment, so every service that reads process.env.X uses them straight away; one pasted here wins over .env, and
   removing it brings back the .env value. The browser can save or remove a key but never reads one back: it only
   learns whether a key is set, where from, and its last four characters.
   The music side runs in its own process: it watches the file and picks changes up within a couple of seconds. */
const fs = require('fs');
const path = require('path');

const FILE = () => path.join(process.env.DATA_DIR || '/data', 'keys.json');
// what can be connected, in the order the page shows them
const SERVICES = [
  { id: 'DISCOGS_TOKEN', name: 'Discogs', for: 'Your record collection and wantlist in Music Radar, and the Record of the day theme', get: 'discogs.com → Settings → Developers → Generate new token', link: 'https://www.discogs.com/settings/developers' },
  { id: 'TMDB_API_KEY', name: 'TMDB', for: 'Pictures and colours for film and TV themes, and Movie night', get: 'themoviedb.org → Settings → API (the API key or the read access token)', link: 'https://www.themoviedb.org/settings/api' },
  { id: 'THEGAMESDB_API_KEY', name: 'TheGamesDB', for: 'Fanart and title logos for game themes and Game shelf', get: 'Ask for a key on TheGamesDB (see their API page)', link: 'https://thegamesdb.net/' },
  { id: 'LASTFM_API_KEY', name: 'Last.fm', for: 'Optional: Last.fm listener counts, charts and similar artists in Music Radar. Keys need a Last.fm Pro account from 1 December 2026; without one, Radar uses ListenBrainz', get: 'last.fm → API account → Create', link: 'https://www.last.fm/api/account/create' },
  { id: 'LISTENBRAINZ_TOKEN', name: 'ListenBrainz', for: 'Sends what you listen to in THING to your ListenBrainz profile', get: 'listenbrainz.org → Settings → User token', link: 'https://listenbrainz.org/settings/' },
  { id: 'KOITO_URL', name: 'Koito address', for: 'Your own Koito scrobbler on your network (like http://192.168.1.20:4110). THING sends your listens there too', get: 'The address you open Koito at', link: 'https://github.com/gabehf/koito' },
  { id: 'KOITO_TOKEN', name: 'Koito', for: 'Lets THING send listens to your Koito', get: 'In Koito: make an API key in its settings', link: 'https://github.com/gabehf/koito' },
  { id: 'SLSKD_URL', name: 'Soulseek (slskd) address', for: 'Downloads: your slskd on your network (like http://192.168.1.20:5030). THING looks there first for the best copy of a song', get: 'The address you open slskd at', link: 'https://github.com/slskd/slskd' },
  { id: 'SLSKD_API_KEY', name: 'Soulseek (slskd)', for: 'Lets THING search and download through your slskd', get: "In slskd's settings file: web → authentication → api_keys", link: 'https://github.com/slskd/slskd/blob/master/docs/config.md' },
  { id: 'NEWZNAB_URL', name: 'Usenet indexer address', for: 'Downloads: where THING looks for records on Usenet (any newznab indexer, like https://api.nzbgeek.info)', get: "Your indexer's API address", link: 'https://newznab.readthedocs.io/en/latest/misc/api/' },
  { id: 'NEWZNAB_API_KEY', name: 'Usenet indexer', for: 'Goes with the indexer address', get: "Your indexer's profile page → API key", link: 'https://newznab.readthedocs.io/en/latest/misc/api/' },
  { id: 'SABNZBD_URL', name: 'SABnzbd address', for: 'Downloads: your SABnzbd on your network (like http://192.168.1.20:8080). Or use NZBGet below', get: 'The address you open SABnzbd at', link: 'https://sabnzbd.org/' },
  { id: 'SABNZBD_API_KEY', name: 'SABnzbd', for: 'Lets THING hand records to SABnzbd', get: 'SABnzbd → Config → General → API Key', link: 'https://sabnzbd.org/wiki/configuration/4.3/general' },
  { id: 'NZBGET_URL', name: 'NZBGet address', for: 'Downloads: your NZBGet, instead of SABnzbd (like http://192.168.1.20:6789)', get: 'The address you open NZBGet at', link: 'https://nzbget.com/' },
  { id: 'NZBGET_USER', name: 'NZBGet user name', for: 'Goes with the NZBGet address', get: 'NZBGet → Settings → Security → ControlUsername', link: 'https://nzbget.com/' },
  { id: 'NZBGET_PASS', name: 'NZBGet password', for: 'Goes with the NZBGet user name', get: 'NZBGet → Settings → Security → ControlPassword', link: 'https://nzbget.com/' },
  { id: 'ANTHROPIC_API_KEY', name: 'Claude (Anthropic)', for: 'AI features: summaries, company lookups, suggestions', get: 'console.anthropic.com → API keys', link: 'https://console.anthropic.com/settings/keys' },
  { id: 'TICKETMASTER_API_KEY', name: 'Ticketmaster', for: 'Shows near you in Music Radar', get: 'developer.ticketmaster.com → My apps', link: 'https://developer.ticketmaster.com/' },
  { id: 'BANDSINTOWN_APP_ID', name: 'Bandsintown', for: 'Tour dates for the artists you follow', get: 'Ask Bandsintown for an app id', link: 'https://artists.bandsintown.com/' },
  { id: 'SPOTIFY_CLIENT_ID', name: 'Spotify app id', for: 'Connecting your Spotify account (with the secret below)', get: 'developer.spotify.com → Dashboard → Create app', link: 'https://developer.spotify.com/dashboard' },
  { id: 'SPOTIFY_CLIENT_SECRET', name: 'Spotify app secret', for: 'Goes with the Spotify app id', get: 'The same app on developer.spotify.com', link: 'https://developer.spotify.com/dashboard' },
  { id: 'NTFY_TOPIC', name: 'ntfy topic', for: 'Phone notifications from Music Radar', get: 'Any private topic name you pick in the ntfy app', link: 'https://ntfy.sh/' },
];
const IDS = new Set(SERVICES.map(s => s.id));
const fromEnv = {};   // what .env said, to fall back to
let loaded = false, mtime = 0;

const read = () => { try { const o = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
function put(saved) {
  for (const id of IDS) {
    const v = saved[id] ? String(saved[id]) : fromEnv[id];
    if (v) process.env[id] = v; else delete process.env[id];
  }
}
// at start-up, before anything reads the environment
function load() {
  if (!loaded) { for (const id of IDS) if (process.env[id]) fromEnv[id] = process.env[id]; loaded = true; }
  put(read());
}
// another process saved: pick it up
function watch() {
  load();
  try { mtime = fs.statSync(FILE()).mtimeMs; } catch {}
  fs.watchFile(FILE(), { interval: 2000, persistent: false }, st => { if (st.mtimeMs !== mtime) { mtime = st.mtimeMs; put(read()); } });
}
const clean = v => String(v == null ? '' : v).trim().replace(/^["']|["']$/g, '');
function set(id, value) {
  if (!IDS.has(id)) throw Object.assign(new Error('Unknown key'), { code: 400 });
  const saved = read(), v = clean(value);
  if (v && (v.length > 400 || /\s/.test(v))) throw Object.assign(new Error("That doesn't look like a key: no spaces, and at most 400 characters"), { code: 400 });
  if (v) saved[id] = v; else delete saved[id];
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  const tmp = FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(saved, null, 1), { mode: 0o600 }); fs.renameSync(tmp, FILE());
  try { fs.chmodSync(FILE(), 0o600); } catch {}
  if (!loaded) load(); put(saved);
  return list();
}
// what the page may know: set or not, where from, the last four characters
function list() {
  const saved = read();
  return SERVICES.map(s => {
    const v = saved[s.id] || fromEnv[s.id] || '';
    return { ...s, set: !!v, from: saved[s.id] ? 'page' : fromEnv[s.id] ? 'env' : null, tail: v.length > 8 ? v.slice(-4) : '' };
  });
}
module.exports = { load, watch, set, list, SERVICES };
