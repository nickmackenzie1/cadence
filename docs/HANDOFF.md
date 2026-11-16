# Handoff: rules and open backlog

Start with `CLAUDE.md` (how to work here). This file holds the user's standing rules and every backlog idea they have
asked for, verbatim by date. Add new ideas at the bottom ("just add things I say to the backlog"). When something
ships, delete it here and note it in the commit. The full session history up to 0.7.2 is in `docs/archive/HANDOFF-2026-11.md`;
some backlog items below may already be partly done, so check there before starting one.

## RULES (from the user, 2026-11-08) — override anything above
- No Tailscale. Never expose the NAS to the internet (no port forwarding, DDNS, Let's Encrypt HTTP challenge).
- Secrets live on the NAS only (.env, certs/, .mkcert-ca/, data/). Never commit them, never put them in the browser.
- Deploy = push main -> CI tests -> promoted to `stable` -> NAS deploy.sh (every 5 min). Repo clone is /home/claude/cadence.

- Release numbers (user, 2026-11-13 22:01): EVERY push gets a new version, even small ones. Run `npm run bump`
  (patch; `npm run bump minor` for big batches) before committing; it writes public/version.json + package.json.
  The app (window.Cadence.version, startup notice) and /api/health read version.json; CI tags v<version> and
  publishes a GitHub release after every green run (skips if the tag already exists, i.e. someone forgot to bump).

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

## Backlog (user, 2026-11-13 12:05)
- Themes, new categories. "Movie & TV": Jurassic Park, Star Wars, The Shining, Kill Bill, Titan A.E., The Simpsons,
  Family Guy, South Park, Over the Garden Wall. "Studio Ghibli": Spirited Away, My Neighbor Totoro. As with the other
  homages: palettes, textures, type and mood only, no characters, logos, title wordmarks or stills (e.g. Shining =
  the hexagon hallway carpet pattern + typewriter; Kill Bill = yellow/black, katana-slash dividers; Totoro = forest
  greens, rain, soft painted sky; Jurassic = jungle greens, amber, park-signage type).
- Themes screen redesign: it's very long, needs better navigation (category tabs/side index, search, maybe a compact
  grid + live preview). Bug: picking a theme scrolls the page back to the top.

## Backlog (user, 2026-11-13 12:16)
- A 3D theme (depth: tilted cards, parallax, layered panels; maybe a WebGL backdrop).
- A webcam theme, something playful: e.g. you, pixelated or posterised, as the backdrop; the Elements engine reading
  the camera so snow/sand lands on your head and shoulders; hand-wave to clear a drift. Camera only on explicit opt-in,
  processed on the device, never stored or sent, a visible "camera on" indicator.

## Backlog (user, 2026-11-13 12:36): Games theme category + Camping
- CS:GO, Half-Life, Steam, Borderlands, Grand Theft Auto (category "Games"), and a Camping theme. Same homage rules:
  palettes, textures, type and mood (e.g. Steam = the client's dark slate blues; Borderlands = cel-shaded ink
  outlines; Half-Life = orange-on-black HEV-style HUD; CS:GO = tactical HUD greys/orange; GTA = sunset gradients and
  pastel 80s), no logos, characters or game art.

## Backlog (user, 2026-11-13 12:49): Music Radar's Reddit scan is getting 403s — "do we really need an API? what's the cost?"
- Seen: "scan: 45 of the Reddit requests failed, e.g. r/listentothis/hot: HTTP 403". Reddit now blocks all non-OAuth
  traffic (anonymous .json from a server IP), so the old keyless fetch is dead, not flaky.
- Cost: the official Data API is $0 for personal, non-commercial use (100 requests/min per app, far more than the scan
  needs). The catch is access, not money: 2026 reports say self-serve keys ended and new requests need Reddit's
  approval (some say new requests closed 2026-10-31). So REDDIT_CLIENT_ID/SECRET only helps if the user already has an app.
- Options to weigh with the user: (1) try registering a "script" app at reddit.com/prefs/apps; (2) per-subreddit RSS
  (/r/x/hot/.rss) — may hit the same block, test from the NAS first; (3) drop Reddit and lean on sources that need no
  keys (Bandcamp, label/blog RSS, Last.fm, the record-store feed); (4) make the Reddit part quiet when it fails —
  one calm line, not a "problem" notice. Do (4) regardless. Secrets stay in the NAS .env only.

