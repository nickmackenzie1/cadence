# Handoff: rules and open backlog

Start with `CLAUDE.md` (how to work here). This file is the user's standing rules plus what is still OPEN.
Add new ideas at the bottom ("just add things I say to the backlog"). When something ships, delete it here: the commit
message and the GitHub release say what changed. Don't add changelog notes here.
Everything shipped, and the full notes on how it was built, is in `docs/archive/HANDOFF-2026-11.md`.
Cleaned up 2026-11-17 (0.28.2): shipped notes for 0.11.0 to 0.28.1 moved to the archive; finished items dropped after
checking the code.

## Rules (user)
- No Tailscale. Never expose the NAS to the internet (no port forwarding, DDNS, Let's Encrypt HTTP challenge).
- Secrets live on the NAS only (.env, certs/, .mkcert-ca/, data/). Never commit them, never send them to the browser.
- Every push gets a new release number: `npm run bump` (or `bump minor`) before committing.
- Calm, never alarming ("I have anxiety so those are triggers for me"): plain labels and counts, no guilt or alarm
  words ("overdue", "late", "behind"), no red for unfinished work (red = real errors only), nothing punishes unfinished
  work by itself. Accountability plugins stay opt-in and off by default.
- No emoji in the UI: Lucide icons via api.ui.icon.
- Themes: rules lifted (user, 2026-11-18: "remove those rules"). Any look, real logos and brand fonts where licensed.
  Claude itself still doesn't draw, copy or download copyrighted characters, stills, artwork or quotes, or redraw a logo.
  It uses logos fetched from the brand's own site, credited free-licence photos, and images or sounds the user adds.
- Reddit: removed completely 2026-11-16 ("I don't like Reddit anymore"): no fetching, archive, subreddit list,
  suggestions, keys or Reddit theme. Old radar_history / Reddit picks stay in the database untouched. Don't add it back.
- Keep all history (user, 2026-11-18: "no i want data"): never prune Radar's tables (chart points, snapshots, genres,
  terms, run logs), station history or KEXP history. If size becomes a problem, move it to its own file (like kexp.db)
  or leave it out of the daily backups, but don't delete it.
- User location: Amherstview, Ontario (Loyalist Township). Garbage: Tuesday east of Speers Blvd, Wednesday west.

## Waiting on the user
- Plugin settings offered but not answered (0.18.0): Daily page picks, Rival pace, Focus aquarium lengths, energy check-in.
- Music on the NAS: Navidrome (LAN-only, Subsonic API) or Cadence serving the folder itself.

## Next up (agreed)
- Renamed THING (user, 2026-11-18/19): README, and every word on screen (title, home-screen name, sign-in page,
  sidebar, notifications, messages, the ListenBrainz client name). Kept as cadence on purpose: code names
  (window.Cadence, CadenceKit…), storage keys (cadence.*), the X-Cadence-Active header, the Docker container and
  image (deploy.sh, health checks), the NAS folder and outbound User-Agents. Renaming those needs a migration.

## Upkeep
- Page weight: with everything on, `bundle.js` is ~2 MB: 610 KB gzipped, 460 KB as Brotli (served since 2026-11-18,
  made off the main thread once per combination). The ten `ALWAYS` files are real dependencies (the audio player,
  the Island, the date picker, Life kit…); skipping them when unused would save only ~30 KB. The big remaining piece
  was the theme packs: since 2026-11-18 only the pack holding each space's current theme loads with the app
  (localStorage cadence.theme.work / .life tell the chooser); the gallery lists the rest from a small manifest and
  fetches a pack when one of its themes is applied, or all of them when the Themes page opens. A theme a pack makes
  on the fly (not in the manifest) means every pack loads, as before. About 290 KB less script to run on each load.
- Dark mode check after the design passes.
- Redraws: core views morph in place with idiomorph (0.41.0; `localStorage cadence.morph = off` turns it off).
  Plugin views and (since 2026-11-19) dashboard cards redraw in full, but keepBefore/keepAfter put back focus, unsaved
  typing and the cursor, inner scroll positions and opened <details> on a same-page redraw (tests/keep.spec.mjs).
  They aren't morphed, on purpose: plugins bind handlers with closures over the data they drew, and a morph would keep
  the old handlers. Iframes inside them still reload (keep those outside views, like the Mixcloud dock).
- `docs/BACKUP.md` still mentions a Reddit key in `.env`.

- Server speed (user, 2026-11-18, from a review of the one-thread setup; most of it was already done: the music process,
  backup/KEXP/vacuum on worker threads, the bundle served from memory, the browser drawing from its own copy first):
  - Calendar and feeds: done 2026-11-18. Calendars are read by a scheduler job ("calendar", every 10 min) and expanded
    in a worker thread (calendar-worker.js); requests read the kept result. Feeds parse in a long-lived worker
    (feed-worker.js), the "feeds" job keeps recent feeds ready, and a feed older than asked for is answered at once and
    refreshed behind the scenes.
  - Deploys: done 2026-11-18. .dockerignore (an allow-list) stops every rebuild sending data/, .git and the cert
    folders to Docker (gigabytes of disk reads per release), and deploy.sh runs its builds under nice/ionice (each used
    only if it works on the NAS), then swaps the container at normal priority. Not done: releases only at quiet hours.
  - Sync: measure the size of a full save; if it's big, move the JSON parse/stringify and the write off the main thread.

## Check from the NAS (the agent workspace can't reach these)
- Amherst Island Radio's stream; the six blog feed addresses added in 0.8.0 (warnings in Sources).
- KEXP weekly charts (`kexpchart`): parser was written from a description of the page; if Sources says it couldn't read
  the format, look at the page markup.
- Radio now-playing (ICY titles) against real stations.
- NACC chart: page format unchecked, may be JS-rendered.
- Said the Gramophone 2005–2007 best-of pages use older page names and may not read.

## Music and radio
- Radar as its own app: its own container (or name) and database file. The music side already runs in its own process.
- Spotify listening stats view.
- Genius: song facts and the stories behind songs (its API has no lyrics).
- Webamp (winamp2-js, MIT) to load real Winamp .wsz skins the user brings.

## Themes and effects
- Kill Bill: blood drips from panel edges that pool on ledges, a splash on finishing a task (Elements engine;
  stylised, not gory; respects Effects off / reduced motion).
- Havok physics option (@babylonjs/havok, MIT WASM ~2 MB, vendored, loaded only when picked): task cards as real
  blocks that tumble and stack, done tasks into a bin. Elements for materials, Havok for pieces that break loose.
- More effects: a lava-lamp focus timer, fireworks when a project finishes (Seasons already does it when today's list
  is done), a snow globe, spring puddles. (Fog, leaves, rain, snow and campfire embers are in Weather window, Seasons
  and Camping, public/plugins/themes-live.js.)
- Zelda fonts (Hylia Serif etc.): check each licence before vendoring.

## Look and feel
- Colour-blind modes: done 2026-11-19 (public/plugins/colour-vision.js; Okabe–Ito colours over any theme, per device,
  ⌘K "Colour-blind mode…"). Not covered yet: chart series colours in dashboards/insights.

## Everyday app
- File browser for NAS shares (read-only, LAN-only, path-jailed).
- Feed layouts for news and podcasts in rss.js (Letterboxd exists).
- AI chat widget on the dashboard.

## Life
- Couple/roommate bounty board (chores with point bounties, cash out as favours); needs shared lists between logins.
- Location reminders ("you're near the hardware store"): needs the phone app + geofences.
- Sleep data (Oura API; Apple Health via the phone app) for the energy-aware day.

## Fun and weird
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

## Things to know (from shipped work)
- The Docker image has no package.json; the version comes from `public/version.json`.
- Music side: `server/music.js` in a child process (`lib/music-proxy.js`); `MUSIC_PROCESS=0` runs it in-process,
  `MUSIC_MAX_MB` caps its memory. Problems log: `data/problems.jsonl`, Problems page in System status.
