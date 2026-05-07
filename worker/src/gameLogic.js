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