## Backlog (user, 2026-11-13 13:09–13:12): theme add-ons from links
- Simpsons theme + "The Simpsons in CSS" (alvaromontoro.com, github pattle/simpsons-in-css): those are drawings of the
  actual characters. Same homage rule as every screen theme (no characters, logos, quotes), so NOT adding them.
  Possible instead: more of the look (sky/cloud wallpaper, yellow + blue palette, chunky outlines), all original.
- Zelda theme: BOTW menu UI (github myantalgik/w3 zelda_botw_menu_ui) — the layout ideas (dark translucent panels,
  thin gold frames, slot grid, tab strip) are fine to rebuild in our own CSS. The codepens with Sheikah symbols and
  rupees copy Nintendo's designs: skip the glyphs, use generic gem/rune shapes of our own.
- Fonts: Hylia Serif (artsyomni.com) and the zeldauniverse.net set — check each licence before vendoring; only ship
  ones that allow it, with LICENSE-*.txt in public/vendor/themes/fonts/ like the others.

## Theme rule update (user, 2026-11-13 13:16) — replaces "no characters, logos, quotes" for screen themes
- User: fonts and CSS that tries to look like the thing are fine and the codepens are good examples; still no logos or
  quotes. So: lookalike fonts (licence permitting), palettes, textures, UI chrome, props and scenery recreated in CSS.
- One line Claude keeps: it won't draw the actual characters (Simpsons family, etc.) in CSS either. Rebuilt items
  stay generic (a gem, not a rupee; a rune, not a Sheikah glyph).
- Jurassic Park (user, 13:14): codepen GemmaCroad/vYGLPLr as reference (skip the logo); font options on fontspace
  "jurassic-park" and cdnfonts "jurassic-park" — check the licence, vendor the file, LICENSE-*.txt.

## Backlog (user, 2026-11-13 13:23): Pocket Casts — "love that app"; sync my podcasts, "place and all that"
- Reference for look/feel: github FelicianoTech/pocket-casts-desktop-app (the web app packaged for Linux). Our Pocket
  Casts theme + the Feeds mini player could borrow more of its layout.
- Sync: Pocket Casts has NO official API (their support page says so). There is a long-used unofficial one at
  api.pocketcasts.com (email + password login → token): user/podcast/list, user/history (with playedUpTo = your
  place in each episode), user/starred, up next, stats; position can be written back too (Music Assistant does
  this). References (user, 13:24): github niklas-heer/pocketcasts-stats (stats → Airtable), furgoose/Pocket-Casts
  (Python, endpoint docs), madisonrickert/pocketcasts-api (TypeScript client — closest to our Node server; read
  it for endpoints/auth flow, write our own small fetch wrapper rather than adding the dependency).
- Plan when picked up: NAS-side only (POCKETCASTS_EMAIL / POCKETCASTS_PASSWORD in the NAS .env, token never sent to
  the browser). Pull subscriptions + history + places into the Feeds player so "resume" starts where the phone left
  off; optionally push the place back when you pause in Cadence. Risk: unofficial, can break if they change it —
  fail quietly with one calm line.

## Backlog (user, 2026-11-13 13:25): rebrand + README refresh
- "the readme needs updating haha and the cadence name doesn't really apply anymore". Cadence started as a consultant
  to-do app; it's now Work + Life spaces, themes, Music Radar, feeds, family/home plugins, games. Pick a new name with
  the user (offer a short list), then rename: UI strings, title/manifest/icons, login page, README, docs, Docker image
  and container names, localStorage keys (migrate `cadence.*` → keep reading old keys), window.Cadence API (keep an
  alias for user plugins), deploy.sh paths on the NAS (careful: data dir and .env must not move without a migration).
- README: rewrite for what it is now (features by space, install on Synology, the NAS-only rules: no Tailscale, not
  exposed to the internet, secrets in the NAS .env only; optional keys table; plugin API pointer; tests/CI/stable flow).

## Backlog (user, 2026-11-13 13:33): Kill Bill theme — blood dripping/effects with our engine
- Use the Elements engine (CadenceFX world): drips from the top edge of panels and headings that run down and pool on
  ledges, a splash when you finish a task. Respect Effects Off / reduced motion. Keep it stylised (the film's
  saturated red on yellow/black), not gory.

## Backlog (user, 2026-11-13 13:39): load only the plugins that are turned on
- Today: one bundle with all 62 plugins (450 KB gzipped, cached by hash), so a repeat visit downloads nothing, but
  every plugin is still parsed and run on each load, even the disabled ones. Next step: index.html/bundle carries
  core + a manifest (id, name, category, file); the bundle only includes files for enabled plugins (enabled list is
  in the synced doc + localStorage; the server can't see it, so either send it as ?p= on bundle.js or load disabled
  ones lazily on demand when switched on in Settings → Plugins). Themes files split the same way (load the theme
  pack only when its theme is active or the Themes screen opens). Measure on a phone before/after.

