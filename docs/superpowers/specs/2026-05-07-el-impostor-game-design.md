# El Impostor — Game Design Spec

**Date:** 2026-05-07  
**Status:** Approved  

---

## Context

El Impostor is a Spanish-language social deduction word game (Among Us-style). A polished frontend MVP already exists: React 18 JSX components, 9 fully designed screens, a theming system, and fake-player simulation for solo testing. The frontend has zero networking, no sounds, and no backend.

This document specifies the transformation from that standalone HTML prototype into a real multiplayer web game hosted on Cloudflare.

---

## Goals

- Real multiplayer: players on separate devices, connecting over the internet
- Fully Cloudflare-hosted (Pages + Workers), free tier to start
- 9 sound effects at key game moments
- Expanded word bank (50–100 pairs)
- No user accounts — fully anonymous play

---

## Architecture

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│   Cloudflare Pages            │     │   Cloudflare Workers                  │
│   (Static Frontend)           │     │                                       │
│                              │     │  Worker (index.js)                    │
│  Vite + React 18             │◄───►│  ├── POST /rooms   → create room      │
│  Existing JSX components     │ WS  │  └── GET /rooms/:code/ws → upgrade    │
│  + useGameSocket hook         │     │                                       │
│  + soundManager.js           │     │  Durable Object: GameRoom             │
│  + words.json                │     │  ├── 1 instance per active room       │
└──────────────────────────────┘     │  ├── holds full game state in memory  │
                                      │  ├── manages all WebSocket conns     │
                                      │  └── runs all authoritative logic    │
                                      └──────────────────────────────────────┘
```

**Single source of truth:** The Durable Object. The React frontend is a display layer — it renders whatever state the server sends. Every game action triggers a WebSocket message; the server validates, mutates state, and broadcasts the new snapshot to all players.

---

## Project Structure

```
el-impostor/
├── frontend/                       # Vite + React app → Cloudflare Pages
│   ├── src/
│   │   ├── app.jsx                 # Modified: remove fake players, use WS hook
│   │   ├── components/
│   │   │   ├── screens-entry.jsx   # Unchanged
│   │   │   ├── screens-lobby.jsx   # UI unchanged; ready state from server
│   │   │   ├── screens-game.jsx    # UI unchanged; timers server-driven
│   │   │   ├── screens-vote.jsx    # UI unchanged
│   │   │   └── primitives.jsx      # Unchanged
│   │   ├── ws/
│   │   │   └── useGameSocket.js    # NEW: WS hook (connect, reconnect, send)
│   │   ├── audio/
│   │   │   └── soundManager.js     # NEW: Howler.js SFX manager
│   │   └── data/
│   │       └── words.json          # NEW: 50-100 Spanish word+hint pairs
│   ├── public/
│   │   └── sounds/                 # NEW: 9 OGG+MP3 SFX files
│   ├── index.html
│   └── vite.config.js
│
├── worker/                         # Cloudflare Worker → Cloudflare Workers
│   ├── src/
│   │   ├── index.js                # NEW: routing + WS upgrade handler
│   │   ├── GameRoom.js             # NEW: Durable Object class
│   │   └── gameLogic.js            # NEW: pure game state transition functions
│   └── wrangler.toml
│
└── package.json                    # Root scripts: dev, deploy
```

---

## Frontend Changes: app.jsx

**Remove:**
- All fake-player simulation (~200 lines: `useFakePlayers`, timed setTimeout chains, `FAKE_WORDS`, `simulateReady`, etc.)
- All in-memory state mutations for game events (setState called directly in response to player actions)

**Add:**
- `const { state, send, connectionState } = useGameSocket(roomCode)`
- Replace `const [room, setRoom] = useState(...)` with `const [gameState, setGameState] = useState(null)`
- Replace all action handlers with `send(type, payload)` calls:
  - `handleSubmitWord(word)` → `send("SUBMIT_WORD", { word })`
  - `handleVote(targetId)` → `send("CAST_VOTE", { targetId })`
  - etc.
- Store player's own role (word/hint/isImpostor) in separate local state, populated from `ROLE` WebSocket message

**Screen routing stays identical** — phase field from server state maps to existing screen components.

---

## useGameSocket Hook

```javascript
// frontend/src/ws/useGameSocket.js
export function useGameSocket(roomCode) {
  // Connects to wss://<worker>/rooms/:code/ws
  // Handles: open, message, close, error
  // Parses JSON messages: STATE updates setGameState, ROLE updates setMyRole
  // Reconnects with exponential backoff on disconnect
  // Returns: { gameState, myRole, send, connectionState }
}
```

`connectionState`: `"connecting" | "connected" | "disconnected"` — shown in UI if disconnected.

---

## Worker: HTTP Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms` | Generate 4-char code, verify it's unused, create DO stub, return `{ code }` |
| GET | `/rooms/:code/ws` | WebSocket upgrade → routed to `GameRoom` DO |
| OPTIONS | `*` | CORS preflight |

