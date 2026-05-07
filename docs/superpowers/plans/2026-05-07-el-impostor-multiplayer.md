# El Impostor — Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the standalone React prototype into a real-time multiplayer web game with anonymous play, server-authoritative game logic, 9 sound effects, and full deployment on Cloudflare Pages + Workers.

**Architecture:** Cloudflare Pages hosts a Vite-built React 18 frontend; Cloudflare Workers with a Durable Object (`GameRoom`) hosts one stateful WebSocket server per active room. All game logic runs server-side in pure functions (`gameLogic.js`); the React frontend is a pure display layer that renders server state.

**Tech Stack:** Vite 5, React 18, Howler.js 2, Cloudflare Workers, Cloudflare Durable Objects, Vitest (for gameLogic unit tests), Wrangler 3 CLI, npm workspaces.

---

## File Map

Files to **create**:
- `CLAUDE.md` — project documentation
- `package.json` — root monorepo with npm workspaces
- `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`
- `frontend/src/main.jsx` — React mount point
- `frontend/src/styles.css` — moved from root `styles.css`
- `frontend/src/app.jsx` — refactored from root `app.jsx`
- `frontend/src/components/` — moved from root `components/`
- `frontend/src/ws/useGameSocket.js` — WebSocket hook
- `frontend/src/audio/soundManager.js` — Howler.js SFX manager
- `frontend/public/sounds/` — 9 × OGG + MP3 sound files
- `worker/package.json`, `worker/wrangler.toml`
- `worker/src/index.js` — Worker routing + CORS
- `worker/src/GameRoom.js` — Durable Object
- `worker/src/gameLogic.js` — pure state functions
- `worker/src/words.json` — 60 Spanish word+hint pairs
- `worker/tests/gameLogic.test.js` — Vitest unit tests
- `worker/vitest.config.js`

Files to **delete** after migration:
- Root-level `app.jsx`, `styles.css`, `components/` (after they are verified working from `frontend/`)
- Root-level HTML files (kept as reference; not entry points)

---

## Phase 1 — Scaffold

### Task 1: CLAUDE.md + Monorepo Setup

