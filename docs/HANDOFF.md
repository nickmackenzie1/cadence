# Session notes (Cadence)
- Repo: /home/claude/repo (GitHub nickmackenzie1/cadence, push origin main). Commit as user.name="Cadence" email noreply@anthropic.com with Co-Authored-By + Claude-Session trailer.
- App: public/index.html (core, first <script> block), plugins in public/plugins/*.js loaded by script tags at end of index.html:
  island.js, status.js, momentum.js, brand.js, havoc.js, links.js, datepick.js. vendor/: matter.min.js, havoc-engine.js
- Server: server.js (Node, no deps): /api/health, /api/state, /api/ai, /api/favicon, /api/company, /api/banner. safeFetch(url) = public-hosts-only fetch.
- Artifact: slug ae5a5a29-2e8e-4973-abd3-9223e0b9c039, latest version 1794014753-00db (publish_files patch mode, list files).
- Mock NAS for tests: /tmp/mock2.js -> `pkill -f mock2.js; rm -rf /tmp/cd3; mkdir -p /tmp/cd3; (DATA_DIR=/tmp/cd3 PORT=8496 node /tmp/mock2.js &)`; playwright tests in /tmp/t*.py
- Plugin API: api.on(ev), api.sidebar.add({id,slot:'top'|'bottom',render}), api.views.add, api.commands.add, api.clientActions.add, api.storage.get/set, api.system(), api.ui.{toast,pointer,modal,close,esc,avatar,faviconUrl,navigate,refresh,currentRoute}, api.clients.{list,get,update}, api.tasks.*, api.plugins.enabled(id). Events: task:complete, task:quickadd, render {route}, render:side, sync, client:update, meeting:start/end, reminder.
- Island API: window.CadenceIsland.show({title,sub,icon,check,spin,actions,sticky,ms}), .update(n), .dismiss(), .live(key,{prio,view}), .clear(key)
- NOTE: something else is also editing public/plugins/status.js (corner boot + islandBoot timings). Read before editing.
- TODO next: (1) Living mural plugin (task -> brushstroke in client brand colours, time-lapse, export poster). (2) Generic RSS feed plugin with server proxy /api/feed (safeFetch, cache), placement options (sidebar bottom / home / own view), "record store" vinyl theme using item images (Lightspeed CDN: swap /75x75x2/ -> /300x300x2/). Feed: https://www.somethingelserecords.ca/index.rss (RSS 2.0, image in description <img>).
  (3) Spotify: user has Premium. HTTPS is now local mkcert (see below), no DDNS/Let's Encrypt.
- mural.js added (view-mural). Next: test with t22, then RSS.
- mural committed 16c034d
- rss.js written + server /api/feed + preposition repair migration (S.fixPrep). testing t24
- pushed 2a39412 (rss/island) + datepick home fix. artifact version 1794015195-dcc1 (needs index.html+datepick republish)
- TODO: RSS pop-out timeline panel (click sidebar row -> slide-out vertical timeline grouped by day, 'new since last visit').
- SPLIT DONE: public/core.js + core.css; built-ins moved to plugins/{importers,recap,pulse,zoho-tags,prep,chase,templates,review}.js. backup /tmp/index.backup.html
- TODO: Mural MOSAIC mode: public-domain painting (Wikimedia presets via NAS /api/img proxy, or upload) rebuilt from tiles of client logos tinted to target colour; each completed task lays k tiles; ghost of target underneath.

## Session end 2026-11-06 21:20 (commit 5bc2dc6, artifact 1794017429-292b)
Done: demo mode, calendar, insights, db viewer, feeds wall+timeline, motion/narrow, Island API (show/celebrate/progress/live), plugin cards (icon/color/category/tagline/settings), mural mosaic (/api/img), Havoc damage blends into the page, update notice.
Next: (superseded, see below)

## RULES (from the user, 2026-11-08) — override anything above
- No Tailscale. Never expose the NAS to the internet (no port forwarding, DDNS, Let's Encrypt HTTP challenge).
- Secrets live on the NAS only (.env, certs/, .mkcert-ca/, data/). Never commit them, never put them in the browser.
- Deploy = push main -> CI tests -> promoted to `stable` -> NAS deploy.sh (every 5 min). Repo clone is /home/claude/cadence.

## Session 2026-11-08
- HTTPS (mkcert): tls.sh (called by deploy.sh) downloads pinned mkcert v1.4.4 (sha256 per arch), CA in .mkcert-ca/
  (never mounted), leaf cert in certs/ -> mounted /certs:ro. Hosts = hostname, hostname.local, localhost, LAN IPv4s
  + CERT_HOSTS. Reissues on host change / 30 days before expiry, exit 10 -> deploy.sh restarts container.
  server.js: certs present -> https on 8443, http 8484 = 307 redirect (before auth) + /ca.crt (public CA only).
  tests/https.spec.mjs covers it. HTTPS=off disables.
- LOGIN (done): public/login.html (+ auth.js fetch guard -> login?next= on 401, plugins/account.js 'Sign out' command).
  server: cookie cadence_session (HttpOnly, SameSite=Strict, Secure on https), sessions hashed in data/sessions.json (0600),
  keyed to a password tag (password change = all signed out), 'keep me signed in' 30d sliding else 12h, lockout after 5 misses
  (30s doubling, max 15m), Origin check on non-GET, Basic auth still accepted for scripts. tests/login.spec.mjs.
- ISLAND (done): themed via core CSS vars (panel/text/line); idle = translucent panel + hairline (blends in);
  notices add .up (lift, shadow, ring + glow in notice colour via --glow, dark colours fall back to accent) + one .ping ring.
- Plan order: HTTPS (done) -> login page (cookie session, replaces Basic auth) -> SQLite (node:sqlite, Node 22 image).

## Backlog (user ideas, 2026-11-08)
1. Client page redesign (screenshot was the Filecenter client page: flat, washed out). More aggressive theme in the
   client's brand colours; switching clients MORPHS the colours like TV bias lighting (ambient glow behind the
   page/background), but text must stay very readable (contrast-checked).
2. RSS skins for common feed types: news, podcasts (player), etc. (rss.js already has records/cards/list).
3. File browser / network shares view (NAS-side, read-only first; must stay LAN-only, path-jailed).
4. Kanban view. 5. Calendar view (month/week grid; calendar.js has the ICS events).
6. Weather plugin: API key entered in settings but STORED ON THE NAS (server proxy, like calendars.json), placeable in
   several spots (sidebar / home / island).
7. Spotify listening stats (needs HTTPS: done; PKCE, tokens on NAS).
8. WORK / LIFE MODES (big, decide before SQLite schema): same user, two spaces. Work = current app (clients, meetings,
   Zoho). Life = different setup and philosophy, NO clients (personal areas/projects instead?). Each mode its own data,
   plugins enabled, sidebar, theme. Needs a 'space' key in storage -> design SQLite with spaces from day one.
- Web links plugin (done): plugins/weblinks.js, sidebar 'Links' section + Settings editor + ⌘K 'Add a web link'.
- Older: right-click menu, verify mosaic with real Wikimedia images and logos on the NAS.

## Session 2026-11-08 (later)
- Shipped fun plugins: haunted.js (ghost per overdue task, 6 personalities: sulker/nosy/judge/prankster/drama/shy,
  seek UI targets .task[data-id] / .qa / .isl-pill, speech bubbles one at a time, flinch on completes, z-index 25 under modals),
  stocks.js (deterministic price from history: deliveries/meetings/chases up, idle >2d and overdue down; index + tape +
  5 weakest; ⌘K Market report; Island crash alert once/day), intern.js (SVG pixel sprite, boxes = client-owed items,
  sleeps at N days (setting), wakes you once/day/client with Chase -> window.CadenceChase).
- MARKETING (user's words): "it can be as simple as writing and taking notes, a place to relax, or a place to go
  batshit crazy and make it whatever you want." / "It's whatever you want it to be, but in the end life is always a to-do list."
- NEXT (promised): Christmas mode plugin (lights, snow, optional build-up on UI/letters/where you type, real physics,
  chaos level from gentle to insane in settings). Desktop-pet sheep (sheep.exe-style: walks panel edges, falls, sleeps,
  draggable) — ORIGINAL pixel sheep, not the Stray Sheep/Poe design.
- Ideas asked about: Letterboxd (no open API; public RSS letterboxd.com/<user>/rss/ -> rss.js 'films' skin with posters).
- Life mode areas: Home, Health, Money, Projects (+custom). Waiting on user confirmation of the SQLite/spaces design.

## Themes (2026-11-08)
- themes.js = engine (data-skin on <html>, vars/light/dark, fonts always declared, stylesheets/scripts lazy, enhance + effects
  hooks with cleanup, custom accent/font/corners/effects level in storage 'custom'/'effects', theme in storage 'theme', gallery
  view 'view-themes', ⌘K 'Theme: X' / 'Next theme'). Loaded right after core.js so there's no flash.
- themes-pack.js: Useful (paper, tufte, nord, solarized, contrast, calm), Fun (ninety-five, xp 'Luna', seven 'Aero',
  chicago, nes, terminal, vaporwave, sketchbook), Crazy (crt, matrix, geocities, cyberpunk[augmented-ui enhance], doodle-party[css-doodle]).
- Vendored (licenses alongside): 98.css fonts, system.css Chicago fonts, augmented-ui, css-doodle, ET Book (Tufte), OFL fonts.
  Skipped: DOS VGA font (no license), doodle.css (no license), Apple Monaco/logo, any Microsoft assets.
- User links to consider: Orbit (zumerlab, MIT) radial UI -> ideas: radial right-click/quick-add wheel, client 'solar system'
  view, 24h day-clock of meetings/tasks.
- Work/Life: user said YES to: separate spaces under one login, Life areas Home/Health/Money/Projects(+custom),
  no clients/meetings/chasing in Life, calmer by default ('Calm' theme fits). Design SQLite with spaces.

## Backlog additions (2026-11-08 late) — user: "just add things I say to the backlog, react later"
- Plugins declare spaces: `spaces: ['work'] | ['life'] | ['work','life']` so they show in one or both environments.
- LIFE: inbox scanner plugin: choose mailboxes (IMAP/Gmail/Outlook, creds on NAS only) + categories (school, kids' sports,
  programs). Brief breakdowns, recaps, action items, suggested calendar events/notifications. AI model selectable; non-AI
  rule-based fallback (keywords, dates, senders).
- LIFE: shopping list that also becomes a weekly menu, feeding calendar and to-dos.
- Christmas mode (lights, snow, build-up, physics, chaos level). Sheep desktop pet (original design).
- Orbit (MIT) ideas: radial right-click wheel, client solar system, 24h day clock.
- Letterboxd film diary skin for rss.js. More: focus aquarium, invoice radar, desk plant, weekly rewind, bills calendar.
- Dashboard: AI chat widget later. Side panel exists (dock a page).
- Floating sticky notes: pin any note so it follows you across every page (draggable, minimisable, synced).
- Notifications: a proper system. Desktop notifications exist only for reminders today (Settings → General); add a
  notification centre (history), per-plugin notification settings, Web Push (needs a service worker + HTTPS: we have it),
  and quiet hours. Island stays the in-app surface.
- LIFE: "Good Homeowner" plugin. A guided first-run interview about the house (heating/cooling type, filter sizes,
  eavestroughs, gutters, smoke/CO detectors, water heater, sump pump, roof, appliances, lawn/garden, pool, well/septic),
  then it creates the recurring maintenance reminders with sensible seasonal timing (furnace filter every 1–3 months,
  eavestroughs spring + fall, detector batteries twice a year, water heater flush yearly…). Keeps a house profile:
  model numbers, filter sizes, paint colours, contractor contacts, warranty dates, so the details are there when needed.
  Belongs to the Life space (Home area); dashboard widget for "this month at home".

## SQLite phase 1 (2026-11-08, shipped)
- server.js storage layer: node:sqlite DatabaseSync at data/cadence.db (WAL). Tables: meta(schema=1, created, migrated_from_json),
  state(id=1 json, updated_at) = the synced document (API unchanged), records(kind task|client|meeting|plugin|settings, id,
  space default 'work', data JSON, updated_at (only bumps when data changes), deleted flag).
- Startup: imports state.json when DB empty OR state.json.updatedAt > DB (rollback/STORAGE=json safety). JSON mirror still written
  every save. Daily VACUUM INTO backups/cadence-YYYY-MM-DD.db. SIGTERM checkpoints + closes. STORAGE=json forces JSON.
- Node 22 image (CMD silences ExperimentalWarning), CI node 22. /api/health: storage, storageNote. /api/db: db{rows…}.
- NEXT (phase 2): per-record sync API (GET /api/records?since=, PUT /api/records batch with per-record updated_at, conflict = newest
  per record), client switches from whole-document sync; then drop the JSON mirror; then spaces (space column + UI switch).
- Toasts (e.g. "Theme: X · Undo") should come out of the top bar / Island instead of floating bottom-centre, and STACK when
  several arrive close together. Slick, emerging from the UI naturally. (core toast() -> Island stack; keep actions.)

## SQLite phase 2: per-record sync (2026-11-08, shipped)
- Schema 2: records(kind task|client|meeting|plugin|doc, id, space, data, pos, rev, edited_at, device, deleted), history (every
  version, 60 days, base for 3-way merge), conflicts (cid, field, kept/other + devices/times, resolved), meta.rev counter.
  'doc'/'root' = every top-level key except tasks/clients/meetings/pluginData/updatedAt. Schema 1 -> 2 rebuilds records from state.
- API: GET /api/sync?since=rev -> {cursor, records, docUpdatedAt, conflicts(count)}; POST /api/sync {device, since, changes:[{kind,id,
  data|deleted, pos(new only), baseRev, at}]} -> applies, 3-way field merge vs history[baseRev]; same field both changed -> newest
  `at` wins + conflicts row (plugin kind + internal doc fields = silent/resolved). Edit beats delete. Returns records since + newConflicts.
  GET /api/conflicts, POST /api/conflicts/resolve {cid}. /api/state GET/PUT still work (older tabs): PUT = importDoc (record-level).
  After each sync push: state table + state.json mirror refreshed (assembled doc), daily backup.
- Client (core.js): Store.mode 'records' when health.storage==='sqlite' else 'doc' (old path). `Sync` object: localStorage
  '<LS_KEY>.sync' {init, cursor, recs{key:{rev,h,deleted}}, dirty{key:firstSeenAt}}; diff() vs recs, apply() keeps local
  unsent edits, adopt() on first run (server copy unless local S.updatedAt newer). Device name: localStorage 'cadence.device' or UA.
  Clash notice on Island + 'Review sync clashes' (⌘K) modal; useConflictValue applies the other value and saves.
- Tests: tests/sync.spec.mjs (two browser contexts, offline merges, clash + flip, deletes, old-tab PUT, upgrade paths).
- NEXT: Work/Life spaces (records.space column exists; client needs a space switch + plugin `spaces` flag), then drop state.json mirror.
- Calendar in Life: personal calendars per space (calendar.js is Work-only for now: it matches events to clients/meetings).

## Spaces (2026-11-08, shipped)
- Each space is a full document: Work = localStorage cadence.v1, Life = cadence.life.v1 (demo: cadence.demo[.life].v1).
  SPACE per device (localStorage cadence.space), html[data-space]. S = current doc, OTHER = other (lazy). switchSpace(to):
  swaps docs, rebuildPlugins, emit('space'). Life seed: areas Home/Health/Money/Projects (clients with icon), Calm theme,
  haunted+havoc off. Areas = clients with `icon` (promptArea). Life UI: no waiting/meetings/chase, 'Still on the list',
  area page Now/Later. ⌘K 'Switch to Life/Work', ⇧L.
- Plugins: def.spaces ['work'] for client-specific plugins (fireflies, ai-extract, plain-lines, recap, pulse, zoho-tags, prep,
  chase, templates, brand, links, mural, stocks, intern, zoho-status, calendar). enabled() = not disabled in this space's doc
  AND spaceOk. Widgets may have spaces too (dashboard 'waiting' is Work-only). api.space().
- Sync: records carry space; Life plugin/doc ids prefixed 'life:'. Server assemble/state/mirror = Work only; importDoc (old
  tabs) never touches Life. Whole-document mode (no SQLite) keeps Life on the device.
- tests/spaces.spec.mjs.

## Plugin ideas from the user (2026-11-08, backlog — build later)
Meta / sharing
- Ritual marketplace: share whole life systems ("Sunday reset", "post-breakup rebuild", "new parent survival") that install
  as bundles of recurring tasks (Life). Export/import a bundle = areas + repeating tasks + optional dashboard page.
Smart nudges
- Location ambush: near the hardware store, "you've needed a lightbulb for 3 weeks, it's RIGHT THERE" (needs the phone app
  + geofences; tasks tagged with a place).
- Procrastination forecaster: learns which tasks you avoid (snoozes, reschedules, age) and shows a "chance this actually
  happens" % like a weather forecast.
- Energy-aware scheduler: pulls sleep data (Oura API; Apple Health via the phone app) and only surfaces hard tasks on rested
  days; bad night → "water plants", "reply to one email". Needs task effort levels.
- Done-list mode: for bad days, flip to show only what you've accomplished (proof you're not a failure).
- Future-you negotiator: snoozing requires a note to future-you; future-you can reject the excuse when it comes due.
- Regret minimizer: monthly "which of these would you regret not doing at 80?" and quietly promotes those.
Games
- Couple/roommate bounty board: chores with point bounties, cash out as favours ("you pick the movie"). Needs shared lists
  between two logins.
- Roulette mode: spin a wheel of your tasks, do whatever it lands on. No appeals.
- Rival AI: an imaginary rival with the same list completing tasks at a believable pace, always slightly ahead.
- Seasonal life quests: goals as an RPG skill tree ("learn to cook" → "host a dinner party" → …).
- Death clock sort: a bucket-list maker sorted by actuarial urgency. Grim, but clarifying.
Stakes and accountability
- Shame escrow: put money on a task; miss it and it goes to a cause you hate (like Beeminder / stickK; needs payments,
  so probably a link-out integration rather than holding money).
- Grandma mode: overdue tasks trigger a disappointed-grandparent guilt-trip ("I'm not mad, I just thought you'd have called
  the dentist by now"). Text first; voice via TTS later.
- Public ledger: your three oldest overdue tasks become your Slack/Discord status (needs their APIs + tokens on the NAS).

## Family / Life plugin ideas from the user (2026-11-08, backlog — all Life space)
Kids
- Kid size tracker: shoe/clothing/diaper sizes with dates, nudges when the next size is probably due; shareable "what to buy" for grandparents.
- Activity logistics: hockey/swim/dance schedules, carpool rotations, gear lists, REGISTRATION DEADLINES (popular programs fill in minutes).
- Milestone & memory jar: one-tap funny quotes, firsts, moments; yearly compiled book/slideshow.
- Health records hub: vaccinations, allergies, doctor/dentist visits, medication doses with weights and dates (for walk-in clinics).
- Chore chart with allowance: age-appropriate recurring chores earning points/money; kids see their balance.
- Birthday party planner: guests, RSVPs, gifts received (thank-you notes), "things to get for parties we're invited to".
Spouse / partner
- Mental load splitter: who owns which recurring household jobs; makes invisible work visible.
- Date night rotator: regular date night, alternating planner, idea list, "book the babysitter" a week ahead.
- Gift idea vault: 2-second capture ("she loves that"), birthdays/anniversaries/Mother's & Father's Day reminders 2 weeks out.
- Weekly check-in: shared 15-min Sunday agenda (schedule, money, anything bugging either of you, one appreciation).
- Little things reminder: occasional nudge for small unprompted kindnesses.
Household
- Meal planner -> grocery list sorted by store aisle; remembers what the family actually ate vs ignored. (merges with shopping-list idea)
- Home maintenance calendar: seasonal recurrences tuned to location (Toronto: November tire swap). (merges with Good Homeowner)
- Document & renewal tracker: passports, licences, health cards, insurance, subscriptions; reminders 60–90 days out (kids' passports = 5 yrs).
- Bills & budget pulse: recurring bills as tasks + monthly "where did the money go" review for two.
- Emergency binder: who to call, where papers are, account info, what to do if one of you is out of commission.
Yourself
- Personal maintenance: your own physical, dentist, eyes, haircut on recurrences.
- Friendship keeper: nudges to see friends.
- Energy budget: daily check-in; low days show only essentials and hide the guilt list. (relates to energy-aware scheduler)
- Solo time scheduler: protected alone time per parent on a rotation.
Family-wide
- Shared family dashboard (kitchen tablet): today's schedule, who drives whom, dinner, what's due. (dashboards + side panel exist; needs shared/household login)
- Vacation planner: per-person packing lists remembered between trips, countdown, booking deadlines, pet-sitter checklist.
- Family traditions keeper: recurring reminders for traditions (pumpkin patch, cookie day, yearly photo).
Cross-cutting needs these imply: household sharing (two adults, maybe kids) in the Life space; per-person assignment; a "profiles/people" record kind.

## Camping Planner (user spec, 2026-11-08, backlog — Life)
One trip is the hub; the route sets the days, days set the menu, menu + weather build the packing list; the journal feeds the
report, which feeds the next trip's lists.
1. Trip setup: dates, destination, campsite/backcountry, who's coming (adults, kids, dog), type (car, canoe, backpacking, RV);
   forecast near the date with flags (lows near freezing, rainy day 2); Ontario Parks opens reservations 5 months ahead
   (Algonquin, Killarney, the Bruce fill fast) -> nudge on opening day; permits / fire bans / park alerts checklist.
2. Packing list: base list by trip type; per-person lists (kids with sizes; picture checklist for little ones); weather-adjusted;
   menu-linked (pancakes -> griddle, spatula, syrup); gear inventory incl. sleeping bag ratings and borrowed-gear tracking;
   weight mode (per-item, per-pack); learns from "didn't use" / "wish I'd brought"; leaving-the-site checklist.
3. Route maker: drive-in route with stops (gas, groceries, last real washroom, ice) and gatehouse closing time; backcountry
   draw/import GPX, split into days (distance, elevation, portages, campsite/lake per night); pace check for the group;
   bail-out/access points; leave-behind plan sent to a trusted person + check-in reminder; offline maps.
4. Menu maker: day grid (B/L/D/snacks) from trip length; recipe library tagged stove/fire/no-cook, prep time, travels well;
   perishables first, cooler-life warnings; grocery list scaled and sorted by store section + "prep at home"; cooler packing
   order; dietary flags + kid-approved filter; bear-safe storage checklist for backcountry.
5. Journal & report: quick daily entries (weather, highlight, wildlife, site rating, photos, voice notes); kid journal mode;
   auto-logging photos/GPS per day; searchable site notes for next time; trip report / photo book; three "lessons learned"
   questions feeding the next lists.
Needs: Life space (done), weather API (key on NAS), maps/GPX (offline tiles = phone app), photo storage on the NAS.
