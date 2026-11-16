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
- Free data (all NAS-side, cached, no keys):
  - Outdoors: air quality, pollen, UV (Open-Meteo); northern lights (NOAA SWPC); ISS passes.
  - Daily: Wikipedia "On this day", xkcd, Lichess daily puzzle, top Hacker News stories.
  - Home: dinner ideas (TheMealDB), garbage night (Loyalist preset + any weekly schedule), barcode → shopping list
    (Open Food Facts), TV shows airing tonight (TVmaze).
- Move local saves to IndexedDB (more room than compressed localStorage); keep the small cadence.off.* keys.
- Design pass: one type scale, spacing scale, radius set and colour roles across core + every plugin; same patterns for
  headers, empty states, lists, dialogs, badges. Sharpen, don't redefine.
- README rewrite. Rename: the user is still thinking about a name (offered Hearth, Almanac, Homebase, Lantern). When
  chosen: UI strings, title/manifest/icons, login, README, docs, image/container names; keep reading `cadence.*`
  storage keys and keep a window.Cadence alias; don't move the NAS data dir or .env without a migration.

## Music and radio
- Music on the NAS: Navidrome (LAN-only, Subsonic API) or Cadence serving the folder itself. User to decide.
- Spotify listening stats view.
- Reddit: user doubts approval will come (2026-11-16). Since 0.10.0 Radar reads Lemmy communities + Mastodon hashtags
  instead (lib/fediverse.mjs, same post shape as Reddit) and Reddit is only read with keys or when switched on.
  Don't scrape Reddit or work around the block. A mainstream filter hides big artists (lib/mainstream.mjs).
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
