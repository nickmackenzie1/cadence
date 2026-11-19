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
- Name: shortlist Almanac, Hearth, Porchlight, Stella (earlier: Homebase, Lantern). When chosen: UI strings,
  title/manifest/icons, login, README, docs, image/container names; keep reading `cadence.*` storage keys and keep a
  window.Cadence alias; don't move the NAS data dir or .env without a migration.
- Plugin settings offered but not answered (0.18.0): Daily page picks, Rival pace, Focus aquarium lengths, energy check-in.
- Music on the NAS: Navidrome (LAN-only, Subsonic API) or Cadence serving the folder itself.

## Next up (agreed)
- README rewrite (after the rename, or now and rename later). Current README is out of date: sessions, the JSON
  mirror, Synology-only setup.

## Upkeep
- Page weight: with everything on, `bundle.js` is ~1.9 MB (560 KB gzipped). `ALWAYS` in `server/lib/bundle.js` loads
  ten plugins even when they're off; `artist.js` is 66 KB.
- Dark mode check after the design passes.
- Redraws: core views morph in place with idiomorph (0.41.0; `localStorage cadence.morph = off` turns it off).
  Plugin views (data-binding their own handlers) and dashboard widgets still redraw in full, so they don't keep
  focus/scroll yet, and iframes inside them reload (keep those outside views, like the Mixcloud dock).
- `docs/BACKUP.md` still mentions a Reddit key in `.env`.

- Server speed (user, 2026-11-18, from a review of the one-thread setup; most of it was already done: the music process,
  backup/KEXP/vacuum on worker threads, the bundle served from memory, the browser drawing from its own copy first):
  - Calendar: keep the parsed and expanded events (now the raw .ics is cached but parsed and expanded on every request,
    on the main thread); refresh on a timer and let requests read the result.
  - Feeds: refresh followed feeds on a timer so no request parses one inline on a cache miss.
  - Deploys: run deploy.sh's two Docker builds at low priority (nice / ionice) so the app keeps the CPU and disk;
    maybe take new releases only at quiet hours.
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
- A Steam theme (the other game themes are done: CS:GO, Half-Life, Portal, Borderlands, Vice City).
- Kill Bill: blood drips from panel edges that pool on ledges, a splash on finishing a task (Elements engine;
  stylised, not gory; respects Effects off / reduced motion).
- Havok physics option (@babylonjs/havok, MIT WASM ~2 MB, vendored, loaded only when picked): task cards as real
  blocks that tumble and stack, done tasks into a bin. Elements for materials, Havok for pieces that break loose.
- More effects: a lava-lamp focus timer, fireworks when a project finishes (Seasons already does it when today's list
  is done), a snow globe, spring puddles. (Fog, leaves, rain, snow and campfire embers are in Weather window, Seasons
  and Camping, public/plugins/themes-live.js.)
- Zelda fonts (Hylia Serif etc.): check each licence before vendoring.

## Look and feel
- Colour-blind modes (protanopia, deuteranopia, tritanopia, achromatopsia): remap palette, add shape/pattern cues.

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
  card lists the other matches, plus "Not a film", which puts back what you typed. Next ideas from the same list: a
  "Tonight" picker, quiet release reminders, a reward shelf, and a year in review.
- Artist pages: show an artist's albums like Cover Flow or flipping through a record-shop bin, instead of a plain list (user, 2026-11-18).
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