## Backlog (user, 2026-11-13 13:49): code review — data safety, speed, security, deploy/CI, code health
Claims checked against the code 2026-11-13 (all real). Planned in 4 groups; do in this order.

### Group 1 — cheap safety batch (one session)
- #9  Basic auth skips the login lockout (lib/auth.js basicOK/authorized never call lockedFor/noteFail): count
      Basic failures per IP too and refuse while locked.
- #10 feedparse.js abs() passes `javascript:` (and data:) URLs: allow only http/https.
- #12 safeFetch resolves DNS then fetches separately (rebinding to a LAN address): pin the resolved IP for the
      connection (custom lookup on the agent).
- #13 Dockerfile runs as root, no healthcheck: `USER node` (check data/ and certs/ ownership on the NAS first) and
      `HEALTHCHECK` on /api/health.
- #14 a slow CI run can force-push an older commit to `stable`: add a `concurrency` group to test.yml AND make the
      promote step refuse to move backwards (`git merge-base --is-ancestor origin/stable HEAD`).
- #15 deploy.sh updates live public/ before the container rebuild: rebuild first (or stage), check /api/health
      after, roll back to the previous commit on failure.
- #16 deploy.sh rewrites itself via `git reset --hard` mid-run: copy to a temp file and re-exec it first.
- #17 CI reinstalls Chromium every run and there's no package-lock.json: commit the lockfile, `npm ci`, cache
      ~/.cache/ms-playwright keyed on the Playwright version.
- #1  persistLocal() swallows errors (localStorage ~5 MB cap → saves stop silently): show a calm notice when a
      local save fails (IndexedDB move is in group 3).
- #7  app files (core.css, icons, login page) are sent no-store: same ETag + no-cache (+ gzip) as /vendor/.

### Group 2 — database health
- #3  every change to any record copies the full blob into `history` for 60 days; plugin blobs (feeds, mural)
      rewrite constantly; tombstones never purged. Keep history only for task/client/meeting; purge deleted
      records older than ~90 days (after all devices have had time to sync); VACUUM after the first cleanup.
- #4  refreshDoc() reassembles and rewrites the whole doc on every push, only for long-gone "older tabs".
      Retire it (or run daily), keeping api/state working for the fallback path.
- #2  backups sit on the same NAS: don't build it in — write the user step-by-step Synology Hyper Backup setup
      (encrypted, nightly, to a USB drive or second NAS; nothing exposed, secrets stay on the NAS).

### Group 3 — speed (felt daily)
- #5  bundle only enabled plugins (see "load only the plugins that are turned on" above).
- #6  Harper (20 MB) preloads on every load (harper.js ~line 210, added because the user asked 12:39): keep the
      preload on desktop; on phones / narrow screens / Save-Data, load on first focus of a text box.
- #8  the app can't open away from home (service worker caches nothing; rule: no internet exposure). Cache the app
      shell in the service worker so it opens offline from local data and syncs back on the LAN; move local saves
      to IndexedDB at the same time (#1).

### Group 4 — housekeeping
- #18 radar test/simulate.mjs and source-fixtures.mjs aren't in `npm test`: wire in or delete.
- #20 CI retries twice and hides flakes: log which tests needed a retry (reporter), then fix those (known: radar,
      platform refocus, smoke themes-set-3, team-desk, kids, kanban, dashboard).
- #19 core.js is ~2,100 lines with lines up to 2,900 chars: run a formatter in its own commit (no other changes),
      then keep splitting modules like meeting.js.
- #21 HANDOFF.md is ~900 lines, much superseded: trim to a short CLAUDE.md (rules, structure, how to test/deploy)
      plus docs/archive.
- #22 README is stale (sessions.json, a JSON mirror retired Nov 9): rewrite, ideally with the rebrand.

## Backlog (user, 2026-11-13 13:54): weird and wonderful
- The NAS dreams: overnight job uses the NAS AI key to write a short surreal dream from yesterday's tasks and
  clients ("Patagonia was a lighthouse. You owed it a SOW."); waiting for you in the morning (Today card or Island).
  Calm tone, never anxious; skip if no AI key.
- Civilization in your backlog: tiny people settle on your oldest tasks, build villages, develop a religion around
  the Start Meeting button; finishing an old task is the extinction event they prophesied. (Elements engine?)
