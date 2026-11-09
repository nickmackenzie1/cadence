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
- Older: right-click menu, verify mosaic with real Wikimedia images and logos on the NAS.
