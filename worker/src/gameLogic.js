// worker/src/gameLogic.js
import { avatarIndex, isAvatarId } from '../../shared/avatars.js'

export const WORD_CATEGORY_IDS = [
  'all',
  'animales',
  'comida',
  'lugares',
  'objetos',
  'naturaleza',
  'cultura',
  'profesiones',
  'deportes',
  'ficcion',
  'ciencia',
  'streamers',
  'youtubers',
  'tiktokers',
  'videojuegos',
  'libros',
  'cine_series',
  'musica',
  'futbol',
  'creadores_latam',
  'emociones',
]

const WORD_CATEGORY_SET = new Set(WORD_CATEGORY_IDS)

function clampInt(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

function connectedPlayerIndices(state) {
  return state.players
    .map((p, idx) => p.connected !== false ? idx : null)
    .filter(idx => idx !== null)
}

export function normalizeCategories(value) {
  const raw = Array.isArray(value) ? value : [value]
  const filtered = raw
    .filter(category => typeof category === 'string' && WORD_CATEGORY_SET.has(category))
  if (filtered.length === 0 || filtered.includes('all')) return ['all']
  return [...new Set(filtered)]
}

// Host-written words: trimmed, deduplicated, 2–30 characters, at most 100.
// They stay on the server; players only see how many there are.
export function cleanCustomWords(input) {
  if (!Array.isArray(input)) return []
  const seen = new Set()
  const words = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const word = raw.trim().replace(/\s+/g, ' ')
    const key = word.toLocaleLowerCase('es')
    if (word.length < 2 || word.length > 30 || seen.has(key)) continue
    seen.add(key)
    words.push(word)
    if (words.length === 100) break
  }
  return words
}

export function firstConnectedPlayerIdx(state) {
  return connectedPlayerIndices(state)[0] ?? 0
}

function sanitizeRules(state, patch = {}) {
  const next = {}
  const connectedCount = state.players.filter(p => p.connected !== false).length

  if ('turnTime' in patch) {
    const turnTime = clampInt(patch.turnTime, 10, 60)
    if (turnTime !== null) next.turnTime = turnTime
  }

  if ('roundsBeforeVote' in patch) {
    const roundsBeforeVote = clampInt(patch.roundsBeforeVote, 1, 5)
    if (roundsBeforeVote !== null) next.roundsBeforeVote = roundsBeforeVote
  }

  if ('maxPlayers' in patch) {
    const maxPlayers = clampInt(patch.maxPlayers, Math.max(3, connectedCount), 16)
    if (maxPlayers !== null) next.maxPlayers = maxPlayers
  }

  if ('imposterHasHint' in patch && typeof patch.imposterHasHint === 'boolean') {
    next.imposterHasHint = patch.imposterHasHint
  }

  if ('wordCategory' in patch && WORD_CATEGORY_SET.has(patch.wordCategory)) {
    next.wordCategories = normalizeCategories(patch.wordCategory)
  }

  if ('wordCategories' in patch) {
    next.wordCategories = normalizeCategories(patch.wordCategories)
  }

  return next
}

export function applyJoin(state, { id, name, isOwner, avatarId }) {
  const existing = state.players.find(p => p.id === id)
  if (existing) {
    return { ...state, players: state.players.map(p => p.id === id ? { ...p, connected: true } : p) }
  }
  return {
    ...state,
    players: [...state.players, { id, name, avatarId: avatarIndex(name, avatarId), connected: true, ready: false, isOwner: !!isOwner }],
  }
}

export function applyUpdateAvatar(state, { playerId, avatarId }) {
  if (state.phase !== 'lobby' || !isAvatarId(avatarId)) return state
  const player = state.players.find(p => p.id === playerId)
  if (!player || player.connected === false || player.avatarId === avatarId) return state
  return { ...state, players: state.players.map(p => p.id === playerId ? { ...p, avatarId } : p) }
}

export function applyReady(state, playerId) {
  if (state.phase !== 'lobby') return state
  return {
    ...state,
    players: state.players.map(p => p.id === playerId ? { ...p, ready: true } : p),
  }
}

