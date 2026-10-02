// worker/src/GameRoom.js
import {
  applyJoin, applyReady, applyUpdateRules, applyUpdateAvatar, applyStartGame,
  applySubmitWord, applyBetweenVote, applyCastVote,
  applyConfirmVote, computeResult, firstConnectedPlayerIdx, normalizeCategories,
} from './gameLogic.js'
import words from './words.json'
import { recordRoomEvent } from './Engagement.js'
import { cleanAttribution } from '../../shared/engagement.js'
import { consentReceipt } from '../../shared/consent.js'

const ROUND_REVIEW_MS = 3500
const VOTING_MS = 30000

const INITIAL_STATE = (code, category = 'all') => ({
  code,
  gameId: null,
  phase: 'lobby',
  players: [],
  rules: {
    turnTime: 30,
    roundsBeforeVote: 2,
    maxPlayers: 8,
    imposterHasHint: true,
    wordCategories: normalizeCategories(category),
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
  roundReviewEnd: null,
  phaseAfterReview: null,
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
        this.state = INITIAL_STATE(code, url.searchParams.get('category'))
        let consent
        try { consent = consentReceipt(JSON.parse(url.searchParams.get('consent'))) } catch {}
        this.state.engagement = {
          id: crypto.randomUUID(), attribution: cleanAttribution(consent ? Object.fromEntries(url.searchParams) : { source: 'unattributed' }),
          consent: consent || null, completedGames: 0, wasInvited: !!consent && url.searchParams.get('wasInvited') === 'true',
        }
        this._record('room_created', this.state.engagement.id)
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
      case 'MEASUREMENT_PREFERENCE':
        if (playerId && msg.payload?.enabled === false) this._withdrawMeasurement(playerId)
        break
      case 'PING':
        try { ws.send(JSON.stringify({ type: 'PONG', serverNow: Date.now(), clientSentAt: msg.payload?.clientSentAt })) } catch {}
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
      case 'UPDATE_AVATAR':
        if (playerId) {
          const next = applyUpdateAvatar(this.state, { playerId, avatarId: msg.payload?.avatarId })
          if (next !== this.state) { this.state = next; this._broadcast() }
        }
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
    // Complete the closing handshake so clients can release the old connection.
    try { ws.close(1000, 'closed') } catch {}
    // A replaced connection can close after its replacement has already joined.
    const attachedId = ws.deserializeAttachment?.()?.playerId
    if (attachedId && this.sessions.has(attachedId) && this.sessions.get(attachedId) !== ws) return
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
        const revealEnd = Date.now() + 6000
        this.state = { ...this.state, phase: 'roleReveal', timerEnd: revealEnd }
        this._sendRoleMessages()
        this._broadcast()
        await this.ctx.storage.setAlarm(revealEnd)
        break
      }

      case 'roleReveal': {
        // Reveal finished → start first turn
        const firstTurnEnd = Date.now() + this.state.rules.turnTime * 1000
        this.state = {
          ...this.state,
          phase: 'playing',
          activePlayerIdx: firstConnectedPlayerIdx(this.state),
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
        } else if (this.state.phase === 'roundReview') {
          await this._startRoundReview()
        } else if (this.state.phase === 'voting') {
          // Intentionally deviates from plan: plan's alarm lacks this branch, but without it
          // auto-timeout into voting would have no votingTimerEnd and players would be stuck.
          // _handleSubmitWord sets it on manual submit; alarm path needs symmetric handling.
          const voteEnd = Date.now() + VOTING_MS
          this.state = { ...this.state, timerEnd: null, votingTimerEnd: voteEnd }
          this._broadcast()
          await this.ctx.storage.setAlarm(voteEnd)
        } else {
          this._broadcast()
        }
        break
      }

      case 'roundReview': {
        await this._finishRoundReview()
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

  async _handleJoin(ws, { name, code, playerId, avatarId, attribution, wasInvited, consent }) {
    if (typeof playerId !== 'string' || !playerId || playerId.length > 100 ||
        typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 16) {
      this._recordJoinRejected('invalid_join')
      ws.send(JSON.stringify({ type: 'ERROR', payload: { reason: 'invalid_join', message: 'Escribe un nombre de 2 a 16 caracteres.' } }))
      ws.close(1008, 'invalid_join')
      return
    }
    name = name.trim()
    // Reject join for unclaimed rooms — only POST /rooms creates a room.
    if (!this.state) {
      this._recordJoinRejected('room_not_found')
      ws.send(JSON.stringify({ type: 'ERROR', payload: { reason: 'room_not_found', message: 'Sala no encontrada. Comprueba el código o pide una nueva invitación al anfitrión.' } }))
      ws.close()
      return
    }

    const existing = this.state.players.find(p => p.id === playerId)
    if (existing) {
      if (!consentReceipt(consent)) this._withdrawMeasurement(playerId)
      // Reconnect path
      const prev = this.sessions.get(playerId)
      if (prev && prev !== ws) {
        try { prev.close(1000, 'replaced') } catch {}
      }
      this.sessions.set(playerId, ws)
      try { ws.serializeAttachment({ playerId }) } catch {}
      this.state = applyJoin(this.state, { id: playerId, name, isOwner: existing.isOwner })
      if (['roleReveal', 'playing', 'roundReview', 'betweenRound', 'voting', 'results'].includes(this.state.phase)) {
        this._sendRoleTo(playerId, ws)
      }
      this._broadcast()
      return
    }

    // New player
    if (this.state.phase !== 'lobby') {
      this._recordJoinRejected('game_in_progress')
      ws.send(JSON.stringify({ type: 'ERROR', payload: { reason: 'game_in_progress', message: 'La partida ya ha empezado. Si ya estabas jugando, vuelve a la pestaña original. Si eres nuevo, pide al anfitrión que vuelva a la sala de espera al terminar.' } }))
      ws.close()
      return
    }
    if (this.state.players.filter(p => p.connected).length >= this.state.rules.maxPlayers) {
      this._recordJoinRejected('room_full')
      ws.send(JSON.stringify({ type: 'ERROR', payload: { reason: 'room_full', message: 'Sala llena. Pide al anfitrión que amplíe las plazas en la sala de espera.' } }))
      ws.close()
      return
    }
    const isOwner = !this.state.players.some(p => p.connected && p.isOwner)
    if (isOwner) this.state = { ...this.state, players: this.state.players.map(p => ({ ...p, isOwner: false })) }
    this.sessions.set(playerId, ws)
    try { ws.serializeAttachment({ playerId }) } catch {}
    this.state = applyJoin(this.state, { id: playerId, name, isOwner, avatarId })
    if (isOwner && this.state.engagement && !this.state.engagement.attributionOwnerId) this.state.engagement.attributionOwnerId = playerId
    const accepted = consentReceipt(consent)
    if (!accepted) this._withdrawMeasurement(playerId)
    recordRoomEvent(this.ctx, this.env, 'player_joined', crypto.randomUUID(), cleanAttribution(accepted ? attribution : { source: 'unattributed' }), { wasInvited: !!accepted && wasInvited === true })
    this._broadcast()
  }

  async _handleStartGame(playerId) {
    const player = this.state?.players.find(p => p.id === playerId)
    if (!player?.isOwner || this.state.phase !== 'lobby') return
    const wordPair = this._pickWordPair()
    const next = applyStartGame(this.state, wordPair)
    if (next.phase !== 'countdown') return // requirements not met
    const countdownEnd = Date.now() + 4000
    this.state = { ...next, gameId: crypto.randomUUID(), timerEnd: countdownEnd }
    this._broadcast()
    // 4-second countdown then alarm fires → roleReveal
    await this.ctx.storage.setAlarm(countdownEnd)
  }

  async _handleBetweenVote(playerId, choice) {
    const next = applyBetweenVote(this.state, { playerId, choice })
    if (next === this.state) return
    this.state = next
    if (this.state.phase === 'playing') {
      const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
      this.state = { ...this.state, timerEnd: nextTurnEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(nextTurnEnd)
    } else if (this.state.phase === 'voting') {
      const voteEnd = Date.now() + VOTING_MS
      this.state = { ...this.state, votingTimerEnd: voteEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(voteEnd)
    } else {
      this._broadcast()
    }
  }

  async _handleSubmitWord(playerId, { word }) {
    if (typeof word !== 'string' || !word.trim()) return
    const trimmed = word.trim().slice(0, 20)
    const next = applySubmitWord(this.state, { playerId, word: trimmed })
    if (next === this.state) return // rejected actions must never restart another player's timer
    this.state = next

    if (this.state.phase === 'playing') {
      const nextTurnEnd = Date.now() + this.state.rules.turnTime * 1000
      this.state = { ...this.state, timerEnd: nextTurnEnd }
      this._broadcast()
      await this.ctx.storage.setAlarm(nextTurnEnd)
    } else if (this.state.phase === 'roundReview') {
      await this.ctx.storage.deleteAlarm()
      await this._startRoundReview()
    } else if (this.state.phase === 'voting') {
      await this.ctx.storage.deleteAlarm()
      const voteEnd = Date.now() + VOTING_MS
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
    if (this.state?.phase !== 'results') return
    const remaining = this.state.players.filter(p => p.connected)
    if (remaining.length === 0) return
    this.state = {
      ...INITIAL_STATE(this.state.code),
      players: remaining.map((p, i) => ({ ...p, ready: false, isOwner: i === 0 })),
      rules: this.state.rules,
      engagement: this.state.engagement,
    }
    this._broadcast()
  }

  _handleBackToLobby(playerId) {
    const player = this.state?.players.find(p => p.id === playerId)
    if (!player?.isOwner || this.state.phase !== 'results') return
    this.state = {
      ...INITIAL_STATE(this.state.code),
      players: this.state.players
        .filter(p => p.connected)
        .map((p, i) => ({ ...p, ready: false, isOwner: i === 0 })),
      rules: this.state.rules, // keep current rules
      engagement: this.state.engagement,
    }
    this._broadcast()
  }

  async _startRoundReview() {
    const reviewEnd = Date.now() + ROUND_REVIEW_MS
    this.state = {
      ...this.state,
      timerEnd: null,
      votingTimerEnd: null,
      roundReviewEnd: reviewEnd,
    }
    this._broadcast()
    await this.ctx.storage.setAlarm(reviewEnd)
  }

  async _finishRoundReview() {
    const nextPhase = this.state.phaseAfterReview || 'betweenRound'

    if (nextPhase === 'voting') {
      const voteEnd = Date.now() + VOTING_MS
      this.state = {
        ...this.state,
        phase: 'voting',
        activePlayerIdx: firstConnectedPlayerIdx(this.state),
        timerEnd: null,
        roundReviewEnd: null,
        phaseAfterReview: null,
        votingTimerEnd: voteEnd,
      }
      this._broadcast()
      await this.ctx.storage.setAlarm(voteEnd)
      return
    }

    this.state = {
      ...this.state,
      phase: 'betweenRound',
      activePlayerIdx: firstConnectedPlayerIdx(this.state),
      timerEnd: null,
      roundReviewEnd: null,
      phaseAfterReview: null,
      votingTimerEnd: null,
      betweenRoundVotes: { continue: [], vote: [] },
    }
    this._broadcast()
  }

  _pickWordPair() {
    const categories = this.state?.rules?.wordCategories
      || (this.state?.rules?.wordCategory ? [this.state.rules.wordCategory] : ['all'])
    const pool = categories.includes('all')
      ? words
      : words.filter(item => categories.includes(item.category))
    const candidates = pool.length > 0 ? pool : words
    return candidates[Math.floor(Math.random() * candidates.length)]
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
    this._observeMilestones()
    // Fire-and-forget persistence — don't block the broadcast on storage I/O.
    this._save().catch(() => {})
    const msg = JSON.stringify({ type: 'STATE', serverNow: Date.now(), payload: this._publicState() })
    // Source of truth is ctx.getWebSockets(): it survives hibernation and
    // includes accepted sockets. Only the current, joined connection for
    // each player receives state; replaced and unjoined sockets are skipped.
    const sockets = this.ctx.getWebSockets()
    const seen = new Set()
    for (const ws of sockets) {
      const playerId = ws.deserializeAttachment?.()?.playerId
      if (!playerId || this.sessions.get(playerId) !== ws) continue
      seen.add(ws)
      try { ws.send(msg) } catch {}
    }
    for (const ws of this.sessions.values()) {
      if (seen.has(ws)) continue
      try { ws.send(msg) } catch {}
    }
  }

  _publicState() {
    const { impostorIdx, secretWord, hint, engagement, ...pub } = this.state
    return pub
  }

  _record(event, id) {
    const info = this.state.engagement
    if (!info) return
    const accepted = consentReceipt(info.consent)
    recordRoomEvent(this.ctx, this.env, event, id, accepted ? info.attribution : { source: 'unattributed' }, { wasInvited: !!accepted && info.wasInvited })
  }

  _recordJoinRejected(reason) {
    recordRoomEvent(this.ctx, this.env, 'join_rejected', crypto.randomUUID(), { source: 'unattributed' }, { method: reason })
  }

  _withdrawMeasurement(playerId) {
    const info = this.state?.engagement
    if (!info || info.attributionOwnerId !== playerId) return
    info.consent = null
    info.attribution = cleanAttribution({ source: 'unattributed' })
    info.wasInvited = false
    this._save().catch(() => {})
  }

  _observeMilestones() {
    const info = this.state.engagement
    if (!info) return // Existing rooms remain playable after deploying this version.
    // An interruption is an observed empty room, not an inferred failed game.
    // It can later recover; keep it separate from finished-game counts.
    if (this.state.gameId && info.startedGame === this.state.gameId &&
        !['lobby', 'results'].includes(this.state.phase) &&
        !this.state.players.some(p => p.connected) && info.interruptedGame !== this.state.gameId) {
      info.interruptedGame = this.state.gameId
      this._record('game_interrupted', this.state.gameId)
    }
    if (!info.groupReady && this.state.players.filter(p => p.connected).length >= 3) {
      info.groupReady = true
      this._record('group_ready', info.id)
    }
    if (this.state.phase === 'playing' && info.startedGame !== this.state.gameId) {
      if (!info.startedGame) this._record('room_activated', info.id)
      info.startedGame = this.state.gameId
      this._record('game_started', this.state.gameId)
      if (info.completedGames > 0) this._record('game_repeated', this.state.gameId)
    }
    if (this.state.phase === 'results' && info.finishedGame !== this.state.gameId) {
      info.finishedGame = this.state.gameId
      info.completedGames++
      this._record('game_finished', this.state.gameId)
    }
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
        if (this.sessions.has(att.playerId) && this.sessions.get(att.playerId) !== ws) return null
        this.sessions.set(att.playerId, ws)
        return att.playerId
      }
    } catch {}
    return null
  }
}
