# El Impostor

Spanish-language social deduction word game (Among Us-style) for 3-12 players.
Real-time multiplayer over WebSockets. Anonymous play — no accounts.

## Stack
- **Frontend:** Vite 5 + React 18 (in `frontend/`)
- **Backend:** Cloudflare Workers + Durable Objects (in `worker/`)
- **Hosting:** Cloudflare Pages (frontend) + Cloudflare Workers (backend)

## Local Development

Prerequisites: Node 20+, Wrangler CLI (`npm i -g wrangler`), Cloudflare account.

```bash
npm install          # installs all workspaces
npm run dev          # starts wrangler dev (port 8787) + vite dev (port 3000) concurrently
```

Open http://localhost:3000 in 3 browser tabs to simulate 3 players.

## Deployment

```bash
npm run deploy:worker   # wrangler deploy (must run first)
npm run deploy:frontend # wrangler pages deploy frontend/dist
```

Set `FRONTEND_ORIGIN` environment variable in Cloudflare dashboard to your Pages URL.

## Project Structure

```
el-impostor/
├── frontend/src/
│   ├── app.jsx                  Main app, screen routing, WS state
│   ├── components/              Screen components (entry, lobby, game, vote, primitives)
│   ├── ws/useGameSocket.js      WebSocket hook — connects, reconnects, exposes send()
│   └── audio/soundManager.js   Howler.js SFX — call play("win") etc.
├── worker/src/
│   ├── index.js                 HTTP routing: POST /rooms, GET /rooms/:code/ws
│   ├── GameRoom.js              Durable Object — one per room, holds state + WS sessions
│   ├── gameLogic.js             Pure functions: applyJoin, applySubmitWord, etc.
│   └── words.json               60 Spanish word+hint pairs
└── worker/tests/
    └── gameLogic.test.js        Unit tests for all gameLogic functions
```

## Architecture Rules

1. **Privacy:** `impostorIdx`, `secretWord`, `hint` are NEVER sent in public `STATE` broadcasts.
   They travel only in private `ROLE` WebSocket messages to individual players.
2. **Server-authoritative:** All game state transitions happen in `GameRoom.js` by calling
   `gameLogic.js` functions. The frontend never mutates game state directly.
3. **Timers:** Turn timers and voting timers are Durable Object alarms (`ctx.storage.setAlarm`).
   Clients receive a `timerEnd` timestamp and render a local countdown. The server auto-advances
   on alarm fire regardless of whether the client acted.
4. **Reconnection:** Players reconnect with the same `playerId` (stored in `sessionStorage`).
   The server marks them `connected: true` and re-sends their `ROLE` message.

## WebSocket Message Protocol

Client → Server: `{ type, payload }`

| Type           | Payload                          | Notes                        |
|----------------|----------------------------------|------------------------------|
| JOIN           | `{ name, code, playerId }`       | First message on connect     |
| READY          | `{}`                             | Lobby only                   |
| UPDATE_RULES   | `{ rules: Partial<Rules> }`      | Owner only, lobby only       |
| START_GAME     | `{}`                             | Owner only, 3+ players ready |
| SUBMIT_WORD    | `{ word: string }`               | Active player's turn         |
| BETWEEN_VOTE   | `{ choice: "continue"\|"vote" }` | Between-round phase          |
| CAST_VOTE      | `{ targetId: string }`           | Voting phase                 |
| CONFIRM_VOTE   | `{}`                             | Lock in vote                 |
| PLAY_AGAIN     | `{}`                             | Results — any player         |
| BACK_TO_LOBBY  | `{}`                             | Results — owner only         |

Server → Client:

| Type      | Broadcast? | Payload                                   |
|-----------|------------|-------------------------------------------|
| STATE     | All        | Full public game state (no secrets)       |
| ROLE      | Private    | `{ isImpostor, word, hint }`              |
| ERROR     | Private    | `{ message: string }`                     |

## Sounds

Call `play(name)` from `soundManager.js`. Must call `initSounds()` once after first user interaction.

| Name          | Trigger                        |
|---------------|--------------------------------|
| tick          | Countdown each number          |
| roleImpostor  | Role reveal: you're impostor   |
| roleCrewmate  | Role reveal: you have word     |
| yourTurn      | It becomes your turn           |
| timerWarning  | Timer drops below 25%          |
| wordSubmit    | Any player submits a word      |
| voteCast      | You cast a vote                |
| win           | Impostor found (team wins)     |
| lose          | Impostor escapes               |
