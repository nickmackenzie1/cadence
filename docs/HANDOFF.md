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
- Themes: lookalike fonts (licence permitting), palettes, textures, UI chrome and props in CSS are fine. No logos, no
  quotes, and Claude doesn't draw actual characters. Rebuilt items stay generic (a gem, not a rupee).
- User location: Amherstview, Ontario (Loyalist Township). Garbage: Tuesday east of Speers Blvd, Wednesday west.

## In progress (user picked 2026-11-16)
- Shipped 0.11.0: Outside (outdoors.js: air/UV/pollen, northern lights, ISS passes via server/vendor/satellite.min.js),
  Daily (daily-bits.js: On this day, xkcd, Lichess puzzle iframe, HN), Home helpers (home-bits.js, Life: TheMealDB ideas →
  Kitchen, garbage night with Loyalist presets, Open Food Facts barcodes, TVmaze). Server: services/daily.js, /api/daily/*.
  Kitchen exposes window.CadenceKitchen { addToList, addRecipe } for other plugins.
- Next queue (user, 12:39), Reddit removal done in 0.12.0; then music: artist page, Deezer previews + Want to hear, ICY
  now-playing + history for every station, follow artists + calm alerts, simpler Radar front page, one Music home,
  local shows (Bandsintown/Ticketmaster keys in .env).
- Move local saves to IndexedDB (more room than compressed localStorage); keep the small cadence.off.* keys.
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
