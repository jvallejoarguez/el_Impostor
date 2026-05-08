// worker/tests/gameLogic.test.js
import { describe, it, expect } from 'vitest'
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

  it('never assigns impostorIdx to a disconnected player slot', () => {
    // Ghost at index 0 is disconnected. impostor must always be one of p1, p2, p3.
    const players = [
      makePlayer('p0', 'Ghost', { connected: false, ready: false }),
      makePlayer('p1', 'Ana', { isOwner: true, ready: true }),
      makePlayer('p2', 'Bob', { ready: true }),
      makePlayer('p3', 'Car', { ready: true }),
    ]
    for (let i = 0; i < 30; i++) {
      const state = makeState({ players })
      const next = applyStartGame(state, { word: 'Playa', hint: 'Lugar de vacaciones' })
      const impostor = next.players[next.impostorIdx]
      expect(impostor.connected).toBe(true)
    }
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
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true },
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
    let state = playingState()
    state = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    state = applySubmitWord(state, { playerId: 'p2', word: 'sol' })
    state = applySubmitWord(state, { playerId: 'p3', word: 'mar' })
    expect(state.phase).toBe('betweenRound')
  })

  it('advances to voting after all players speak and round >= roundsBeforeVote', () => {
    let state = playingState()
    state = { ...state, rules: { ...state.rules, roundsBeforeVote: 1 } }
    state = applySubmitWord(state, { playerId: 'p1', word: 'arena' })
    state = applySubmitWord(state, { playerId: 'p2', word: 'sol' })
    state = applySubmitWord(state, { playerId: 'p3', word: 'mar' })
    expect(state.phase).toBe('voting')
  })

  it('ignores submission from wrong player', () => {
    const state = playingState()
    const next = applySubmitWord(state, { playerId: 'p2', word: 'sol' })
    expect(next.wordHistory).toHaveLength(0)
    expect(next.activePlayerIdx).toBe(0)
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
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true },
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
    expect(state.phase).toBe('playing')
    expect(state.currentRound).toBe(2)
    expect(state.activePlayerIdx).toBe(0)
    expect(state.betweenRoundVotes).toEqual({ continue: [], vote: [] })
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
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true },
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
    votes: { p1: 'p3', p2: 'p3', p3: 'p2' },
    impostorIdx: 2,
    secretWord: 'Playa',
    hint: 'Lugar',
    rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true },
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
    expect(result.tally).toEqual({ p2: 1, p3: 2 })
    expect(result.secretWord).toBe('Playa')
  })

  it('computeResult: impostor not found when most-voted is not impostor', () => {
    const state = makeState({
      phase: 'voting',
      players: [makePlayer('p1', 'Ana'), makePlayer('p2', 'Bob'), makePlayer('p3', 'Car')],
      votes: { p1: 'p2', p2: 'p2', p3: 'p1' },
      impostorIdx: 2,
      secretWord: 'Playa',
      hint: 'Lugar',
      rules: { turnTime: 30, roundsBeforeVote: 2, maxPlayers: 8, imposterHasHint: true },
    })
    const result = computeResult(state)
    expect(result.found).toBe(false)
    expect(result.impostorId).toBe('p3')
  })
})
