import { describe, expect, it } from 'vitest'
import { dealRound, joinNames, maxImpostors, playerNames } from '../src/localGame.js'
import words from '../../worker/src/words.json'

describe('one-phone dealing', () => {
  it('picks a word from the chosen categories and seats inside the group', () => {
    for (let i = 0; i < 50; i++) {
      const round = dealRound(words, { playerCount: 5, categories: ['futbol'] })
      expect(words.find(item => item.word === round.word)).toMatchObject({ category: 'futbol', hint: round.hint })
      expect(round.impostorIdxs).toHaveLength(1)
      expect(round.impostorIdxs[0]).toBeGreaterThanOrEqual(0)
      expect(round.impostorIdxs[0]).toBeLessThan(5)
      expect(round.starterIdx).toBeLessThan(5)
    }
  })

  it('deals several distinct impostors when asked', () => {
    for (let i = 0; i < 50; i++) {
      const { impostorIdxs } = dealRound(words, { playerCount: 8, impostors: 3, categories: ['all'] })
      expect(new Set(impostorIdxs).size).toBe(3)
      expect(impostorIdxs.every(idx => idx >= 0 && idx < 8)).toBe(true)
      expect(impostorIdxs).toEqual([...impostorIdxs].sort((a, b) => a - b))
    }
  })

  it('never lets impostors outnumber the rest of the group', () => {
    expect([3, 4, 5, 6, 7, 16].map(maxImpostors)).toEqual([1, 1, 2, 2, 3, 3])
    expect(dealRound(words, { playerCount: 4, impostors: 3, categories: ['all'] }).impostorIdxs).toHaveLength(1)
    expect(dealRound(words, { playerCount: 5, impostors: 0, categories: ['all'] }).impostorIdxs).toHaveLength(1)
  })

  it('lists impostor names the Spanish way', () => {
    expect(joinNames(['Ana'])).toBe('Ana')
    expect(joinNames(['Ana', 'Bruno'])).toBe('Ana y Bruno')
    expect(joinNames(['Ana', 'Bruno', 'Inés'])).toBe('Ana, Bruno e Inés')
    expect(joinNames(['Ana', 'Hilario'])).toBe('Ana e Hilario')
    expect(joinNames(['Ana', 'Hierro'])).toBe('Ana y Hierro')
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