- KEXP writes pause while music pages are in use (`KEXP_QUIET_MS`, 2 min).
- KEXP history lives in `data/kexp.db` (0.29.0). Older installs move it over from cadence.db on start (`moveOld()` in
  kexp-log.js: 5,000 plays a step, copied then deleted, resumes after a restart; new plays and the backfill wait for it).
  cadence.db's empty space is given back by `storage.reclaim()` (VACUUM in a worker, 2–5 am, when over 128 MB and a
  third of the file is free; `RECLAIM=0` off). Check `deploy.log`/Problems for "KEXP: history moved to kexp.db".

- Background work goes through `server/lib/scheduler.js` (0.30.0): `sched.add(name, fn, { label, every, first, heavy,
  quiet, hours, retry })`; fn may return `{ again: ms }`, `{ done: true }`, `{ note }`. Heavy jobs take turns; quiet ones
  wait while someone is actually using Cadence (requests carrying X-Cadence-Active, which public/auth.js adds within a
  minute of input or while audio plays; page loads; streams), not an open tab's automatic checks. Don't add new
  setInterval timers for background work. Jobs are listed on the Problems page (/api/jobs, /api/radar/jobs).
- KEXP search uses an FTS5 index (`kexp_fts`, 0.30.1): built by the `kexp-fts` job, kept current by triggers for ids the
  builder has passed; search falls back to LIKE until `fts_done`.
- Artist suggestions (0.30.2): `/api/radar/find?q=` merges Radar's artists, KEXP (via the index) and Deezer's artist
  search (no key, kept a day, 2.5 s limit). Not yet in ⌘K: a plugin search hook for the palette was planned, not built.
- Share target (0.30.3): manifest `share_target` → `./?share_title&share_text&share_url` → `takeShare()` in core.js
  fills quick add. Android and desktop Chrome/Edge only; iPhone doesn't support it for web apps.

- Live sync (0.31.0): `server/lib/live.js` SSE at /api/events; one tab per browser holds it (Web Lock `cadence-live`) and
  relays on BroadcastChannel; each push carries the tab id (TAB_ID) so a tab ignores its own echo. 20 s poll stays.
- ⌘K (0.31.1): `api.search.add(async q => [{ title, k, run }])` for plugin results (artist.js adds artists). Declared in
  types/cadence.d.ts.
- Harper runs as WorkerLinter (0.36.1): readiness = worker answers AND the page's binary (`bin.inner`) loads, 45 s limit,
  retry with a fresh binary (`createBinaryModuleFromUrl(url?retry=N)`). The vendored index.js has one patch
  (CADENCE_QUIET). sw.js dedupes concurrent first downloads of the same file. These were the cause of the form-test flakes.
- Phone tab bar (≤640 px): `#tabbar` built in core.js, styles at the end of core.css; replaces `.nav-btn` on phones;
  hides during meetings, the task editor and dialogs. Things fixed to the bottom go above `var(--tabbar-h)`.

- Speed, measured 2026-11-18 (phone-speed = CPU 4x slower): first screen after a reload is about 1.1–1.4 s. Leaving the
  theme packs and music files out of the bundle cut code by a quarter but saved only ~0.25 s; plain script tags
  (?nobundle) are no faster than the bundle. Most start-up time is the browser's own work plus core.js setup and first
  draw. The user chose to leave start-up speed there. Idle cost was the real problem: the effects layer now sleeps
  (0.38.1, tests/fx-sleep.spec.mjs); don't add loops that ask for frames forever.

- Swipe on phones (0.39.3): list rows only (rows with their own `.check`, not timeline blocks or board cards); right =
  the checkbox's own click (Undo toast), left = tomorrow (Undo). Code next to the tab bar in core.js, styles at the end
  of core.css (pointer: coarse). NAS dreams were dropped from the backlog (user, 2026-11-18).

- Removed 2026-11-18 (user picked them): Grandma mode, Public ledger, Stakes, Procrastination forecaster, Future-you
  negotiator, Regret minimizer, Rival, Client stock ticker, Orbit, Client Pulse. Don't bring them back. Old saved data
  for them is left in place, unused; a dashboard that had the stock ticker shows "This widget's plugin is off or gone".

## New ideas (add below)
- Radar as its own thing (user asked 2026-11-17 what it would take): step 1 its own database file radar.db (KEXP already moved to kexp.db, 0.31),
  step 2 its own container on the NAS that Cadence proxies to (no new port to the outside, same login), Radar pages stay
  inside Cadence. Also asked about other tech worth using: Uptime Kuma/Dozzle on the LAN, a memory limit per container.
- Picked from the vendor list (user, 2026-11-17):
  - Flagged email to tasks over IMAP (Zoho Mail, Outlook, Gmail): a flagged message becomes a task linking back to it.
  - Synology: disk health, free space and backup status on the Status page; Synology Photos "on this day" on Daily.
    DSM Web API (`/webapi/entry.cgi`, `SYNO.API.Info` lists what the NAS has). Storage and Hyper Backup calls need an
    admin account, so consider SNMP (read-only, no password) for disk and volume health; Photos (`SYNO.Foto.*`, unofficial
    docs: github.com/zeichensatz/SynologyPhotosAPI) works with a normal user. Calls stay on the LAN.
- Music tech (user, 2026-11-17, "go for it"): built in 0.32–0.34 except these two.
  - Whole-house radio with Snapcast: needs snapserver running on the NAS (its own container) and snapclient on each
    speaker device. Cadence would feed it the relay's stream (ffmpeg → Snapcast's pipe or TCP source) and get a
    "Play everywhere" button. LAN only.
  - Naming songs on stations that send no titles: AcoustID can't do it (it only matches whole files, not a clip from
    the middle of a song: acoustid.org/faq). Services that can (AudD, ACRCloud) are paid with small free tiers; ask
    the user before adding a key.
