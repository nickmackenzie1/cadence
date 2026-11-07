# Writing Cadence plugins

Everything beyond the core is a plugin, including the Fireflies import, AI extraction, recap emails,
Client Pulse and Zoho tags. Built-in plugins live at the bottom of `public/index.html` and are the
best examples. A plugin is one call:

```js
Cadence.registerPlugin({
  id: 'my-plugin',            // unique, stable
  name: 'My plugin',
  version: '1.0.0',
  description: 'Shown in Settings → Plugins',
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
| `api.sidebar.add({ id, order, render(el, api) })` | A widget card at the bottom of the sidebar. Rendered once; update it yourself from events |
| `api.on(event, fn)` | `task:add` `task:update` `task:complete` `task:reopen` `task:remove` `client:add` `client:update` `meeting:start` `meeting:end` `reminder` `render` ({route}) `sync` ({phase: push/saved/pull/pulled/connected/error, ms}) `*` |

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

## Task shape

```js
{ id, title, clientId, owner: 'me'|'client', assignee, dueDate: 'YYYY-MM-DD'|null, dueTime: 'HH:MM'|null,
  priority: 0-3, tags: [], notes, repeat: { unit: 'day'|'weekday'|'week'|'month', n } | null, order, lastChased, remindMode: 'auto'|'at'|'60'|'custom'|'none', remindAt, done, doneAt, createdAt, meetingId }
```

## Plugin files

Bigger plugins live in their own file in `public/plugins/` and are loaded by a `<script>` tag at the bottom
of `index.html`: `status.js` (boot sequence + system panel), `momentum.js` (gamification), `brand.js`
(client brand colours), `havoc.js` (page destroyer, engine in `public/vendor/`), `links.js` (client quick links with Zoho detection). Copy one as a starting point.

## Shipping a plugin

Paste it into Settings → Developer to try it out. To ship it to everyone, add it next to the
built-in plugins in `public/index.html` and push. It goes live on the next deploy, with no rebuild.

## Built-in plugins worth reading

`prep` (client action + modal), `chase` (reuses the recap email via `window.CadenceRecap.open`),
`templates` (storage-backed editor), `review` (sidebar view), `pulse` (sidebar view),
`fireflies` / `ai-extract` / `plain-lines` (extractors), `zoho-tags` (parser).