**Files:**
- Create: `CLAUDE.md`
- Create: `package.json`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/vitest.config.js`

- [ ] **Step 1: Create CLAUDE.md**

```markdown
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
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "el-impostor",
  "private": true,
  "workspaces": ["frontend", "worker"],
  "scripts": {
    "dev": "concurrently -n frontend,worker -c cyan,yellow \"npm run dev -w frontend\" \"npm run dev -w worker\"",
    "deploy:worker": "npm run deploy -w worker",
    "deploy:frontend": "npm run build -w frontend && wrangler pages deploy frontend/dist --project-name el-impostor"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 3: Create frontend/package.json**

```json
{
  "name": "el-impostor-frontend",
  "private": true,
  "scripts": {
    "dev": "vite --port 3000",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "howler": "^2.2.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 4: Create frontend/vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/rooms': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
```

The proxy forwards `/rooms/*` requests from Vite dev server to the local Wrangler worker, so no CORS issues in development.

- [ ] **Step 5: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>El Impostor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create frontend/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Create worker/package.json**

```json
{
  "name": "el-impostor-worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev --port 8787",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "devDependencies": {
    "wrangler": "^3.57.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 8: Create worker/wrangler.toml**

```toml
name = "el-impostor-worker"
main = "src/index.js"
compatibility_date = "2024-09-23"

[vars]
FRONTEND_ORIGIN = "http://localhost:3000"

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_classes = ["GameRoom"]
```

- [ ] **Step 9: Create worker/vitest.config.js**

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 10: Install dependencies**

Run from project root:
```bash
npm install
```

Expected: `node_modules` created at root, `frontend/node_modules` and `worker/node_modules` symlinked via workspaces.

- [ ] **Step 11: Commit**

```bash
git add CLAUDE.md package.json frontend/package.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx worker/package.json worker/wrangler.toml worker/vitest.config.js
git commit -m "feat: monorepo scaffold with Vite frontend and Wrangler worker"
```

---

### Task 2: Migrate Existing Frontend Files to Vite Structure

**Files:**
- Create: `frontend/src/styles.css` (copy of root `styles.css`)
- Create: `frontend/src/app.jsx` (copy of root `app.jsx` — will be refactored in Task 10)
- Create: `frontend/src/components/screens-entry.jsx`
- Create: `frontend/src/components/screens-lobby.jsx`
- Create: `frontend/src/components/screens-game.jsx`
- Create: `frontend/src/components/screens-vote.jsx`
- Create: `frontend/src/components/primitives.jsx`

- [ ] **Step 1: Copy existing source files into frontend/src/**

```bash
cp "styles.css" "frontend/src/styles.css"
cp "app.jsx" "frontend/src/app.jsx"
mkdir -p "frontend/src/components"
cp "components/screens-entry.jsx" "frontend/src/components/screens-entry.jsx"
cp "components/screens-lobby.jsx" "frontend/src/components/screens-lobby.jsx"
cp "components/screens-game.jsx" "frontend/src/components/screens-game.jsx"
cp "components/screens-vote.jsx" "frontend/src/components/screens-vote.jsx"
cp "components/primitives.jsx" "frontend/src/components/primitives.jsx"
```

- [ ] **Step 2: Fix import paths in app.jsx**

The existing `app.jsx` imports components as `./components/screens-entry`. In the new location (`frontend/src/app.jsx`) the relative path is the same, but verify the top of the file. It should read:

```javascript
import { HomeScreen, JoinScreen } from './components/screens-entry.jsx'
import { LobbyScreen, CountdownScreen } from './components/screens-lobby.jsx'
import { RoleRevealScreen, GameplayScreen } from './components/screens-game.jsx'
import { BetweenRoundScreen, VotingScreen, ResultsScreen } from './components/screens-vote.jsx'
```

If the imports already match this pattern, no change needed.

- [ ] **Step 3: Verify Vite builds without errors**

```bash
npm run build -w frontend
```

Expected output ends with:
```
✓ built in Xs
```
No TypeScript or import errors.

- [ ] **Step 4: Verify app runs in browser**

```bash
npm run dev -w frontend
```

Open http://localhost:3000 — should show the El Impostor home screen. Click through all screens using the dev screen jumper (bottom-left button). Verify the UI looks identical to the original HTML file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: migrate existing frontend to Vite structure"
```

---

## Phase 2 — Backend (TDD)

### Task 3: gameLogic Tests (Failing)

**Files:**
- Create: `worker/tests/gameLogic.test.js`
- Create: `worker/src/gameLogic.js` (empty stub — just exports so import doesn't fail)

- [ ] **Step 1: Create empty gameLogic.js stub**

```javascript
// worker/src/gameLogic.js
export function applyJoin(state, payload) { throw new Error('not implemented') }
export function applyReady(state, playerId) { throw new Error('not implemented') }
export function applyUpdateRules(state, { playerId, rules }) { throw new Error('not implemented') }
export function applyStartGame(state, wordPair) { throw new Error('not implemented') }
export function applySubmitWord(state, { playerId, word }) { throw new Error('not implemented') }
export function applyBetweenVote(state, { playerId, choice }) { throw new Error('not implemented') }
export function applyCastVote(state, { voterId, targetId }) { throw new Error('not implemented') }
export function applyConfirmVote(state, voterId) { throw new Error('not implemented') }
export function computeResult(state) { throw new Error('not implemented') }
```

- [ ] **Step 2: Create gameLogic.test.js**

```javascript
// worker/tests/gameLogic.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyJoin, applyReady, applyUpdateRules, applyStartGame,
  applySubmitWord, applyBetweenVote, applyCastVote,
  applyConfirmVote, computeResult,
} from '../src/gameLogic.js'

const makeState = (overrides = {}) => ({
  code: 'TEST',
  phase: 'lobby',
  players: [],
  rules: {
    turnTime: 30,
    roundsBeforeVote: 2,
    maxPlayers: 8,
    imposterHasHint: true,
    imposterWinsIfNotFound: true,
  },
  impostorIdx: null,
  secretWord: null,
  hint: null,
  activePlayerIdx: null,
  currentRound: null,
  wordHistory: [],
  votes: {},
  confirmedVotes: [],
  timerEnd: null,
  votingTimerEnd: null,
  betweenRoundVotes: { continue: [], vote: [] },
  result: null,
  ...overrides,
})

const makePlayer = (id, name, overrides = {}) => ({
  id, name, connected: true, ready: false, isOwner: false, ...overrides,
})

// ────────────────────────────────────────────────────────────────
// applyJoin
// ────────────────────────────────────────────────────────────────
describe('applyJoin', () => {
  it('adds the first player and makes them owner', () => {
    const state = makeState()
    const next = applyJoin(state, { id: 'p1', name: 'Ana', isOwner: true })
    expect(next.players).toHaveLength(1)
    expect(next.players[0]).toMatchObject({ id: 'p1', name: 'Ana', isOwner: true, ready: false, connected: true })
  })

  it('adds a second player as non-owner', () => {
    const state = makeState({ players: [makePlayer('p1', 'Ana', { isOwner: true })] })
    const next = applyJoin(state, { id: 'p2', name: 'Bob', isOwner: false })
    expect(next.players).toHaveLength(2)
    expect(next.players[1].isOwner).toBe(false)
  })

  it('reconnects an existing player by id', () => {
    const state = makeState({ players: [makePlayer('p1', 'Ana', { connected: false })] })
    const next = applyJoin(state, { id: 'p1', name: 'Ana', isOwner: false })
    expect(next.players).toHaveLength(1)
    expect(next.players[0].connected).toBe(true)
  })

  it('does not mutate the input state', () => {
    const state = makeState()
    Object.freeze(state)
    Object.freeze(state.players)
    expect(() => applyJoin(state, { id: 'p1', name: 'Ana', isOwner: true })).not.toThrow()
  })
})

// ────────────────────────────────────────────────────────────────
// applyReady
// ────────────────────────────────────────────────────────────────
describe('applyReady', () => {
  it('marks the player as ready', () => {
    const state = makeState({ players: [makePlayer('p1', 'Ana')] })
    const next = applyReady(state, 'p1')
    expect(next.players[0].ready).toBe(true)
  })

  it('does not affect other players', () => {
    const state = makeState({
      players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob')],
    })
    const next = applyReady(state, 'p1')
    expect(next.players[1].ready).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────
// applyUpdateRules
// ────────────────────────────────────────────────────────────────
describe('applyUpdateRules', () => {
  it('merges new rule values', () => {
    const state = makeState({ players: [makePlayer('p1', 'Ana', { isOwner: true })] })
    const next = applyUpdateRules(state, { playerId: 'p1', rules: { turnTime: 45 } })
    expect(next.rules.turnTime).toBe(45)
    expect(next.rules.roundsBeforeVote).toBe(2) // unchanged
  })

  it('ignores update from non-owner', () => {
    const state = makeState({ players: [makePlayer('p1', 'Ana', { isOwner: false })] })
    const next = applyUpdateRules(state, { playerId: 'p1', rules: { turnTime: 45 } })
    expect(next.rules.turnTime).toBe(30) // unchanged
  })
})

// ────────────────────────────────────────────────────────────────
// applyStartGame
// ────────────────────────────────────────────────────────────────
describe('applyStartGame', () => {
  const threeReadyPlayers = [
    makePlayer('p1', 'Ana', { isOwner: true, ready: true }),
    makePlayer('p2', 'Bob', { ready: true }),
    makePlayer('p3', 'Car', { ready: true }),
  ]

  it('transitions phase to countdown', () => {
    const state = makeState({ players: threeReadyPlayers })
    const next = applyStartGame(state, { word: 'Playa', hint: 'Lugar de vacaciones' })
    expect(next.phase).toBe('countdown')
  })

  it('assigns secretWord, hint, and a valid impostorIdx', () => {
    const state = makeState({ players: threeReadyPlayers })
    const next = applyStartGame(state, { word: 'Playa', hint: 'Lugar de vacaciones' })
    expect(next.secretWord).toBe('Playa')
    expect(next.hint).toBe('Lugar de vacaciones')
    expect(next.impostorIdx).toBeGreaterThanOrEqual(0)
    expect(next.impostorIdx).toBeLessThan(3)
  })

  it('does not start with fewer than 3 players', () => {
    const state = makeState({ players: threeReadyPlayers.slice(0, 2) })
    const next = applyStartGame(state, { word: 'Playa', hint: 'Lugar de vacaciones' })
    expect(next.phase).toBe('lobby') // unchanged
  })

  it('does not start when not all players are ready', () => {
    const notAllReady = [
      makePlayer('p1', 'Ana', { isOwner: true, ready: true }),
      makePlayer('p2', 'Bob', { ready: true }),
      makePlayer('p3', 'Car', { ready: false }), // not ready
    ]
    const state = makeState({ players: notAllReady })
    const next = applyStartGame(state, { word: 'Playa', hint: 'Lugar de vacaciones' })
    expect(next.phase).toBe('lobby')
  })
})

// ────────────────────────────────────────────────────────────────
// applySubmitWord
// ────────────────────────────────────────────────────────────────
describe('applySubmitWord', () => {
  const playingState = () => makeState({
    phase: 'playing',
    players: [
      makePlayer('p1', 'Ana'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Car'),
    ],
    activePlayerIdx: 0,
    currentRound: 1,
    impostorIdx: 2,
    secretWord: 'Playa',
    hint: 'Lugar de vacaciones',
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true, imposterWinsIfNotFound: true },
  })

  it('adds the word to wordHistory', () => {
    const state = playingState()
    const next = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    expect(next.wordHistory).toHaveLength(1)
    expect(next.wordHistory[0]).toMatchObject({ playerId: 'p1', word: 'arena', round: 1 })
  })

  it('advances activePlayerIdx to the next player', () => {
    const state = playingState()
    const next = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    expect(next.activePlayerIdx).toBe(1)
  })

  it('advances to betweenRound after all players speak and round < roundsBeforeVote', () => {
    // All players submit in round 1; roundsBeforeVote is 2
    let state = playingState()
    state = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    state = applySubmitWord(state, { playerId: 'p2', word: 'sol' })
    state = applySubmitWord(state, { playerId: 'p3', word: 'mar' })
    expect(state.phase).toBe('betweenRound')
  })

  it('advances to voting after all players speak and round >= roundsBeforeVote', () => {
    // roundsBeforeVote = 1 → voting after first round
    let state = playingState()
    state = { ...state, rules: { ...state.rules, roundsBeforeVote: 1 } }
    state = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    state = applySubmitWord(state, { playerId: 'p2', word: 'sol' })
    state = applySubmitWord(state, { playerId: 'p3', word: 'mar' })
    expect(state.phase).toBe('voting')
  })

  it('ignores submission from wrong player', () => {
    const state = playingState() // activePlayerIdx = 0 → p1's turn
    const next = applySubmitWord(state, { playerId: 'p2', word: 'sol' }) // p2 tries to submit
    expect(next.wordHistory).toHaveLength(0) // unchanged
    expect(next.activePlayerIdx).toBe(0) // unchanged
  })
})

// ────────────────────────────────────────────────────────────────
// applyBetweenVote
// ────────────────────────────────────────────────────────────────
describe('applyBetweenVote', () => {
  const betweenState = () => makeState({
    phase: 'betweenRound',
    players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob'), makePlayer('p3', 'Car')],
    currentRound: 1,
    betweenRoundVotes: { continue: [], vote: [] },
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true, imposterWinsIfNotFound: true },
    impostorIdx: 2,
    secretWord: 'Playa',
    hint: 'Lugar',
    wordHistory: [],
  })

  it('records a vote', () => {
    const state = betweenState()
    const next = applyBetweenVote(state, { playerId: 'p1', choice: 'continue' })
    expect(next.betweenRoundVotes.continue).toContain('p1')
  })

  it('transitions to playing when majority votes continue', () => {
    let state = betweenState()
    state = applyBetweenVote(state, { playerId: 'p1', choice: 'continue' })
    state = applyBetweenVote(state, { playerId: 'p2', choice: 'continue' })
    // 2/3 voted continue
    expect(state.phase).toBe('playing')
    expect(state.currentRound).toBe(2)
    expect(state.activePlayerIdx).toBe(0)
    expect(state.betweenRoundVotes).toEqual({ continue: [], vote: [] }) // reset
  })

  it('transitions to voting when majority votes vote', () => {
    let state = betweenState()
    state = applyBetweenVote(state, { playerId: 'p1', choice: 'vote' })
    state = applyBetweenVote(state, { playerId: 'p2', choice: 'vote' })
    expect(state.phase).toBe('voting')
  })
})

// ────────────────────────────────────────────────────────────────
// applyCastVote + applyConfirmVote
// ────────────────────────────────────────────────────────────────
describe('applyCastVote', () => {
  const votingState = () => makeState({
    phase: 'voting',
    players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob'), makePlayer('p3', 'Car')],
    votes: {},
    impostorIdx: 2,
    secretWord: 'Playa',
    hint: 'Lugar',
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true, imposterWinsIfNotFound: true },
  })

  it('records a vote', () => {
    const state = votingState()
    const next = applyCastVote(state, { voterId: 'p1', targetId: 'p3' })
    expect(next.votes['p1']).toBe('p3')
  })

  it('can change a vote', () => {
    let state = votingState()
    state = applyCastVote(state, { voterId: 'p1', targetId: 'p3' })
    state = applyCastVote(state, { voterId: 'p1', targetId: 'p2' })
    expect(state.votes['p1']).toBe('p2')
  })
})

describe('applyConfirmVote + computeResult', () => {
  const allVotedState = () => makeState({
    phase: 'voting',
    players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob'), makePlayer('p3', 'Car')],
    votes: { p1: 'p3', p2: 'p3', p3: 'p2' }, // majority votes for p3
    impostorIdx: 2, // p3 is the impostor
    secretWord: 'Playa',
    hint: 'Lugar',
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true, imposterWinsIfNotFound: true },
  })

  it('applyConfirmVote transitions to results when all players have confirmed', () => {
    let state = allVotedState()
    state = applyConfirmVote(state, 'p1')
    state = applyConfirmVote(state, 'p2')
    state = applyConfirmVote(state, 'p3')
    expect(state.phase).toBe('results')
    expect(state.result).not.toBeNull()
  })

  it('computeResult: impostor found when most-voted player is impostor', () => {
    const result = computeResult(allVotedState())
    expect(result.found).toBe(true)
    expect(result.impostorId).toBe('p3')
    expect(result.impostorName).toBe('Car')
    expect(result.tally).toEqual({ p2: 1, p3: 2 }) // p3 got 2 votes, p2 got 1
    expect(result.secretWord).toBe('Playa')
  })

  it('computeResult: impostor not found when most-voted is not impostor', () => {
    const state = makeState({
      phase: 'voting',
      players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob'), makePlayer('p3', 'Car')],
      votes: { p1: 'p2', p2: 'p2', p3: 'p1' }, // majority votes for p2, but p3 is impostor
      impostorIdx: 2,
      secretWord: 'Playa',
      hint: 'Lugar',
      rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true, imposterWinsIfNotFound: true },
    })
    const result = computeResult(state)
    expect(result.found).toBe(false)
    expect(result.impostorId).toBe('p3')
  })
})
```

- [ ] **Step 3: Run tests — verify they all fail**

```bash
npm run test -w worker
```

Expected: all tests fail with `Error: not implemented`. If they fail with any other error (import not found, syntax), fix the issue before proceeding.

- [ ] **Step 4: Commit**

```bash
git add worker/src/gameLogic.js worker/tests/gameLogic.test.js worker/vitest.config.js
git commit -m "test: add failing gameLogic unit tests (TDD)"
```

---

### Task 4: Implement gameLogic.js

**Files:**
- Modify: `worker/src/gameLogic.js`

- [ ] **Step 1: Replace gameLogic.js stub with full implementation**

```javascript
// worker/src/gameLogic.js

export function applyJoin(state, { id, name, isOwner }) {
  const existing = state.players.find(p => p.id === id)
  if (existing) {
    return { ...state, players: state.players.map(p => p.id === id ? { ...p, connected: true } : p) }
  }
  return {
    ...state,
    players: [...state.players, { id, name, connected: true, ready: false, isOwner: !!isOwner }],
  }
}

export function applyReady(state, playerId) {
  return {
    ...state,
    players: state.players.map(p => p.id === playerId ? { ...p, ready: true } : p),
  }
}

export function applyUpdateRules(state, { playerId, rules }) {
  const player = state.players.find(p => p.id === playerId)
  if (!player?.isOwner) return state
  return { ...state, rules: { ...state.rules, ...rules } }
}

export function applyStartGame(state, wordPair) {
  const connected = state.players.filter(p => p.connected)
  if (connected.length < 3) return state
  if (!connected.every(p => p.ready)) return state
  const impostorIdx = Math.floor(Math.random() * connected.length)
  return {
    ...state,
    phase: 'countdown',
    impostorIdx,
    secretWord: wordPair.word,
    hint: wordPair.hint,
    activePlayerIdx: null,
    currentRound: null,
    wordHistory: [],
    votes: {},
    votingTimerEnd: null,
    betweenRoundVotes: { continue: [], vote: [] },
    result: null,
  }
}

export function applySubmitWord(state, { playerId, word }) {
  const activePlayer = state.players[state.activePlayerIdx]
  if (activePlayer?.id !== playerId) return state

  const newHistory = [...state.wordHistory, { playerId, word, round: state.currentRound }]
  const nextActiveIdx = (state.activePlayerIdx + 1) % state.players.length
  const roundComplete = nextActiveIdx === 0

  if (!roundComplete) {
    return { ...state, wordHistory: newHistory, activePlayerIdx: nextActiveIdx }
  }

  // Round complete
  if (state.currentRound >= state.rules.roundsBeforeVote) {
    return {
      ...state,
      wordHistory: newHistory,
      activePlayerIdx: 0,
      phase: 'voting',
    }
  }

  return {
    ...state,
    wordHistory: newHistory,
    activePlayerIdx: 0,
    phase: 'betweenRound',
    betweenRoundVotes: { continue: [], vote: [] },
  }
}

export function applyBetweenVote(state, { playerId, choice }) {
  const alreadyVoted =
    state.betweenRoundVotes.continue.includes(playerId) ||
    state.betweenRoundVotes.vote.includes(playerId)
  if (alreadyVoted) return state

  const newVotes = {
    continue: choice === 'continue'
      ? [...state.betweenRoundVotes.continue, playerId]
      : state.betweenRoundVotes.continue,
    vote: choice === 'vote'
      ? [...state.betweenRoundVotes.vote, playerId]
      : state.betweenRoundVotes.vote,
  }

  const connectedCount = state.players.filter(p => p.connected).length
  const majority = Math.floor(connectedCount / 2) + 1

  if (newVotes.continue.length >= majority) {
    return {
      ...state,
      phase: 'playing',
      currentRound: state.currentRound + 1,
      activePlayerIdx: 0,
      betweenRoundVotes: { continue: [], vote: [] },
    }
  }

  if (newVotes.vote.length >= majority) {
    return {
      ...state,
      phase: 'voting',
      betweenRoundVotes: { continue: [], vote: [] },
    }
  }

  return { ...state, betweenRoundVotes: newVotes }
}

export function applyCastVote(state, { voterId, targetId }) {
  return { ...state, votes: { ...state.votes, [voterId]: targetId } }
}

export function applyConfirmVote(state, voterId) {
  const confirmed = (state.confirmedVotes || [])
  if (confirmed.includes(voterId)) return state
  const newConfirmed = [...confirmed, voterId]
  const connectedCount = state.players.filter(p => p.connected).length
  if (newConfirmed.length < connectedCount) {
    return { ...state, confirmedVotes: newConfirmed }
  }
  return {
    ...state,
    phase: 'results',
    confirmedVotes: [],
    result: computeResult(state),
  }
}

export function computeResult(state) {
  const tally = {}
  for (const targetId of Object.values(state.votes)) {
    tally[targetId] = (tally[targetId] || 0) + 1
  }

  const mostVotedId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
  const impostor = state.players[state.impostorIdx]
  const found = mostVotedId === impostor?.id

  return {
    found,
    impostorId: impostor?.id,
    impostorName: impostor?.name,
    tally,
    secretWord: state.secretWord,
  }
}
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
npm run test -w worker
```

Expected: all tests pass. If any fail, read the error carefully and fix the logic in `gameLogic.js`. Do not change tests to match wrong behavior.

- [ ] **Step 3: Commit**

```bash
git add worker/src/gameLogic.js
git commit -m "feat: implement gameLogic pure state functions (all tests pass)"
```

---

### Task 5: Worker HTTP Routing (index.js)

**Files:**
- Create: `worker/src/index.js`

- [ ] **Step 1: Create worker/src/index.js**

```javascript
// worker/src/index.js
import { GameRoom } from './GameRoom.js'

export { GameRoom }

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
  return code
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.FRONTEND_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = corsHeaders(env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // POST /rooms — create a new room, return its code
    if (request.method === 'POST' && url.pathname === '/rooms') {
      let code = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode()
        const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(candidate))
        const res = await stub.fetch(new Request('http://internal/exists'))
        const { active } = await res.json()
        if (!active) { code = candidate; break }
      }
      if (!code) {
        return new Response(JSON.stringify({ error: 'Could not generate room' }), {
          status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ code }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // GET /rooms/:code/ws — WebSocket upgrade, proxied to GameRoom DO
    const wsMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]{4})\/ws$/)
    if (wsMatch && request.headers.get('Upgrade') === 'websocket') {
      const code = wsMatch[1]
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
      return stub.fetch(request)
    }

    return new Response('Not Found', { status: 404, headers: cors })
  },
}
```

- [ ] **Step 2: Verify wrangler dev starts without errors**

```bash
npm run dev -w worker
```

Expected output includes:
```
⎔ Starting local server...
[mf:inf] Ready on http://localhost:8787
```

No `SyntaxError` or import errors.

- [ ] **Step 3: Smoke test room creation**

In a new terminal while wrangler dev is running:
```bash
curl -s -X POST http://localhost:8787/rooms -H "Content-Type: application/json" | jq
```

Expected:
```json
{ "code": "ABCD" }
```
(Code will differ each run, 4 uppercase alphanumeric chars.)

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: worker HTTP routing — POST /rooms and WS upgrade"
```

---

### Task 6: GameRoom Durable Object

**Files:**
- Create: `worker/src/GameRoom.js`
- Create: `worker/src/words.json`

- [ ] **Step 1: Create worker/src/words.json**

```json
[
  {"word":"Playa","hint":"Lugar de vacaciones"},
  {"word":"Pizza","hint":"Comida popular"},
  {"word":"Fútbol","hint":"Deporte en equipo"},
  {"word":"Navidad","hint":"Fecha festiva"},
  {"word":"Guitarra","hint":"Instrumento musical"},
  {"word":"León","hint":"Animal salvaje"},
  {"word":"Médico","hint":"Profesión de salud"},
  {"word":"Avión","hint":"Medio de transporte aéreo"},
  {"word":"Volcán","hint":"Montaña que erupciona"},
  {"word":"Biblioteca","hint":"Lugar con libros"},
  {"word":"Sushi","hint":"Comida japonesa"},
  {"word":"Mariposa","hint":"Insecto con alas"},
  {"word":"Desierto","hint":"Zona árida y seca"},
  {"word":"Circo","hint":"Espectáculo con acrobacias"},
  {"word":"Pulpo","hint":"Animal marino con tentáculos"},
  {"word":"Tren","hint":"Transporte sobre rieles"},
  {"word":"Chocolate","hint":"Dulce de cacao"},
  {"word":"Cactus","hint":"Planta del desierto"},
  {"word":"Castillo","hint":"Construcción medieval"},
  {"word":"Tornado","hint":"Viento giratorio violento"},
  {"word":"Pingüino","hint":"Ave marina que no vuela"},
  {"word":"Hospital","hint":"Lugar de atención médica"},
  {"word":"Café","hint":"Bebida caliente popular"},
  {"word":"Cohete","hint":"Nave espacial"},
  {"word":"Ballena","hint":"Mamífero marino grande"},
  {"word":"Selva","hint":"Bosque tropical denso"},
  {"word":"Diamante","hint":"Piedra preciosa"},
  {"word":"Carnaval","hint":"Fiesta con disfraces"},
  {"word":"Telescopio","hint":"Instrumento para ver estrellas"},
  {"word":"Relámpago","hint":"Descarga eléctrica en tormenta"},
  {"word":"Mercado","hint":"Lugar para comprar alimentos"},
  {"word":"Camello","hint":"Animal del desierto con joroba"},
  {"word":"Pirata","hint":"Ladrón del mar"},
  {"word":"Helado","hint":"Postre frío y dulce"},
  {"word":"Submarino","hint":"Nave que navega bajo el agua"},
  {"word":"Tifón","hint":"Tormenta tropical"},
  {"word":"Ballet","hint":"Danza clásica con puntas"},
  {"word":"Faro","hint":"Torre de luz en la costa"},
  {"word":"Muralla","hint":"Pared defensiva gigante"},
  {"word":"Pulsar","hint":"Estrella de neutrones rotatoria"},
  {"word":"Samurái","hint":"Guerrero japonés"},
  {"word":"Terremoto","hint":"Temblor de la tierra"},
  {"word":"Acuario","hint":"Lugar con peces en exhibición"},
  {"word":"Brújula","hint":"Instrumento de orientación"},
  {"word":"Corrida","hint":"Espectáculo con toros"},
  {"word":"Dragón","hint":"Criatura mítica que escupe fuego"},
  {"word":"Eclipse","hint":"El sol o la luna se oscurece"},
  {"word":"Flamenco","hint":"Baile tradicional español"},
  {"word":"Glaciar","hint":"Masa de hielo que avanza"},
  {"word":"Huracán","hint":"Tormenta tropical de gran escala"},
  {"word":"Iglú","hint":"Refugio de hielo"},
  {"word":"Jirafa","hint":"Animal con cuello largo"},
  {"word":"Koala","hint":"Marsupial australiano"},
  {"word":"Laberinto","hint":"Lugar con muchos caminos"},
  {"word":"Momia","hint":"Cuerpo preservado del Egipto antiguo"},
  {"word":"Noria","hint":"Rueda gigante de feria"},
  {"word":"Ópera","hint":"Espectáculo musical cantado"},
  {"word":"Paella","hint":"Plato típico valenciano"},
  {"word":"Queso","hint":"Alimento derivado de la leche"},
  {"word":"Rascacielos","hint":"Edificio muy alto"},
  {"word":"Taco","hint":"Comida típica mexicana"}
]
```

- [ ] **Step 2: Create worker/src/GameRoom.js**

```javascript
// worker/src/GameRoom.js
import {
  applyJoin, applyReady, applyUpdateRules, applyStartGame,
  applySubmitWord, applyBetweenVote, applyCastVote,
  applyConfirmVote, computeResult,
} from './gameLogic.js'
import words from './words.json'

const INITIAL_STATE = (code) => ({
  code,
  phase: 'lobby',
  players: [],
  rules: {
    turnTime: 30,
    roundsBeforeVote: 2,
    maxPlayers: 8,
    imposterHasHint: true,
    imposterWinsIfNotFound: true,
  },
  impostorIdx: null,
  secretWord: null,
  hint: null,
  activePlayerIdx: null,
  currentRound: null,
  wordHistory: [],
  votes: {},
  confirmedVotes: [],
  timerEnd: null,       // Unix timestamp — broadcast to clients for countdown rendering
  votingTimerEnd: null,
  betweenRoundVotes: { continue: [], vote: [] },
  result: null,
})

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    // sessions: Map<playerId, WebSocket>
    this.sessions = new Map()
    this.state = null
  }

  async fetch(request) {
    const url = new URL(request.url)

    // Internal health/exists check from Worker routing
    if (url.pathname === '/exists') {
      return Response.json({ active: this.state !== null && this.state.phase !== 'lobby' || this.sessions.size > 0 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // Called by the Workers runtime for each incoming WS message
  async webSocketMessage(ws, rawMessage) {
    let msg
    try { msg = JSON.parse(rawMessage) } catch { return }

    const playerId = this._playerIdForWs(ws)

    switch (msg.type) {
      case 'JOIN':
        await this._handleJoin(ws, msg.payload)
        break
      case 'READY':
        if (playerId) { this.state = applyReady(this.state, playerId); this._broadcast() }
        break
      case 'UPDATE_RULES':
        if (playerId) { this.state = applyUpdateRules(this.state, { playerId, rules: msg.payload.rules }); this._broadcast() }
        break
      case 'START_GAME':
        if (playerId) await this._handleStartGame(playerId)
        break
      case 'SUBMIT_WORD':
        if (playerId) await this._handleSubmitWord(playerId, msg.payload)
        break
      case 'BETWEEN_VOTE':
        if (playerId) { this.state = applyBetweenVote(this.state, { playerId, choice: msg.payload.choice }); this._broadcast() }
        break
      case 'CAST_VOTE':
        if (playerId) { this.state = applyCastVote(this.state, { voterId: playerId, targetId: msg.payload.targetId }); this._broadcast() }
        break
      case 'CONFIRM_VOTE':
        if (playerId) await this._handleConfirmVote(playerId)
        break
      case 'PLAY_AGAIN':
        if (playerId) await this._handlePlayAgain()
        break
      case 'BACK_TO_LOBBY':
        if (playerId) this._handleBackToLobby(playerId)
        break
    }
  }

  async webSocketClose(ws) {
    const playerId = this._playerIdForWs(ws)
    if (!playerId || !this.state) return
    this.sessions.delete(playerId)
    this.state = {
      ...this.state,
      players: this.state.players.map(p => p.id === playerId ? { ...p, connected: false } : p),
    }
    // Transfer ownership if owner left during lobby
    if (this.state.phase === 'lobby') {
      const wasOwner = this.state.players.find(p => p.id === playerId)?.isOwner
      if (wasOwner) {
        const nextOwner = this.state.players.find(p => p.connected)
        if (nextOwner) {
          this.state = {
            ...this.state,
            players: this.state.players.map(p => ({ ...p, isOwner: p.id === nextOwner.id })),
          }
        }
      }
    }
    this._broadcast()
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws)
  }

  // Durable Object alarm — fires at timerEnd for the active phase
  async alarm() {
    if (!this.state) return
    switch (this.state.phase) {
      case 'countdown':
        // Advance to roleReveal and send private ROLE messages
        this.state = { ...this.state, phase: 'roleReveal' }
        this._sendRoleMessages()
        this._broadcast()
        await this.ctx.storage.setAlarm(Date.now() + 6000)
        break

      case 'roleReveal': {
        // Advance to first turn of playing — set timerEnd so clients can render countdown
        const firstTurnEnd = Date.now() + this.state.rules.turnTime * 1000
        this.state = { ...this.state, phase: 'playing', activePlayerIdx: 0, currentRound: 1, timerEnd: firstTurnEnd }
        this._broadcast()
        await this.ctx.storage.setAlarm(firstTurnEnd)
        break
      }

      case 'playing': {
        // Auto-submit "..." for the player who timed out
        const activePlayer = this.state.players[this.state.activePlayerIdx]
        if (activePlayer) {
          this.state = applySubmitWord(this.state, { playerId: activePlayer.id, word: '...' })
          if (this.state.phase === 'playing') {
            const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
            this.state = { ...this.state, timerEnd: nextTurnEnd }
            this._broadcast()
            await this.ctx.storage.setAlarm(nextTurnEnd)
          } else {
            this._broadcast()
          }
        }
        break
      }

      case 'voting':
        // Time's up — compute result with current votes
        this.state = { ...this.state, phase: 'results', result: computeResult(this.state) }
        this._broadcast()
        break
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  async _handleJoin(ws, { name, code, playerId }) {
    // Initialize room state on first join
    if (!this.state) {
      this.state = INITIAL_STATE(code)
    }

    const existing = this.state.players.find(p => p.id === playerId)
    if (existing) {
      // Reconnect
      this.sessions.set(playerId, ws)
      this.state = applyJoin(this.state, { id: playerId, name, isOwner: existing.isOwner })
      // Re-send ROLE if game is in progress
      if (['roleReveal', 'playing', 'betweenRound', 'voting', 'results'].includes(this.state.phase)) {
        this._sendRoleTo(playerId, ws)
      }
    } else {
      // New player
      if (this.state.phase !== 'lobby') {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Partida en curso, no puedes unirte' } }))
        ws.close()
        return
      }
      if (this.state.players.filter(p => p.connected).length >= this.state.rules.maxPlayers) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Sala llena' } }))
        ws.close()
        return
      }
      const isOwner = this.state.players.length === 0
      this.sessions.set(playerId, ws)
      this.state = applyJoin(this.state, { id: playerId, name, isOwner })
    }

    this._broadcast()
  }

  async _handleStartGame(playerId) {
    const player = this.state?.players.find(p => p.id === playerId)
    if (!player?.isOwner) return
    const wordPair = words[Math.floor(Math.random() * words.length)]
    this.state = applyStartGame(this.state, wordPair)
    if (this.state.phase !== 'countdown') return // guard: requirements not met
    this._broadcast()
    // Alarm fires after 4s → sends ROLE messages + advances to roleReveal
    await this.ctx.storage.setAlarm(Date.now() + 4000)
  }

  async _handleSubmitWord(playerId, { word }) {
    this.state = applySubmitWord(this.state, { playerId, word: word?.trim().slice(0, 20) || '...' })
    if (this.state.phase === 'playing') {
      const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
      this.state = { ...this.state, timerEnd: nextTurnEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(nextTurnEnd)
    } else {
      // Phase changed (betweenRound or voting) — cancel turn alarm
      await this.ctx.storage.deleteAlarm()
      if (this.state.phase === 'voting') {
        const voteEnd = Date.now() + 30000
        this.state = { ...this.state, timerEnd: null, votingTimerEnd: voteEnd }
        await this.ctx.storage.setAlarm(voteEnd)
      } else {
        this.state = { ...this.state, timerEnd: null }
      }
      this._broadcast()
    }
  }

  async _handleConfirmVote(playerId) {
    this.state = applyConfirmVote(this.state, playerId)
    this._broadcast()
    if (this.state.phase === 'results') {
      await this.ctx.storage.deleteAlarm()
    }
  }

  _handleBackToLobby(playerId) {
    const player = this.state?.players.find(p => p.id === playerId)
    if (!player?.isOwner) return
    this.state = {
      ...INITIAL_STATE(this.state.code),
      players: this.state.players
        .filter(p => p.connected)
        .map((p, i) => ({ ...p, ready: false, isOwner: i === 0 })),
      rules: this.state.rules, // keep current rules
    }
    this._broadcast()
  }

  async _handlePlayAgain() {
    // Any player can trigger — resets game but keeps connected players
    const wordPair = words[Math.floor(Math.random() * words.length)]
    this.state = {
      ...INITIAL_STATE(this.state.code),
      players: this.state.players
        .filter(p => p.connected)
        .map((p, i) => ({ ...p, ready: false, isOwner: i === 0 })),
      rules: this.state.rules,
      phase: 'lobby',
    }
    this._broadcast()
  }

  _sendRoleMessages() {
    this.state.players.forEach((player, idx) => {
      const ws = this.sessions.get(player.id)
      if (ws) this._sendRoleTo(player.id, ws, idx)
    })
  }

  _sendRoleTo(playerId, ws, idxOverride) {
    const idx = idxOverride ?? this.state.players.findIndex(p => p.id === playerId)
    const isImpostor = idx === this.state.impostorIdx
    ws.send(JSON.stringify({
      type: 'ROLE',
      payload: {
        isImpostor,
        word: isImpostor ? null : this.state.secretWord,
        hint: isImpostor
          ? (this.state.rules.imposterHasHint ? this.state.hint : null)
          : this.state.hint,
      },
    }))
  }

  _broadcast() {
    const msg = JSON.stringify({ type: 'STATE', payload: this._publicState() })
    for (const ws of this.sessions.values()) {
      try { ws.send(msg) } catch {}
    }
  }

  _publicState() {
    // Strip private fields before broadcasting
    const { impostorIdx, secretWord, hint, ...pub } = this.state
    return pub
  }

  _playerIdForWs(ws) {
    for (const [id, socket] of this.sessions) {
      if (socket === ws) return id
    }
    return null
  }
}
```

- [ ] **Step 3: Restart wrangler dev and verify WebSocket connects**

```bash
npm run dev -w worker
```

In a new terminal, test with wscat (install if needed: `npm i -g wscat`):
```bash
wscat -c "ws://localhost:8787/rooms/TEST/ws"
```

Then send:
```json
{"type":"JOIN","payload":{"name":"Ana","code":"TEST","playerId":"player-001"}}
```

Expected response:
```json
{"type":"STATE","payload":{"code":"TEST","phase":"lobby","players":[{"id":"player-001","name":"Ana","connected":true,"ready":false,"isOwner":true}],...}}
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/GameRoom.js worker/src/words.json
git commit -m "feat: GameRoom Durable Object with full game state machine"
```

---

## Phase 3 — Frontend Wire-Up

### Task 7: useGameSocket Hook

**Files:**
- Create: `frontend/src/ws/useGameSocket.js`

- [ ] **Step 1: Create frontend/src/ws/useGameSocket.js**

```javascript
// frontend/src/ws/useGameSocket.js
import { useState, useEffect, useRef, useCallback } from 'react'

function getOrCreatePlayerId() {
  const key = 'el-impostor-player-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || ''
// In dev, Vite proxies /rooms → localhost:8787, so WORKER_BASE is empty.
// In production, set VITE_WORKER_URL=https://el-impostor-worker.<account>.workers.dev

export function useGameSocket() {
  const [gameState, setGameState] = useState(null)
  const [myRole, setMyRole] = useState(null)     // { isImpostor, word, hint }
  const [connectionState, setConnectionState] = useState('disconnected')
  const [lastError, setLastError] = useState(null)

  const wsRef = useRef(null)
  const retryTimerRef = useRef(null)
  const retryCountRef = useRef(0)
  const activeCodeRef = useRef(null)
  const activeNameRef = useRef(null)
  const myId = getOrCreatePlayerId()

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const connect = useCallback((code, name) => {
    activeCodeRef.current = code
    activeNameRef.current = name
    retryCountRef.current = 0
    _openConnection(code, name)
  }, [])

  const disconnect = useCallback(() => {
    activeCodeRef.current = null
    activeNameRef.current = null
    clearTimeout(retryTimerRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setGameState(null)
    setMyRole(null)
    setConnectionState('disconnected')
  }, [])

  function _openConnection(code, name) {
    clearTimeout(retryTimerRef.current)
    const wsUrl = `${WORKER_BASE.replace(/^http/, 'ws')}/rooms/${code}/ws`
    setConnectionState('connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      retryCountRef.current = 0
      setConnectionState('connected')
      ws.send(JSON.stringify({ type: 'JOIN', payload: { name, code, playerId: myId } }))
    }

    ws.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      switch (msg.type) {
        case 'STATE':
          setGameState(msg.payload)
          break
        case 'ROLE':
          setMyRole(msg.payload)
          break
        case 'ERROR':
          setLastError(msg.payload.message)
          break
      }
    }

    ws.onclose = () => {
      setConnectionState('disconnected')
      if (activeCodeRef.current && activeNameRef.current) {
        // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(
          () => _openConnection(activeCodeRef.current, activeNameRef.current),
          delay,
        )
      }
    }

    ws.onerror = () => ws.close()
  }

  useEffect(() => () => {
    clearTimeout(retryTimerRef.current)
    wsRef.current?.close()
  }, [])

  return { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/ws/useGameSocket.js
git commit -m "feat: useGameSocket hook with connect, send, and exponential backoff reconnect"
```

---

### Task 8: Refactor app.jsx

**Files:**
- Modify: `frontend/src/app.jsx`

The current `app.jsx` is ~535 lines. This task removes ~200 lines of fake-player simulation and replaces in-memory state mutations with WebSocket calls. The screen component tree stays identical.

- [ ] **Step 1: Identify the blocks to remove**

Open `frontend/src/app.jsx`. Find and note the line numbers of these sections (search by name):
- `const FAKE_WORDS` — hardcoded fake word arrays
- `WORD_PAIRS` — hardcoded word pairs
- `useFakePlayers` — the hook that simulates other players
- All `setTimeout` chains simulating ready-up, word submission, voting
- The `initGame()` function that builds fake state and calls `setRoom`

- [ ] **Step 2: Replace app.jsx contents**

Replace the entire file with the following. This preserves all screen components and routing logic while replacing state management with the WebSocket hook:

```jsx
// frontend/src/app.jsx
import React, { useState, useCallback } from 'react'
import { HomeScreen, JoinScreen } from './components/screens-entry.jsx'
import { LobbyScreen, CountdownScreen } from './components/screens-lobby.jsx'
import { RoleRevealScreen, GameplayScreen } from './components/screens-game.jsx'
import { BetweenRoundScreen, VotingScreen, ResultsScreen } from './components/screens-vote.jsx'
import { useGameSocket } from './ws/useGameSocket.js'
import { initSounds } from './audio/soundManager.js'

// Theming defaults (keep existing theme system intact)
const DEFAULT_THEME = {
  primaryColor: '#E63946',
  logoVariant: 'stacked',
  avatarStyle: 'blob',
  circleLayout: 'orbit',
  revealStyle: 'flash',
  fontFamily: 'archivo',
  darkMode: false,
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [theme, setTheme] = useState(DEFAULT_THEME)

  const { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send } =
    useGameSocket()

  // Derived values
  const phase = gameState?.phase ?? null
  const myPlayer = gameState?.players?.find(p => p.id === myId) ?? null
  const amOwner = myPlayer?.isOwner ?? false

  // ── Navigation helpers ────────────────────────────────────────

  const handleSoundsInit = useCallback(() => {
    initSounds() // must be called from a user interaction
  }, [])

  const handleCreateRoom = useCallback(async (name) => {
    handleSoundsInit()
    setPlayerName(name)
    try {
      const res = await fetch('/rooms', { method: 'POST' })
      const { code } = await res.json()
      setRoomCode(code)
      connect(code, name)
      setScreen('lobby')
    } catch {
      setJoinError('No se pudo crear la sala. Inténtalo de nuevo.')
    }
  }, [connect, handleSoundsInit])

  const handleJoinRoom = useCallback((name, code) => {
    handleSoundsInit()
    setPlayerName(name)
    setRoomCode(code)
    setJoinError(null)
    connect(code, name)
    setScreen('lobby')
  }, [connect, handleSoundsInit])

  const handleLeaveRoom = useCallback(() => {
    disconnect()
    setScreen('home')
    setRoomCode('')
    setPlayerName('')
  }, [disconnect])

  // ── Game actions (delegate to server via send()) ──────────────

  const handleReady = useCallback(() => send('READY'), [send])
  const handleUpdateRules = useCallback((rules) => send('UPDATE_RULES', { rules }), [send])
  const handleStartGame = useCallback(() => send('START_GAME'), [send])
  const handleSubmitWord = useCallback((word) => send('SUBMIT_WORD', { word }), [send])
  const handleBetweenVote = useCallback((choice) => send('BETWEEN_VOTE', { choice }), [send])
  const handleCastVote = useCallback((targetId) => send('CAST_VOTE', { targetId }), [send])
  const handleConfirmVote = useCallback(() => send('CONFIRM_VOTE'), [send])
  const handlePlayAgain = useCallback(() => send('PLAY_AGAIN'), [send])
  const handleBackToLobby = useCallback(() => send('BACK_TO_LOBBY'), [send])

  // ── Screen routing ────────────────────────────────────────────
  // Map server phase to the appropriate screen component.
  // 'home' and 'join' are local-only (no server phase yet).

  if (screen === 'home') {
    return (
      <HomeScreen
        theme={theme}
        onCreateRoom={() => setScreen('create')}
        onJoinRoom={() => setScreen('join')}
      />
    )
  }

  if (screen === 'create') {
    return (
      <HomeScreen
        theme={theme}
        mode="create"
        onSubmitName={handleCreateRoom}
        onBack={() => setScreen('home')}
      />
    )
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        theme={theme}
        error={joinError || lastError}
        onJoin={handleJoinRoom}
        onBack={() => setScreen('home')}
      />
    )
  }

  // From here on, we need gameState
  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Space Grotesk, sans-serif' }}>
        {connectionState === 'connecting' ? 'Conectando...' : 'Desconectado — reconectando...'}
      </div>
    )
  }

  switch (phase) {
    case 'lobby':
      return (
        <LobbyScreen
          theme={theme}
          room={{ ...gameState, code: roomCode }}
          myId={myId}
          amOwner={amOwner}
          onReady={handleReady}
          onUpdateRules={handleUpdateRules}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
        />
      )

    case 'countdown':
      return <CountdownScreen theme={theme} />

    case 'roleReveal':
      return (
        <RoleRevealScreen
          theme={theme}
          myRole={myRole}
          revealStyle={theme.revealStyle}
        />
      )

    case 'playing':
      return (
        <GameplayScreen
          theme={theme}
          room={gameState}
          myId={myId}
          myRole={myRole}
          onSubmitWord={handleSubmitWord}
        />
      )

    case 'betweenRound':
      return (
        <BetweenRoundScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onVote={handleBetweenVote}
        />
      )

    case 'voting':
      return (
        <VotingScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onCastVote={handleCastVote}
          onConfirmVote={handleConfirmVote}
        />
      )

    case 'results':
      return (
        <ResultsScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={amOwner ? handleBackToLobby : undefined}
        />
      )

    default:
      return null
  }
}
```

- [ ] **Step 3: Run the app and verify screens render**

Start both dev servers:
```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Home screen loads
- "Crear sala" button calls `POST /rooms` (check Network tab → should return a code)
- After creating, page shows "Conectando..." then the Lobby screen
- Open a second tab at http://localhost:3000 and join with the same code

If the screen components receive different props than expected (e.g., `room` vs separate props), adjust the prop names in the screen components to match the new signatures. The screen components were written for the fake state — their prop API may need minor adjustments. Fix any prop mismatches now.

- [ ] **Step 4: Play a full game in 3 tabs**

- Tab 1: Create room → goes to lobby
- Tab 2: Join with same code → appears in lobby
- Tab 3: Join with same code → appears in lobby
- All 3 mark ready → owner clicks Start → countdown appears simultaneously in all tabs
- Role reveal appears in all 3 tabs (each tab may show different role text)
- Gameplay screen: submit a word → all tabs see the word bubble appear
- Vote → results show correctly

If any phase transition doesn't work, check the browser WebSocket frames (DevTools → Network → WS tab) to trace the STATE messages.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app.jsx
git commit -m "feat: refactor app.jsx to use WebSocket state — remove fake player simulation"
```

---

## Phase 4 — Sound

### Task 9: Source Sound Files

**Files:**
- Create: `frontend/public/sounds/` (directory with 18 audio files — 9 × OGG + 9 × MP3)

- [ ] **Step 1: Download Kenney Interface Sounds pack**

Go to https://kenney.nl/assets/interface-sounds and download the free pack (ZIP).
Extract it. Inside the `Audio/` folder you'll find dozens of `.ogg` files.

**Note:** Kenney pack filenames are numbered (e.g., `click_001.ogg` through `click_005.ogg`). Listen to each variant and pick the best fit. The table below is a starting suggestion — adjust based on what sounds right.

Copy to `frontend/public/sounds/`, renaming as shown:

| Suggested source (listen and pick best) | Destination filename |
|-----------------------------------------|----------------------|
| `click_002.ogg` or `click_003.ogg` | `tick.ogg` |
| `confirmation_002.ogg` | `your-turn.ogg` |
| `notification_001.ogg` | `role-crewmate.ogg` |
| `error_005.ogg` or `error_004.ogg` | `timer-warning.ogg` |
| `minimize_006.ogg` or `maximize_001.ogg` | `word-submit.ogg` |

- [ ] **Step 2: Download Kenney UI Audio pack for remaining sounds**

Go to https://kenney.nl/assets/ui-audio and download. Listen and pick the best fit:

| Suggested source | Destination |
|-----------------|-------------|
| `switch_002.ogg` or any short thud/stamp | `vote-cast.ogg` |

- [ ] **Step 3: Download dramatic stings from Freesound.org (CC0)**

For the 3 remaining sounds, search freesound.org with the filter "License: Creative Commons 0":

| Search term | Expected result | Destination |
|------------|-----------------|-------------|
| `"horror sting short"` CC0 | 1-2s dramatic hit | `role-impostor.ogg` |
| `"fanfare short game"` CC0 | 2-3s win jingle | `win.ogg` |
| `"fail game over"` CC0 | 1-2s descending sting | `lose.ogg` |

Download as OGG. If OGG is not available, download MP3 and convert with ffmpeg:
```bash
ffmpeg -i input.mp3 -c:a libvorbis -q:a 4 output.ogg
```

- [ ] **Step 4: Create MP3 fallbacks for all 9 sounds**

```bash
cd frontend/public/sounds
for f in *.ogg; do
  ffmpeg -i "$f" -c:a libmp3lame -q:a 4 "${f%.ogg}.mp3"
done
```

Expected: 18 files in `frontend/public/sounds/` (9 OGG + 9 MP3).

- [ ] **Step 5: Commit**

```bash
git add frontend/public/sounds/
git commit -m "feat: add 9 CC0 sound effects for game events"
```

---

### Task 10: soundManager.js + Wire Sound Triggers

**Files:**
- Create: `frontend/src/audio/soundManager.js`
- Modify: `frontend/src/components/screens-lobby.jsx` (countdown ticks)
- Modify: `frontend/src/components/screens-game.jsx` (role reveal, your turn, timer warning, word submit)
- Modify: `frontend/src/components/screens-vote.jsx` (vote cast, win, lose)

- [ ] **Step 1: Create frontend/src/audio/soundManager.js**

```javascript
// frontend/src/audio/soundManager.js
import { Howl, Howler } from 'howler'

let initialized = false
const sounds = {}

const MANIFEST = {
  tick:          ['/sounds/tick.ogg',           '/sounds/tick.mp3'],
  roleImpostor:  ['/sounds/role-impostor.ogg',  '/sounds/role-impostor.mp3'],
  roleCrewmate:  ['/sounds/role-crewmate.ogg',  '/sounds/role-crewmate.mp3'],
  yourTurn:      ['/sounds/your-turn.ogg',      '/sounds/your-turn.mp3'],
  timerWarning:  ['/sounds/timer-warning.ogg',  '/sounds/timer-warning.mp3'],
  wordSubmit:    ['/sounds/word-submit.ogg',     '/sounds/word-submit.mp3'],
  voteCast:      ['/sounds/vote-cast.ogg',       '/sounds/vote-cast.mp3'],
  win:           ['/sounds/win.ogg',             '/sounds/win.mp3'],
  lose:          ['/sounds/lose.ogg',            '/sounds/lose.mp3'],
}

export function initSounds() {
  if (initialized) return
  initialized = true
  Howler.volume(0.7)
  for (const [name, src] of Object.entries(MANIFEST)) {
    sounds[name] = new Howl({ src, preload: true })
  }
}

export function play(name) {
  if (!initialized || !sounds[name]) return
  sounds[name].play()
}
```

- [ ] **Step 2: Add tick sounds to CountdownScreen in screens-lobby.jsx**

In `frontend/src/components/screens-lobby.jsx`, find `CountdownScreen`. It uses a `useEffect` with `setInterval` or similar to count down from 3. After each decrement, add:

```javascript
import { play } from '../audio/soundManager.js'

// Inside the useEffect where countdown ticks:
play('tick')
```

Exact location: find where `count` state is decremented (the countdown 3→2→1→¡YA!). Add `play('tick')` immediately before or after each decrement.

- [ ] **Step 3: Add role reveal sounds to RoleRevealScreen in screens-game.jsx**

In `frontend/src/components/screens-game.jsx`, find `RoleRevealScreen`. It receives `myRole` prop.

Add at the top of the component (inside the component function, called once on mount):

```javascript
import { play } from '../audio/soundManager.js'

// In RoleRevealScreen, add this useEffect:
useEffect(() => {
  play(myRole?.isImpostor ? 'roleImpostor' : 'roleCrewmate')
}, []) // run once on mount
```

- [ ] **Step 4: Add yourTurn sound to GameplayScreen in screens-game.jsx**

In `GameplayScreen`, find where `isMyTurn` changes (derived from `activePlayerIdx`). Add:

```javascript
const isMyTurn = room.players[room.activePlayerIdx]?.id === myId

useEffect(() => {
  if (isMyTurn) play('yourTurn')
}, [isMyTurn])
```

- [ ] **Step 5: Add timerWarning sound to GameplayScreen**

The timer ring component reads `remaining` and `total`. Find where the percentage is computed:

```javascript
const pct = timer.remaining / timer.total

useEffect(() => {
  if (pct <= 0.25 && pct > 0) play('timerWarning')
}, [Math.floor(pct * 4)]) // fires once when pct crosses 25%
```

Where `timer` is derived from `gameState`. The client computes remaining as:
```javascript
const timerEnd = room.timerEnd // set by server in STATE
const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000))
```

- [ ] **Step 6: Add wordSubmit sound to GameplayScreen**

Find where word history updates (compare previous wordHistory length). Add:

```javascript
const wordCount = room.wordHistory?.length ?? 0
const prevWordCount = useRef(wordCount)

useEffect(() => {
  if (wordCount > prevWordCount.current) {
    play('wordSubmit')
    prevWordCount.current = wordCount
  }
}, [wordCount])
```

- [ ] **Step 7: Add voteCast sound to VotingScreen in screens-vote.jsx**

Find where the user casts their vote (the `onCastVote` call). Wrap it:

```javascript
const handleVote = (targetId) => {
  play('voteCast')
  onCastVote(targetId)
}
```

Replace any direct call to `onCastVote(targetId)` in the vote button's onClick with `handleVote(targetId)`.

- [ ] **Step 8: Add win/lose sounds to ResultsScreen in screens-vote.jsx**

In `ResultsScreen`, add:

```javascript
useEffect(() => {
  play(room.result?.found ? 'win' : 'lose')
}, []) // run once on mount
```

- [ ] **Step 9: Verify sounds play in browser**

```bash
npm run dev
```

Play a full game. Verify sounds:
- [ ] Countdown: 3 ticks heard
- [ ] Role reveal: different sound for impostor vs crewmate
- [ ] Your turn: ping when active player changes to you
- [ ] Word submit: pop sound when any player submits
- [ ] Vote cast: thud when you click a player in voting
- [ ] Results: fanfare or sting depending on outcome

- [ ] **Step 10: Commit**

```bash
git add frontend/src/audio/soundManager.js frontend/src/components/
git commit -m "feat: add sound effects — 9 SFX triggered at key game moments"
```

---

## Phase 5 — Deploy

### Task 11: Cloudflare Deployment

**Files:**
- Modify: `worker/wrangler.toml` (add production vars)

Prerequisites:
- Cloudflare account (free tier)
- `wrangler login` authenticated (`wrangler whoami` should print your email)

- [ ] **Step 1: Authenticate wrangler**

```bash
wrangler login
```

Opens browser → log in with Cloudflare account. Then verify:
```bash
wrangler whoami
```

Expected: prints your account name and ID.

- [ ] **Step 2: Deploy the Worker**

```bash
npm run deploy:worker
```

Expected output ends with:
```
Published el-impostor-worker (Xs)
  https://el-impostor-worker.<your-subdomain>.workers.dev
```

Note the workers.dev URL — you'll need it for the frontend env variable.

- [ ] **Step 3: Build and deploy the frontend**

Set the worker URL as an environment variable for the build:

```bash
VITE_WORKER_URL=https://el-impostor-worker.<your-subdomain>.workers.dev \
  npm run build -w frontend
```

Then deploy to Cloudflare Pages:
```bash
wrangler pages deploy frontend/dist --project-name el-impostor
```

On first run, this creates the Pages project. Expected output:
```
✨ Deployment complete! Take a peek over at https://el-impostor.pages.dev
```

- [ ] **Step 4: Set FRONTEND_ORIGIN in the Worker**

```bash
wrangler secret put FRONTEND_ORIGIN
```

Enter the Pages URL when prompted (e.g., `https://el-impostor.pages.dev`).

Redeploy the worker to pick up the variable:
```bash
npm run deploy:worker
```

- [ ] **Step 5: Test production deployment**

Open https://el-impostor.pages.dev in two different devices (phone + laptop, or two browsers).

Verify:
- [ ] Create room on device 1 → code appears
- [ ] Join with code on device 2 → both players appear in lobby
- [ ] Start game → role reveal shows in both browsers (different roles)
- [ ] Submit words → both devices see the words
- [ ] Vote → results show correctly
- [ ] Check DevTools → Network → WS on both devices: `STATE` messages never contain `impostorIdx`, `secretWord`, or `hint`

- [ ] **Step 6: Add VITE_WORKER_URL to wrangler.toml for repeatability**

Update `worker/wrangler.toml`:

```toml
name = "el-impostor-worker"
main = "src/index.js"
compatibility_date = "2024-09-23"

[vars]
FRONTEND_ORIGIN = "http://localhost:3000"

[env.production.vars]
FRONTEND_ORIGIN = "https://el-impostor.pages.dev"

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_classes = ["GameRoom"]
```

- [ ] **Step 7: Add deployment scripts to root package.json**

Update root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently -n frontend,worker -c cyan,yellow \"npm run dev -w frontend\" \"npm run dev -w worker\"",
    "build": "VITE_WORKER_URL=https://el-impostor-worker.<your-subdomain>.workers.dev npm run build -w frontend",
    "deploy:worker": "npm run deploy -w worker",
    "deploy:frontend": "npm run build && wrangler pages deploy frontend/dist --project-name el-impostor",
    "deploy": "npm run deploy:worker && npm run deploy:frontend"
  }
}
```

Replace `<your-subdomain>` with the actual value from Step 2.

- [ ] **Step 8: Final commit**

```bash
git add worker/wrangler.toml package.json
git commit -m "chore: configure production deployment to Cloudflare Pages + Workers"
git push origin main
```

---

## Verification Checklist

Run these after all tasks are complete:

- [ ] `npm run test -w worker` — all unit tests pass
- [ ] `npm run build -w frontend` — builds without errors or warnings
- [ ] Local play with 3 browser tabs — full game completes successfully
- [ ] DevTools WS inspection: `STATE` messages never contain `secretWord`, `hint`, or `impostorIdx`
- [ ] All 9 sounds play at the correct moments
- [ ] Disconnect mid-game: close one tab, verify game continues, rejoin, verify state restored
- [ ] Timer expiry: wait out a turn without submitting — server auto-advances
- [ ] Vote timer: wait out the voting phase — server auto-confirms votes
- [ ] Production test with 2 real devices on different networks
