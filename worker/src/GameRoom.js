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
})

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.sessions = new Map() // playerId -> WebSocket
    this.state = null
    // Hydrate state from durable storage so wrangler hot-reloads and
    // Cloudflare DO evictions don't wipe in-progress rooms.
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('state')
      if (saved) this.state = saved
    })
    // Hibernation API: when the DO wakes from hibernation, this.sessions is
    // empty but ctx.getWebSockets() still has every accepted socket. Each
    // socket's playerId was stashed via serializeAttachment in _handleJoin,
    // so we can rebuild the routing table here. Without this, broadcasts
    // after a hibernation tick only reach the most recently joined tab —
    // the visible symptom was "host doesn't see joiners".
    for (const ws of ctx.getWebSockets()) {
      const att = ws.deserializeAttachment?.()
      if (att?.playerId) this.sessions.set(att.playerId, ws)
    }
  }

  async _save() {
    if (this.state) await this.ctx.storage.put('state', this.state)
  }

  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/exists') {
      return Response.json({ active: this.state !== null || this.sessions.size > 0 })
    }

    // Claim the room code at creation time so a concurrent POST /rooms
    // cannot pick the same code before any client connects.
    if (url.pathname === '/claim') {
      const code = url.searchParams.get('code') || 'UNKNOWN'
      if (!this.state) {
        this.state = INITIAL_STATE(code)
        await this._save()
      }
      return Response.json({ ok: true })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws, rawMessage) {
    let msg
    try { msg = JSON.parse(rawMessage) } catch { return }

    const playerId = this._playerIdForWs(ws)

    switch (msg.type) {
      case 'PING':
        try { ws.send(JSON.stringify({ type: 'PONG' })) } catch {}
        break
      case 'JOIN':
        await this._handleJoin(ws, msg.payload || {})
        break
      case 'READY':
        if (playerId) { this.state = applyReady(this.state, playerId); this._broadcast() }
        break
      case 'UPDATE_RULES':
        if (playerId) { this.state = applyUpdateRules(this.state, { playerId, rules: msg.payload?.rules || {} }); this._broadcast() }
        break
      case 'START_GAME':
        if (playerId) await this._handleStartGame(playerId)
        break
      case 'SUBMIT_WORD':
        if (playerId) await this._handleSubmitWord(playerId, msg.payload || {})
        break
      case 'BETWEEN_VOTE':
        if (playerId) await this._handleBetweenVote(playerId, msg.payload?.choice)
        break
      case 'CAST_VOTE':
        if (playerId) { this.state = applyCastVote(this.state, { voterId: playerId, targetId: msg.payload?.targetId }); this._broadcast() }
        break
      case 'CONFIRM_VOTE':
        if (playerId) await this._handleConfirmVote(playerId)
        break
      case 'PLAY_AGAIN':
        if (playerId) this._handlePlayAgain()
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
    const wasOwner = this.state.players.find(p => p.id === playerId)?.isOwner
    this.state = {
      ...this.state,
      players: this.state.players.map(p => p.id === playerId ? { ...p, connected: false } : p),
    }
    // Transfer ownership to the next connected player whenever the owner
    // drops, regardless of phase — otherwise owner-only actions (START_GAME,
    // BACK_TO_LOBBY) get stranded if the host never reconnects.
    if (wasOwner) {
      const nextOwner = this.state.players.find(p => p.connected)
      if (nextOwner) {
        this.state = {
          ...this.state,
          players: this.state.players.map(p => ({ ...p, isOwner: p.id === nextOwner.id })),
        }
      }
    }
    this._broadcast()
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws)
  }

  // Durable Object alarm — drives phase transitions on timer expiry
  async alarm() {
    if (!this.state) return
    switch (this.state.phase) {
      case 'countdown': {
        // Countdown finished → roleReveal + send private ROLE messages
        this.state = { ...this.state, phase: 'roleReveal' }
        this._sendRoleMessages()
        this._broadcast()
        await this.ctx.storage.setAlarm(Date.now() + 6000)
        break
      }

      case 'roleReveal': {
        // Reveal finished → start first turn
        const firstTurnEnd = Date.now() + this.state.rules.turnTime * 1000
        this.state = {
          ...this.state,
          phase: 'playing',
          activePlayerIdx: 0,
          currentRound: 1,
          timerEnd: firstTurnEnd,
        }
        this._broadcast()
        await this.ctx.storage.setAlarm(firstTurnEnd)
        break
      }

      case 'playing': {
        const activePlayer = this.state.players[this.state.activePlayerIdx]
        if (!activePlayer) break
        this.state = applySubmitWord(this.state, { playerId: activePlayer.id, word: '...' })
        if (this.state.phase === 'playing') {
          const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
          this.state = { ...this.state, timerEnd: nextTurnEnd }
          this._broadcast()
          await this.ctx.storage.setAlarm(nextTurnEnd)
        } else if (this.state.phase === 'voting') {
          // Intentionally deviates from plan: plan's alarm lacks this branch, but without it
          // auto-timeout into voting would have no votingTimerEnd and players would be stuck.
          // _handleSubmitWord sets it on manual submit; alarm path needs symmetric handling.
          const voteEnd = Date.now() + 30000
          this.state = { ...this.state, timerEnd: null, votingTimerEnd: voteEnd }
          this._broadcast()
          await this.ctx.storage.setAlarm(voteEnd)
        } else {
          this._broadcast()
        }
        break
      }

      case 'voting': {
        // Voting time expired — finalize with current votes
        this.state = {
          ...this.state,
          phase: 'results',
          votingTimerEnd: null,
          confirmedVotes: [],
          result: computeResult(this.state),
        }
        this._broadcast()
        break
      }
    }
  }

  // ── Handlers ──────────────────────────────────────────────

  async _handleJoin(ws, { name, code, playerId }) {
    console.log('[GameRoom] JOIN attempt', { code, name, playerId, hasState: !!this.state, players: this.state?.players.length })
    if (!playerId) return
    // Reject join for unclaimed rooms — only POST /rooms creates a room.
    if (!this.state) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Sala no encontrada' } }))
      ws.close()
      return
    }

    const existing = this.state.players.find(p => p.id === playerId)
    if (existing) {
      // Reconnect path
      const prev = this.sessions.get(playerId)
      if (prev && prev !== ws) {
        try { prev.close(1000, 'replaced') } catch {}
      }
      this.sessions.set(playerId, ws)
      try { ws.serializeAttachment({ playerId }) } catch {}
      this.state = applyJoin(this.state, { id: playerId, name, isOwner: existing.isOwner })
      if (['roleReveal', 'playing', 'betweenRound', 'voting', 'results'].includes(this.state.phase)) {
        this._sendRoleTo(playerId, ws)
      }
      this._broadcast()
      return
    }

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
    try { ws.serializeAttachment({ playerId }) } catch {}
    this.state = applyJoin(this.state, { id: playerId, name, isOwner })
    this._broadcast()
  }

  async _handleStartGame(playerId) {
    const player = this.state?.players.find(p => p.id === playerId)
    if (!player?.isOwner) return
    const wordPair = words[Math.floor(Math.random() * words.length)]
    const next = applyStartGame(this.state, wordPair)
    if (next.phase !== 'countdown') return // requirements not met
    const countdownEnd = Date.now() + 4000
    this.state = { ...next, timerEnd: countdownEnd }
    this._broadcast()
    // 4-second countdown then alarm fires → roleReveal
    await this.ctx.storage.setAlarm(countdownEnd)
  }

  async _handleBetweenVote(playerId, choice) {
    this.state = applyBetweenVote(this.state, { playerId, choice })
    if (this.state.phase === 'playing') {
      const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
      this.state = { ...this.state, timerEnd: nextTurnEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(nextTurnEnd)
    } else if (this.state.phase === 'voting') {
      const voteEnd = Date.now() + 30000
      this.state = { ...this.state, votingTimerEnd: voteEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(voteEnd)
    } else {
      this._broadcast()
    }
  }

  async _handleSubmitWord(playerId, { word }) {
    const trimmed = (word || '').trim().slice(0, 20) || '...'
    this.state = applySubmitWord(this.state, { playerId, word: trimmed })

    if (this.state.phase === 'playing') {
      const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
      this.state = { ...this.state, timerEnd: nextTurnEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(nextTurnEnd)
    } else if (this.state.phase === 'voting') {
      await this.ctx.storage.deleteAlarm()
      const voteEnd = Date.now() + 30000
      this.state = { ...this.state, timerEnd: null, votingTimerEnd: voteEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(voteEnd)
    } else {
      // betweenRound
      await this.ctx.storage.deleteAlarm()
      this.state = { ...this.state, timerEnd: null }
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

  _handlePlayAgain() {
    if (!this.state) return
    const remaining = this.state.players.filter(p => p.connected)
    if (remaining.length === 0) return
    this.state = {
      ...INITIAL_STATE(this.state.code),
      players: remaining.map((p, i) => ({ ...p, ready: false, isOwner: i === 0 })),
      rules: this.state.rules,
    }
    this._broadcast()
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

  // ── Broadcast helpers ────────────────────────────────────

  _sendRoleMessages() {
    this.state.players.forEach((player, idx) => {
      const ws = this.sessions.get(player.id)
      if (ws) this._sendRoleTo(player.id, ws, idx)
    })
  }

  _sendRoleTo(playerId, ws, idxOverride) {
    const idx = idxOverride ?? this.state.players.findIndex(p => p.id === playerId)
    const isImpostor = idx === this.state.impostorIdx
    try {
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
    } catch {}
  }

  _broadcast() {
    if (!this.state) return
    // Fire-and-forget persistence — don't block the broadcast on storage I/O.
    this._save().catch(() => {})
    const msg = JSON.stringify({ type: 'STATE', payload: this._publicState() })
    // Source of truth is ctx.getWebSockets(): it survives hibernation and
    // includes every accepted socket, even ones this instance never saw a
    // JOIN for. this.sessions is a fast lookup index, not authoritative.
    const sockets = this.ctx.getWebSockets()
    const seen = new Set()
    for (const ws of sockets) {
      seen.add(ws)
      try { ws.send(msg) } catch {}
    }
    for (const ws of this.sessions.values()) {
      if (seen.has(ws)) continue
      try { ws.send(msg) } catch {}
    }
  }

  _publicState() {
    const { impostorIdx, secretWord, hint, ...pub } = this.state
    return pub
  }

  _playerIdForWs(ws) {
    for (const [id, socket] of this.sessions) {
      if (socket === ws) return id
    }
    // Fallback: read playerId from the socket's serialized attachment.
    // Covers the window where this.sessions hasn't been rebuilt yet but the
    // attachment (set in _handleJoin) survived hibernation on the socket.
    try {
      const att = ws.deserializeAttachment?.()
      if (att?.playerId) {
        this.sessions.set(att.playerId, ws)
        return att.playerId
      }
    } catch {}
    return null
  }
}