- Plugins gossip: the intern, sheep, ghosts and Chad have a group chat you can read. They talk about you
  (gently). AI-written when a key is set, canned lines otherwise.

## Reddit (user asked 21:20): Reddit's Responsible Builder Policy says API access needs explicit approval first.
- Create a "script" app (redirect uri http://localhost:8080, unused; we use client_credentials), then request access
  via their ticket form describing personal, non-commercial, read-only use. Don't work around the block (policy).
- Until approved, Radar runs on the other sources; refusals are one calm line.

## Backlog (user, 2026-11-13 21:36): Narrator
- A nature-documentary voice (browser speechSynthesis) comments on what you do: "The consultant approaches the SOW.
  He hesitates. He opens Themes instead." Hooks: opening a task then switching away, opening Themes, finishing an
  old task, long idle, meeting start. Off by default, a Fun plugin; rate-limited (one line every few minutes at most),
  muted during meetings and quiet hours, gentle not judgmental (anxiety-safe). Lines canned, optionally AI-written
  when a key is set. Pick the deepest/slowest available voice; captions in the Island for when sound is off.

## Backlog (user, 2026-11-13 21:40): free APIs to use (check each one's current terms/rate limits before building;
## all fetches server-side through safeFetch, cached, no keys unless noted)
- Open-Meteo Air Quality + pollen: UV, pollen, smoke in the greeting (same provider as weather).
- NOAA SWPC space weather: aurora / solar storm → "Northern lights possible tonight" on the Island.
- ISS: live position + pass times over home (pass times may need a TLE + local calc).
- Wikipedia "On this day" + featured article: daily fact on Today; raw material for the NAS dreams.
- Met Museum + Art Institute of Chicago: public-domain artworks with images for the mural mosaic (beside the
  Wikimedia presets). Only public-domain/CC0 items.
- MusicBrainz + Cover Art Archive: album art and release data for Music Radar (MusicBrainz needs a UA + 1 req/s).
- Radio Browser: internet radio stations for the ambient plugin.
- TheMealDB: recipes with photos for dinner roulette (free test key "1").
- Bank of Canada Valet + Frankfurter: daily exchange rates (USD invoicing).
- Hacker News (Firebase API): top stories as a feed skin.
- xkcd JSON: the daily comic.
- Lichess: daily chess puzzle for the games plugin.
- NHL stats API: Leafs scores on the Island; on a Leafs goal the Island flashes red goal-light style with a horn
  (our own sound, off by default; no team logos). Quiet hours / meetings mute it.
- Also suggested earlier: TVmaze ("your shows air tonight"), Open Food Facts (barcode → groceries), the city's
  open-data waste calendar ("garbage night" reminders; ask which city).
- Pocket Casts (unofficial) capabilities for the sync item above: subscriptions, new releases, in progress, starred,
  star / played status / played position write-back, subscribe/unsubscribe, episode notes, search, charts.

## Pocket Casts / Podcasts design (user, 2026-11-13 21:41–21:42; mockup shown in chat)
- One plugin for BOTH spaces (no `spaces` limit): the same shows, queue and player in Work and Life.
- Playback never stops when you switch space, view or browser tab: one <audio> element owned by a window-level
  singleton (window.CadencePodcasts), created once and kept outside #view and outside rebuildPlugins/render (a
  rebuild re-attaches UI to the existing player instead of making a new one). Lazy plugin loading: keep the file in
  ALWAYS once it's playing, or just never skip it while audio is active.
- Layout: now-playing card (resume point from the phone, progress, -10/+30, speed, sleep timer, star), Up next
  (drag to reorder), New from your shows (Up next / Make a task / Archive), sidebar: your shows grid + find a show,
  In progress, This week stats (only if the stats endpoint exists), "Synced with Pocket Casts 2m ago".
- Mini player in the bottom bar everywhere; media keys + Media Session API (lock-screen controls on the phone).
- Pauses for meetings, quiet during quiet hours, gentle Island note for new episodes, "keep listening" Today card.
- Credentials only in the NAS .env; if the unofficial API breaks: "Pocket Casts sync paused", player keeps working.

