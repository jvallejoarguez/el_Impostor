# Deployment

> **Status:** Live as of 2026-05-22 on Cloudflare's free tier.
>
> | Surface  | URL                                                              |
> |----------|------------------------------------------------------------------|
> | Frontend | https://juegoimpostor.app                                        |
> | Pages fallback | https://el-impostor-djf.pages.dev                         |
> | Worker   | https://el-impostor-worker-production.jvallejoarguez.workers.dev |
>
> Account: `jvallejoarguez@gmail.com` (Account ID `9dcaf5d50edb2a76eaef1221620d7d33`). Pages project: `el-impostor`. Worker script: `el-impostor-worker-production`. Custom domain zone: `juegoimpostor.app`.

This doc captures **what is actually in production**, the gotchas hit while getting there, and the exact commands needed to redeploy or roll back. It supplements `docs/superpowers/plans/2026-05-07-el-impostor-multiplayer.md` Phase 5 — read this when the plan and reality diverge.

## Topology

```
┌────────────────────────────────┐         ┌──────────────────────────────────┐
│  Pages: juegoimpostor.app      │  WSS    │  Worker: el-impostor-worker-     │
│  (Vite build of frontend/)     │────────▶│  production (DO: GameRoom)       │
│  el-impostor-djf.pages.dev     │  HTTPS  │  *.workers.dev                   │
└────────────────────────────────┘         └──────────────────────────────────┘
                  ▲                                          │
                  │ VITE_WORKER_URL baked in at build time   │
                  └──────────────────────────────────────────┘
```

The Pages site is a static SPA. The browser opens a WebSocket directly to the worker; the worker upgrades the WS into a Durable Object instance keyed by room code. CORS on `POST /rooms` is gated on `FRONTEND_ORIGINS`, which is set in `worker/wrangler.toml` and must include every public frontend origin.

## Files that drive deployment

- `worker/wrangler.toml` — worker name, DO bindings, env-specific vars, migrations.
- `worker/package.json` — `npm run deploy` is `wrangler deploy --env production`.
- `package.json` (root) — `deploy:worker` and `deploy:frontend` orchestration scripts.
- `frontend/.env*` — none; the worker URL is passed via `VITE_WORKER_URL` env var at build time, read in `frontend/src/ws/useGameSocket.js`.

## Redeploy procedure

Always deploy the worker before the frontend. The frontend build inlines the worker URL, so the worker must exist (or its URL must be known) before the Pages build runs.

```bash
# from repo root, on the branch you want live (usually main)

# 1) Worker
npm run deploy:worker
# Last lines should print:
#   Uploaded el-impostor-worker-production
#   Deployed el-impostor-worker-production triggers
#   https://el-impostor-worker-production.jvallejoarguez.workers.dev

# 2) Frontend build with the worker URL baked in + Pages deploy.
#    IMPORTANT: --branch main pins this to the production alias.
#    Without it wrangler tags the deployment with the current git branch,
#    which lands on a *preview* alias (e.g. feat-multiplayer.el-impostor-djf.pages.dev)
#    and leaves the canonical URL serving 404.
npm run deploy:frontend
```

Verify:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://juegoimpostor.app/
# 200

curl -sS -X POST -H "Origin: https://juegoimpostor.app" \
  https://el-impostor-worker-production.jvallejoarguez.workers.dev/rooms
