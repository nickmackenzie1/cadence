# Cadence

A minimal, modular to-do app for consultants: tasks for each client, a Meeting Mode for grabbing
action items on both sides, Fireflies import, formatted recap emails, and a plugin API.

```
public/index.html   page shell (loads core + plugins). No build step.
public/core.js      core: state, sync, parsing, rendering, plugin host
public/core.css     core styles
public/plugins/     every feature beyond the core, one file each
tests/              Playwright smoke tests
server.js           tiny Node server: serves the app, stores data/state.json, daily backups, optional AI proxy
Dockerfile          node:20-alpine image
docker-compose.yml  mounts public/ live, so UI changes need no rebuild
deploy.sh           Synology auto-deploy: pulls from GitHub, rebuilds only when needed
docs/PLUGINS.md     plugin API for developers
```

## Highlights

- Quick add: `Send SOW @Acme Corp fri 3pm !1 #crm`, `^Sarah share logins tomorrow`, `Weekly report every fri`
- Meeting Mode: capture items for you and the client, import Fireflies notes, review, then send a formatted recap
- Client pages: logo, prep sheet, chase email, project templates, status email, pause/resume
- Keyboard: `?` lists every shortcut (J/K to move, X to complete, S to snooze, E to open, M for a meeting)
- Drag to reorder, drag between On me / On client, or drop on a client in the sidebar
- Weekly review, with a nudge on Friday afternoon

## How changes reach the NAS

```
push to main  ->  NAS Task Scheduler runs deploy.sh every 5 min  ->  live
                    public/*                        : live on browser refresh
                    server.js / Dockerfile / compose: container rebuilt automatically
                    data/ and .env                  : never touched
```

Every deploy is a git commit, so rolling back is `git revert` and push.
`deploy.log` on the NAS shows what happened.

## One-time Synology setup

**1. Create a read-only GitHub token.** Go to GitHub → Settings → Developer settings →
Fine-grained tokens → **Generate new token**:
- Repository access: **Only select repositories**, then pick this repo
- Permissions: **Contents → Read-only** (nothing else)
- Expiration: up to a year (set a calendar reminder to renew it)

**2. Put `deploy.sh` on the NAS.** In File Station, upload `deploy.sh` into your existing
`docker/cadence` folder. Your `data` folder is kept as it is.

**3. Schedule it.** Go to Control Panel → Task Scheduler → **Create → Scheduled Task → User-defined script**.
- General: Task name `Cadence deploy`, User **root**
- Schedule: Run on the following days **Daily**. Under Time, set First run time `00:00`,
  Frequency **Every 5 minutes**, Last run time `23:55`
- Task Settings → Run command:
  ```
  REPO=OWNER/cadence TOKEN=github_pat_xxx APP_PASSWORD=your-password sh /volume1/docker/cadence/deploy.sh
  ```
  Optionally add `ANTHROPIC_API_KEY=sk-ant-...` before `sh` to turn on the AI features.
  If your shared folder is on another volume, change `volume1` to match.

**4. Run it once.** Select the task and click **Run**. Within a minute or two the container is rebuilt
from GitHub. Open `http://<nas-ip>:8484`. The sidebar should say **Synced to NAS**.

To change your password or AI key later, edit the task's command. The next run applies it and restarts the container.

The script uses `git` if it's installed (Package Center → Git Server). If not, it uses a throwaway
`alpine/git` container, so no extra packages are needed.

## Tests

`npm install && npx playwright install chromium && npm test` boots a real server on a throwaway data folder
and drives the app (startup, quick add, sync, inline editor, meetings + Fireflies import, every view, SSRF guard).
On GitHub, every push to `main` runs them; only green commits are promoted to the `stable` branch, which is
what `deploy.sh` follows. A broken commit never reaches the NAS.

## Local development

```
mkdir -p data && DATA_DIR=./data node server.js     # http://localhost:8484
```
Or just open `public/index.html` in a browser (data stays in that browser).

## Configuration (.env, generated on the NAS)

| Variable | Purpose |
|---|---|
| `APP_USERNAME` / `APP_PASSWORD` | Login (no login if the password is empty) |
| `ANTHROPIC_API_KEY` | Turns on AI extraction and summaries (optional) |
| `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_QUICK` | Override the models |
| `KEEP_BACKUPS` | Number of daily backups to keep in `data/backups` (default 30) |
