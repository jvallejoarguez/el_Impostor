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

### Panel de administración

Correcciones del 3 de octubre de 2026: Worker `82741e9d-eb45-47fd-9ae8-d6ae10c5a04b`; Pages `https://0a8edff4.el-impostor-djf.pages.dev`, verificados en `juegoimpostor.app`. Versión de cliente `connection-2026-10-03`. Se evita el bucle de reconexión entre pestañas duplicadas, se da margen al heartbeat al volver de segundo plano y se reanuda al recuperar red. Los rechazos de entrada explican cómo actuar y envían un motivo explícito. El panel distingue las categorías de incidencias y muestra diagnósticos limitados para futuros errores JavaScript; los errores históricos no permiten reconstruir su causa.

Validación: 95 pruebas unitarias y 10 escenarios de navegador, incluida partida de tres jugadores y regresiones de pestaña duplicada, suspensión y recuperación de red. Los dos primeros fallaban con el código anterior. Build y 22 páginas SEO verificados. En producción se comprobó acceso privado, lectura del informe, panel en escritorio y móvil, ausencia de errores JS y de medición en administración, assets sin secretos y revocación al cerrar sesión. No se crearon partidas, opiniones ni eventos de prueba en producción. Evidencia en `.local/admin-error-production-verification.json`; assets de esta versión para localizar posiciones de errores en `.local/admin-error-release-connection-2026-10-03/`.

Publicado y verificado el 24 de septiembre de 2026 (reloj local): Worker `1a3c57ee-11fa-499d-8328-8f67fd684b47`; Pages `https://7e69a938.el-impostor-djf.pages.dev`. Dominio principal comprobado: login, informe de 30 días y feedback, rechazo 401 sin sesión en Pages y Worker, rechazo 403 de origen ajeno, cookie protegida, revocación al cerrar sesión, assets sin secretos y continuidad del informe de consola. Validación local: 91 pruebas unitarias y 7 escenarios de navegador (incluido el juego de tres jugadores). La comprobación de producción solo leyó métricas; no añadió partidas, opiniones ni eventos de prueba.

La cabecera y el reloj de producción devolvían el 25 de septiembre durante esta comprobación; el panel muestra esa fecha UTC y advierte del desfase con el dispositivo. Evidencia local sin claves: `.local/admin-production-verification.json`.

La migración `v3` añade `AdminAuth` sin modificar las salas. `functions/admin-panel/api/[[path]].js` se despliega con Pages desde la raíz del repositorio; no mover la ejecución de `wrangler pages deploy` a `frontend/`. El build de Vite genera una entrada independiente `admin-panel/index.html` sin scripts de consentimiento ni medición (el panel no mide navegación). La API privada tiene autenticación del lado del servidor y no comparte el CORS del juego.

Configurar `ADMIN_PASSWORD` antes de publicar el panel. Usar la clave existente de `.local/admin-password`; no regenerarla en cada despliegue. El secreto no es `INSIGHTS_READ_TOKEN`. Ejemplo para guardar una clave ya creada y verificada:

```bash
npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml --env production < .local/admin-password
npm run deploy:worker
npm run deploy:frontend
```

Para que el límite de intentos del login sea por visitante, configurar también la misma clave aleatoria `ADMIN_PROXY_KEY` en el Worker (`npx wrangler secret put ADMIN_PROXY_KEY --config worker/wrangler.toml --env production`) y como secreto del proyecto Pages `el-impostor` (Settings → Variables and Secrets, Production). Sin ella, Cloudflare sustituye `CF-Connecting-IP` en la subpetición del proxy y todos los visitantes comparten el mismo contador.

La clave debe tener al menos 32 caracteres aleatorios, estar fuera de Git y tener permisos 0600. Rotarla invalida sesiones anteriores. Comprobar el login y logout en el dominio principal, el rechazo 401 del informe sin cookie y la ausencia de credenciales en assets. La configuración local de Playwright usa exclusivamente una clave de prueba. Para desarrollo manual, usar `.dev.vars` o `--var ADMIN_PASSWORD:...` con una clave local, nunca la de producción.

Latest verified activation (2026-09-06): source `38a843b`; Worker version `a34bdb09-eda0-4df3-9cb9-136184bf12d0`; Pages deployment `https://22503182.el-impostor-djf.pages.dev`, served by the production custom domain. Migration `v2` and the private report secret are active. A real three-player game, feedback submission and authenticated report retrieval passed on the public deployment. Details and the technical test campaign are recorded in `docs/growth.md`.

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

**Actualización de crecimiento (septiembre de 2026):** la migración `v2` añade el Durable Object `ENGAGEMENT`. Desplegar el Worker antes de Pages. La ingesta no requiere secreto, pero consultar opiniones y métricas exige `INSIGHTS_READ_TOKEN`; configuración y uso en [growth.md](growth.md). No exponerlo como variable del frontend. El apartado original de abajo describe las credenciales del juego antes de esta incorporación.

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

- `www.juegoimpostor.app` and the `pages.dev` hosts are served with `X-Robots-Tag: noindex` (`frontend/public/_headers`), and their canonical tags point to the apex. Pages `_redirects` cannot redirect by hostname, so a true 301 from `www` needs a Cloudflare Redirect Rule (Rules → Redirect Rules: hostname equals `www.juegoimpostor.app` → `https://juegoimpostor.app${http.request.uri.path}`, 301, preserve query string).
- `POST /rooms` is limited to 10 per minute per IP through the `ROOM_LIMITER` rate-limit binding (`[[env.production.unsafe.bindings]]`). Workers Logs are enabled with `[observability]`.