## Backlog (user, 2026-11-13 22:03): flexible, hostable anywhere, any database, apps for every platform
- Hosting: keep zero-dependency Node; document + test installs for Synology (current), plain Docker/Compose, Unraid,
  TrueNAS, Proxmox LXC, Raspberry Pi (arm64 image), bare Linux (systemd unit), Windows (service/WSL), macOS (launchd),
  and cloud VMs/PaaS (Fly, Railway, Render, a $5 VPS). Multi-arch image on GHCR. Config only via env vars.
  NOTE: the user's OWN instance keeps the standing rules (no Tailscale, NAS not exposed, secrets on the NAS).
  Docs for other people's installs must still default to private/LAN, with internet exposure as an explicit,
  documented opt-in (HTTPS, strong password, reverse proxy guide).
- Database: storage.js already abstracts SQLite + legacy JSON. Add a storage adapter interface (records, history,
  sync cursor, blobs) with drivers: SQLite (default), Postgres, MySQL/MariaDB, plus "files" (JSON, for tiny
  installs). Pick by DATABASE_URL. Keep node:sqlite as the no-dependency default; other drivers are optional
  installs. Migration tool between drivers (export → import).
- Apps: the web app is already a PWA. Then:
  - Phone (iOS/Android): PWA install guide first; later a Capacitor wrapper (push, share sheet, widgets).
  - Desktop (Windows/macOS/Linux): a Tauri shell (small, uses the system webview) pointing at your server,
    with tray icon, global quick-add shortcut, notifications, launch at login. Builds in GitHub Actions per
    release (the new per-push releases attach the installers).
  - Server-in-the-app option for desktop: run the Node server bundled for single-machine use, no NAS needed.
- Instructions "for everything under the sun": a docs site (docs/install/*.md) with one page per platform and
  per database, each tested in CI where possible (Docker matrix: amd64/arm64 × sqlite/postgres/mysql).
- Do with the rebrand (name appears in images, app IDs, bundle IDs, data paths).


## Test notes (0.7.3)
- Kids chores test (more.spec "kids: a child…") failed once under full-suite load with a balance of 1 instead of 2.
  It never reproduced, even under CPU stress. It now checks the row says "2 pts" first, so the next failure shows whether saving or clicking went wrong.

## Shipped 0.8.0 (user, 2026-11-15): underground indie sources + Radio
- Music Radar: KEXP source (api.kexp.org plays: rotation, new releases, live sessions; weight 3.5). Blogs have tiers:
  big (Pitchfork, The Fader) count 1.5, small count 3.5. New small blogs: Post-Trash, Rosy Overdrive, Aquarium Drunkard,
  Obscure Sound, Under the Radar, The Line of Best Fit. Their feed addresses were NOT checked (agent workspace can't
  reach them): if one shows a warning under Sources, fix its address in Radar settings (name | url | small/big).
- Radio view (plugins/radio.js, services/radio.js, routes/radio.js): presets resolved via Radio Browser on the NAS
  (cached a week in data/radio-cache.json), search, your stations (api.storage, per space), KEXP now playing,
  http streams relayed by the NAS (public addresses only). Shares the Podcasts player and mini bar (P.useMini).
- Open: !earshot (Canadian campus radio charts) — its robots.txt disallows automated access to /charts, so not
  scraped. Ask them for a feed, or link to it. NACC chart: page format unchecked; may be JS-rendered.
- Open: confirm Amherst Island Radio's stream is in Radio Browser (else add it by address in Radio).

## Backlog (user, 2026-11-15 21:21): KEXP song history search
- User shared KSSE (github.com/geluso/kexp_song_search_engine, live at 5tephen.com/ksse): search KEXP's play history
  by artist/song, see the songs played around it ("neighbors") and DJ comments, plus all-time top songs/artists.
  It scrapes KEXP's hourly playlist HTML into a database (Python + PHP); searchable history from 2016. No API, licence unstated.
- Idea for Cadence: don't scrape their site. The NAS already reads api.kexp.org/v2/plays for Music Radar, which includes
  DJ comments, labels and rotation. Keep every play in our own table from now on (a few hundred rows a day), then:
  search in Radio ("when did KEXP last play X?"), the songs before and after, DJ comments, top artists this month,
  and "you'd like these" from the neighbours of songs you saved. Check whether the API's airdate filters allow a
  backfill before building one.
- 0.8.2: started. `server/services/kexp-log.js` saves every KEXP play to `kexp_plays` in cadence.db (new plays every
  5 min; backfills the past year one page per 30 s; tries airdate_before, else offset pages). Status:
  /api/radio/kexp-history, shown at the bottom of Radio. Search UI not built yet. Env: KEXP_LOG=0 to turn off,
  KEXP_BACKFILL_DAYS (default 365). Off under CI unless KEXP_LOG=1.