# {"code":"XXXX"}
```

## Gotchas hit during the first deploy

These are not in the original plan and bit us. Keep them in mind when tweaking infra.

### 1. Free-plan Durable Objects need `new_sqlite_classes`, not `new_classes`

The plan uses:

```toml
[[migrations]]
tag = "v1"
new_classes = ["GameRoom"]
```

On the free plan this fails with:

> In order to use Durable Objects with a free plan, you must create a namespace using a `new_sqlite_classes` migration. \[code: 10097]

Fix (currently in `worker/wrangler.toml`):

```toml
[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]
```

The DO API is identical from the worker's point of view. If we ever upgrade to the paid Workers plan and want classic storage, this can be migrated — but for now SQLite-backed is correct *and* cheaper.

### 2. `[[durable_objects.bindings]]` does not inherit into named envs

Top-level bindings in `wrangler.toml` are *not* automatically copied into `[env.production]`. Symptom — wrangler warns:

> "durable_objects" exists at the top level, but not on "env.production".

…and the deploy actually succeeds without the binding, leaving the production worker unable to find `GAME_ROOM`. The fix is to redeclare the binding under the env block:

```toml
[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[env.production]

[env.production.vars]
FRONTEND_ORIGINS = "https://juegoimpostor.app,https://www.juegoimpostor.app,https://el-impostor-djf.pages.dev"

[[env.production.durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"
```

The `[migrations]` block *does* inherit, so we don't duplicate it.

### 3. Pages domain auto-suffix when the slug is taken

`wrangler pages project create el-impostor` printed:

> Successfully created the 'el-impostor' project. It will be available at https://el-impostor-djf.pages.dev/

Cloudflare appended `-djf` because `el-impostor.pages.dev` was already taken by another tenant. The custom domain `https://juegoimpostor.app` is the canonical public URL; keep `https://el-impostor-djf.pages.dev` as a fallback allowed origin so old links still work.

### 4. `wrangler pages deploy` defaults `--branch` to your current git branch

Running `wrangler pages deploy frontend/dist --project-name el-impostor` from the `feat/multiplayer` branch tagged the deployment with that branch name. The result was that the build *was* live — but only at `https://feat-multiplayer.el-impostor-djf.pages.dev`. The canonical URL `https://el-impostor-djf.pages.dev` returned a Cloudflare "Deployment Not Found" page because the project's production branch is `main` and no main-tagged deployment existed yet.

Always pass `--branch main` (or whichever branch the Pages project considers production) when you want the deploy to be visible at the bare URL.

## Common troubleshooting

| Symptom                                                              | Likely cause                                                                                       | Fix                                                                                                  |
|----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Pages root URL shows "Deployment Not Found"                          | Last deploy went to a preview/branch alias                                                          | Redeploy with `--branch main`                                                                        |
| `POST /rooms` from the frontend → CORS error in browser              | `FRONTEND_ORIGINS` does not include the current origin exactly (trailing slash, http vs https, sub-domain)| Update `[env.production.vars].FRONTEND_ORIGINS` in `wrangler.toml`, run `npm run deploy:worker` |
| Frontend connects but never loads game state                          | `VITE_WORKER_URL` was empty at build time; client is hitting the wrong host                         | Rebuild with `VITE_WORKER_URL=https://el-impostor-worker-production.jvallejoarguez.workers.dev`      |
| Worker deploy errors with code `10097`                                | Migration uses `new_classes` on free plan                                                           | Switch to `new_sqlite_classes`                                                                       |
| Worker deploy succeeds but rooms can't be created (500 in DO call)    | DO binding missing under `[env.production]`                                                         | Add `[[env.production.durable_objects.bindings]]` block                                              |
| WS reconnect loop in production but not local                         | Watchdog firing because intermediary closes idle WS                                                 | Heartbeat is 20 s, watchdog 35 s — see `frontend/src/ws/useGameSocket.js`. Lower heartbeat if needed |

## Auth & secrets

- **Wrangler login:** `npx wrangler login` (interactive — opens a browser). `npx wrangler whoami` confirms the active account. The current login is the OAuth token stored in `~/Library/Preferences/.wrangler` for `jvallejoarguez@gmail.com`.
- **No secrets are required at runtime.** `FRONTEND_ORIGIN` is a plain var; everything else is anonymous. If we ever add secrets, prefer `wrangler secret put NAME --env production` over committing to `wrangler.toml`.

## Rollback

Cloudflare keeps the last N Pages deployments. To roll back:

```bash
npx wrangler pages deployment list --project-name el-impostor
# pick the previous deployment ID
# then in the dashboard → Pages → el-impostor → Deployments → "Rollback to this deployment"
```

There is no equivalent CLI rollback for Pages as of wrangler 3.114; the dashboard is the path of least resistance. For workers, redeploy from a known-good commit:

```bash
git checkout <good-sha>
npm run deploy:worker
```

## Cost & limits (free tier)

- **Workers:** 100k requests/day, 10ms CPU/request. Each WebSocket message counts as a request, but WS connections are billed as one request at open. With the heartbeat at 20 s, ~4,300 messages/day per active connection — comfortably inside the limit for a small player base.
- **Durable Objects (SQLite-backed):** 1 GB storage, 1M reads/day, 100k writes/day. State is small (≤2 KB per room) and writes happen on phase transitions, so we're nowhere near the cap.
- **Pages:** 500 builds/month, unlimited bandwidth on the free plan.

If costs ever start mattering, the most likely culprit is the watchdog/heartbeat creating excess WS messages — tune `HEARTBEAT_MS` in `frontend/src/ws/useGameSocket.js` first.

## Open follow-ups

- Pages preview deployments (anything not on `--branch main`) currently won't pass CORS unless their origin is added to `FRONTEND_ORIGINS`. If we want to preview branches, the worker would need to allow `*.el-impostor-djf.pages.dev` (regex) or fall back to a loose CORS policy in non-production envs.
