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
- Themes: lookalike fonts (licence permitting), palettes, textures, UI chrome and props in CSS are fine. Logos are
  allowed now (user, 2026-11-16: "there can be logos, lets remove that rule"), but Claude itself doesn't redraw a brand's
  real logo or wordmark; real artwork the user brings (skins, images) is fine. No quotes, and Claude doesn't draw actual characters. Rebuilt items stay generic (a gem, not a rupee).
- Reddit: removed completely 2026-11-16 ("I don't like Reddit anymore"): no fetching, archive, subreddit list,
  suggestions, keys or Reddit theme. Old radar_history / Reddit picks stay in the database untouched. Don't add it back.
- User location: Amherstview, Ontario (Loyalist Township). Garbage: Tuesday east of Speers Blvd, Wednesday west.

## Waiting on the user
- Name: shortlist Almanac, Hearth, Porchlight, Stella (earlier: Homebase, Lantern). When chosen: UI strings,
  title/manifest/icons, login, README, docs, image/container names; keep reading `cadence.*` storage keys and keep a
  window.Cadence alias; don't move the NAS data dir or .env without a migration.
- Plugin settings offered but not answered (0.18.0): Daily page picks, Rival pace, Focus aquarium lengths, energy check-in.
- Music on the NAS: Navidrome (LAN-only, Subsonic API) or Cadence serving the folder itself.

## Next up (agreed)
- Prune Radar's growing history tables.
- README rewrite (after the rename, or now and rename later). Current README is out of date: sessions, the JSON
  mirror, Synology-only setup.

## Upkeep
- Flaky tests: `tests/more.spec.mjs` fails a different test under a busy full run (camping, games, kids); each passes
  alone. CI's two retries hide it.
- Page weight: with everything on, `bundle.js` is ~1.9 MB (560 KB gzipped). `ALWAYS` in `server/lib/bundle.js` loads
  ten plugins even when they're off; `artist.js` is 66 KB.
- Dark mode check after the design passes.
- Redraws: dashboard widgets' own redraws don't keep focus/scroll yet; iframes inside views reload on redraw (keep
  them outside views, like the Mixcloud dock).
- `docs/BACKUP.md` still mentions a Reddit key in `.env`.

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
- Games themes: CS:GO, Half-Life, Steam, Borderlands, GTA (Breath of the Wild exists). A Camping theme.
- Kill Bill: blood drips from panel edges that pool on ledges, a splash on finishing a task (Elements engine;
  stylised, not gory; respects Effects off / reduced motion).
- Themes screen: category tabs or a side index, search, compact grid + live preview.
- Havok physics option (@babylonjs/havok, MIT WASM ~2 MB, vendored, loaded only when picked): task cards as real
  blocks that tumble and stack, done tasks into a bin. Elements for materials, Havok for pieces that break loose.
- More effects: Halloween fog, autumn leaves, spring rain and puddles, a lava-lamp focus timer, fireworks when a
  project finishes, a snow globe, a campfire for the camping planner.
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

## Things to know (from shipped work)
- The Docker image has no package.json; the version comes from `public/version.json`.
- Music side: `server/music.js` in a child process (`lib/music-proxy.js`); `MUSIC_PROCESS=0` runs it in-process,
  `MUSIC_MAX_MB` caps its memory. Problems log: `data/problems.jsonl`, Problems page in System status.
- KEXP writes pause while music pages are in use (`KEXP_QUIET_MS`, 2 min).
- KEXP history lives in `data/kexp.db` (0.29.0). Older installs move it over from cadence.db on start (`moveOld()` in
  kexp-log.js: 5,000 plays a step, copied then deleted, resumes after a restart; new plays and the backfill wait for it).
  cadence.db's empty space is given back by `storage.reclaim()` (VACUUM in a worker, 2–5 am, when over 128 MB and a
  third of the file is free; `RECLAIM=0` off). Check `deploy.log`/Problems for "KEXP: history moved to kexp.db".
- Not pushed: a Radar history pruning commit (chart points 400 days, series 180, run logs 60–90, station history 400)
  was built 2026-11-17 and set aside when the user said "just do db move". Rebuild it if asked.

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

## New ideas (add below)
- Radar as its own thing (user asked 2026-11-17 what it would take): step 1 its own database file radar.db (KEXP already moved to kexp.db, 0.31),
  step 2 its own container on the NAS that Cadence proxies to (no new port to the outside, same login), Radar pages stay
  inside Cadence. Also asked about other tech worth using: idiomorph for redraws, Uptime Kuma/Dozzle on the LAN, a memory
  limit per container.
- Picked from the vendor list (user, 2026-11-17):
  - Discogs: collection and wantlist. Radar marks "you own this"; the wantlist and Want to hear stay in step.
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
