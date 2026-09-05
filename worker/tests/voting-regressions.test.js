import { describe, it, expect } from 'vitest'
import { applyBetweenVote, applyCastVote, applyConfirmVote, computeResult } from '../src/gameLogic.js'

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
