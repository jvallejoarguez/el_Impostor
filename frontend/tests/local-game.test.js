import { describe, expect, it } from 'vitest'
import { dealRound, playerNames } from '../src/localGame.js'
import words from '../../worker/src/words.json'

describe('one-phone dealing', () => {
  it('picks a word from the chosen categories and seats inside the group', () => {
    for (let i = 0; i < 50; i++) {
      const round = dealRound(words, { playerCount: 5, categories: ['futbol'] })
      expect(words.find(item => item.word === round.word)).toMatchObject({ category: 'futbol', hint: round.hint })
      expect(round.impostorIdx).toBeGreaterThanOrEqual(0)
      expect(round.impostorIdx).toBeLessThan(5)
      expect(round.starterIdx).toBeLessThan(5)
    }
  })

  it('skips words already played until the category runs out', () => {
    const pool = words.filter(item => item.category === 'animales').map(item => item.word)
    const used = pool.slice(1)
    expect(dealRound(words, { playerCount: 3, categories: ['animales'], used }).word).toBe(pool[0])
    expect(pool).toContain(dealRound(words, { playerCount: 3, categories: ['animales'], used: pool }).word)
  })

  it('fills blank names with numbered players', () => {
    expect(playerNames(['Ana', '  ', 'Bruno', 'Sobra'], 3)).toEqual(['Ana', 'Jugador 2', 'Bruno'])
  })
})