export function applyUpdateRules(state, { playerId, rules }) {
  const player = state.players.find(p => p.id === playerId)
  if (!player?.isOwner) return state
  if (state.phase !== 'lobby') return state
  return { ...state, rules: { ...state.rules, ...sanitizeRules(state, rules) } }
}

export function applyStartGame(state, wordPair) {
  if (state.phase !== 'lobby') return state
  const connected = state.players.filter(p => p.connected)
  if (connected.length < 3) return state
  if (!connected.every(p => p.ready || p.isOwner)) return state
  // Pick from connected players, then map back to a state.players index
  // (state.players may contain disconnected ghosts that aren't valid impostors).
  const chosen = connected[Math.floor(Math.random() * connected.length)]
  const impostorIdx = state.players.findIndex(p => p.id === chosen.id)
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
    confirmedVotes: [],
    phaseAfterReview: null,
    roundReviewEnd: null,
    votingTimerEnd: null,
    betweenRoundVotes: { continue: [], vote: [] },
    result: null,
  }
}

export function applySubmitWord(state, { playerId, word }) {
  if (state.phase !== 'playing') return state
  const activePlayer = state.players[state.activePlayerIdx]
  if (activePlayer?.id !== playerId) return state

  const newHistory = [...state.wordHistory, { playerId, word, round: state.currentRound }]
  // Search from the active seat, not its position among connected players:
  // a disconnected active player must not end the round for everyone after them.
  const nextActiveIdx = connectedPlayerIndices(state).find(idx => idx > state.activePlayerIdx)
  const roundComplete = nextActiveIdx === undefined

  if (!roundComplete) {
    return { ...state, wordHistory: newHistory, activePlayerIdx: nextActiveIdx }
  }

  // Round complete
  return {
    ...state,
    wordHistory: newHistory,
    phase: 'roundReview',
    phaseAfterReview: state.currentRound >= state.rules.roundsBeforeVote ? 'voting' : 'betweenRound',
  }
}

export function applyBetweenVote(state, { playerId, choice }) {
  if (state.phase !== 'betweenRound') return state
  if (!['continue', 'vote'].includes(choice)) return state
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

  return settleBetweenRound(state, newVotes)
}

// Decides the between-round choice from connected players' votes. Re-run on
// disconnects and on timeout so one silent player can never stall the room;
// a timeout continues only with more "continue" votes, otherwise it votes.
export function settleBetweenRound(state, votes = state.betweenRoundVotes, timedOut = false) {
  if (state.phase !== 'betweenRound') return state
  const connected = new Set(state.players.filter(p => p.connected).map(p => p.id))
  const continues = votes.continue.filter(id => connected.has(id)).length
  const voteNow = votes.vote.filter(id => connected.has(id)).length
  const majority = Math.floor(connected.size / 2) + 1

  if (continues >= majority || (timedOut && continues > voteNow)) {
    return {
      ...state,
      phase: 'playing',
      currentRound: state.currentRound + 1,
      activePlayerIdx: firstConnectedPlayerIdx(state),
      betweenRoundVotes: { continue: [], vote: [] },
    }
  }

  if (timedOut || voteNow >= majority || continues + voteNow >= connected.size) {
    return {
      ...state,
      phase: 'voting',
      betweenRoundVotes: { continue: [], vote: [] },
    }
  }

  return { ...state, betweenRoundVotes: votes }
}

export function applyCastVote(state, { voterId, targetId }) {
  if (state.phase !== 'voting') return state
  if (state.confirmedVotes?.includes(voterId)) return state
  if (!state.players.some(p => p.id === targetId)) return state
  return { ...state, votes: { ...state.votes, [voterId]: targetId } }
}

export function applyConfirmVote(state, voterId) {
  if (state.phase !== 'voting') return state
  if (!state.votes[voterId]) return state
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

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const mostVotedId = ranked[0]?.[0]
  const tied = ranked.length > 1 && ranked[0][1] === ranked[1][1]
  const impostor = state.players[state.impostorIdx]
  const found = !tied && mostVotedId === impostor?.id

  return {
    found,
    tied,
    impostorId: impostor?.id,
    impostorName: impostor?.name,
    tally,
    secretWord: state.secretWord,
  }
}
