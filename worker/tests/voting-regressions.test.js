import { describe, it, expect } from 'vitest'
import { applyBetweenVote, applyCastVote, applyConfirmVote, applySubmitWord, computeResult, settleBetweenRound } from '../src/gameLogic.js'

const players = ['a','b','c','d'].map(id => ({id, name:id, connected:true}))
describe('voting decisions', () => {
  it('settles a tied between-round decision instead of waiting forever', () => {
    let state = {phase:'betweenRound', players, currentRound:1, betweenRoundVotes:{continue:[], vote:[]}}
    for (const [playerId, choice] of [['a','continue'],['b','vote'],['c','continue'],['d','vote']]) state = applyBetweenVote(state, {playerId, choice})
    expect(state.phase).toBe('voting')
  })
  it('locks a confirmed vote and cannot confirm an empty ballot', () => {
    const state = {phase:'voting', players, votes:{a:'b'}, confirmedVotes:['a']}
    expect(applyCastVote(state, {voterId:'a', targetId:'c'})).toBe(state)
    expect(applyConfirmVote(state, 'b')).toBe(state)
  })
  it('lets the impostor escape when tied for first, independent of vote insertion order', () => {
    for (const votes of [{a:'a', b:'b'}, {b:'b', a:'a'}]) {
      const result = computeResult({players, votes, impostorIdx:0, secretWord:'León'})
      expect(result.found).toBe(false)
      expect(result.tied).toBe(true)
    }
  })
})

describe('stalled rounds', () => {
  it('a disconnected active player does not end the round for the players after them', () => {
    const seats = players.map(p => p.id === 'b' ? { ...p, connected: false } : p)
    const state = { phase: 'playing', players: seats, activePlayerIdx: 1, currentRound: 1, wordHistory: [], rules: { roundsBeforeVote: 2 } }
    const next = applySubmitWord(state, { playerId: 'b', word: '...' })
    expect(next.phase).toBe('playing')
    expect(next.activePlayerIdx).toBe(2)
  })

  it('settles the between-round choice on timeout and when a voter leaves', () => {
    const base = { phase: 'betweenRound', players, currentRound: 1, betweenRoundVotes: { continue: [], vote: [] } }
    expect(settleBetweenRound(base, undefined, true).phase).toBe('voting')
    expect(settleBetweenRound({ ...base, betweenRoundVotes: { continue: ['a', 'b'], vote: ['c'] } }, undefined, true).phase).toBe('playing')
    // a, b and c chose; d went silent and then dropped, so everyone left has voted.
    const waiting = { ...base, betweenRoundVotes: { continue: ['a'], vote: ['b', 'c'] } }
    expect(settleBetweenRound(waiting)).toMatchObject({ phase: 'betweenRound' })
    const dropped = { ...waiting, players: players.map(p => p.id === 'd' ? { ...p, connected: false } : p) }
    expect(settleBetweenRound(dropped).phase).toBe('voting')
  })
})

describe('custom word cleaning', () => {
  it('trims, deduplicates and limits length and count', async () => {
    const { cleanCustomWords } = await import('../src/gameLogic.js')
    expect(cleanCustomWords(['  Hola  mundo ', 'hola mundo', 'a', 'x'.repeat(31), 42, 'Ñandú'])).toEqual(['Hola mundo', 'Ñandú'])
    expect(cleanCustomWords(Array.from({ length: 150 }, (_, i) => `palabra ${i}`))).toHaveLength(100)
    expect(cleanCustomWords('no es lista')).toEqual([])
  })
})
