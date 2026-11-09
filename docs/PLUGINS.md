# Writing Cadence plugins

Everything beyond the core is a plugin, including the Fireflies import, AI extraction, recap emails,
Client Pulse and Zoho tags. Built-in plugins live in `public/plugins/` and are the best examples.
A plugin is one call:

```js
Cadence.registerPlugin({
  id: 'my-plugin',            // unique, stable
  name: 'My plugin',
  version: '1.0.0',
  description: 'Shown when the card is opened in Settings → Plugins',

  // how the plugin looks in Settings → Plugins (all optional)
  tagline: 'One short line on the card',
  icon: '<path d="M4 12h16"/>',  // SVG paths (24×24, drawn as white strokes), a full <svg>, an image URL, or an emoji
  color: '#2f7de1',               // the icon tile's colour
  category: 'Meetings',           // Meetings · Clients · Productivity · Look & feel · Fun · Integrations · System
  settings(api) { api.ui.modal('My plugin', '…') },  // adds a Settings button to the card

  setup(api) { /* register things */ }
});
```

`setup` runs again whenever plugins are toggled. Only register things there; don't keep state in closures.
Use `api.storage` for anything that should persist.

## Extension points

| API | What it adds |
|---|---|
| `api.commands.add({ title, hint?, run(api) })` | Entry in the ⌘K command palette |
| `api.views.add({ id, title, icon, subtitle?, render(el, api) })` | Sidebar view; render into `el` |
| `api.parsers.add((text, result, ctx) => remainingText)` | Quick-add syntax: mutate `result`, return the text with your tokens removed |
| `api.extractors.add({ id, name, available?(), run(text, ctx, api) })` | Meeting-notes importer, returns `[{ title, owner: 'me'\|'client', assignee?, dueDate?, dueTime? }]` |
| `api.taskActions.add({ label, run(task, api) })` | Button in the task drawer |
| `api.meetingActions.add({ label, run(meeting, items, api) })` | Button on the meeting review screen and in the meeting log |
| `api.clientActions.add({ id, label, run(client, api), primary?, where?: ['waiting'], short? })` | Client page: `primary` shows a button in the header, otherwise it goes in the ••• menu. `where: ['waiting']` also adds a small `short` button to that client's group on Waiting on clients |
| `api.sidebar.add({ id, order, slot: 'top'|'bottom', render(el, api) })` | A widget in the sidebar (keep it small: the sidebar is for navigation). Rendered once; update it yourself from events |
| `api.onSettings(fn)` | The Settings button for your plugin in the plugin browser (or define `settings(api)` on the plugin) |
| `api.on(event, fn)` | `task:add` `task:update` `task:complete` `task:reopen` `task:remove` `client:add` `client:update` `meeting:start` `meeting:end` `reminder` `render` ({route}) `sync` ({phase: push/saved/pull/pulled/connected/error, ms}) `task:quickadd` `render:side` `*` |

## Data and helpers

```
api.tasks.list(filterFn?) / get(id) / add(partial) / update(id, patch) / complete(id) / remove(id) / quickAdd(text, ctx)
api.clients.list() / get(id) / add(name) / update(id, patch)
api.meetings.list() / active() / start(clientId?, notes?)
api.storage.get(key) / set(key, value)        // namespaced to your plugin, synced with the rest of the data
api.ui.toast(msg, [{label, run}]) / navigate(route) / refresh() / copy(text) / modal(title, bodyHTML, footHTML, cls) / close() / esc(str) / currentRoute()
api.ai                                         // async (prompt, opts) => { text }, with .json(prompt); null when AI is off
api.settings()                                 // { myName, theme, remindLead }
api.system()                                   // { mode: 'nas'|'claude'|'local', status, latency, lastSyncAt, ai, health, version, plugins, counts }
api.ui.pointer()                               // last click {x, y, t, target}: anchor effects where the user clicked
api.util.parse(text, ctx) / ymd(date) / fmtDate(ymd) / dueLabel(task) / addDays(date, n) / todayKey()
```

Everything returned is a copy. Change data through the API so events fire and the data syncs.

## The Island (`api.island`)

The pill at the top of the app is shared by every plugin. Use it for anything worth a glance; it falls back to a plain toast if the Island plugin is turned off.

```js
api.island.show({ title: 'Invoice sent', sub: 'Acme · $4,200', icon: '✉', color: '#2f7de1',
  actions: [{ label: 'Open', run: () => {} }] });          // 1–2 actions sit inline, more stack below

api.island.show({ image: api.ui.avatar(client, 20), title: 'Acme replied', key: 'acme-mail' }); // same key = updates in place

const job = api.island.progress('sync-books', 'Syncing Zoho Books…');  // spinner (or pass { value: 0 } for a bar)
job.update({ progress: 0.6, sub: '120 of 200 invoices' });
job.done({ title: 'Books synced', sub: '200 invoices' });               // turns into a check, then fades

api.island.celebrate({ eyebrow: 'Milestone', icon: '🏆', color: '#ffb020', title: '100 tasks this month', right: '+100 XP' });

api.island.live('timer', { prio: 5, view: () => ({ html: '<span class="isl-t"><b>Focus</b></span><span class="isl-right" data-live-tick>25:00</span>', tick: () => '24:59', onClick() {} }) });
api.island.clear('timer');
```

