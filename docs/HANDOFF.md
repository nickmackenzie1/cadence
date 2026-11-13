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
- (SHIPPED 2026-11-09, see below) LIFE: "Good Homeowner" plugin. A guided first-run interview about the house (heating/cooling type, filter sizes,
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
- (SHIPPED in Good Homeowner) Home maintenance calendar: seasonal recurrences tuned to location (Toronto: November tire swap).
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

## Ambient light (2026-11-09, shipped) — the client page rework
- plugins/ambient.js: fixed #amb layer (z-index -1, sized to .main) with 5 blurred lights in the client palette
  (brand.palette/primary/secondary/themeColor/color, greys dropped, topped up with hue-shifted siblings). html.amb-on makes
  #view a frosted "screen" (84% bg + blur, rounded, glow shadow), hero gets the brand gradient + top stripe, stats get brand edges.
  Colours transition (1.6s) when switching clients + a 'surge'; drift animation optional. --accent on #view = brand colour
  darkened/lightened to >= 4.5:1 vs --bg. Settings: Bold/Subtle/Off, drift, brand accent. Themes opt out via '--ambient: off'
  (ninety-five, chicago, terminal, crt, matrix, geocities, contrast, nes). Works for Life areas (single colour -> derived palette).

## Good Homeowner (2026-11-09, shipped) — first Life plugin
- `public/plugins/homeowner.js`, `spaces:['life']`. View `view-house` ("My home"), command "Set up home maintenance",
  Settings button opens the interview, widget "This month at home".
- Interview: place (type/own/climate) → heating & cooling → water → outside (houses/towns only) → safety & appliances →
  review (untick jobs; remembered on re-run). ~50 catalogue items, each `{k, t, g, every, at, if, n}`.
- Reminders are ordinary repeating tasks in the Life "Home" area (created with 🏠 if missing), tagged `home`, owned via
  `task.gh = <catalogue key>`. The repeat spawn copies `gh`, so the chain stays owned. Re-running updates in place
  and removes jobs that no longer apply; never duplicates. Warranties own `gh = warranty:<id>` (30 days before expiry).
- First due: seasonal jobs at the start of their month; if the month is now or just passed, within the week.
- Profile in plugin storage `profile`: answers, systems (filter size flows into the filter reminder's notes), paint,
  pros, warranties, notes. Year strip shows how many jobs land in each month.
- Core: repeat picker gained Every 3 months / Twice a year / Yearly; labels say "Yearly" etc.
- Ideas next: mild/hot climate month shifts, "last done" history per job, attach photos/manuals, share with household.

## Notes from daily use (user, 2026-11-09) — backlog unless marked
- (SHIPPED) Internal work tracking: "for now I just set a client as Catalyst Connect". Now: Projects (see below).
- (SHIPPED) Long task titles ran off the card in the open editor (title was a one-line <input>). Now an auto-growing textarea.
- (SHIPPED, see below) Zoho Desk tickets: not just a tag. A distinct way to surface and track support tickets (ticket number, status,
  priority, SLA/age, link to Desk), maybe their own lane or view; later pull status from the Desk API.
- (SHIPPED as a single "Dev" owner, see below; Zoho Projects URL card still open) Assign a task to a dev (there is a free-text `assignee` today; want a proper people list, maybe "waiting on dev" lane).
  Paste a Zoho Projects task URL into a task and show it (iframe if logged in? Zoho likely blocks framing with
  X-Frame-Options; fall back to a rich link card).
- Meeting recap / action items after a meeting: needs the nice date picker (same one as the task editor), and should
  clean up the list without AI (strip bullets, "- [ ]", "Action:", names → owner, dates → due, dedupe, capitalise),
  with an optional "fix the wording with AI" button later.

## Projects (2026-11-09, shipped) — internal work in Work
- Same record as a client with `kind: 'project'`, plus `icon`, `target` (YYYY-MM-DD), `status` active|paused|done,
  `description`. `isProject(c)` in core. Quick add `@name` works as with clients.
- Sidebar: own "Projects" section under Clients (+ button), finished ones collapse under "Finished".
- Page `projectPage()`: progress bar (done/all tasks), target chip (days left / past), stats, Now / Next /
  Waiting on others / Recently done. No meetings, website, industry.
- `promptProject()` edit dialog; client dialog has "Make it a project", project dialog has "Make it a client".
- Client-only plugins skip projects: stocks, pulse. Client actions show on project pages only with `projects: true`.

## Dev, Desk tickets, follow-ups (2026-11-09, shipped)
- Dev (core, Work only). User: "no specific people, just DEV". Task `owner: 'dev'` (third owner next to me/client),
  `assignedAt` set when handed over. Quick add `>dev`, `>` or `^dev`. Owner chip: Mine / Client's / Dev; key O cycles.
  Sidebar "Dev" page: stats (with dev, overdue, oldest, done this week), grouped by client. Client/project pages:
  "With dev". Dev tasks STAY on my Today (user: "it's still on me"; `onMe(x)` = me|dev for Today/counts). Chip shows age after 2 days, red after 7. (An earlier same-day build had
  named teammates with owner 'team'; loadDoc migrates those to 'dev'.)
- Core hook `api.chips.add((task, preview) => html)` adds chips to task rows and the quick-add preview.
- Desk tickets plugin (`desk.js`, Work): `task.ticket = {no,url,status,pri,opened,closed}`, tag `desk`. Quick add
  `tkt 4821` / `ticket 4821` / `desk 4821` / pasted desk.zoho.* ticket URL. Board view `view-tickets` (Open,
  Escalated, On hold, Waiting on customer; drag or select to move; client filter; past-SLA first). SLA days per
  priority in settings (clock pauses on hold / waiting on customer). Link pattern with {n}. Task ⋯ → Desk ticket… /
  Open in Desk. Completing the task closes the ticket. Widget "Open tickets", client page button "🎫 Tickets".
  Next: Desk API sync (OAuth token on the NAS), auto-create from Desk assignment.
- Follow-ups / in-progress (core): `task.stage` 'doing' | 'waiting', `task.log = [{at,text}]`. Editor "Progress" chip:
  In progress, "Did my part, follow up…" (logs the step, sets the follow-up date, stage waiting), Log a step.
  Key F on a selected task. Rows show the stage chip and the last step under the title. Repeats start clean.
- Backlog (user, 2026-11-09): client news plugin. Related news articles per client on the client page (and a widget).
  Non-AI first: Google News RSS search by client name/domain through the existing feed proxy (`/api/feed`, ttl), with
  de-dupe and an exclude-words filter for common names; optional AI pass later to keep only genuinely relevant items
  and summarise "why it matters for this client".
- Backlog (user, 2026-11-09, "backburner"): Discord theme, inspired by radekkozak/discordian (Obsidian theme, MIT):
  Discord's dark greys (#313338 / #2b2d31 / #1e1f22), blurple accent #5865f2, gg sans-like font stack, channel-list sidebar.
- Backlog (user, 2026-11-09): client page gradients like Granim.js (sarcadass.github.io/granim.js): smooth animated
  gradient transitions between brand-colour "states". Do it ourselves, no dependency: animate the ambient layer's
  CSS custom properties (@property-registered colours) or a tiny canvas, respecting reduced motion.
- Bug report (user, 2026-11-09 14:16): "tasks are clickable but anything I change doesn't show up". Could not
  reproduce (all routes, two themes, edits + reload all fine). Added ErrLog: uncaught/plugin/widget errors now toast
  with "Copy details", and ⌘K → "Copy error log". RESOLVED: the user's hard refresh fixed it (an old tab still
  running the previous build against new data). Idea: detect a new deploy and offer a reload.
- Backlog (user, 2026-11-09 15:17): NES.css theme should lean into NES.css harder: use its actual components
  (nes-container with title for groups/cards, nes-btn variants, nes-checkbox for task checks, nes-progress for the
  project bar, nes-balloon for toasts/Island, pixel icons), 8-bit palette, pixel borders on chips/popovers/modals.

## Sidebar that fits + record-store feed (2026-11-09, shipped)
- User: "I really hate the scrolling" in the sidebar. Now: Views are a row of icon tiles (label on hover); plugin
  sidebar widgets live in a dock (row of plugin icons above the footer) and open in a flyout beside the sidebar;
  📌 Pin keeps one inline (`S.settings.pinnedWidgets`, keys `pid:id`; ⤓ on hover sends it back). `fitSide()` folds
  the quietest clients/projects (fewest open tasks, never the current one, projects last) into "+N more" (searchable
  picker) until #side-main no longer overflows. Re-fits on resize and after widgets render.
- Feeds (records style): Something Else Records feed has no price; server `/api/feed?prices=1` reads each product
  page on the feed's own host (price after the <h1>, or meta/JSON-LD), 4 at a time, cached 12h, 6s budget then the
  rest fill on a later refresh (client re-asks after 45s). Per-feed "show": Vinyl only (default for records) / Used
  vinyl / New vinyl / Everything. `recMeta()` parses format (CD/tape/video/vinyl), new vs used, Goldmine grades
  "(media/sleeve)" + notes, pressing text, colour words tint the record. Stickers: price tag, grade seal coloured by
  grade, NEW, handwritten notes slip, pressing with colour dot.
- Neo-Brutal UI pass (user screenshots, 2026-11-09): chips get real padding (were text-to-border), coloured due
  chips, roomier task rows, wider gaps between hard-shadow cards, client hero puts actions in a row above the title
  so the big Lexend name gets the full width; all themes: hero sub-line is a wrapping flex row, avatar + name never split.
- Backlog (user, 2026-11-09 15:31): "Liquid Glass" UI theme (Apple-style): translucent panels with backdrop blur +
  saturation, specular edge highlights, refraction-ish lensing on hover (SVG feDisplacementMap filter where
  supported), floating pill sidebar and toolbar, content showing through. Pairs naturally with the ambient light layer.
- Backlog (user, 2026-11-09 15:37, strong preference): "I hate the emojis, it makes it look so cheap". Replace EVERY
  emoji in the UI with an open-source icon set (Lucide, ISC licence, vendored SVGs in public/vendor, no CDN): area and
  project icons (picker becomes icon + colour), views/nav, plugin UI (🎫 🏡 🔥 📌 ⚙ ✨ etc.), stickers, toasts, Island,
  Good Homeowner options, empty states. Store icon names (e.g. 'wrench') instead of emoji; migrate existing records.
  Don't add new emojis in the meantime.
- Meeting review (2026-11-09, shipped): `tidyText`/`tidyMeeting` run once on entering review (+ "Tidy up" button):
  strip bullets/checkboxes/"Action item:"/timestamps, "Sarah will…" → assignee Sarah (client) or me if it matches
  settings.myName, "I'll…" mine, "They will…" client, dates pulled via parseQuick into dueDate, dedupe, capitalise.
  Due uses CadenceDatePick (fallback native picker). "Fix wording with AI" when the NAS has a key (AI.json).
- Feed wall: long grade notes wrap; pins re-fit via ResizeObserver + fonts.ready (were overlapping).
- Backlog (user, 2026-11-09 15:41): feed records whose title includes a date are upcoming releases (pre-orders). Show
  them as their own card style with a small "Releases: Nov 28" badge on the top-left of the cover, nothing big; maybe
  sort/group them as "Coming soon".
- Links on tasks (2026-11-09, shipped): plugin `zoho-link.js` ("Links on tasks", Work + Life). Any URL in quick add
  (or task ⋯ → "Link a Zoho task, email or page…") becomes `task.ref = {url, app, appName, kind, portal, id, host}`:
  Zoho Projects task/issue/milestone, CRM module record, Books/Creator, Gmail email (u/N + message id), Outlook email,
  or a plain web link (favicon). Row chip opens it directly; editor shows a card via new core hook
  `api.taskCards.add(task => html)`. No iframes: Zoho and Google block framing. Desk URLs stay with desk.js.
  Next: Gmail subject/sender preview would need Google OAuth (token on the NAS).
- state.json retired (2026-11-09): SQLite mode no longer mirrors state.json on every write. At startup a state.json
  newer than the DB is imported (rollback path), then moved to backups/state-retired-<time>.json. A readable
  backups/state-YYYY-MM-DD.json snapshot is written once a day (dailyJsonBackup) next to the daily .db snapshot.
  STORAGE=json still works as an emergency fallback (copy the latest snapshot to data/state.json first).
- Links on tasks: open editor shows a "Paste a Zoho Projects task, email or any link" box when the task has none.
- Backlog (user, 2026-11-09 15:52): sidebar refinement. (1) Clients list shows only the last 3–4 accessed (recents),
  rest via "+N more" / ⌘K. (2) Main nav (Today, Upcoming, Waiting on clients, Dev, Inbox, Logbook) as compact tiles
  like Views, with a tiny label underneath (and the count as a badge).
- Gradient flow (2026-11-09, shipped): ambient.js option "Header gradient flows through the brand colours" (default on).
  @property-registered --gf1..3/--gfa animated by @keyframes granim through palette rotations (22s), on the client
  hero and its top bar. Reduced motion: static.
- Backlog (user, 2026-11-09 15:55): AI client research. From the client's website (and public sources) let AI pull
  more about the client: what they do, size, products, recent news, notable people, brand imagery and colours,
  "interesting things to mention in the next meeting". Store on the client record; show on the client page.
- Themes (2026-11-09, shipped): new file `plugins/themes-more.js` with Discord (server rail + channel list, # names,
  blurple, message-box quick add) and Liquid Glass (light/dark, drifting colour mesh under frosted panels, floating
  glass sidebar, specular edges, capsule buttons; falls back to opaque where backdrop-filter is missing). NES rewritten
  with NES.css component looks: titled pixel containers for groups, balloon toasts/Island, pixel checkbox + check,
  progress bar, coloured buttons/badges, pixel cursor, blinking ▶.
- Support tickets (desk.js 1.1, 2026-11-09): user clarified tickets are mostly ones he OPENS with Zoho (partner support,
  on a client's behalf). `ticket.via` = 'zoho' | 'desk' | 'other' (+ vendor). Quick add: `zs 12345` / "zoho ticket" /
  "partner ticket" = Zoho; `desk 4821` = our Desk; `tkt`/`ticket` = settings default (Zoho). Tags zoho-support / desk /
  support. Zoho/other tickets start as stage 'waiting' with log "Opened Zoho support ticket #N" and a check-back date
  (settings: followDays, default 2). Board filter All / Zoho support / Our Desk / Other; cards show a via badge.
  Pair with Links on tasks (paste the support email's Gmail link).
- Christmas mode (2026-11-09, shipped): plugins/christmas.js (Work + Life). String lights (classic / warm / candy;
  twinkle / chase / steady; sway at Blizzard+), canvas snow with wind, gusts, mouse plough, flakes settling on SURFACES
  (cards, buttons, headings, tasks, quick add…) as per-element heightmaps with angle of repose, sliding off the ends;
  the focused input collects 2× and keystrokes shake it off; task completion bursts at Blizzard+. Chaos levels Calm /
  Festive / Blizzard / Total chaos. Shovel (settings + ⌘K). Offered once each December via the Island. Reduced motion:
  no snow, still lights. Ids: #xm-string (lights), #xm-snow (canvas).
- Nostalgia themes (2026-11-09, shipped, themes-more.js): Discord now builds a real server rail via enhance (Home,
  client/project "servers" with overdue badges and the white pill, add client/project, explore plugins, Work/Life
  switch), channel list with #channels, server-name header, user panel. MSN Messenger 7.5 homage: window chrome, your
  display picture + status menu + personal message (shows ♫ now playing from the feed; "brb" sets Be Right Back),
  contacts with status dots via :has(), Ctrl+G or triple-click your picture = Nudge (shake + buzz), "<client> has just
  signed in." pop-ups, chime on task complete (not when Busy). Tones synthesized with WebAudio; state in localStorage
  cadence.msn. LimeWire homage: search bar, striped results table, status bar (Turbo-Charged Connection, sharing N
  tasks) and a fake .mp3 download when you complete a task. Core now dispatches DOM event `cadence:task-complete`.
- Snow 2.0 (2026-11-09, shipped): depth layers (far specks, settling mid flakes, near bokeh), soft + six-armed crystal
  sprites, fine-tune sliders (amount/size/speed/wind/gusts/drift depth) live-previewed, melt, reactions: click
  shockwave + knock the clicked element's pile off as clumps that burst into powder, neighbours jolted, wheel shakes
  piles, fast mouse carves. Drifts follow the element's top corner radius (base curve + per-bucket cap by slope).
  Light reflections: G.bulbs + brightness model mirroring the CSS timing; flakes near bulbs glow in their colour,
  drift tops glint, #xm-glow spills colour on the UI (screen blend on dark themes). ⌘K "Let it snow / stop the snow",
  "Lights on / off" work independently any day (G.flip).
- Sidebar: sections emptied by folding show "N in more"; the sidebar re-fits on theme change and when fonts load.
  LimeWire/MSN: #view full width (flex column bug), Search/Send buttons positioned inside the box.
- Backlog (user, 2026-11-09 16:23): meeting screen becomes the client's screen when a client is chosen: their logo,
  brand colours (ambient), description, open items, last meeting notes.
- MSN Messenger XP pass (2026-11-09, shipped): CSS Bliss-style desktop (sky, clouds, green hills), Luna window frames
  for the contact list and main window with glossy title bars and XP caption buttons, working menu bar (File, Contacts,
  Actions, Tools, Help → settings/themes/add client/project/meeting/nudge/waiting/plugins/shortcuts/palette), collapsible
  "I want to…" panel (Add a Contact, Send an Instant Message → quick add, Start a Meeting, Send a Nudge; state in
  localStorage cadence.msn.iw).
- Backlog (user, 2026-11-09 16:40): typing effects, chosen in settings: fire licking up from what you type, ice/frost
  crystals, typewriter (clack sound + carriage-return ding on Enter, slight letter jitter), "MS Word 97" (Clippy-ish
  original helper: "It looks like you're writing a task…" — original character, not Clippy), confetti on Enter,
  power-mode style screen shake + sparks. Per-effect intensity; off for reduced motion.
- Snow fixes (2026-11-09): drifts persist per page + element key (STORE, localStorage cadence.snow, sidebar shared
  '*'), "Shovel this page" / "Shovel everything" (settings + ⌘K); stopping snow clears all drifts. Light themes: no
  dark rims (ICE sprite, CRYS_L sprites with baked blue edge; the per-crystal canvas `filter` was ~700ms/frame
  without GPU, removed). Lights: thin translucent wire, silver caps, the string hooks into the Island pill's sides and
  the pill wears a ring of mini bulbs (#xm-ring, ResizeObserver on the pill). Layers now under dialogs/menus/toasts
  (glow 26, snow 27, string 29; ring 81 above the Island). Flakes start spread over the screen. G.reset(opts) for tests.
- Christmas engine lifecycle (2026-11-09): switching Work/Life rebuilds plugins, which used to start a second snow
  engine each time (slowdown). Now setup() calls G.teardown() first (raf, canvas, save interval, ring observer) and
  window listeners are bound once and dispatch to G.h (the current engine). Settings are global (localStorage
  cadence.xmas, falls back to the old per-space storage) so switching spaces never "stops" the snow.
- Snow lands everywhere (2026-11-09): SURFACES now include checkboxes, chips, editor chips, inputs, nav text/icons/
  counts, view tiles, stat numbers, list headings and the words of titles/headings (TEXTY: first-line text box via
  Range, snow sits on the letters). A GROUND pile along the bottom of the window catches what gets through. Far layer
  thinned (z<.22), each landing flake deposits ~2× (scaled by flake size). Up to 280 surfaces, ~57 fps.
- Snow on letters (2026-11-09): TEXTY surfaces get a glyph profile (glyphs(): render the first line off-screen in the
  element's computed font, scan per 4px bucket for the topmost ink; gaps = p.hole, flakes fall through). All piles
  are lumpy (p.n per-bucket holding factor), deposits shift downwind, repose allows 3.6px steps, edges of letters/
  words shed snow, drifts drawn as smooth quadratic curves per solid run.
- Sidebar v3 (2026-11-09, shipped): main nav is a tile grid (.ntiles/.ntile: icon, label under, count badge; 3×2 in
  Work, 4 in Life). Work shows "Recent": last 4 opened clients/projects (localStorage cadence.recent.<space>, touched
  on the client route) + up to 3 with overdue work, topped up by busiest; "All clients & projects (N)" opens a
  searchable picker (projects/paused labelled, counts, red when overdue). Life keeps its Areas list. Discord theme
  renders tiles as #channels.
- No emoji (2026-11-09, shipped): core `Deemoji` MutationObserver swaps every emoji (and ✦◉▦◇◖◐☰) in rendered text
  for a Lucide icon (EMOJI_ICONS map, ~125 entries) — core, plugins, Island, toasts, stored area icons; skips
  inputs/textarea/contenteditable/.keep-emoji. `icon(name)` / `api.ui.icon(name)` for direct use. Icons bundled in
  public/vendor/lucide/icons.js (subset, ISC, LICENSE alongside); add more with
  `node scripts/build-icons.mjs <lucide-static dir> name…`. New code should use icon names, not emoji.
- Client intel (2026-11-09, shipped): plugins/client-intel.js (Work). Client page gets two cards below the task
  columns. News: Google News RSS via /api/feed (ttl 60), kept only if the headline mentions the client name or domain
  root (unless a custom search is set), deduped, per-client exclude words / custom query / off (plugin storage cfg),
  last items cached for the "Client news" dashboard widget. Research: server /api/sitetext?d= (homepage + about page as
  text, cached 7 days in data/companies/<d>.text.json) + headlines + open tasks → api.ai.json → client.research
  {what, glance{size,hq,founded,model}, products, recent, people, talking, watch, sources}; told not to invent.
  Also a client action "Research with AI". Dashboard widgets may now use Lucide icon names.

## Backlog: team / multiplayer (user, 2026-11-09 18:41)
Needs real multi-user first. User (18:42): "users should not be NAS dependent" -> accounts/identity must not live only
on the NAS (each person's Cadence works on its own; team features are an add-on). Open question to settle with the user:
how teammates connect without Tailscale or exposing the NAS (e.g. a separate hosted team relay that only carries team
data, or peer-to-peer on the same LAN). Personal data and secrets stay on each person's own NAS.
- Team leaderboard (tasks done, chases closed, streaks; friendly, opt-in).
- Team collaboration: shared clients/tasks, who's on what.
- Claiming tasks ("I've got this one") from a shared pool.
- Fun lobby games / messing with each other when you're on the same page (presence: see who else is on a client page,
  throw snowballs, poke their cursor, ghost visits).
- Chat, but in a fun way (reactions, stickers, Island pings).
- Virtual chat room with avatars: walk your avatar into a client's "room" (Gather-style map) and that room is the
  client's chat channel.

## Shipped 2026-11-09 evening
- christmas.js: random/clumpy buildup that rolls downhill and creeps into a continuous cover, per-flake fall speed and
  flutter, softer blended drifts; covered pages (meeting, dialogs) hide the page's snow; pill bulb ring follows the pill
  frame by frame (ResizeObserver + MutationObserver kick a 950ms rAF follow).
- core.js meetingBand: meeting screen in the client's brand (banner, facts, talking points).
- rss.js: releaseOf(title) -> "Releases <date>" badge (.rs-rel) on covers/pins/rows; date-only parentheticals dropped from pressing notes.
- typing-fx.js: modes off/fire/ice/typewriter/confetti/power/helper (localStorage cadence.typing), caret via mirror div,
  one canvas only while particles live; Nib = original sticky-note helper with quick-add tips (#qa only).
- sheep.js: original pixel sheep desktop pet (localStorage cadence.sheep {count}), walks on PLAT tops, physics, drag/throw.
- orbit.js: view-orbit (client solar system + 24h day clock), dashboard widget 'dayclock', radial menu on right-click of
  blank space (Shift = native menu; setting in cadence.orbit). Lucide 'orbit' + 'clock-4' added (🪐 / 🕓 map to them).
- Backlog (user, 19:03): the "public ledger" posts to Zoho Cliq (status / message), not Slack. Cliq OAuth token on the NAS.
- Backlog (user, 19:04, Life): recipe manager with a URL parser that grabs recipes from blogs (schema.org Recipe
  JSON-LD via the NAS fetch, fallback to page heuristics, skip the life story). Ties into the meal plan + shopping list.
- Shipped (evening batch): kanban.js, calview.js, notify.js (+ server Web Push, sw.js), weather.js (+ /api/weather),
  rss skins podcast/news/films, fun-desk.js (aquarium, invoice radar, desk plant, weekly rewind), fun-games.js
  (roulette, rival, quests, bucket), mindset.js (forecaster, done-list, future-you, regret), accountability.js
  (grandma, stakes, Cliq ledger + /api/cliq/*). Core: api.notify, api.footer, api.plugins.list, api.ui.taskRow/openTask/
  selected/refreshSide, views {wide:true}.
- Shipped (Life batch): kitchen.js (+ /api/recipe JSON-LD parser), inbox-scan.js, life-kit.js (shared form/area/
  ownTask helpers, window.LifeKit), kids.js, home-life.js (partner, household, yourself), family-hub.js (kiosk #kiosk,
  vacation, traditions), camping.js, homeowner climate shift + history + attachments.
- Not done / needs more: Location nudges need the phone app (tasks have `place` now). Inbox scanner reads pasted/.eml
  mail only (IMAP later, creds on NAS). Shame escrow is honour system + links. Kitchen tablet has no household login
  yet (open #kiosk on a signed-in tablet). Full suite is ~4 min serial: run with `timeout 590`.
- Backlog (user, 2026-11-12 22:11): themes: Zelda/Link, Xbox 360 blades, Claude, Reddit, Mario, Pocket Casts.
  Harper (Automattic/harper, local grammar checker, Rust/WASM) for writing in Cadence. A full podcast player/manager
  inspired by Pocket Casts (open source iOS/Android): subscriptions, up next queue, speed/trim silence, chapters,
  played state, discover; keep it original and Cadence-styled.
- Queued: RSS "new entries per day" chart view; fire typing melts snow into water that streams down (SPH-style, see
  asadm/SPHjs); mobile pass; server.js restructure into routes/services with comments; meeting code out of core.js;
  single plugin bundle.

## Shipped 2026-11-12 late: server restructure
- server.js is now a thin entry point. Layout: server/config.js, server/app.js (pipeline: CA download → cross-site check →
  auth routes → sign-in gate → API routes → static files), server/routes/*.js (controllers: auth, system, sync, lookup,
  feeds, push, integrations, files, calendar), server/services/*.js, server/lib/*.js (http, auth, storage, net, tls, build).
- Route contract: `async (req, res, { url, p, leaf })` answers, or returns `NEXT` (lib/http) to pass the request on.
- Storage state is read through hasDb() / storageInfo() / allDocs() / resolveConflicts(); routes never touch `db` directly.
- Dockerfile copies server/; deploy.sh rebuilds on server/* changes.
- Sidebar count badges: the neutral badge was invisible (--hover on --side); now a solid grey pill, readable in both themes.
- Known flake: spaces.spec "Life syncs to another device…" fails ~1 in 3 in isolation on the OLD server too (CI retries).

## Backlog: Today redesign (user, 2026-11-12 22:33): "THIS LOOKS SO TYPICAL AI DESIGN — COULD USE A REDESIGN"
- The Today header: big greeting, an energy pill row, four equal rounded stat cards (ring / overdue / chase / upcoming),
  then the quick-add. Generic dashboard tropes: same-size white cards, soft shadows, truncated labels ("overdue — clear th…",
  "9 coming up this …").
- Direction to propose: drop the card grid for one editorial line or a timeline of the day; make overdue an inline action,
  not a stat; let the quick-add lead; fold energy into the greeting; a real type scale and a distinctive accent.

## Backlog: effects engines (user, 2026-11-12 22:52–22:54)
- User built two falling-sand prototypes (uploads: elements.html sandbox, page.html "Ember & Frost" where the page's
  words/cards/images become cells and break loose as rigid pieces). Materials: sand, water, ice, snow, fire, wood,
  steam, stone, oil, lava, ember, ash, smoke, glass; bloom by downsampled emissive layer.
- Ideas agreed ("LOVE IT"): done tasks crumble to sand into a jar/pile (replaces the ring); "Let go" can burn a task
  (the user's choice, never automatic). DROPPED: overdue tasks smouldering/catching fire (anxiety trigger, see below); one shared effects engine replacing christmas.js snow/melt + typing-fx fire,
  driven by real weather; focus hourglass; kids sandbox / chore jar on the family kiosk.
- "Could we also do it in Havok… keep what we have but on the menu let it switch": an Effects engine setting —
  Off / Classic (today's code) / Elements (falling sand) / Havok (rigid bodies).
  - Havok for the web: @babylonjs/havok, MIT-licensed WASM (~2 MB). Rigid bodies only: no fluids or particles.
    Vendor the .wasm into public/vendor (no CDN, NAS-only), load it only when Havok is picked.
  - Havok mode: task cards as real blocks that tumble/rotate/stack, done tasks dropped into a bin, snowballs.
  - Best of both: Elements for materials, Havok for the pieces that break loose (rotation, bouncing), instead of
    the prototype's per-cell straight drop.
  - All engines behind one adapter fed by the same events (cadence:heat, task done, overdue, weather); viewport-only
    grid, pause on hidden tab, off for prefers-reduced-motion, Lucide icons not emoji in the controls.

## Design principle (user, 2026-11-12 22:56): calm, never alarming — "I have anxiety so those are triggers for me"
- Plain, not chatty (user, 23:15: "don't like the language"): a greeting is fine ("Good evening, Nick"), everything
  else is plain labels and counts ("Earlier · 3", "Today · 1", "9 this week", Tomorrow / Next week / Clear). No narrating
  sentences, no "whenever you're ready", no cute copy.
- No guilt or alarm language: not "slipped", "overdue — clear them", "late", "behind". Say "carried over", "still open",
  "whenever you're ready", "let go".
- No red for unfinished work. Red is for real errors only. Carried-over items use the neutral muted colour.
- Nothing punishes you for unfinished work on its own (no burning, smouldering or shaming effects triggered by overdue
  tasks). Accountability plugins (grandma, stakes) stay opt-in and off by default; review their wording against this.
- Today redesign: the user picked direction A ("The day, written out"), revised with this language. Canvas:
  https://claude.ai/artifact/7jVwyko8gijFawevd931zU — build it into renderView 'today' next.

## Backlog (user, 2026-11-12 22:59–23:01)
- Colour-blind plugin: modes for the main types (protanopia, deuteranopia, tritanopia, achromatopsia). Remap the palette
  (status, client colours, charts, the red/green done ring) and add shape/pattern cues so nothing relies on hue alone.
- Whole-app design pass: "not redefining — sharpening and making things cohesive". One type scale, spacing scale, radius
  set and colour roles across core + every plugin; same patterns for headers, empty states, lists, dialogs, badges;
  apply the calm-language principle everywhere.
- 3D environment: look at your tasks in a first-person work environment (walk your backlog as a space).
- Fantasy work world: an RPG mini-game where you hold meetings and chat with co-workers; chat rooms with employees
  (ties into the team/multiplayer backlog: avatars walking to client "rooms").

## Shipped 2026-11-12 late: Havoc gets an Elements mode
- Havoc's toolbar has a Physics / Elements switch. Elements = vendor/elements-engine.js, a port of the user's falling-sand
  "Ember & Frost" page: reads the visible screen (panels by background/border, words by Range rects in their real font,
  img/canvas, SVG icons with computed paint, input values) into 2px cells without touching the DOM; damaged pieces break
  loose and fall as one; fire/snow/water/lava/ice/sand/oil/wood/steam/stone/eraser, Ignite (I), Snowfall (S), Space
  pause, [ ] brush, Esc or Shift+H exits. The last-used mode is remembered in synced pref cadence.havoc.

## Backlog (user, 2026-11-12 23:05): "I have a bunch of music on my NAS — music server?"
- Option: run a self-hosted music server on the NAS (e.g. Navidrome: Docker, Subsonic API, LAN-only so it fits the
  no-Tailscale / no-internet-exposure rules), then a Cadence plugin that talks to it: focus playlists for focus mode,
  "now playing" in the Island, play/pause from the command palette, a music player sharing the podcast player's UI.
- Or Cadence serves the music folder itself (read-only mount, tags read on the server, zero dependencies).
- Decide which before building; ties into the Pocket Casts-style podcast player backlog item.

## Backlog (user, 2026-11-12 23:10): "the typing effects should be the fire and elements as well!"
- Typing effects (typing-fx.js) should run on the Elements engine: typing with Fire mode drops real fire cells at the
  caret that rise, char the text above and melt snow into water; other modes (snow, water, sand…) emit their material.
  This is the "one shared effects engine" item: split elements-engine.js into a reusable core (grid, step, render)
  plus the Havoc screen-reader/HUD, run it on a small region around the caret (not the whole screen) so typing stays
  fast, and fold christmas.js snow/water into the same core.

## Backlog (user, 23:15): weather in the Today greeting — maybe, undecided. Taken out of the mockup for now.

## Shipped 2026-11-12 late: Today direction A, and the user's engine v2 in Havoc Elements
- Today: greeting + date, add line, schedule strip (api.today.schedule for plugins; calendar meetings use it), Earlier
  rows with Tomorrow / Next week / Clear (+ undo), Done today folded at the bottom, energy as a small switch.
- Elements engine v2 (from the user's page (3).html): sharp mode (untouched cells show a full-resolution copy of the
  screen, touched cells become pixels; P toggles), Christmas lights (WIRE/BULB, Twinkle/Chase/Steady, pixel halos,
  warm bulbs melt snow, icicles grow from the string while it snows, snow on the wire stays shallow; L cycles).

## Next (user, 23:24): "apply it across the board — snow, lights, typing where it needs it"
- One engine core (vendor/elements-core.js: grid, materials, step, render, sharp mask, lights) used by Havoc Elements,
  christmas.js (snow + lights + icicles replace the current canvas snow and DOM lights) and typing-fx.js (fire at the
  caret is real fire that chars text and melts snow). Ambient uses run on a region (the top strip / around the caret),
  not the whole screen, and pause when hidden.
- Ideas to pick from (see chat 23:3x): Halloween (carved pumpkins with candle fire glowing through the faces, fog, bats,
  dripping slime), autumn leaves, spring rain + puddles, summer fireflies, lava lamp focus timer, sand hourglass, done
  tasks to sand jar, campfire for the camping planner, fireworks for a finished project, aquarium water, snow globe.
- Havoc Physics + engine: blasts ignite and scatter matter, black hole swallows sand/water, rain becomes real water,
  "melt" becomes real lava.
- Refocus (user, 23:29): tab shown or window focused → refocus(): pulls data + prefs, plugins get 'refocus' (calendar
  reloads), and checkBuild(true) reloads at once on a new version unless something is half-typed or a meeting is open
  (then the banner). Throttled to once per 4s.

## Shipped 2026-11-13 00:xx: Elements engine v3 (user's page (4).html)
- elements-engine.js now carries the user's v3 simulation verbatim where possible (sim, lights, render, paint), wrapped
  in Cadence's screen reader, toolbar and lifecycle: temperature grid (heat spreads/rises, heat view V), wind with gusts
  (slider), lightning (fulgurites in sand), fireworks, gunpowder explosions with flash + shake, holly, acid + fumes,
  storm (T), snow that settles everywhere or only on the lights, light that casts shadows (ambient stays 1 on a light
  page so opening Elements doesn't dim the screen). To take a future version: re-run the splice in the commit message.

## Shipped 2026-11-13 ~01:00: one matter layer for everything (user: "typing and christmas mode lets do it")
- vendor/elements-engine.js is a factory: ElementsWorld.create({ kind: 'havoc' | 'ambient', cell, floor, z, hidden, ledges }).
  Havoc Elements = kind 'havoc' (reads the screen, toolbar). Ambient = see-through layer, no mouse, cards/buttons/headings
  become invisible ledges (SURF) refreshed every 400ms; 3px cells, 30 fps while things fall/burn, slow tick when settled;
  soft glow on light pages; lights kept in a slim top strip; hidden while a dialog/meeting/Havoc Elements is open.
- core.js CadenceFX: world() (shared ambient layer, null with reduced motion), want(key, {snow, everywhere, rain, storm,
  lights, palette, wind}) merges what each plugin wants; re-applied after the layer rebuilds on resize ('elements:ready').
- Christmas: new Look setting, Elements (default) or Classic. Elements = engine snow (settles on cards when "builds up"
  is on, else only on the lights), engine lights with the chosen pattern/palette, icicles. The Island ring stays.
- Typing: fire/ice put real fire+embers / snow into the layer (setting "Real fire and snow", default on).
- Havoc Physics: havoc-engine.js dispatches 'havoc:fx' (blast, melt, hole, rain, stop); havoc.js plays them in the layer.
- New plugin sand-jar.js: finished tasks stream sand into a glass jar (bottom right/left), fills over the day, empties at
  midnight, refills after reload; settings: on, corner, empty.
- Weather: "Show the weather on the page" (default on): real snow settles, rain 1–5 by intensity, wind from wind_speed_10m.
  Thunderstorms = heavy rain, no lightning (calm principle).

## Shipped 2026-11-13 ~01:30: engine v5 (user's page (5).html)
- vendor/elements-core.js = the user's ENGINE, nearly verbatim, run as a Web Worker (on the page if a worker can't
  start). Cadence additions marked "Cadence": SURF ledges, opts lights/palette/compact/rain/floor, inputs spawn/heat/
  explode/surf/jar/clear/clearAt, 'count' message, frame.quiet. To take a new version: replace the ENGINE body and
  re-apply those (small) additions.
- vendor/elements-engine.js = the page side: the user's compositor (WebGL2; 2D on software GL — chosen on a spare
  canvas), air snowflakes that land as grid snow, sound (off by default), plus Cadence's screen reader (now in the
  engine's layout format: layer/boxOf/boxCol, so the real page shows through untouched cells: perfectly sharp), Havoc
  toolbar, and the ambient API (spawn, heatAt, set, strike, explode, firework, jar, clear, clearAt, count→Promise,
  counts→Promise). Ambient idles at 4 fps when the engine reports quiet.
- Tests read material counts through counts() (the grid lives in the worker).

## Shipped 2026-11-13 ~02:00: Music Radar as a Life plugin (user upload music-radar.zip)
- Scanner: the user's app, nearly verbatim, in server/services/radar/ (ESM: lib/*.mjs, radar.mjs, digest.mjs,
  backfill.mjs, test/simulate.mjs). Data in DATA_DIR/radar. Links in RSS/digests use the request's base URL.
- server/services/radar.js (CJS wrapper): settings in data/radar/cadence.json ({on, lastScan, lastDigest, lastError}),
  OFF by default; when on, a 10-min tick runs a scan every 6h and a digest every 7d. One job at a time.
- server/routes/radar.js, all under /api/radar: status, settings, run {scan|digest|backfill|stop}, data, feedback
  (POST, or GET from RSS links), subs {add|remove}, feed.xml, digests/<file>, spotify/login|callback, spotify.
- public/plugins/music-radar.js: Life view #view-radar. Plain SVG charts (no CDN): who's climbing, risers, genre and
  buzzword change bars, albums, sub lead-time, "sounds like" force map, picks with Lucide thumbs, subreddits +
  suggestions + taste, over-the-years charts and year tables, track record, digests, a Setup section listing which
  optional keys are on the NAS (ANTHROPIC_API_KEY, LASTFM_API_KEY, REDDIT_CLIENT_ID/_SECRET, NTFY_TOPIC,
  SPOTIFY_CLIENT_ID/_SECRET). Keys stay in the NAS .env. Only works in NAS mode.
- Test: tests/radar.spec.mjs (simulated data via simulate.mjs into a temp DATA_DIR).
- Lucide icons added: loader, thumbs-down, circle-check, circle, history.
- Not done yet: ntfy alerts are wired in the user's code but untested here; no Navidrome link-up (backlog: music server).

## Shipped 2026-11-13 ~06:30: design pass, sharpening not redefining (user: "sure", after "whats next")
- Corners: one base `--r` (10px) and multiples `--r-s/-m/-l/-xl` (6/8/12/16). Every radius in core + plugins uses them
  (themes*.js and havoc keep their own). The Themes corner slider now just sets `--r`; the old !important class list
  is gone.
- Type: no half-pixel sizes (9.5→10, 10.5→11, 11.5→12, 12.5/13.5→13, 14.5→15, 17→18, 19/21→20, 26→28); weights are
  400/500/600/700 only. Script: the one-off normaliser lived in /tmp, regex over core.css, core.js, plugins (not themes).
- Calm: "Overdue" is now "From earlier" everywhere (client/project/dev stats, dashboard, Pulse, Board column, Island,
  prep, review "Carried over"); no red for unfinished work (closing block in core.css); top priority is warm orange,
  not red. Haunted backlog is OFF by default (new data and demo) — existing setups keep their choice.
- Empty states: `api.ui.empty(title, sub, icon, sm)` and LifeKit.empty both render the core `.empty` look.
- View subtitles: one short phrase, no instructions, no trailing period.
- Left alone, worth asking the user: Bucket list still sorts by "good years left" with life-in-weeks (its design);
  Desk plant still droops with old tasks (text softened); Haunted still exists, opt-in.

## Shipped 2026-11-13 ~10:30: Music Radar data lives in cadence.db (user: "i really think it should be going into the db")
- Symptom the user saw: archive ("Over the years") filled in, but scans gave 0 picks / 0 artists with no error. Cause:
  the scanner swallowed per-subreddit Reddit failures (console.log only), so a refused scan looked successful.
- Now: everything the scanner prints during a job is captured into the status log and stored in radar_jobs; a scan
  where most Reddit requests fail sets lastError (with the HTTP code / network cause, and the REDDIT_CLIENT_ID/_SECRET
  hint when Reddit answers 403/429). The Radar view shows it as a "The last run had a problem" note with a link to
  the job log in Database.
- server/services/radar/lib/store.mjs: SQLite (node:sqlite) on cadence.db, tables radar_kv, radar_artists, radar_picks,
  radar_edges, radar_digests, radar_history, radar_snapshots, radar_genres, radar_terms, radar_jobs. Old files are
  imported once on first start and renamed *.imported. Falls back to the files if node:sqlite is missing.
  RADAR_DB overrides the DB path; simulate.mjs uses its own simulate.db unless RADAR_DB is set (never the real db).
- Digests: HTML is in radar_digests; /api/radar/digests/<file> serves the file if present, else from the table.
- Database view: "Music Radar tables" group (newest 500 rows per table, filter, inspector), page is now wide.
  API: GET /api/radar/raw (table list), /api/radar/raw?table=radar_x&offset&limit.
- Still to find out on the NAS: what the actual Reddit error is. Likely 403 without keys → add Reddit app keys.
- Data quality without ANTHROPIC_API_KEY is rough (archive shows "Daily Discussion", "official video" as
  artists/genres). The AI key fixes most of that; a stop-list for the plain extractor is a possible follow-up.

## Fixed 2026-11-13 ~10:45: Havoc Elements, pictures vanished when burned (user screenshot: Feeds wall)
- Cause: pictures from other sites (feed images) are cross-origin; getImageData threw, the engine skipped them, so the
  picture had no material and turned into empty background once its card was touched.
- Fix (elements-engine.js rasterize): a tainted <img> is re-fetched through /api/img (same origin) and sampled; if
  that fails, it gets a plain textured fill so it still burns. api.stats now has pictures/foreign, and is reset at
  start (it used to keep the previous run's stats until the new read finished).
- Test: platform.spec "a picture from another site is still read in".
- Also: tests now silence the Friday review nudge properly (the old 'x' value never matched; failed on Friday
  afternoons UTC). The nudge text is now just "Weekly review".

## Shipped 2026-11-13 ~11:00: Music Radar other sources (user: "lets add this to the music radar, so we can look at it by source, combine them look at trends etc")
- server/services/radar/lib/sources.mjs: ListenBrainz fresh releases (sitewide + per-user with a username), Apple Music
  most-played albums/songs (country, default CA), Audius trending (week, a few genres), Last.fm top artists + tag top
  artists (needs LASTFM_API_KEY), Bandcamp discover "new" by tag (discover_web, falls back to hub/2/dig_deeper), Hype
  Machine popular/latest JSON, blog RSS (Pitchfork, Stereogum, The Fader, Gorilla vs. Bear, Bandcamp Daily; editable)
  read for artist names (Claude if ANTHROPIC_API_KEY, else headline rules: fromHeadline()).
  Tags: your liked genres first, then a starter set; editable.
- Runs after every Reddit scan, or "Check sources" (POST /api/radar/run {what:'sources', only?}). Settings: POST
  /api/radar/sources (kept in radar_kv.sourcesCfg).
- Tables: radar_signals (unique source+uid; first/last seen, rank, best rank), radar_chart_points (rank per check),
  radar_source_runs (per-source result/error).
- lib/sources-data.mjs: per-source lists (charts by rank with movement), combined per artist over 30 days (weights:
  Reddit/blogs/Hype 3, Audius 2, Bandcamp/ListenBrainz 1.5, Apple/Last.fm 1; rank bonus; 10-day half-life; ×(1+0.5 per
  extra source)), new finds per day per source, genres across sources, chart movers, crossover (Reddit picks later on
  the Apple chart), "also on" chips on picks.
- Not verified against the live APIs from here (no network in the build sandbox): formats are from the docs/known
  shapes, parsed defensively; any mismatch shows as that source's error in its tab. Audius/Hype Machine/Bandcamp are
  the likeliest to need a tweak.
- Tests: tests/radar-sources.spec.mjs (fixtures in server/services/radar/test/source-fixtures.mjs), radar.spec.
- Ideas not done: sources in the weekly digest; boosting Reddit pick scores by other sources.

## Fixed 2026-11-13: weather snow blew right
- weather.js used wind speed only (always positive = always right) at kmh/18 (very strong). Now uses
  wind_direction_10m (added to the Open-Meteo query) for the sideways component, scaled kmh/50, capped ±0.8.
  CadenceFX.wanted() exposes the current wants.

## Shipped 2026-11-13 ~11:30: six more themes (backlog 2026-11-12 22:11)
- public/plugins/themes-extra.js (after themes-more.js): Claude (ivory/clay, Source Serif 4 headings, roomy composer,
  light+dark), Reddit (IBM Plex Sans, tasks as posts with a vote column: up/down = priority, light+dark), Pocket Casts
  (dark/red, rounded art, an Up Next player bar: next task due + done-today progress, its button completes it),
  Blades (2005 console dashboard: glossy coloured blades on the right edge navigate Today/Upcoming/Inbox/Logbook, green
  glow), Adventure (parchment over forest, Cinzel gold headings, a heart per task due/done today, "You finished" banner),
  Platformer (blue sky, drifting clouds, brick floor, pixel borders, coin counter + coin pop with synthesized blip).
- Homages only: no logos, mascots, characters or brand artwork (Zelda/Mario became Adventure/Platformer).
- Fonts vendored from Fontsource (OFL): Cinzel 500/700, IBM Plex Sans 400/500/700, Source Serif 4 400/600. CREDITS.md.
- Theme CSS must not style `.task` alone: schedule blocks are `.td-b.task`. Use `.task:not(.td-b)`.
- Test: smoke "themes set 3". Also fixed: Radar's add-subreddit field keeps its text across redraws (flaky test).

## Shipped 2026-11-13 ~12:15: Harper grammar checker (user picked from the backlog)
- public/plugins/harper.js + public/vendor/harper (harper.js 3.0.0, Automattic, Apache-2.0, unmodified dist; the
  WebAssembly is 20 MB, 8 MB gzipped). Loads only when you first focus a text box.
- Checks textareas (not .te-title, code/JSON boxes, mono fonts, [data-no-grammar]); turns the browser's own
  spellcheck off on the box it's checking. Underlines on a mirror layer ON TOP of the box (pointer-events none,
  transparent text), so it works in dialogs too. Caret on a problem → popover: message, suggestions (deduped), Ignore,
  Add to dictionary (synced plugin storage `cfg.words`). Settings: on/off, dialect (Canadian default).
- LocalLinter on the page: the WorkerLinter build hangs unless the engine is also loaded on the page, and
  setup() hangs in the worker. A check is a few ms after the first load (~0.8 s).
- Core: the task editor no longer closes on clicks inside [data-keep-open] elements.
- Server: /vendor/* is served with ETag + no-cache (304 when unchanged) and gzipped when over 256 KB (kept in
  memory); MIME for .wasm and .woff2. Everything else is still no-store.
- Plugins' setup() can run more than once (rebuilds): document-level listeners need a cleanup (see G.cleanup).

## Shipped 2026-11-13 ~12:40: typing fire melts snow into running water (backlog)
- elements-core.js: new input 'melt' [cx, cy, r, rx]: SNOW (90%) and ICE (50%) inside an ellipse (mostly above the
  point) become WATER. On the ambient layer (opts.compact) fire next to water boils it 3% of the time instead of 25%,
  so meltwater runs off instead of vanishing as steam (Havoc unchanged).
- elements-engine.js world API: melt(x, y, r = 40, rx = r) in px.
- typing-fx.js (fire, matter on): each key melts the drift on the TOP EDGE of the box being typed in (that's where
  snow rests; the caret is ~25 px lower), wider on Enter. Test: team-desk "typing fire melts the snow".

## Shipped 2026-11-13 ~13:10: mobile pass (backlog)
- Audit: every view at 390×844 (scripts were .scratch/audit-m.mjs, mob-ui.mjs). Already OK: slide-over menu, task
  editor, dialogs, Today, lists, dashboard, calendar, board (scrolls sideways by design), Radar.
- Fixed (core.css "phones (≤640px)" block): page top room for the Island (titles were covered by toasts), .stats in
  two columns, Insights table scrolls sideways, .seg/.tabs scroll instead of clipping, Kitchen meal-plan columns
  have a minimum width and scroll, dialogs fit the screen, 16px inputs (no iOS zoom), meeting bar wraps under the
  Island and the menu button hides during meetings, safe-area insets (viewport-fit=cover, home-screen app metas).
- core.js: tapping anything that does something in the slide-over menu closes it (not dock-* actions).
- sand-jar: no jar under 700px wide (it sat on the task list).
- Test: platform "on a phone" (no sideways scroll on 13 views, stats rows, menu, meeting).
- Not done: no command palette button on phones (⌘K only); swipe gestures; a bottom tab bar.

## Shipped 2026-11-13 ~13:40: Harper in single-line boxes + autocorrect (user: "i dont see it? … auto correct like if i did ther it would do the")
- The user's screenshot was the meeting box (#m-in, an <input>): Harper only did textareas then; those squiggles were
  the browser's. Now also checks LINES = '#qa,#m-in,.qa input,.m-add input,input[data-grammar]' and task titles.
  Single-line mirror: white-space:pre, line-height = inner height, scrollLeft synced. Quick-add syntax tokens
  (@client ^owner >dev !1 #tag) are never flagged.
- Autocorrect (setting "auto", default on): on space/punctuation after a word: a built-in SLIPS list (teh/ther→the,
  dont→don't, tomorow→tomorrow, i→I, …) or, once Harper has loaded, its first spelling suggestion if it's 1 edit away
  (≤5 letters) or 2 (longer), lowercase words of 4+ letters only. The fixed word glows blue (.hp-fixed). Backspace
  straight after restores your word and keeps it for the session (G.keep). Words in your dictionary are never touched.
- Harper starts loading as soon as a box is focused.
- Tests: more.spec "grammar…" and "autocorrect…".

## Fixed 2026-11-13 ~14:20: Christmas Elements look had two light strings and two kinds of snow (user report + screenshot)
- Two strings: christmas.js turned the classic DOM string off only in apply(); resize/theme/Island-pill redraws called
  lights(G.o) with the full settings and brought it back. lights() and snow() now force their classic part off
  themselves when look !== 'classic' (classicOff).
- Snow "less aware of the page than Havoc": the ambient layer only had ledges on a few selectors' top edges, and most
  falling snow was v5 air flakes (crystals, blurry front bokeh). Now ledges() reads the page like ground: the top of
  every line of text (at ~22% of the line box) and of everything solid-looking (bg/border/bg-image, IMG/SVG/INPUT/
  BUTTON/…), up to 1500 elements and 2500 text rects; re-read when the page changes (MutationObserver + scroll +
  resize, at most every 250 ms, and every 4 s anyway). No long tasks measured. Ambient flakes are plain (no crystals,
  no near bokeh); Havoc keeps all three.
- Also fixed: Harper's position loop threw when its box left the page mid-frame (place() detaches; check cur after).
- Test: projects "Elements look: one set of lights after resizes and theme changes, snow settles on text".

## Backlog (user, 2026-11-13 12:05)
- Themes, new categories. "Movie & TV": Jurassic Park, Star Wars, The Shining, Kill Bill, Titan A.E., The Simpsons,
  Family Guy, South Park, Over the Garden Wall. "Studio Ghibli": Spirited Away, My Neighbor Totoro. As with the other
  homages: palettes, textures, type and mood only, no characters, logos, title wordmarks or stills (e.g. Shining =
  the hexagon hallway carpet pattern + typewriter; Kill Bill = yellow/black, katana-slash dividers; Totoro = forest
  greens, rain, soft painted sky; Jurassic = jungle greens, amber, park-signage type).
- Themes screen redesign: it's very long, needs better navigation (category tabs/side index, search, maybe a compact
  grid + live preview). Bug: picking a theme scrolls the page back to the top.
