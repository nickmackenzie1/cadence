# Handoff: rules and open backlog

Start with `CLAUDE.md` (how to work here). This file is the user's standing rules plus what is still OPEN.
Add new ideas at the bottom ("just add things I say to the backlog"). When something ships, delete it here and note
it in the commit. Everything shipped, and the full wording of older ideas, is in `docs/archive/HANDOFF-2026-11.md`.
Cleaned up 2026-11-16 (0.8.2): items already built were moved out after checking the code.

## Rules (user)
- No Tailscale. Never expose the NAS to the internet (no port forwarding, DDNS, Let's Encrypt HTTP challenge).
- Secrets live on the NAS only (.env, certs/, .mkcert-ca/, data/). Never commit them, never send them to the browser.
- Every push gets a new release number: `npm run bump` (or `bump minor`) before committing.
- Calm, never alarming ("I have anxiety so those are triggers for me"): plain labels and counts, no guilt or alarm
  words ("overdue", "late", "behind"), no red for unfinished work (red = real errors only), nothing punishes unfinished
  work by itself. Accountability plugins stay opt-in and off by default.
- No emoji in the UI: Lucide icons via api.ui.icon.
- Themes: lookalike fonts (licence permitting), palettes, textures, UI chrome and props in CSS are fine. Logos are
  allowed now (user, 2026-11-16: "there can be logos, lets remove that rule"), but Claude itself doesn't redraw a brand's
  real logo or wordmark; real artwork the user brings (skins, images) is fine. No quotes, and Claude doesn't draw actual characters. Rebuilt items stay generic (a gem, not a rupee).
- User location: Amherstview, Ontario (Loyalist Township). Garbage: Tuesday east of Speers Blvd, Wednesday west.

## In progress (user picked 2026-11-16)
- Shipped 0.11.0: Outside (outdoors.js: air/UV/pollen, northern lights, ISS passes via server/vendor/satellite.min.js),
  Daily (daily-bits.js: On this day, xkcd, Lichess puzzle iframe, HN), Home helpers (home-bits.js, Life: TheMealDB ideas →
  Kitchen, garbage night with Loyalist presets, Open Food Facts barcodes, TVmaze). Server: services/daily.js, /api/daily/*.
  Kitchen exposes window.CadenceKitchen { addToList, addRecipe } for other plugins.
- Next queue (user, 12:39), Reddit removal done in 0.12.0; then music: artist page, Deezer previews + Want to hear, ICY
  now-playing + history for every station, follow artists + calm alerts, simpler Radar front page, one Music home,
  local shows (Bandsintown/Ticketmaster keys in .env).
- Design pass: one type scale, spacing scale, radius set and colour roles across core + every plugin; same patterns for
  headers, empty states, lists, dialogs, badges. Sharpen, don't redefine.
- README rewrite. Rename: the user is still thinking about a name (offered Hearth, Almanac, Homebase, Lantern). When
  chosen: UI strings, title/manifest/icons, login, README, docs, image/container names; keep reading `cadence.*`
  storage keys and keep a window.Cadence alias; don't move the NAS data dir or .env without a migration.

## Music and radio
- Music on the NAS: Navidrome (LAN-only, Subsonic API) or Cadence serving the folder itself. User to decide.
- Spotify listening stats view.
- Reddit: removed completely 2026-11-16 ("I don't like Reddit anymore"): no fetching, archive, subreddit list,
  suggestions, keys or Reddit theme. Old radar_history / Reddit picks stay in the database untouched. Don't add it back.
- NACC chart: page format unchecked, may be JS-rendered.
- Check from the NAS: Amherst Island Radio's stream; the six blog feed addresses added in 0.8.0 (warnings in Sources).

## Themes and effects
- Games themes: CS:GO, Half-Life, Steam, Borderlands, GTA (Breath of the Wild exists). A Camping theme.
- Kill Bill: blood drips from panel edges that pool on ledges, a splash on finishing a task (Elements engine;
  stylised, not gory; respects Effects off / reduced motion).
- Themes screen: category tabs or a side index, search, compact grid + live preview. Bug: picking a theme scrolls
  the page back to the top.
- Havok physics option (@babylonjs/havok, MIT WASM ~2 MB, vendored, loaded only when picked): task cards as real
  blocks that tumble and stack, done tasks into a bin. Elements for materials, Havok for pieces that break loose.
- More effects: Halloween pumpkins with candle fire and fog, autumn leaves, spring rain and puddles, a lava-lamp focus
  timer, fireworks when a project finishes, a snow globe, a campfire for the camping planner.
- Zelda fonts (Hylia Serif etc.): check each licence before vendoring.

## Look and feel
- Colour-blind modes (protanopia, deuteranopia, tritanopia, achromatopsia): remap palette, add shape/pattern cues.
- Phones: a ⌘K button, swipe gestures, a bottom tab bar.

## Everyday app
- File browser for NAS shares (read-only, LAN-only, path-jailed).
- Feed layouts for news and podcasts in rss.js (Letterboxd exists).
- AI chat widget on the dashboard.

## Life
- Couple/roommate bounty board (chores with point bounties, cash out as favours); needs shared lists between logins.
- Location reminders ("you're near the hardware store"): needs the phone app + geofences.
- Sleep data (Oura API; Apple Health via the phone app) for the energy-aware day.

## Fun and weird
- NAS dreams: overnight, the AI writes a short surreal dream from yesterday's tasks and clients; Today card or Island.
  Calm tone; skip without an AI key.
- Civilization in your backlog: tiny people settle on your oldest tasks, build villages; finishing an old task is the
  extinction event they prophesied (Elements engine?).
- Plugins gossip: the intern, sheep, ghosts and Chad have a group chat about you (gently). AI-written with a key,
  canned otherwise.
- Narrator: a nature-documentary voice (speechSynthesis) comments on what you do; off by default, rate-limited, muted
  in meetings and quiet hours, gentle; captions in the Island.
- Fantasy RPG office (meetings and co-worker chats as a mini-game); a 3D first-person walk through your backlog.

## More free data (not picked yet)
- Met Museum + Art Institute of Chicago public-domain art for the mural mosaic.
- Exchange rates (Bank of Canada Valet, Frankfurter).
- NHL: Leafs scores on the Island; a goal flashes the Island with our own horn sound (off by default, no logos).

## Bigger projects
- Multiplayer: real multi-user first, not NAS-dependent; how teammates connect without Tailscale or exposing the NAS
  is an open question (hosted relay carrying team data only, or LAN peer-to-peer). Then: shared clients/tasks,
  claiming tasks, presence and fun pokes, chat with reactions, a Gather-style map where client rooms are channels,
  an opt-in friendly leaderboard.
- Run anywhere (with the rename): install guides and CI-tested installs for Docker/Compose, Unraid, TrueNAS, Proxmox,
  Raspberry Pi, bare Linux, Windows, macOS, cloud VMs; multi-arch image on GHCR; storage adapters (SQLite default,
  Postgres, MySQL, files) by DATABASE_URL with a migration tool; PWA guide, then Capacitor (phone) and Tauri (desktop:
  tray, global quick-add, notifications). Other people's installs default to private/LAN; internet exposure is an
  explicit, documented opt-in. The user's own instance keeps the rules above.

- **(2026-11-16, user)** Radar trends should use every source, not just Lemmy/Mastodon. Who's climbing, hottest genre,
  most talked about and picks currently come only from the community scan; the all-sources score (blogs, KEXP, earshot,
  charts, Bandcamp, Hype Machine…) only drives the "All sources combined" table and source trends. Make one combined
  daily buzz score per artist (and per genre) from all signals and drive the front page from it (fits #98).
- **(2026-11-16, user)** Said the Gramophone's yearly best-of lists (2005 onward): top songs, albums of the year and
  the artists he keeps coming back to. Shipped in 0.14.1 (`radar/lib/stg.mjs`, page `#view-stg`, artist-page section).
  Only the 2023 page layout was checked (from a copy the user sent); 2005-2007 use older page names and may read
  differently: the page lists any year that didn't read. Feeds: Under the Radar `/site/rss` (from the user) and
  Said the Gramophone via `feeds.feedburner.com/saidthegramophone/stg` (linked in the blog's footer).
- **0.14.2:** Radar's front page now uses every source (`radar/lib/buzz.mjs`): Who's climbing, Fastest risers (with
  where each came from), Albums and EPs, Genres blowing up and Artists tracked. Buzz is scaled so the top artist is 100.
  Buzzwords and picks are still the Lemmy/Mastodon scan. Note: `tests/more.spec.mjs` has timing flakes under a busy
  workspace (a different test each full run: games, camping, kids); each passes alone. Worth hardening.
- **0.14.3 (user asked 2026-11-16):** KEXP weekly charts (kexp.org/charts, no feed) as a Radar source `kexpchart`:
  Top 90 + genre lists ranked, "Adds" (just added to rotation) as unranked mentions. Parser written from a text
  description of the page, not its HTML: if the Sources card says it couldn't read the format, look at the page markup.
  Skipped the 2017 all-time countdown (one-off, airplay-ranked; KEXP history already has all-time tops from plays).
- **0.14.4 (from kexp.fyi's build write-up, sent by the user):** KEXP's `airdate_before` is inclusive. Our backfill
  asked for "before oldest play", got it back, and switched itself to offset paging. Now asks for one second earlier;
  a one-time migration undoes the offset switch. "(Various Artists) X" credits become X; bare Various Artists credits
  stay out of top-artist/album lists. 429/5xx back off. All-time/yearly tops cached 30 min (full archive ≈ 3.6M
  plays back to 2000-12-31 per kexp.fyi). Ideas from that site for later: monthly/yearly winners per DJ and show.
- **0.15.0 (music list #3):** now playing + history for every station. `services/radio.js`: `icyTitle`/`readIcy`
  (Icy-MetaData, reads one metadata block, ~8–64 KB, 20 s cache), `radio_plays` saved on title change, `radio_follow`
  ("Keep a history": checked every 2 min, `RADIO_FOLLOW_EVERY`; `RADIO_HISTORY=0` off; off under CI). Routes
  `/api/radio/now?id&u`, `/api/radio/history`, POST `/api/radio/follow`. Page: song + preview/save buttons for any
  station, "Played earlier", hidden view `radio-station`. Not checked against real stations (workspace can't reach them).
- **0.16.0 (user, 2026-11-16):**
  - Radar front page simplified: tiles, Want to hear, climbing + risers, albums + genres, picks; the rest folded under
    "Sources and charts", "Scenes and connections", "How it's doing", "Settings" (open state remembered).
  - Music home: views with `group: 'music'` (and `order`) share one "Music" tile and a tab bar (core.js); `#music`
    opens the last tab (`S.settings.musicTab`). Tabs: Radar, Radio, KEXP history, Want to hear, Shows, Said the
    Gramophone, Artists (new: look anyone up, recently opened, from Want to hear).
  - KEXP winners (`kexp-log.winners`, view=winners): most-played artist/song/album per month or year, with runner-up,
    station-wide or per program/DJ; Winners tab, and "Their favourite artist each month" on DJ/show pages.
  - Shows (`radar/lib/shows.mjs`, Music → Shows): Ticketmaster (`TICKETMASTER_API_KEY`), Bandsintown
    (`BANDSINTOWN_APP_ID`), Kingston Live feed (no key; address from the user; `KINGSTONLIVE=0` off). Matched to Want
    to hear, recently opened artists, Radar, KEXP's year, Said the Gramophone. Default circle 100 km around Amherstview.
    Kingston Live's feed format wasn't visible from the agent workspace: the reader is generic; if the page says it
    couldn't read it, get the feed text from the user.
  - Rename brainstorm sent; user hasn't picked yet (shortlist: Almanac, Hearth, Porchlight, Stella).
- **0.16.1:** Kingston Live reader fitted to the real feed (user sent it): RSS items, title "Series: Act, Act @ Venue -
  Nov 16, 2026", time in the description (7:30 PM / 22:30 / 1700). Feed address now the user's shorter one
  (`show_feed_xml&no_headers=true&barebones_mode=true`); it lists theatre, talks and karaoke too, which land in
  "Everything else nearby" unless an act matches.
- **0.16.2 (user: "i want to grab all kexp"):** KEXP backfill defaults to everything (`KEXP_BACKFILL_DAYS` still
  limits it). One page every 8 s (was 30 s) plus that page's shows (~0.5 requests/s, ~2 days for ~3.6M plays,
  ~1–1.5 GB). "Done" now needs the real floor (`backfill_floor`), so a stop at the old 365-day default resumes.
  Show names: filled from the page just fetched / last 14 days for live plays, no whole-table scans per tick.
- **0.17.0 (user, 2026-11-16):**
  - IndexedDB (`IDB` in core.js): every save of the space documents and the sync records also goes to IndexedDB
    (db `cadence`, store `docs`, coalesced 400 ms, flushed on pagehide). localStorage stays the quick copy while it
    fits; when a save doesn't, an `idb1:` marker replaces it and Boot reads IndexedDB first (`HOLD`: no saves, no
    `noteOff`, no `Store.init` until then; user plugins load after). Unreadable → fresh full pull from the NAS. A db
    missing its store is repaired (version bump); connections close on `versionchange`. Test: tests/idb.spec.mjs.
  - Flaky tests fixed. Real bugs found: forms' late autofocus stole the cursor mid-typing (`CadenceKit.focusLater`
    everywhere); theme picking kept the card in place only for 120 ms (now on size changes for 1.5 s, stops if you
    scroll); Harper threw offline before it was cached (now quiet). Test-only: roulette uses reduced motion; task links
    wait for the last date picker; sync waits re-pull (refocus is throttled to one per 4 s).
- **0.17.1 design pass (Music):** every `group: 'music'` view gets `vw-wide` + `vw-music` (core.js), and one block in
  core.css ("Music pages") sets the content width (880), section headings, chips (selected = soft accent), links and
  `a.btn`. Fixes: tabs no longer shift sideways between pages; Want to hear on one line; risers fit their card (status
  only when not "climbing"); play/save buttons always sit before the name; Shows errors in plain words (detail on hover).
  Next design-pass candidates: the rest of the app (same pattern: one heading/list/empty-state style), dark mode check.
- **0.18.0 plugin settings audit (user, 2026-11-16):** 78 plugins, 25 had a settings window. Added (all through
  `LifeKit.form`, test tests/plugin-settings.spec.mjs): Quick date (calendar after a dateless task on/off), Weekly
  review (nudge day/hour or never, was Friday 2 pm fixed), Weekly rewind (offer day or never), Outside (aurora / space
  station notes), Home helpers (garbage-night reminder on/off + time), Calendar view (week starts Sun/Mon), Podcasts
  (skip lengths, were 10/30 fixed), Roulette (lock length), Music Radar (gear opens its Settings section).
  Judgement calls offered to the user, not done: Daily page picks, Rival pace, Focus aquarium lengths, energy check-in.
- **0.18.1 design pass (whole app):** measured every plugin's CSS (scripts were /tmp/css-audit.cjs, /tmp/hex.cjs;
  screenshots of every view as contact sheets). Changes: `--warn`/`--warn-soft` tokens (light + dark) and the status colours in
  routines, mindset, desk, life-kit, camping, kids, orbit, kanban, fun-games, core now use `--ok`/`--warn`/`--danger`
  (themes control them; decorative/brand colours left alone); fixed 6/8/10/12px radii → `--r-s/--r-m/--r/--r-l`;
  half-pixel font sizes rounded; `LifeKit.empty(t)` with one argument is a quiet hint (was bold), two = title + hint;
  links in `.empty` and checkboxes/radios use the accent; feed fetch errors in plain words (`detail` keeps the cause).
  Calendar view's "now" line uses the accent instead of red.
- **0.19.0 following artists (music list #4):** `radar.follow()` / `/api/radar/follow` (GET list + news; POST
  add/remove/seen). radar_kv `follows`, `followSeen` (per-artist cursor), `followShows`. News since you last looked:
  every Radar signal (blog / chart / release), KEXP plays (`kexp-log.playsSince`), plays on kept stations
  (`radio.playsFor`), Shows' cached list (`shows.cachedShows`). Following someone removes them from the mainstream list
  and `mainstreamSet` never hides a followed artist (user). Client: `window.CadenceFollow`, Follow button on artist pages,
  "Following" in Music → Artists, island note 20 s after load and every 30 min (each item once: `cadence.followNoted`).
  Shows puts followed artists first ("You follow them").

### Player redesign + old-school visualizers (2026-11-16)
- User: the player "seems so out of place design wise and ugly", wants "old school" visualizers to choose from "in a mini window".
- `#pc-mini` (podcasts.js) redrawn with theme tokens (panel, line, shadow, `--r-l`): outlined play button, skip either side,
  steady digits, thin seek line along the bottom (click to jump), tiny live bars that open the visualizer.
- `public/plugins/visualizer.js` (`window.CadenceViz`, in `ALWAYS`): draggable window with Bars (Winamp-style, amber tips,
  no red), Scope, VU (two needles), Ring (theme colour); remembers mode, position, open. "Pop out" uses Document
  Picture-in-Picture (Chrome/Edge) so it floats over other apps.
- Sound analysis needs same-origin audio, so with the visualizer on `P.setViz(true)` plays everything through
  `api/radio/stream?u=` (relay now forwards Range → 206 so seeking works) and keeps the place when switching.
  Once the AudioContext exists the relay stays on for the rest of the page session.
- `CadenceKit.icon(name)` added so plain scripts can use the Lucide set. Icons added: picture-in-picture-2, audio-lines.

### Radar data fixes (2026-11-16)
- "Genres blowing up" skips umbrella tags (alternative, pop, electronic, energizing…) and rounds the numbers.
- Fastest risers no longer filled with ListenBrainz-only "0 → N" rows; status shown only for new entries.
- Albums card drops the redundant "album" chip.

### Artist pages kept and refreshed in the background (2026-11-16)
- User: artist pages "should cache and update in background … its slow". Building one used `loadState()` (the whole
  Radar: every artist, pick, edge and digest) plus 120 days of every chart's points; now `artistRecord`,
  `picksForArtist`, `chartPointsFor` and `isMainstream` read just that artist (about 450 ms → 22 ms on NAS-sized data).
- NAS keeps finished pages in `radar_artist_pages`: served at once, rebuilt in the background after 15 min (or while
  MusicBrainz is pending), pages opened in the last 60 days refreshed hourly, dropped after 60 days unopened.
  `?fresh=1` waits for a new build. The browser keeps the last 40 in IndexedDB `cadence-artists` and re-asks once the
  NAS says it's rebuilding (`refreshing`).

### Daily layout, Kingston Live list (2026-11-16)
- Daily page sections overlapped: its `.db-grid` shared a name with the Dashboard's fixed-row grid. Daily now uses `dy-`.
- Shows: Kingston Live has its own open list (`local` from the server), and every act in a lineup is named (no "and more").
- Idea from the user's API list: Genius (song facts and the stories behind songs; its API has no lyrics).

### Classic player, where they've turned up, faster KEXP history (2026-11-16)
- Podcasts settings → Player look: Calm or Classic. Classic follows the user's own Winamp recreation (gold title pills,
  lime Aldrich time, cream seek bar with gold thumb, lit active button, fold-open Up next playlist; double-click plays).
  Fonts vendored: Aldrich, Share Tech Mono (OFL) next to VT323. Classic keeps sound analysis on (NAS relay) so its
  spectrum moves. Volume is remembered (`cadence.pc.volume`).
- Shows rows: `heard` per act (Radar sources, Lemmy & Mastodon, Said the Gramophone years, KEXP play count, your
  stations), from `heardFor` in radar.js (10 min cache). Artist page points to STG / KEXP when no blog mentions them.
- KEXP backfill: 1,000 plays a page every 1.5 s (KEXP_BACKFILL_PAGE / KEXP_BACKFILL_EVERY); backs off on 429/5xx.
- Idea: winamp2-js / Webamp (MIT code) to load real Winamp .wsz skins the user brings.

### Logos everywhere they make sense, and TheAudioDB (2026-11-16)
- User: "apply logos where it makes sense … its just displaying it" (non-profit personal project). `api.ui.logo(site, {img,
  size, cls})` / `CadenceKit.logo`: the site's icon via `api/favicon`, or a thing's own logo image via the new
  `api/logo?u=` (NAS fetches public images only, 4 MB max, kept in data/favicons as `u-<sha1>.img`), falling back to the
  site's icon, then to nothing. The browser never contacts the station or site itself.
- `site` on views (title, music tabs, all-views list), widgets (dashboard header and library) and plugins (tile).
  Given to: Said the Gramophone, KEXP history, Podcasts (Pocket Casts), Zoho Desk/status/tags/links, Harper; Daily
  widgets (Wikipedia, xkcd, Lichess, Hacker News), Your shows (TVmaze), Client news (Google News). Weather/Outside
  keep their weather icons.
- Logos added in: Radio station cards, now playing, the player and station history (station's own logo, else its site);
  Music Radar source tabs, blog chips and columns, risers, albums, movers, Sources dialog; artist page mentions,
  charts, links, section headings; Shows sources and Details links; Following news; Daily headings and each Hacker News
  story's site; Feeds shelves, settings and stats; task links to Zoho/Gmail/Outlook; meetings' join service; calendars.
- TheAudioDB (`radar/lib/audiodb.mjs`, free key 123 or AUDIODB_KEY; 2.1 s between requests; by MusicBrainz ID, else
  name; kept 30 days, misses 7): band logo (on a dark tile), photo, banner or fan art, biography (About), members,
  label, genre/style/mood, extra links; "MusicBrainz and TheAudioDB side by side" marks where they disagree.

### Lean daily backups, no AIRBREAK in KEXP history (2026-11-16)
- Daily `cadence-<day>.db` backups used VACUUM INTO (the whole file, KEXP history included, 30 kept → tens of GB once
  all of KEXP is in). `backupInto()` now copies every table, index, trigger and view except `kexp_*` and
  `radar_artist_pages` (they download or rebuild by themselves). 194 MB → 46 MB on a NAS-sized test copy, 134 ms.
  Older full-size backups age out over the 30 days. Database view says what backups leave out; its lock emoji is a Lucide icon.
- KEXP's older playlists list DJ talk as a track by "AIRBREAK": skipped when saving, existing rows deleted once
  (`kexp_meta.fix_airbreak`).

### Music Radar learns your taste; Friday mix; Out this week; Called it; Bandcamp (2026-11-16)
- User asked for all nine Radar ideas. Listen log `radar_listens` (POST /api/radar/listen from artist.js: one line per
  preview or song heard live; preview stopped under 8 s = skip). `radar/lib/foryou.mjs`: taste from follows (+5), Want to
  hear (+3), thumbs (±3), previews played/skipped, songs heard live; genre weights (catch-all genres skipped, UMBRELLA now
  exported from sources-data); co-mentions ("mentioned alongside X"). For you card at the top of Radar with reasons.
- Not for me (`notForMe` in radar_kv; /api/radar/nfm): artists and genres join the hide set; a source or one blog
  (`blog:<name>`) gets weight 0. Buttons on For you rows, artist pages, source panel; "See or undo" dialog.
- `radar/lib/extras.mjs`: Friday mix (weeks start Friday, kept 12 weeks, groups For you / New from people you follow /
  Climbing fast / Wildcards; /api/radar/mix, "Make a new one", past weeks), Out this week (MusicBrainz release groups +
  sources' release dates for followed and saved artists; /api/radar/releases; release-day island note), Called it
  (first early sighting vs first Apple chart and KEXP heavy rotation via kexp-log.heavyFirst; card + artist page line).
- Friday mix tab (order 12), island note Fridays after 7am. Bandcamp: "Buy on Bandcamp" (their page from MusicBrainz) or
  "Find on Bandcamp" (search) on artist pages; Bandcamp link on every mix row.
- Sounds-like graph names were "undefined" for edges read from SQLite (no aName/bName): names looked up now.
- Artist page: no logo tile when there's a banner; placeholder layout while loading; banner/releases placeholders while
  TheAudioDB / MusicBrainz are pending; banner and photo keep fixed shapes.

### Sounds like, Close to home, Your year, SomaFM, Mixcloud (2026-11-16)
- Sounds like (artist pages): `radar/lib/similar.mjs` = co-mentions (`store.neighbors`, new edge indexes) + Last.fm
  artist.getSimilar when LASTFM_API_KEY is set (kept 30 days in `lfs:<key>`).
- Close to home (Radar card; /api/radar/home): Kingston (CFRC + Amherst Island Radio plays, Kingston Live acts,
  MusicBrainz "from Kingston"), Canada (!earshot, CIUT/CJRU/CHRY/CKUT plays, MusicBrainz/TheAudioDB country), and
  Local and rising (mentions in the last 30 days). `radio.artistCounts` added.
- Your year in music (tab "Your year"; /api/radar/year?y=): minutes, artists, songs on the radio, previews, follows,
  saves, top artists, months, genres, stations, found early (listened before Apple chart / KEXP heavy rotation).
  Skipped previews don't count. Island note on Dec 1.
- SomaFM (Radio, fold-open): /api/radio/soma reads somafm.com/channels.json (10 min), best mp3 .pls played through
  the relay (`playable()` now relays .pls/.m3u); now playing via the usual ICY reader.
- Mixcloud (Radio, fold-open; /api/radar/mixcloud, 6 h): KEXP DJs who play your favourites most (listens + follows →
  kexp-log artist().djs), Mixcloud public search "<DJ> KEXP" filtered to that DJ; Play loads Mixcloud's widget.

### NAS stopped answering its health check (2026-11-17)
- Up ~2 min then "Health check exceeded timeout": the hourly artist-page warm-up (starts 2 min after boot, 40 pages)
  called `kexp-log.status()` per page just to ask "is it on?", and status() did COUNT(*) over all of KEXP plus a
  dbstat size scan (1 GB+). Also "Called it" loaded every Radar signal on each Radar page load.
- Now: `K.isOn()` for that question; status() keeps the play count (bumped on save) and estimates size from it;
  `K.heavySince()` reads heavy rotation once by date index (window capped at 400 days); Called it groups first
  sightings in SQL (`store.firstSightings`), reads artists only (`store.loadArtists`), kept an hour.

### Idea: Music Radar as its own thing (user, 2026-11-17)
- "at some point radar should be its own thing". Radar + KEXP history + Radio are the heaviest parts and share one
  process with tasks, so a slow Radar query froze the whole app (health check included).
- Step 1: run the music side in a second Node process in the same container (main app proxies /api/radar/*,
  /api/radio/*, /api/kexp*); a crash or slow query there can't stop tasks or the health check.
- Step 2 (later): its own container or app, maybe its own name and database file (cadence.db is 1 GB+ mostly KEXP).
- Related: a `kexp_artists` metrics table (plays, first/last play, first heavy rotation per artist), built in small
  batches and kept up to date on save, so per-artist KEXP numbers never group over millions of rows.

### Radar page froze the NAS (2026-11-17, 0.24.3)
- Opening Radar fires data, calledit, home, releases… at once, all synchronous on the one thread. Fixes:
  `data()` kept 60 s (any POST /api/radar/* or finished scan starts it fresh); For you's "mentioned alongside" is one
  pass over the edges (was candidates × edges); Called it runs in a worker thread (`radar/called-worker.mjs`), starts
  from Apple-chart/heavy-rotation artists only, result kept in radar_kv `calledIt`, refreshed hourly; the page shows
  the last result straight away.
- Daily database backup runs in a worker thread (`lib/backup-worker.js` + `lib/backup-copy.js`).
- Log: "slow: GET /path took Xs" for requests over 2 s; "! stuck for Xs while serving …" when the app is blocked 3 s+.
- New indexes: radar_signals(last_seen), radar_chart_points(ts), radar_picks(artist COLLATE NOCASE).

### Database support: tuning, a reader thread, the KEXP artist summary (2026-11-17, 0.25.0)
- `lib/sqlite-tune.js` on every connection (tasks 16 MB cache / 128 MB mmap, Radar 32/256, KEXP 32/256, Radio 8/64):
  busy_timeout, synchronous=NORMAL (WAL), cache_size, mmap_size, temp_store=MEMORY, `optimize` with analysis_limit
  at open and hourly from storage upkeep.
- `lib/sql-reader.js`: a reader thread with its own read-only connection. KEXP's big reports (top lists, winners,
  search, program/DJ pages, new to KEXP) run there via `rq()` in kexp-log.js, so they never block the app; top() and
  winners() cache the promise. Single-artist/song look-ups stay on the main thread (artist index).
- `kexp_artists` (key, artist, plays, first_at, last_at, first_heavy): built a minute after start, 10,000 plays every
  0.4 s in id order (kexp_meta artists_cursor / artists_done; "KEXP: artist summary ready" in the log), and kept up
  to date in save() only for ids the builder has passed (no double counting). playCount, heavyFirst, heavySince,
  newArtists and the Called it worker read it once it's ready.
- Still to do: KEXP in its own database file (kexp.db); pruning Radar's growing history tables; Radar in its own process.

### Problems log (2026-11-17, 0.26.0)
- `server/lib/problems.js` → data/problems.jsonl (2 MB, then .1): error (with stack), failed (5xx except 502/504),
  slow (>2 s), stuck (app blocked ≥3 s, with what it was serving), stopped (heartbeat `.heartbeat` every 20 s with
  memory; removed on a clean stop, so one found at start = crash/OOM/kill), browser (window error/unhandledrejection
  from core.js → POST /api/problems/browser, 30/min). Same message within a minute is folded.
- uncaughtException is logged then exits (restart: unless-stopped brings it back); unhandledRejection is logged and
  no longer kills the process.
- Problems page (System status plugin; command "Problems"): filters Everything / Errors and freezes / Slow, details
  (stack, page, what it was serving, memory before a stop), Clear.
- Note: the image has no package.json; the version comes from public/version.json.

### The music side runs in its own process (2026-11-17, 0.27.0)
- `server/music.js`: Radar, Radio and KEXP history (their routes, scans, timers) in a child process on 127.0.0.1,
  answering only requests with the main server's one-time key (MUSIC_KEY). Started at boot by `lib/music-proxy.js`,
  which passes /api/radar/* and /api/radio/* through after sign-in (streams piped), waits up to 20 s while it starts,
  and restarts it if it stops (1 s, then backing off to 60 s if it keeps failing), logging "The music side … was
  stopped (SIGKILL, often running out of memory)" in Problems. The child exits when the main server goes.
  MUSIC_PROCESS=0 runs everything in one process as before; MUSIC_MAX_MB caps the music side's memory.
- Mixcloud plays in a small dock at the bottom (#rd-mcdock), outside the page, so redraws don't restart the show.

### Radar page in sections (2026-11-17, 0.27.1)
- Chips under the tiles: For you · Rising · Sources · Communities · About Radar · Everything (sticky; remembered in
  plugin storage `radarSection`). Cards are filed by their heading (FILE map in music-radar.js); the older fold-outs
  (data-more sources/scenes/record/settings) show with their section and open when chosen.
- For you's genre weights now skip catch-all genres (the earlier edit hadn't applied).
- (user, 2026-11-17) Move KEXP to its own database file once the full KEXP backfill is done.

### Radar Rising redesign; deploy clears stuck recreates (2026-11-17, 0.27.2)
- Rising leads with one ranked list "Who's climbing" (replaces the 6-line chart + Fastest risers table): rank,
  play/save, artist + source logos, 14-day sparkline, week-ago → now bar, gain. Albums as a two-line ranked list;
  genre bars in the accent colour with a visible zero line; source labels are inline chips (were full-width stripes);
  fold-out headings hidden inside a section.
- deploy.sh `clear_stale`: removes leftover `<id>_cadence` containers (a Compose recreate that stopped halfway)
  before rebuilding or rolling back. Seen 2026-11-17; the user deleted it by hand and ensure_running restarted Cadence.