**Room code generation:** The Worker generates a code and checks the DO stub's `exists()` flag. If that code is already in use, it retries (up to 5 attempts). Codes use the existing charset (no O/I/L/1) so collisions are rare at low scale.

CORS allows requests from the Pages domain (`https://el-impostor.pages.dev` and custom domain).

---

## Durable Object: GameRoom

One DO instance per room, created on first player join, hibernates when all players disconnect.

**State shape (authoritative, in-memory):**
```javascript
{
  code: "A2K9",
  phase: "lobby" | "countdown" | "roleReveal" | "playing" | "betweenRound" | "voting" | "results",
  players: [{ id, name, connected, ready }],
  rules: { turnTime, roundsBeforeVote, maxPlayers, imposterHasHint, imposterWinsIfNotFound },
  // playing phase:
  impostorIdx: number,        // NEVER sent in public STATE broadcast
  secretWord: string,         // NEVER sent in public STATE broadcast
  hint: string,               // NEVER sent in public STATE broadcast
  activePlayerIdx: number,
  currentRound: number,
  wordHistory: [{ playerId, word, round }],
  // voting phase:
  votes: { [voterId]: targetId },
  votingTimerEnd: timestamp,
  betweenRoundVotes: { continue: [playerId], vote: [playerId] },
  // results phase:
  result: { found: bool, impostorId, impostorName, tally, secretWord }
}
```

**Privacy rule:** `impostorIdx`, `secretWord`, and `hint` are stored in DO state but stripped from all `STATE` broadcasts. They are only sent via private `ROLE` messages at game start.

---

## WebSocket Protocol

### Client → Server

| Type | Payload | When |
|------|---------|------|
| `JOIN` | `{ name, code }` | First message after WS connect |
| `READY` | `{}` | Lobby: mark self ready |
| `START_GAME` | `{}` | Owner only, in lobby |
| `SUBMIT_WORD` | `{ word: string }` | During active player's turn |
| `BETWEEN_VOTE` | `{ choice: "continue" \| "vote" }` | Between-round screen |
| `CAST_VOTE` | `{ targetId: string }` | During voting phase |
| `CONFIRM_VOTE` | `{}` | Lock in vote |
| `PLAY_AGAIN` | `{}` | Results screen (any player; resets game keeping same players) |
| `BACK_TO_LOBBY` | `{}` | Results screen (owner only; returns to lobby phase) |

### Server → Client

**`STATE`** — broadcast to all players after every state change:
```json
{
  "type": "STATE",
  "payload": { "phase": "...", "players": [...], "rules": {...}, ... }
}
```
(Never includes `impostorIdx`, `secretWord`, `hint`)

**`ROLE`** — sent privately to each player once, at game start:
```json
{
  "type": "ROLE",
  "payload": { "isImpostor": false, "word": "Playa", "hint": "Lugar de vacaciones" }
}
```

**`ERROR`** — targeted, for invalid actions:
```json
{ "type": "ERROR", "payload": { "message": "Room not found" } }
```

---

## gameLogic.js

Pure functions (no I/O, no side effects) that compute the next state:

```javascript
applyJoin(state, { id, name })         → nextState
applyReady(state, playerId)            → nextState
applyStartGame(state, words)           → nextState  // assigns word pair + impostor
applySubmitWord(state, { playerId, word }) → nextState
applyBetweenVote(state, { playerId, choice }) → nextState
applyCastVote(state, { voterId, targetId }) → nextState
applyConfirmVote(state, voterId)        → nextState
computeResult(state)                    → { found, impostorId, tally }
```

