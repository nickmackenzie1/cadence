# THING

A personal, self-hosted everything-app that runs on a Synology NAS at home. It started as a to-do list and grew:
two spaces (Work and Life), a music side built around KEXP and new-release radar, a watch list, 130-odd themes, and
a page you can blow up. Only reachable on the home network: nothing is exposed to the internet.

(The code and its storage keys still say `cadence` in places. That's the old name and is safe to leave.)

## What's in it

**Everyday**
- **Quick add** understands plain typing: `Send SOW @acme fri 3pm !1 #crm`, `^Sarah share logins tomorrow`,
  `Weekly report every fri`, and `watch Jurassic Park` or `play Hades` for the Watch list.
- **Work and Life spaces**, each a complete set of tasks, areas or clients, plugins, theme and dashboard.
- **⌘K** finds anything: commands, tasks, clients, notes, meetings, artists, films.
- **Live sync** between every open tab and device, with the browser drawing from its own copy first so pages open
  instantly, even offline.
- **On the phone:** a bottom tab bar, swipe a task right to finish it or left for tomorrow, and the share sheet sends
  links and text straight into THING.
- **Meeting Mode**: capture action items for both sides, import Fireflies notes, send a formatted recap.
- **Watch list**: films, shows (TMDB) and games (TheGamesDB) with posters, year and runtime; a shelf of what you've
  watched; and **Tonight**, which picks one thing that fits the time you have.

**Music**
- **KEXP**: the whole play history in its own database (`data/kexp.db`), full-text search, charts, artist pages.
- **Music Radar**: new releases from artists you like, scans, a weekly digest, Discogs, ListenBrainz, shows nearby.
- **Radio**: stations you keep, what they're playing now, sent to ListenBrainz if you like.

**Fun**
- **Themes**: about 135, from calm ones to games, films and old operating systems, checked automatically so none
  ships unreadable.
- **Havoc** (Shift+H): words float and explode with real physics, while fire, lava, acid, rain and blasts are falling-
  sand matter (the Elements engine). **Wizard vs bosses** (Shift+F, or the Wizard button on Havoc's toolbar) is a pixel-art
  boss fight on top of it.

**Looking after itself**
- **Background work** page: every job the NAS runs on its own (KEXP history, Radar scans, feeds, reminders, database
  upkeep) with its last and next run. Run one now, pause it, or change how often.
- **Problems** page: errors, freezes and slow spots on the NAS and in the browser, newest first.
- Daily database backups, kept 30 days.

The interface is calm on purpose: plain labels, no alarm words, no red for unfinished work, no countdowns, no emoji.

## How it's built

No build step and no npm packages on the server: Node 22 with its built-in SQLite.

```
public/index.html     page shell
public/core.js/.css   the app core: state, sync, quick-add parsing, rendering, the plugin host
public/plugins/       every feature beyond the core, one file each (plugin API: docs/PLUGINS.md)
public/vendor/        engines and libraries: Elements (falling sand), Havoc physics (Matter.js), Lucide icons
public/sw.js          offline app shell (never caches the API, sign-in or audio/video)
server.js             entry point
server/app.js         request pipeline: security checks, sign-in, API routes, static files
server/music.js       the music side, in its own process so it never slows the app
server/routes/        the API, one file per area
server/services/      the work behind the routes (feeds, calendars, KEXP, Radar, radio, TMDB…)
server/lib/           storage (SQLite), the scheduler, sessions, safe outbound fetch, TLS, the bundle
tests/                Playwright tests: each spec starts its own server on a throwaway data folder
Dockerfile            node:22-alpine
docker-compose.yml    mounts public/ live, so interface changes need no rebuild
deploy.sh             the NAS auto-deploy
tls.sh                local HTTPS with a private certificate made on the NAS
```

Only the plugins you have switched on are sent to the browser, as one `bundle.js`.

## How changes reach the NAS

```
push to main -> GitHub runs the tests -> green: promoted to `stable`
             -> the NAS runs deploy.sh every 5 min and follows `stable`
                  public/*                         live on the next page load
                  server/, Dockerfile, compose      new image built first (low priority), then swapped in;
                                                    if it doesn't come up healthy, the old one is put back
                  data/, .env, certs/, .mkcert-ca/  never touched
```

Every release has its own version number. `deploy.log` on the NAS says what happened; check it when something
doesn't arrive.

## One-time Synology setup

**1. A read-only GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token:
only this repository, **Contents: Read-only**, nothing else. Set a reminder before it expires.

**2. Put `deploy.sh` on the NAS** in the `docker/cadence` folder (File Station).

**3. Schedule it.** Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script:
- General: name it, user **root**
- Schedule: daily, every 5 minutes, from `00:00` to `23:55`
- Run command:
  ```
  REPO=OWNER/cadence TOKEN=github_pat_xxx APP_PASSWORD=your-password sh /volume1/docker/cadence/deploy.sh
  ```
  If the shared folder is on another volume, change `volume1`.

**4. Run it once.** Select the task and click Run. A minute or two later, open `http://<nas-ip>:8484`.

**5. Trust the certificate on each device (once).** The first deploy makes a private certificate authority on the NAS
with [mkcert](https://github.com/FiloSottile/mkcert); THING then runs on `https://<nas-ip>:8443`, and the old address
redirects there. The CA's private key never leaves `.mkcert-ca/` on the NAS.
- Get the CA from `http://<nas-ip>:8484/ca.crt`, or copy `certs/rootCA.pem` with File Station. Its fingerprint is in
  `deploy.log`.
- **Mac:** open it, then in Keychain Access set the "mkcert" certificate to *Always Trust*.
- **Windows:** Install Certificate → Local Machine → *Trusted Root Certification Authorities*.
- **iPhone / iPad:** open the link in Safari, install the profile, then turn on full trust under Settings → General →
  About → Certificate Trust Settings.
- **Android:** Settings → Security → Encryption & credentials → Install a certificate → CA certificate.
- **Firefox** keeps its own list: set `security.enterprise_roots.enabled` to true in `about:config`.

A new NAS IP gets a new certificate from the same CA automatically. Extra names: `CERT_HOSTS="thing.lan"` in the
task's command; another port: `HTTPS_PORT=9443`; no HTTPS: `HTTPS=off`.

Git isn't needed on the NAS: without it, `deploy.sh` uses a throwaway `alpine/git` container.

## Settings (`.env` on the NAS)

`deploy.sh` creates `.env` from `.env.example` on the first run and keeps your own lines after that. Edit it by hand
and the container restarts with the change within 5 minutes. Everything below is optional except the password.

| Variable | What it does |
|---|---|
| `APP_USERNAME`, `APP_PASSWORD` | The sign-in page. Changing the password signs every device out |
| `TZ` | Time zone (e.g. `America/Toronto`) |
| `ANTHROPIC_API_KEY` | AI features: task extraction, recaps, Radar write-ups (`ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_QUICK` to override) |
| `TMDB_API_KEY` | Film and TV posters for the Watch list and themes (v3 key or the longer read token) |
| `THEGAMESDB_API_KEY` | Game box art for the Watch list and game themes |
| `DISCOGS_TOKEN` | Your records and wantlist in Music Radar |
| `LISTENBRAINZ_TOKEN` | Send what you listen to on the radio to ListenBrainz |
| `KOITO_URL`, `KOITO_TOKEN` | Send them to your own [Koito](https://github.com/gabehf/koito) on your network too (or instead) |
| `LASTFM_API_KEY` | Optional Last.fm counts, charts and similar artists in Music Radar. Needs Last.fm Pro from 1 December 2026; without it Radar uses ListenBrainz |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Connect Spotify in Music Radar |
| `TICKETMASTER_API_KEY`, `BANDSINTOWN_APP_ID` | Shows nearby |
| `HOME_LAT`, `HOME_LON` | Where "nearby" and "close to home" are measured from |
| `NTFY_SERVER`, `NTFY_TOPIC` | Phone notifications through ntfy |
| `POCKETCASTS_EMAIL`, `POCKETCASTS_PASSWORD` | Your Pocket Casts podcasts |
| `HTTPS_PORT` | HTTPS port on the NAS (default 8443) |
| `KEEP_BACKUPS` | Daily backups kept in `data/backups` (default 30) |
| `QUIET_MS` | How long after you last used THING the quiet background jobs wait (default 2 minutes) |
| `STORAGE=json` | Emergency fallback to the old JSON-file storage. Default: SQLite in `data/cadence.db` |

Keys stay on the NAS. They're never committed and never sent to the browser.

## Running it on a computer

```
mkdir -p data && DATA_DIR=./data node server.js      # http://localhost:8484
```
Add `?demo=1` to the address for a filled-in demo that saves nothing.

## Tests

```
npm install && npx playwright install chromium
npm run typecheck                          # seconds: plugin API misuse and undefined names
npm test                                   # the full Playwright run, about 5 minutes
npx playwright test tests/watchlist.spec.mjs  # one file while working
```

Every push to `main` runs both. Only green commits are promoted to `stable`, so a broken commit never reaches the NAS.
Every theme is also applied and checked for readable text and an intact layout; pictures of each are kept as the
`themes` artifact on each run.

## More

- `docs/PLUGINS.md`: writing plugins and themes
- `docs/BACKUP.md`: backups and restoring
- `docs/HANDOFF.md`: the standing rules and the open backlog
