# Cadence

A self-hosted to-do app with Work and Life spaces, running in Docker on the user's Synology NAS.
`docs/HANDOFF.md` has the user's rules and the open backlog. `docs/PLUGINS.md` covers the plugin and theme API.

## Rules (from the user, these override everything)
- **No Tailscale. Never expose the NAS to the internet** (no port forwarding, DDNS, or Let's Encrypt HTTP challenge).
- **Secrets stay on the NAS only:** `.env`, `certs/`, `.mkcert-ca/`, `data/`. Never commit them or send them to the browser.
- **Every push gets a new release number:** run `npm run bump` (or `npm run bump minor` for a big batch) before committing.
- **Calm, anxiety-safe UI:** no alarming red, no countdown pressure, no badge counts. Use plain labels.
- **No emoji in the UI.** Use Lucide icons via `api.ui.icon(name)`. To add icons: `node scripts/build-icons.mjs /tmp/lu/package <names>`.
- **Themes:** CSS recreations, lookalike fonts and props are fine. Logos are allowed (user, 2026-11-16). No quotes. Don't draw actual characters.
- When the user mentions an idea, add it to the bottom of `docs/HANDOFF.md`.

## Layout
- `public/core.js` + `core.css`: the app core (one IIFE). `public/plugins/*.js`: everything else, registered with
  `Cadence.registerPlugin({id, name, setup(api)})`. Themes: `CadenceThemes.register({...})`.
- `server.js` + `server/`: Node 22, no npm dependencies. Storage is `node:sqlite` (`server/lib/storage.js`).
  `server/lib/bundle.js` serves one `bundle.js` with only the enabled plugins (`ALWAYS` lists ones always included).
- `public/sw.js`: offline app shell. It never caches `/api/*`, login, or audio/video.
- Outbound fetches go through `safeFetch` (public hosts only).

## Deploy
Push to `main` → CI (Playwright) → if green, fast-forwarded to `stable` and tagged → the NAS `deploy.sh` follows `stable`
every 5 minutes. It test-builds first, rolls back if the new container isn't healthy, and recreates the container when
`.env` is edited by hand. The container starts as root only to check permissions, then runs as `node` (`entrypoint.sh`).
Check `deploy.log` on the NAS when something doesn't arrive.

## Tests
- `npm run typecheck` (seconds, runs first in CI): plugin API misuse and undefined names, via `types/cadence.d.ts`.
  When you add to `makeApi()` in core.js, declare it there too.
- `npx playwright test` (about 5 minutes). Run single files while working: `npx playwright test tests/x.spec.mjs`.
- Each spec starts its own server on a free port with a temp `DATA_DIR`. Specs in one file share that server,
  so don't assume a fresh database (count what's there instead of hard-coding).
- Wait for async things with `expect.poll` or locator assertions, never a single read straight after an action.
- Docker Hub is blocked in the agent workspace, so image builds can't be tested here; the NAS precheck build catches failures.

## Commits
Commit to `main` with a one-line message saying what changed for the user. Keep reformatting in its own commit.