Each function is independently testable. The DO calls these and then broadcasts.

---

## Word Bank: words.json

50–100 Spanish word+hint pairs, structured as:
```json
[
  { "word": "Playa", "hint": "Lugar de vacaciones" },
  { "word": "Pizza", "hint": "Comida popular" },
  ...
]
```

Categories to cover: food, sports, places, animals, objects, celebrations, professions, nature.  
The server picks one at random when `START_GAME` is received.

---

## Sound Effects

9 SFX files, all CC0 license. Sources: **Kenney.nl** (game UI/SFX packs) and **Freesound.org** (CC0 filter).  
Format: OGG primary + MP3 fallback. Total target weight: **<500KB**.

| File | Trigger | Feel |
|------|---------|------|
| `tick.ogg` | Countdown 3-2-1 each number | Short mechanical click |
| `role-impostor.ogg` | Role reveal: you are the impostor | Tense low sting (1–2s) |
| `role-crewmate.ogg` | Role reveal: you have the word | Soft upward chime |
| `your-turn.ogg` | Active player changes to you | Notification ping |
| `timer-warning.ogg` | Timer drops below 25% | Heartbeat pulse |
| `word-submit.ogg` | Any player submits a word | Soft pop |
| `vote-cast.ogg` | You cast a vote | Stamp/gavel thud |
| `win.ogg` | Results: impostor was found | Short triumphant fanfare |
| `lose.ogg` | Results: impostor escapes | Dramatic descending sting |

**soundManager.js** uses Howler.js. All sounds preloaded on first user interaction (required by browser autoplay policy). `play(name)` is the only public API.

---

## Deployment

### Cloudflare Pages (Frontend)
- Repo connected to Cloudflare Pages dashboard
- Build command: `cd frontend && npm run build`
- Output directory: `frontend/dist`
- Free tier: 500 builds/month, unlimited bandwidth, custom domain

### Cloudflare Workers (Backend)
- Deploy command: `wrangler deploy` from `worker/`
- `wrangler.toml` declares DO binding: `[[durable_objects.bindings]]`
- Free tier: 100k requests/day, DO hibernates idle rooms (zero cost at rest)
- Upgrade path: Workers Paid plan ($5/month) if traffic exceeds free limits

### Custom Domains
- `el-impostor.com` → Cloudflare Pages (frontend)
- `api.el-impostor.com` → Cloudflare Workers (WebSocket + HTTP API)

### Environment Variables
- `FRONTEND_ORIGIN`: allowed CORS origin (set in Cloudflare dashboard per env)

---

## Timer Architecture

Timers (turn timer, voting timer) are **authoritative on the server**. The DO stores `timerEnd` as a Unix timestamp. At game start / turn start:
1. Server sets `timerEnd = now + turnTime * 1000`
2. Server broadcasts STATE (clients display countdown from `timerEnd - now`)
3. DO schedules an alarm: `this.ctx.storage.setAlarm(timerEnd)`
4. On alarm fire: server auto-advances (submits "..." for inactive player, or auto-confirms vote)

This prevents clients from cheating by manipulating their local timer.

---

## Reconnection

If a player disconnects mid-game:
- DO marks `player.connected = false`, broadcasts STATE
- UI shows disconnected player as greyed out
- If the disconnected player's turn comes up, the timer auto-expires (server alarm fires)
- Player can reconnect within 60s using the same name + room code; DO reassigns their playerId

During `countdown` or `roleReveal` phases, disconnections are ignored (game proceeds). If the owner disconnects during `lobby`, ownership transfers to the next connected player.

---

## Verification Plan

1. **Local dev:** `wrangler dev` for Worker + `npm run dev` for Vite frontend — open in 3 tabs, play a full game
2. **Privacy test:** Open browser devtools Network tab, verify `ROLE` messages differ between tabs, verify no `secretWord` in `STATE` broadcasts
3. **Disconnect test:** Close one tab mid-game, verify game continues, reconnect and verify state is recovered
4. **Timer test:** Let a turn timer expire without submitting — verify server auto-submits and advances
5. **Sound test:** Verify all 9 sounds play at the correct moments; verify no sound plays before first user interaction
6. **Deploy test:** Deploy to Cloudflare, play a full game with 3 real devices on different networks