Options for `show`: `title`, `sub`, `icon` + `color`, `image` (HTML, e.g. an avatar or `<img>`), `right` (small text on the right), `check`, `spin`, `progress` (0–1), `actions`, `onClick`, `key`, `sticky`, `ms`. Plain notices: the newest wins. Celebrations, sticky and keyed notices wait their turn. Live activities (a running meeting, the next calendar event) show whenever nothing else is.

## Themes (`window.CadenceThemes`)

The Themes plugin is a small engine that every plugin can use. A theme is a set of design tokens (CSS variables)
plus optional CSS, fonts, stylesheets and effects. The active theme is synced like everything else.

```js
CadenceThemes.register({
  id: 'sunset', name: 'Sunset', category: 'Fun',            // Useful · Fun · Crazy
  tagline: 'Shown on the gallery card',
  vars:  { '--bg': '#1b1020', '--panel': '#24152b', '--text': '#ffe9dc', '--accent': '#ff7a59' },
  light: { … }, dark: { … },                                 // optional: follow the moon toggle instead of vars
  font: '"My Font", system-ui', fonts: [{ family: 'My Font', src: 'vendor/my.woff2' }],
  stylesheets: ['vendor/lib.css'], scripts: ['vendor/lib.js'], // only loaded while the theme is active
  css: ':skin .btn { border-radius: 0 }',                     // :skin = html[data-skin="sunset"]
  enhance(ctx) { /* DOM tweaks that are part of the look */ return () => {} },
  effects(ctx) { ctx.layer.innerHTML = '…'; return () => {} },  // motion; skipped when Effects is Off or reduced motion
});
CadenceThemes.apply('sunset'); CadenceThemes.current(); CadenceThemes.list();
CadenceThemes.token('--accent'); CadenceThemes.isDark();
CadenceThemes.on(({ id, dark }) => …);   // or document.addEventListener('cadence:theme', e => e.detail)
```

**Tokens every plugin should use** (instead of hard-coded colours, so themes reach you): `--bg` `--panel` `--side`
`--text` `--muted` `--faint` `--line` `--hover` `--accent` `--accent-soft` `--danger` `--danger-soft` `--ok`
`--client` `--client-soft` `--shadow` `--mono`, and `--on-accent` (text on an accent background, defaults to white).
`effects(ctx)` gets `ctx.layer`, a fixed overlay above the page (`pointer-events:none`); set `ctx.layer.style.zIndex = '0'`
to draw *behind* the app (the theme's CSS then makes `.app` `position:relative; z-index:1` and panels translucent).
Built-in themes live in `public/plugins/themes-pack.js`; open-source credits in `public/vendor/themes/CREDITS.md`.

## Task shape

```js
{ id, title, clientId, owner: 'me'|'client', assignee, dueDate: 'YYYY-MM-DD'|null, dueTime: 'HH:MM'|null,
  priority: 0-3, tags: [], notes, repeat: { unit: 'day'|'weekday'|'week'|'month', n } | null, order, lastChased, remindMode: 'auto'|'at'|'60'|'custom'|'none', remindAt, done, doneAt, createdAt, meetingId }
```

## Plugin files

Bigger plugins live in their own file in `public/plugins/` and are loaded by a `<script>` tag at the bottom
of `index.html`: `status.js` (boot sequence + system panel), `momentum.js` (gamification), `brand.js`
(client brand colours), `havoc.js` (page destroyer, engine in `public/vendor/`), `links.js` (client quick links with Zoho detection), `themes.js` (theming engine + gallery, `window.CadenceThemes`), `themes-pack.js` (20 themes), `haunted.js` (overdue ghosts with personalities), `stocks.js` (client share prices, history rebuilt from data), `intern.js` (pixel intern carrying waiting-on-client items), `weblinks.js` (sidebar bookmarks, `api.storage` "links"), `account.js` (Sign out), `island.js` (Dynamic-Island pill: `window.CadenceIsland.show({title, sub, icon, check, actions, sticky})`, `.live(key, {view})`, `.clear(key)`), `datepick.js` (calendar under newly added undated tasks; `window.CadenceDatePick.openAt(el, {value, onPick, onClear})`), `mural.js` (living mural view), `rss.js` (feeds: sidebar row / home shelf / Feeds view; records, cards or list; server proxy `api/feed?url=`). Copy one as a starting point.

## Shipping a plugin

Paste it into Settings → Developer to try it out. To ship it to everyone, add it next to the
built-in plugins in `public/index.html` and push. It goes live on the next deploy, with no rebuild.

## Built-in plugins worth reading

`prep` (client action + modal), `chase` (reuses the recap email via `window.CadenceRecap.open`),
`templates` (storage-backed editor), `review` (sidebar view), `pulse` (sidebar view),
`fireflies` / `ai-extract` / `plain-lines` (extractors), `zoho-tags` (parser).
