import { normalizeWordCategories } from './wordCategories.js'

// One-phone mode: the whole game lives on this device, so dealing happens here
// instead of in the room's Durable Object. Words already played this session are
// skipped until the chosen categories run out.
export function dealRound(words, { playerCount, categories, used = [] }, random = Math.random) {
  const selected = normalizeWordCategories(categories)
  const pool = selected.includes('all') ? words : words.filter(item => selected.includes(item.category))
  const fresh = pool.filter(item => !used.includes(item.word))
  const candidates = fresh.length ? fresh : pool.length ? pool : words
  const { word, hint } = candidates[Math.floor(random() * candidates.length)]
  return { word, hint, impostorIdx: Math.floor(random() * playerCount), starterIdx: Math.floor(random() * playerCount) }
}

export function playerNames(names, count) {
  return Array.from({ length: count }, (_, i) => names[i]?.trim() || `Jugador ${i + 1}`)
}