- Libraries picked (user, 2026-11-17), vendored in public/vendor, loaded only where used, no build step:
  - SortableJS (MIT): touch dragging on phones for the kanban, lists and dashboard (about five places use native
    drag now, which fingers can't do).
  - uFuzzy (MIT, ~7 KB): typo-tolerant matching in ⌘K ("wnsdy" finds Wednesday).
  - uPlot (MIT, ~50 KB): real axes and hover readouts for Your year and Radar's Rising charts (hand-drawn SVG now).
- Animated "top artists through the years" charts (user, 2026-11-17): bar chart race, bump chart (rank lines),
  streamgraph. Data: KEXP history (2001 on, plays per artist per month, built by a quiet background job into a small
  table), your own listens, and an import of Spotify's extended streaming history (JSON) or Last.fm / ListenBrainz.
  Drawn in the browser with D3 (ISC, vendored, ~90 KB); "Save as video" records the canvas (MediaRecorder, WebM)
  with no server work.
- KEXP live theme: also show the current KEXP song in the Island while it's on.
- Theme pictures: a theme names `tmdb: {type, title, year}` (TMDB stills), `game: {title}` (TheGamesDB fanart),
  `commons: 'subject'` (a credited free-licence Wikimedia Commons photo, server/services/commons.js) or `site` (the
  brand's own logo). Keys come from Settings → Connections (server/lib/keys.js, data/keys.json) or .env.
- Audio (user, 2026-11-18: "not working across the board, podcasts previews etc"): not reproduced in Chrome on 0.41.4.
  Fixed the likely Safari cause (sound engine made before a tap stays paused, so everything with the visualizer or
  Even volume on plays silently: now it waits for a tap, and any tap wakes it). Waiting on the user's device, what
  happens, and Status → Problems.

- **Theme checks** (tests/themes-health.spec.mjs, 2026-11-18): every theme is applied to the demo data and checked for
  readable text (contrast measured from the screenshot's pixels), sideways scrolling, a squashed view, missing task rows
  or quick add, and errors. Pictures of every theme are in CI's "themes" artifact. Its KNOWN list holds four themes whose
  unselected sidebar tiles are faint (under 2.7:1): XP and daisyUI Emerald, Retro and Valentine. Contrast gets 10% slack for CI's font rendering. It already found two
  bugs: LimeWire's quick-add text stayed on every theme after it, and the quick-add hint was the browser's grey (gone on dark themes).

- **Watch list** (public/plugins/watchlist.js, Life, 2026-11-18): "watch Dune", "see Severance" or "play Hades" in quick
  add looks the title up (TMDB through /api/tmdb/find and /api/tmdb/title, TheGamesDB through /api/gdb/find, cached 30
  days) and files it in a "Watch list" area with its poster, year and runtime, without a due date. The Watch list page
  has posters of what's next, a search box with suggestions, and a shelf of what you've watched and played. The task's
  card lists the other matches, plus "Not a film", which puts back what you typed. Reminders (2026-11-19): once a day
  while THING is open it checks release dates (TMDB, TheGamesDB) and shows' next episode (/api/tmdb/next, 12 h) and
  sends one quiet note when a film or game is out today or a season starts; cards say "Out Mar 3" / "Season 3 on Jan 17".
  Your year tab: counts, hours of film, favourite genres, month by month, covers. Works in both spaces since 2026-11-18 (each
  space has its own list), and every "added" toast has See the list. Tonight (same day): pick how much time you have (45 min to
  All evening) and it suggests one thing that fits; what's waited longest comes up more often. Next ideas from the same list: a
  "Tonight" picker, quiet release reminders, a reward shelf, and a year in review.
- Artist pages' albums: done 2026-11-18 as Cover Flow, a Record bin and the Grid (public/plugins/coverflow.js, a
  component any page can use: CadenceCoverFlow.html(items, { key, artist })).
- Havoc (user, 2026-11-18): a dragon that flies around the page and sets things on fire (its fire is Elements fire, so
  it spreads and burns real page bits); and marry Havoc's two screens, Physics (Matter.js) and Elements (falling sand),
  into one, so pieces knocked loose fall into sand, water and fire and burn, float or sink. Ties in with the Havok
  physics item above. The dragon is Cadence's own design, not a known character.
- Havoc creatures (user, 2026-11-18), alongside the dragon above, all Cadence's own designs:
  - a blobby that chases the wizard along the ground (the bottom of the page)
  - the dragon blows fireballs
  - a vampire cat that flies around trying to bite the wizard
  - when the dragon comes out, a wizard comes out too and fights it with fireballs from his staff; after a random
    number of hits the dragon is beaten and the next boss comes out, wrecking more of the screen each round.
  - Built 2026-11-18 as "Wizard vs bosses" (public/plugins/havoc-fight.js, game in public/vendor/havoc-fight.js; Shift+F or
    ⌘K). Rebuilt the same day as pixel art (user: "pixel art, it should use our physics and elements engines"):
    sprites are flat shapes snapped to hard pixels with an outline. Words fly with Havoc's physics engine, which now
    runs "bare" for it (havoc-engine.js start({bare:true}): no toolbar or keys; H.blast / H.melt / H.knock). Fire (on
    oil, so it lasts), lava, acid and ice are the ambient Elements layer. The wizard shouts his spells in comic
    bubbles: purple Fireball, Kablammo, Meltdown, Zappity zap, Frostbite, and Splat splat (Blobby only: he bursts
    into acid and pulls himself back together). Bosses: Dragon (fireballs, lava), Vampire cat (claws the page, swoops,
    sometimes latches on and bites), Blobby (a jelly cube), and Skeleton (throws bones, or the trick: offers something
    nice, then grabs the wizard, shakes him and throws him; user, 2026-11-18). Esc restores everything.
    Still to do: Havoc's own toolbar has no button for it, and the dragon in the item above is separate.
- **Background work page** (public/plugins/jobs.js, 2026-11-18; user: "a place where we could view these jobs and control
  them"): every scheduler job from the app and the music side, with what it's doing, its last run and its last few
  runs. You can run one now, which skips the wait for a quiet moment (heavy jobs still take turns), pause it, or change
  how often it runs. Pauses and pace changes are kept in DATA_DIR/jobs-app.json and jobs-music.json
  (scheduler.control; POST /api/jobs/<name> and /api/radar/jobs/<name>). Jobs that run in small steps until their work
  is done (backfills, the search index) have no fixed pace to change. Laid out like Immich's Jobs page (user, same
  day): a card per job, grouped (KEXP, Music, Reading, Notifications, Upkeep), with Last run and Next run counters and
  Run now, Pause and More on the right.
- **One Havoc** (2026-11-18; user: "Elements should be the go-to for everything destructive and awesome, but keep how
  the words float and explode"): Havoc's physics toolbar is now Grab, Blast, Fire, Lava, Acid, Rain, Black hole,
  Zero-G and Collapse (keys 1–9), plus a Wizard button that starts Wizard vs bosses. The letters stay physics; fire (on
  oil), lava, acid, the rain and the blasts' flames are Elements matter (havoc.js, the havoc:fx event). Physics' own
  rain streaks and water beads are gone; its invisible drops still knock letters loose. The full Elements mode (the
  page as sand) is still behind the toolbar's Elements switch.
- **Lyrics** (public/plugins/lyrics.js + server/services/lyrics.js, 2026-11-19; user picked LRCLIB): a panel above the
  player. On the radio it follows what's on; KEXP gives each song's start, so synced lines light up in time (other
  stations count from when the title changed; Earlier/Later nudges are kept per station in localStorage
  cadence.ly.delay, KEXP starts 6 s behind). Song lists (CadencePreview.buttons for songs) get a lyrics button, the
  player bar and the Radio card get one too. LRCLIB's rules are kept: User-Agent names THING, one request at a time
  with a 350 ms gap, a wait on 429. Answers are kept in data/lyrics-cache.json (found 60 days, not found 3).
  Full screen (2026-11-19; there's no Focus mode in THING, so this is the distraction-free view): big lines, the
  cover blurred behind, Esc to come back; ⌘K "Lyrics, full screen".
  TasteDive built 2026-11-19 (services/tastedive.js, TASTEDIVE_API_KEY): "More like this" on Watch list cards, "Because
  you watched" on the Watch list page, "Fans also like" on artist pages; kept 30 days, stops at 250 an hour, hides
  itself without a key or an answer. Not built: Audiometa (browse by tempo/key; a key), Open Guitar Chords (chord shapes only), Verome (scrapes
  YouTube, streams through Piped/Invidious: skip).

- **Idea (2026-11-19): Last.fm API needs Pro from 1 December 2026; look at Koito.** Last.fm keys stop working
  unless the key owner pays for Pro. THING only uses Last.fm in Music Radar (charts and tags source, listener
  counts for the "small but buzzing" boost and the mainstream cut-off, the "Last.fm listeners" line on artist
  pages, similar artists). Scrobbling already goes to ListenBrainz. Plan: keep Last.fm working when a key is set,
  but make the free path the default (ListenBrainz popularity and sitewide stats, MusicBrainz tags, ListenBrainz
  Labs similar artists), and quietly skip Last.fm when the key is rejected. Koito
  (https://github.com/gabehf/koito, MIT, self-hosted, ListenBrainz-compatible, imports Last.fm history) could run
  on the NAS as a private listening history, with THING sending listens to it through LISTENBRAINZ_API.

- **Built (0.43.0, 2026-11-19): Music Radar off Last.fm, and Koito.** How big an artist is now comes from ListenBrainz
  (`POST /1/popularity/artist` by MusicBrainz id, cached a week on `a.lb`; artists without an id are looked up in the
  background and counted next run), in `server/services/radar/lib/enrich.mjs`. Counts are kept as given
  (`{ n, from: "lb" | "lastfm" }`, `sizeOf`, `sizeText`); scoring (`sizeFactor`) and the mainstream limit use
  Last.fm-sized numbers, so ListenBrainz counts are multiplied by `RADAR_LB_SCALE` (25, a rough guess: tune it on the
  NAS if too many or too few artists get hidden). Last.fm is used only while `lastfmOk()`: a key is set and Last.fm
  hasn't turned it down (HTTP 401/403 or error 4/9/10/26 → `lastfmRejected` in radar_kv; retried after a day or with
  a new key). Every Last.fm call goes through `lastfmJson`. Radar's Setup says when the key was turned down.
  New free source `lbcharts` (ListenBrainz sitewide top artists, week and month). The track record compares like with
  like (`p.listenersFrom`). Fixed on the way: `a.listeners` was never set, so the listener part of the mainstream
  filter and the artist page's listener line never showed; `sizeCandidates` sets it now.
  Koito: `KOITO_URL` + `KOITO_TOKEN` (env or Settings → Connections) sends listens to
  `<KOITO_URL>/apis/listenbrainz/1/submit-listens` with `Token <key>`, next to ListenBrainz or alone, each with its
  own queue (`koitoScrobbleQueue`). Radar's top bar has a "Your listening" link to Koito (the address only goes to the
  browser, never the token). Koito itself isn't in THING's container: run it beside THING on the NAS (its compose
  file needs Postgres), LAN only, and import your Last.fm history there before 1 December.

- **Radio (2026-11-19):** added WXYC 89.3 (Chapel Hill), WFUV 90.7 (Fordham, New York) and KSUA 91.5 (Fairbanks) as
  presets; their streams are found in Radio Browser like the other stations.
- **Radio now playing from station playlists (2026-11-19):** presets can carry `playlist` (`wxyc`, `wfuv`,
  `spinitron:<CALL>`); `stationNow` asks that first and falls back to the title in the stream. WXYC is
  `api.wxyc.org/flowsheet` (format read from their iOS app, github.com/WXYC/wxyc-ios-64). KSUA is Spinitron's public
  now-playing widget (`widgets.spinitron.com/widget/now-playing-v2?station=ksua`) and WFUV is the wfuv.org/playlist
  table: both parsed from HTML whose exact markup couldn't be seen from the agent workspace, so the parsers are
  tolerant (any element with class artist/song/release; any table row of time | song | artist). If either shows
  nothing on the NAS, check the page's markup against `parseSpinitron` / `parseWfuv`. Entries older than 20 minutes
  aren't shown as playing now. Overrides for testing: WXYC_API, WFUV_PLAYLIST, SPINITRON_WIDGETS. Any other Spinitron
  station can use the same `spinitron:` source.
- **Built (2026-11-19): Hockey on the Island** (`public/plugins/hockey.js`, `server/services/nhl.js`, `/api/nhl?team=TOR`).
  Off until switched on (⌘K "Hockey on the Island…" or the plugin's settings); the choice is per device
  (localStorage `cadence.hockey`: on, team, sound). The NAS reads the NHL's public feed (api-web.nhle.com
  `/v1/score/now`, and `/v1/club-schedule/<TEAM>/week/now` for the next game), kept 15 s during a game and 10 minutes
  otherwise; NHL_API points at a stand-in for tests. While the game is in warm-up or on, the Island holds
  "BOS 1 · TOR 2 · 2nd 08:01" (away first). A goal for your team lifts the Island in blue with the scorer and a horn
  synthesised with Web Audio (no sound file); goals against only change the score. No horn in a meeting or when the
  tab is hidden. One note at the final. Remembered per game, so reloading doesn't sound the horn again. Team names
  only, no logos. Pick any of the 32 teams.
- **Built (2026-11-19): pages draw at once** (user: "we need to start gradually loading or loading on demand, show
  something at least"). New core helper `api.cached(url, onData, {max})`: hands over this device's last copy of a NAS
  answer straight away (synchronously, so the same render draws it; localStorage `cadence.c.<url>`, up to 1 MB each),
  then the fresh answer when it lands, only if it changed. `api.ui.skeleton(cards, label)` draws placeholder outlines
  (`.skel` in core.css, a gentle breathe, still with reduced motion). Music Radar: its six pieces each draw as they
  land instead of waiting for the slowest (status, data, community, releases, called-it, home), and a revisit
  refreshes quietly after a minute. Radio: the station list and KEXP history come from the saved copy first; the NAS
  answers `/api/radio/stations` without waiting on Radio Browser (300 ms budget instead of 2.5 s, and a failed
  look-up is remembered 10 minutes instead of being retried on every visit; the page already asks again for stations
  still "looking up"). KEXP history pages: first visit in a session shows the saved copy for each view. Use
  `api.cached` for any new page that reads the NAS on open.
- **App review (2026-11-19, user: "lets go over the whole app and see what improvements can be made"):**
  Speed: (1) the first request after each release gets bundle.js uncompressed (2.1 MB; Brotli 466 KB is made after
  that first request): compress before serving. (2) Inter and JetBrains Mono come from Google Fonts on every visit:
  vendor them (OFL). (3) Eight more pages still open on "Loading…" (rss, artist, status, outdoors, jobs, dbview,
  daily-bits, home-bits): move them to `api.cached` + `api.ui.skeleton`. (4) Every save writes the whole space to
  localStorage and sends the whole space to the NAS: measure, then send changes only. (5) Plugin views redraw in full
  (scroll and focus lost): morph them like core views. (6) Life-only plugins (artist, radar, radio, podcasts…) load
  in Work too: skip per space, or load a plugin's file when its page first opens.
  Reliability: (7) CI takes 8–19 min a run, 4 of the last 40 failed, 10 were cancelled by newer pushes: shard the
  specs across parallel jobs. (8) A "Check outside services" button on Background work: runs each outside source once
  (TMDB, LRCLIB, TasteDive, NHL, Radio Browser, the station playlists, KEXP charts, NACC…) and says which answered,
  so the "Check from the NAS" list checks itself. Polish: (9) the 💿 icon has no Lucide match and shows as an emoji.
  (10) Dark mode pass; chart colours in colour-blind mode.
- **Done (2026-11-19, from the app review):** (1) bundles compressed before the first request: the skip lists this NAS's
  browsers asked for are kept in data/bundle-combos.json (last 8) and compressed again when the server starts
  (`bundle.warm()`), so the first visit after a release gets Brotli, not the 2 MB copy. (2) Fonts are in the app:
  public/vendor/fonts (Inter and JetBrains Mono variable, latin + latin-ext; Bangers and Luckiest Guy for Momentum),
  @font-face at the top of core.css, licences beside them, served with a one-year immutable cache. No Google Fonts
  request anywhere now. (9) 💿 maps to Lucide disc-3.
- **Done (2026-11-19, review item 3):** the last eight "Loading…" pages draw at once: Said the Gramophone and Want to
  hear (artist.js), Problems (status.js; its two job lists are fetched together now), Background work (jobs.js),
  Outside (outdoors.js, per place), Daily bits (each card), Home bits TV, Database (dbview.js), KEXP through the years
  (kexp-race.js) and every RSS feed (rss.js: the last copy of each feed, then the NAS's). Saved copies are
  `cadence.c.*` in localStorage; `window.CadenceCached` is `api.cached` for code outside setup().
- **Done (2026-11-19, review item 8): Check outside services**, at the bottom of Background work (jobs.js;
  server/services/checks.js; POST /api/checks runs them, GET gives the last). 19 services asked at once with a
  10 s limit each: Radio Browser, KEXP, the WXYC/KSUA/WFUV playlists (through the real readers, ignoring age, so a
  changed page shows as "Can't read it"), SomaFM, MusicBrainz, ListenBrainz, LRCLIB, TMDB, TheGamesDB, TasteDive,
  Last.fm, NHL, TVmaze, Open-Meteo, Wikipedia, xkcd, Hacker News. Ones needing a key that isn't set say "No key".
  States: Works, No key, Can't read it, Didn't answer (calm colours). Radar's own sources keep their check on Radar's
  Sources page. Add a line to CHECKS when THING starts using a new outside service.
- **Done (2026-11-19, review item 6):** the bundle chooser leaves out every plugin file whose plugins are all off (or
  not offered) in the space the page opens in, not only ones off in both; switching space fetches the rest
  (core.js LazyPlugins, unchanged). Opening in Work skipped about 220 KB more script in a test profile.
- **Done (2026-11-19, review item 4): saving a big space is fast.** Measured with 3,000 tasks: three quick adds
  blocked the page for ~8.7 s in total, 6 s of it lz-string compressing the space and the sync state for
  localStorage on every save. Now (core.js lsWrite) a document past LZ_MIN (150 KB) is saved to IndexedDB only, with
  the `idb1:` marker in localStorage (the path that already existed for a full localStorage); compression stays only
  for browsers without IndexedDB. The sync state keeps a 64-bit fingerprint per record (`fp`) instead of a full copy of
  its text; old copies are turned into fingerprints when read, so nothing is re-sent. After: the longest block was
  136 ms, ~0.7 s in total. NAS sync already sent only changed records. Theme code that read cadence.v1 straight from
  localStorage uses `window.CadenceWorkDoc()` now.
- **Done (2026-11-19, review item 5):** plugin pages already kept focus, typing, scroll and opened sections on a redraw
  (keepBefore/keepAfter in core.js); dashboard cards now do too (`api.widgets.render` wraps the same keep).
- **2026-11-19, user: "i feel like the saving locks things up"** (after 0.44.4 had already taken out the lz-string
  compression; no freeze could be reproduced here with 3,000 tasks, so the next step is real numbers):
  - Saving on the device is adaptive (core.js LocalQ): while a save takes ≤ 12 ms it's written straight away, as
    before; once one takes longer (or the space is IndexedDB-only), an edit's save waits 250 ms and a run of quick
    edits is written once. Written at once on pagehide, when the page is hidden, and before switching space.
    IndexedDB-only keys skip JSON.stringify entirely.
  - Freeze logging (core.js Slow): saving on the device, working out what changed for the NAS, and drawing the page
    note their time; a heartbeat notices the page not answering. A step over 400 ms or a freeze over 700 ms (page in
    front only, not sleep) goes to Problems as kind "slow", from "browser", with the device, page, version and the
    sizes of both spaces and their three biggest plugin-data entries. At most one a minute.
  - Read those Problems entries before guessing further: they say which step it was and which plugin's data is big.
- **Built (2026-11-19, user's ideas): three more Wizard bosses** (public/vendor/havoc-fight.js), rounds 5–7:
  Big baby (drops in and wails; tears are Elements water; each WAAAH is a ring that knocks the words and the wizard;
  throws his rattle; every spell becomes Milk time!, and he falls asleep with Zzz instead of exploding),
  Graveyard (one zombie per stone, 5–7; a hand comes up when the wizard goes near, the zombie climbs out (clipped at the
  floor) and shuffles after him; one hit each, two after round 7; the bar counts how many are left), and Old Clinker
  (the user asked for a fire monster "like the one from Howl's Moving Castle, in the spirit of"; that character is
  copyrighted, so this is our own grumpy coal heap with a flame crown: sparks, fire run along the floor, heat that melts
  the page; fire only tickles him, Frostbite hurts and steams, and he shrinks as he's put out). Bosses now answer
  `hitTest(x, y, r)` and `aim()`, so a boss can be several targets (the zombies). `HavocFight.debug.boss(kind)` jumps to one.
- **Physics engine review (2026-11-19, user: "take a look at the physics engine… give me a list").** Measured on the
  demo Today page (891 letters, headless Chromium without a GPU, so absolute numbers are low): the page alone 60 fps;
  Havoc on and still ~27 fps; after Collapse ~22; blasting the pile ~11 (worst frames 200 ms). Most of the time is the
  browser restyling and compositing ~900 transformed letter divs each frame ("program" in the profile), then
  elementsFromPoint in dent(), then Matter's solver. Ideas, roughly by payoff:
  Speed: (1) draw letters on one canvas (a glyph sprite per character and style, drawImage with rotation) instead of a
  div each; (2) a fixed 60 Hz physics step with an accumulator (smoother, steadier stacks); (3) spatial lookups
  (Matter's grid / a simple bucket grid) for bodiesNear, black holes and knock, no array copies per frame; (4) sprite
  particles instead of shadowBlur and a gradient per particle; (5) cache the boxes dent() pushes instead of
  elementsFromPoint ×28 per blast; (6) letters that settle go back to sleep and aren't touched.
  Feel: (7) words hold together as one body until a hit is hard enough to break them into letters; (8) the page's
  cards become shelves the letters land on, and a big blast knocks the card loose too; (9) weight by size: headings
  heavy, small print light, bold a bit heavier; (10) images shatter into pieces on a blast instead of flying whole;
  (11) Restore rewinds: every letter flies back to its place instead of snapping; (12) soft ticks when letters land,
  louder for harder hits, with Havoc's own synth.
  Together with Elements: (13) two-way: letters float on Elements water, catch fire from Elements fire and burn to ash,
  get eaten by acid (needs the Elements worker to answer "what's at these points" a few times a second);
  (14) lava pushes letters as it flows.
  Fixes: (15) resizing the window restarts Havoc and loses the mess: move the walls instead; (16) screen shake ignores
  "reduce motion"; (17) touch: two fingers to throw, and a long press to grab on the iPhone.
- **Havoc stays real text (2026-11-19, user: drawing letters on a canvas would look "rendered", which is what's lost).**
  Letters stay page elements. Done: `will-change: transform` only on letters that are moving (class `mv`, dropped
  when they sleep or are static) instead of on all of them (900 layers at rest); transforms are written only when a
  letter moved more than a quarter pixel or 0.004 rad. Measured (headless, software rendering): at rest ~28 → ~55 fps;
  mid-blast unchanged here (software compositing is what this machine is worst at), to be judged on a real GPU.
  Next for the moving case, keeping real text: words as one element and one body until hit hard (≈5× fewer of both),
  a fixed 60 Hz physics step, and caching the boxes dent() pushes.
- **Done (2026-11-19, physics 1–3):** (1) words: each word is one element and one body (`kind: 'W'`, the page's own
  kerning) until a knock faster than BREAK (15 px/step) or a collision at 1.5× that breaks it into letters where it
  stands (`shatter`); melt/acid break words first so their letters drip; 891 letters on the demo page start as 225
  pieces. (2) Physics on a fixed 1/60 s step with an accumulator (max 3 steps a frame), drawn blended between the last
  two steps (positionPrev/anglePrev). (3) dent() finds the page's boxes once per Havoc (`boxes()`), then picks the
  innermost ones in reach. Measured headless: Collapse ~23 → ~35–50 fps, the settled pile ~56–60.
  User's next asks: images burst into pixels (Elements matter that pours, burns, dissolves, drips), letters and
  Elements react to each other, cards as shelves, weight by size.
- **Done (2026-11-19, physics 12–15):**
  - (14) Weight by size: `feelOf(fontSize, weight)` gives each word/letter its density (∝ size^0.9, bold ×1.15), air
    drag (small print 0.04, headings 0.004) and bounce.
  - (13) Cards as shelves: every card (a boxy element ≥ 80×40, up to 90) gets a 6 px static ledge on its top
    (`makeShelves`). A blast within 0.3 R of a card loosens it (`loosen`): the real card element tumbles (its
    transform follows a physics body), its words and pictures come free, and cards inside it ride along. Collapse
    loosens all of them bottom-up. The Island and toasts never count as cards.
  - (15) Pictures burst into pixels (user: "shards will look weird"): a blast within 0.45 R of a picture sends its
    pixels to the Elements layer (`havoc:fx` type 'pixels'; havoc.js scales the picture to one colour per cell; a
    picture from another site can't be read, so it bursts grey). New Elements materials in elements-core.js:
    PIXEL (24, a coloured grain that pours like sand, chars and catches like paper, acid eats it, lava melts it) and
    DRIP (25, the melted colour, runs like a liquid and sets back into PIXEL as it cools); flying pixels are sparks of
    kind 5 that land as PIXEL. Cleared when Havoc or the fight stops. Without Elements (reduce motion) pictures fly whole.
  - (12) Words and Elements both ways: elements-core answers `probe` ([x, y, …] in cells → materials); the engine
    exposes `world.probe(pagePoints)`. Havoc asks every 6 frames for each word: water → it floats (a little more than
    its weight upwards, and drag), a still word in water is lifted loose; fire/ember/lava → it darkens and glows
    (sepia + brightness + an orange glow), passes fire to its neighbours, and at 1.4 turns to ash (+ smoke); lava
    also shoves it; acid → it blurs, shifts colour and fades into fumes.
- **Done (2026-11-19, Havoc finish and touch):**
  - Rewind: Esc, the close button, Reset and the end of a Wizard fight call `__havoc.rewind()`: every piece still on
    screen flies back to its `home` (stored on words, letters, letters broken out of words, pictures) with a little
    overshoot, loose cards slide back, the scorch fades; then `stop()` puts the real page back underneath. Pieces that
    were burnt, dissolved or eaten just reappear. Reduce motion: straight back.
  - Touch: a tap does the tool; a finger held still for 0.32 s grabs what's under it (Matter's mouse constraint, a
    tiny buzz where supported); two fingers sweep what's near them along; fire/lava/acid paint as you drag. The
    toolbar scrolls sideways on a phone (no brand or mode switch there), with 44 px buttons and the safe area.
  - Resize (or turning the phone) keeps the mess: walls and floor move, the scorch canvases are copied over.
  - Reduce motion: no screen shake or flash.
  - Soft ticks: words and letters tap when they land (bandpass noise, louder for a harder hit, lower for bigger
    text), at most six every 100 ms and one per piece every 120 ms.
  - Glow and smoke particles are pre-made sprites per colour; glows draw with 'lighter', so overlapping sparks
    brighten.

### Havoc: the page turns into pixels again, black holes eat everything (2026-11-19)
- User: "The one thing lost is the old 'the page turns into pixels' look… need to keep this, this is what is amazing".
  - Once the Elements layer is ready, Havoc draws every still word's ink at cell size and registers the whole word
    box as untouched PAGE (`stamp` in elements-core), each cell knowing the colour behind its word.
  - Untouched cells are see-through. Page words live in `#havoc-page`, a layer at z 59 just under the Elements
    canvas (z 60), so the real word shows; burnt or eaten cells paint the background over it, pixel by pixel.
  - Fire, acid, lava and lightning on a still word pin it in place (it burns as pixels, no ash crumble). Blast,
    grab, black hole and the rest throw it: its cells are removed (`unstamp`) and it flies as a physics word in the
    top layer. A resize re-registers the still words. Esc clears all of it.
- User: "black holes should suck up fire and stuff just everything".
  - `w.sink(x, y, r, secs)` in Elements: every loose cell (fire, smoke, sand, water, ash, pixels, burnt page) and
    every flying spark spirals in and is gone at the middle. Untouched page and the hidden ledges stay. It replaces
    the old growing erase circle.
- User: "if the water gets deep enough little ecosystems should pop up, fish, veg, etc" (built the same day).
  - In the Elements worker (`ecoStep`/`fishStep`), so it works anywhere the Elements layer runs, Havoc included.
  - A pool counts as deep at 14+ cells (about 40px) of water over a solid floor. Every 45 steps a few random water
    cells are checked: deep pools get KELP (material 26) that grows up a cell at a time while there's water above
    it (a slow shimmer runs up the stalks), and pools that have kelp get fish (at most 4 close together, 30 in all).
  - Fish are three cells (light head, body, darker tail) in five calm colours. They swim side to side, turn at
    walls, drift up and down, and now and then let out a bubble. Out of water they flop, then are gone after about
    3 seconds; fire, lava, acid and lightning next to them end them in a little puff; black holes pull them in.
  - `w.fish()` counts them. Test: the last one in `tests/havoc-fight.spec.mjs`.

### One Havoc with a Materials drawer, and more life in the pools (2026-11-20)
- User picked "one Havoc": the Physics / Elements switch is gone from the toolbar. Shift+H always opens Havoc; an old
  saved 'elements' choice is ignored and removed. The full-screen Elements sandbox (snow storm, heat view, lights and
  so on) is still in the command palette as "Elements sandbox".
  - New tool 0, Materials, opens a drawer above the toolbar: Water, Sand, Snow, Ice, Oil, Holly, Wood, Stone,
    Gunpowder, Steam, Firework, Lightning and Eraser. They paint straight into the Elements layer (`w.paint`, only into
    empty cells, so they pile on words rather than replacing them; the Eraser does clear page, words included).
    Firework and Lightning are clicks. The drawer only opens once the Elements layer is there.
- User picked "more life in the pools" (on top of 2026-11-19's kelp and fish):
  - Fish nibble the weed now and then (it grows back).
  - Lily pads (material 27, PAD) float on the surface of pools with weed; some have a pink flower. They drop when the
    water goes and bob up when covered.
  - A frog (up to 3) turns up on a pad, sits, and hops between pads and solid edges. It startles at splashes. In the
    water it paddles up for a while, then is gone. Fire, acid, lava and lightning get it; so do black holes.
  - A word landing in water at speed (`w.splash`) sends nearby fish racing up and leaping out, steering back over the
    water mid-air.
  - A pool that has had weed for about 45 seconds starts growing a second, coppery weed: shorter and bushier.
  - `w.life()` gives { fish, frogs, pads, jumping }. Test: the pool test in `tests/havoc-fight.spec.mjs`.

### Dark mode pass (2026-11-20, item 10 of the app review)
- Swept every page (core and every plugin view) in dark mode with a contrast check on all visible text.
- Fixes:
  - Dark `--faint` is #77746e (was #5c5a56, 2.7:1 on the page; now about 4:1). It's the colour of group counts,
    hints, dates and the like.
  - Text on the accent colour now picks itself: core.js `onAccent()` measures the accent in use and sets
    `--on-accent-auto` to white or #15152b, whichever reads better. Dark mode's light violet gets dark text (it was
    white at 2.9:1). Rules with an accent background use `var(--on-accent, var(--on-accent-auto, #fff))`, so a theme
    that sets `--on-accent` still wins. It re-checks whenever <html>'s style or class, or a stylesheet in <head>, changes.
  - Invoice radar avatars had grey letters (`.ir-row span` reached into the avatar); plain links in a page are the
    accent colour instead of the browser's blue; next-month days in the calendar, "null" in the database viewer and
    empty job counts are less faded.
- Left as they are: finished tasks dimmed in the schedule, theme previews (they show other themes' colours), and
  white letters on bright client colours (same as light mode).

### Island messages no longer wait behind notices that stay up; CI split in three (2026-11-20)
- Found through a failing test on a Friday: while the Island showed a notice that stays up (Friday's "Weekly review",
  a spinner like "Connecting…"), every other message queued behind it and never appeared. Now a plain message steps
  in front and the notice comes back after it, and notices that stay up only show when nothing else is waiting.
  Test: `tests/island-sticky.spec.mjs`.
- The same digging found why "Connecting… THING v…" could sit on the Island forever: the startup notice
  (status.js `islandBoot`) updated and dismissed "whatever's on the Island" instead of itself, so if another notice
  was up it dismissed that one and left Connecting… stuck. It uses its own handle now.
- CI shards don't cancel each other (fail-fast off), so one run shows every failure.
- CI (item 7 of the app review): the Playwright run is split into three shards that run in parallel; the first also
  runs the typecheck. Promoting to `stable` and the release are a separate job that waits for all three. Theme
  pictures upload per shard (`themes-1/2/3`).
- Reminders due now, or within the next 15-second check, fire on time (`remindSoon` in core.js) instead of up to
  15 seconds late. Found when the Island fix made the notifications test reach its reminder sooner.

### Idea (user, 2026-11-20): the Island comes out of the sidebar
- "the island should come from the sidebar and have it organically come out for notifications but keep the island
  idea". Sketch: at rest a slim pill in the sidebar under the THING header (time, sync, live activity); a notice
  swells it and flows out past the sidebar edge into the page, then it draws back in. Phone keeps the top Island;
  a collapsed sidebar puts it on the rail. Same queue, notices, live activities and notification centre.

### Havoc: water finds its level; the Elements sandbox folded into Havoc (2026-11-20)
- User picked "water that slopes": cells only spread along their own surface, so a pool split by a word or shelf but
  joined underneath stayed slanted. `levelStep()` in elements-core: a few random water cells per step climb to the
  top of their water, flood-search the joined water (up to 2048 cells) for the lowest open surface, and move there
  if it's 2+ cells lower. Lily pads don't block it. Calm water (searches finding nothing) is only searched every 8th
  step, so it costs nothing measurable. Test: the U-tube in `tests/havoc-fight.spec.mjs`.
- User picked "tidy up the old Elements mode": the full-screen sandbox (which read the whole page into matter) and its
  toolbar are gone from elements-engine.js (863 → ~560 lines); it is only the ambient layer now. The palette entry
  is gone. Its extras worth keeping are the Weather row in Havoc's Materials drawer: Snowfall, Storm, Wind (Calm /
  Breeze / Gale) and String lights, sent as `havoc:fx` 'weather' and asked of the layer with `CadenceFX.want('havoc')`
  together with rain. Esc turns them off. Heat view and the pixel-sharpness switch were dropped.
- Havoc ideas offered (not built yet): wet sand and mud that grows grass; pools that ice over with Snowfall; fireflies
  and birds; moss on wet words; dominoes along a line; a volcano; tilt the iPhone to pour; a fan and a magnet;
  replay of the last minute; muffled sound under water.

### Today's schedule: short blocks are readable (2026-11-20)
- User picked "schedule blocks you can't read": a half-hour block is about 25px wide, so it showed a letter or two.
  - On hover or keyboard focus a block grows to its full title (min-width: max-content, up to 360px) and lifts above
    the others. Blocks whose right edge is past 60% of the timeline open leftward (`.rt`, `--r`), so they never run
    off the end.
  - In a narrow block the small client line gives up its room first (flex-shrink 999), so the title gets what's left.
  - Phones (or any screen without hover) get a "Next up" list under the timeline: the next three things today, in
    full, with their time ("Now" if under way). Tapping a task opens it, like the block does.
  - Test: `tests/schedule-blocks.spec.mjs`.

### Havoc put back to two modes (2026-11-24)
- User: "I feel like havok regressed, the effects are not there. Can we go back to what it was with the two menus and
  everything else, the water sloshing is good but everything else now is terrible".
  - Havoc's files (havoc-engine.js, elements-engine.js, elements-core.js, plugins/havoc.js, havoc-fight.js and their
    tests) are back to how they were at 1227d67, just before "One Havoc": the Physics / Elements switch, the full
    Elements mode with its own toolbar, kelp and fish. Gone again: the Materials drawer and Weather row, lily pads,
    frogs, jumping fish and the coppery weed.
  - Kept: water finds its level (`levelStep`, without the lily-pad bit) and its U-tube test, plus `w.paint`.
  - Same day, user: "I did like the fish and lily pads and stuff growing": the pond life is back on top of the
    two-mode Havoc: elements-core.js is the e8b80bb version (lily pads, frogs, leaping fish, the coppery weed, water
    levelling that lily pads don't block), with `w.splash` / `w.life` in elements-engine.js and the splash call in
    havoc-engine.js `senses()`. The pool test is the full one again.
  - Not pushed and set aside in a local git stash on 2026-11-20: bombs, vacuum, fan and volcano, built on the newer
    Havoc. They'd need porting onto this version if wanted.

### Ideas (user, 2026-11-24): Triple C (triplec.fm/developers), backlog
- Free API for non-commercial use (key as `Authorization: Bearer`, 60/min, 10,000/day): shows, venues, artists,
  festivals, now playing. User picked for the backlog:
  1. Shows near you: a card or Daily item with gigs in your city this weekend, and how busy tonight looks.
  2. Your artists on tour: match artists from your listening (Radar, KEXP history) against Triple C shows; flag ones
     playing in Canada, especially nearby.
  3. Triple C as a radio station, with now playing and the last ten songs.

### Havoc (Physics mode): bombs, vacuum, fan, volcano (built 2026-11-20, moved onto the two-mode Havoc 2026-11-24)
- User: "bombs you can place and they explode a couple seconds later, vacuum you drag around, fan, volcano".
  - Bomb (B): drops where you click, fuse fizzing; flashes faster and faster and goes off about 2.6 s later as a full
    blast. Click one with the Bomb tool to pick it up and throw it. A blast within 150px sets other bombs off early.
  - Vacuum (V): hold and drag. Words near the nozzle are pulled in and swallowed; still words come loose when it's
    close; Elements matter is sucked in through a small instant sink (`w.sink(x, y, r, secs, true)`).
  - Fan (F): press where it sits, drag to aim, hold to blow. Words in the cone lift off and fly; loose matter, flames,
    smoke, snow and sparks are pushed along (`w.gust`, a cone in elements-core `gustStep`).
  - Volcano (U): a vent at the bottom of the page under the click. Lava wells up for about 14 s with eruptions that
    throw glowing lava bombs, which land as lava, and toss what's above the vent.
  - `__havoc.tools()` gives { bombs, vents, words } for tests. Test: the tools test in `tests/havoc-fight.spec.mjs`.

### CI actions on Node 24 (2026-11-24)
- GitHub warned that Node 20 actions are deprecated: checkout, setup-node, cache and upload-artifact are now v5 (Node 24).
- Flaky tests (watch list, full storage, Wizard fight, new bosses, Follow, inline editor, keys): user doesn't want them
  chased ("seems like a lot of work"); CI's retries cover them.

### Havoc on phones; no Christmas lights in Havoc (2026-11-24)
- User: "how can we make this more mobile friendly, it's so fun to play with on phone" → picked a tuck-away toolbar,
  names instead of key hints, and full screen, "only for mobile".
  - Elements mode on a touch screen without hover (`(hover: none) and (pointer: coarse)`): the toolbar is a slim bar
    with the current material, the last three used, More, Pause and Exit. Swipe up (or More) opens everything, each
    button named, sliders full width; picking a material tucks it away again. Computers are unchanged.
  - Full screen: `html.havoc-open` hides Cadence's tab bar while either mode is open.
- User: "Remove the Christmas lights from havok": Havoc's Elements mode no longer hangs string lights; its Lights and
  "where snow settles" buttons (and the L key) are gone, and snow settles everywhere. Lights outside Havoc are untouched.
- Idea (user, 2026-11-24): a Notion theme. Backlog.

### Tilt to pour (a setting), the Physics phone toolbar, the Wizard fight on phones (2026-11-24)
- Tilt to pour, user: "it needs to be a setting you can turn off and on and not on by default".
  - `window.CadenceTilt` (plugins/havoc.js): a Tilt button in both modes' toolbars on phones, remembered per device
    (`cadence.havoc.tilt`, off by default). iOS asks for motion access the first time; if it's turned down a message says so.
  - Left-right tilt -1 … 1 (follows screen rotation). Elements: `opts.tilt` leans which way sand and water go, sand
    slides on a steep tilt, water on top climbs toward the low side so the surface leans; levelling pauses while tilted.
    Physics: gravity leans (`engine.gravity.x`) so loose words slide, and the matter layer leans too (`w.tilt`).
- Physics mode on phones gets the same tuck-away toolbar as Elements (current tool, last three, More, Exit; named buttons).
- Wizard fight on phones: the boss bar across the top, "Tap to cast a fireball" and Stop under it, tab bar hidden.

### Havoc: fire and lava light up the page (2026-11-24)
- User picked "light from fire and lava". The compositor (elements-engine.js) adds a wide, soft warm light from
  everything that glows (fire, lava, embers, lightning): a 5x5 blur of a coarse level of the light texture
  (WebGL), or a 1/32-size copy brightened and scaled up in two steps (2D fallback). It tints the words and cards
  about 200px around, golden near fire and orange near lava, and flickers with them.
- Only while Havoc is open (`lit`: the sandbox always, the ambient layer only with `html.havoc-open`), so the
  everyday page's snow and lights don't cast haze. Shadows weren't done.
- Tests: `window.__forceGL = true` before the engine loads makes it use WebGL even on a software renderer.

### Havoc: splashes and arcs (2026-11-24)
- User picked "splashes and arcs". In elements-core.js:
  - Falling water counts how far it has fallen (`fv`). Landing after 8+ cells, sometimes (40%) it and a little of the
    surface around it jump up as droplets: kind-6 sparks that fly with gravity and land as water again (`landDrop`).
  - `w.splash(x, y)` (a word landing in a pool in Physics mode) now also throws a crown of up to 10 droplets from the
    surface, besides startling the fish and frogs.
  - Elements mode: water painted with a quick stroke flies off along it as droplets and arcs down (`line`).
  - `w.life()` also reports `drops` in flight.

### Havoc: smoke that curls (2026-11-24)
- User picked "smoke that curls". elements-core.js `swirl(x, y)`: a slow, smooth field of sideways currents (three
  sine waves over place, height and time). In `gasMove`, smoke, steam and fumes are carried left or right by it
  (up to 60% of the time where it's strongest), so plumes bend, spread and curl, and the curls drift. Subtle on a
  light page, clearer in dark mode.
- Tilt fix (same day, user: "Tilt in havok doesn't work"): settled matter ignored it. Changing tilt now wakes every
  chunk in the Elements worker (`opt` 'tilt' → `awake.fill(1)`) and every sleeping Physics body. If the page isn't
  a secure context (iPhones only give motion to https pages) Tilt says so instead of asking; if no motion readings
  arrive within 2.5 s it points to Settings → Safari → Motion & Orientation Access. The user's phone showed
  mackenziebox.local as "not secure", so the https address (with the NAS certificate installed) may be needed.

### The Island lives in the sidebar on computers (2026-11-24)
- User: "the island should come from the sidebar and organically come out for notifications but keep the island
  idea" → decided: gone completely from the top on computers, phones keep it; always shows the time; notices expand
  to fit their size.
  - island.js: a `.isl-slot` (30px) is made under the THING header in `#side-head`; while the window is wider than
    900px the Island is pinned to it (`place()`, `.isl.dock`, fixed left/top from the slot). At rest it fills the
    slot: sync dot and time (or a live activity). A notice grows it to the right, out over the page, as wide and
    tall as the notice needs (up to 540px wide; `.isl-t` up to 480px), then it draws back in.
  - The notification centre opens beside the docked pill instead of under it (notify.js).
  - 900px and narrower (no sidebar): the top Island as before.
- Same evening, user: "the pill should be built into the sidebar so it looks like liquid coming out with a
  notification", "part of the sidebar and not sitting on top". Docked, the pill has the sidebar's colour and no
  border: at rest it's just a sidebar row with the time. A notice keeps that colour and always flows out at least
  56px past the sidebar's edge; the part outside is drawn by `.isl-out` (a shape from the edge plus two concave
  fillets joining it to the edge above and below) which alone carries the hairline and shadow, so inside the sidebar
  there's no outline and the edge line disappears where it pours out. The notice's colour tint glows from the
  outer end only.

### Your phone controls Havoc on the Mac (2026-11-24)
- User picked "phone as a controller" from the push-the-limits list.
  - server/routes/havoc.js: a live relay, nothing stored. The Mac with Havoc open (either mode) listens on
    GET /api/havoc/remote/host (SSE) and says its mode, screen size and tools with PUT .../host. A phone asks
    GET /api/havoc/remote whether one's open and POSTs { t: tilt | down | move | up | key | hello } (at most 80 a
    second); each goes straight to the listening Mac. Signed in like everything else; only on the home network.
  - plugins/havoc.js: the Mac acts it out: tilt goes to the CadenceTilt listeners, touches become pointer and mouse
    events at the same spot (reaching into Havoc's shadow roots), a ring shows where; keys become key presses.
    The phone: "Havoc is open on your Mac — Control it" appears on its Island (or the palette command "Havoc:
    control it from this phone"): a touchpad shaped like the Mac's screen, the Mac's tools by name (they follow a
    mode switch), Tilt and Done. It closes itself when Havoc closes on the Mac.
  - Switching between Physics and Elements is still done on the Mac.
- Idea (user): Desk mode (tasks as lightly physical cards: flick to tomorrow, drop on a client, crumple when done),
  as a mode you switch on, off by default. Backlog.

### Music Radar on phones; thumbs that work (2026-11-24)
- User (iPhone screenshots + "Load failed" ×3 from #view-radar): "Layout issues on phone. Can't click like or don't like".
  - Thumbs: a vote used to throw away Radar's whole cached page (`bust()`) and reload it, so the NAS rebuilt
    everything at once and the phone's requests failed. Now the server marks the pick in the cached copy, and the
    page lights the thumb at once and saves in the background (no reload); if saving fails it flips back with a
    calm message.
  - Phones (≤ 900px): the section chips are one sideways-scrolling row that sticks below the top Island; For you is
    one column with "Not for me" as its eye icon; picks' thumbs sit on their own row and are bigger; wide tables
    scroll inside their card. Test: "on a phone" in `tests/radar.spec.mjs`.

## App review, items 1–6 (2026-11-24)
- **Phone pages fit the screen:** Invoices rows, Radio stations and the Tickets toolbar no longer run off the side (grid columns can shrink, the toolbar wraps).
- **One sticky offset:** `--sticky-top` in core.css (0 on computers, 48px + safe area on phones up to 900px). Sticky headers use `top:var(--sticky-top,0px)` (DB viewer, RSS, Radar sections, calendar, kanban). Use it for any new sticky header.
- **Bigger tap targets on touch screens:** the task circle has an invisible 44px touch area, the Tomorrow/Next week/Clear buttons are 40px tall, and date chips get a larger touch area. Same look.
- **Secure address on phones:** plugins/secure-phone.js. A phone on http gets a calm Island note once a day; "Set up the secure address on this phone" in the palette opens the steps (download ca.crt, install the profile, turn on full trust, open https://host:8443). `/api/health` now has `httpsReady` and `httpsPort`; if the NAS has no certificate yet, the guide says so and points to deploy.log ("tls:" lines).
- **Watch list "More like this" test:** it now adds its own Severance (a CI retry starts on an empty NAS, so it can't rely on earlier tests). The "watch Dune" test had a comment hiding two checks; they run again.
- **Radar no longer rebuilds everything after small changes:** the route used to clear the page data on every POST. Now each change clears only what it affects. Background changes (listens, hometowns, similar artists) keep showing the current page and refresh quietly (`soften()`). A rebuild that started before a change is dropped (`dataGen`). "Not for me" on an artist removes it from the picks straight away.
