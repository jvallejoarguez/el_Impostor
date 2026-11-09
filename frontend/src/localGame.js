import { normalizeWordCategories } from './wordCategories.js'

// Impostors never outnumber the rest of the group: 1 with 3–4 players, 2 with 5–6, 3 from 7 up.
export function maxImpostors(playerCount) {
  return Math.max(1, Math.min(3, Math.floor((playerCount - 1) / 2)))
}

// One-phone mode: the whole game lives on this device, so dealing happens here
// instead of in the room's Durable Object. Words already played this session are
// skipped until the chosen categories run out.
export function dealRound(words, { playerCount, impostors = 1, categories, used = [] }, random = Math.random) {
  const selected = normalizeWordCategories(categories)
  const pool = selected.includes('all') ? words : words.filter(item => selected.includes(item.category))
  const fresh = pool.filter(item => !used.includes(item.word))
  const candidates = fresh.length ? fresh : pool.length ? pool : words
  const { word, hint } = candidates[Math.floor(random() * candidates.length)]
  const seats = Array.from({ length: playerCount }, (_, i) => i)
  const count = Math.min(Number.isInteger(impostors) ? Math.max(1, impostors) : 1, maxImpostors(playerCount))
  const impostorIdxs = Array.from({ length: count }, () => seats.splice(Math.floor(random() * seats.length), 1)[0]).sort((a, b) => a - b)
  return { word, hint, impostorIdxs, starterIdx: Math.floor(random() * playerCount) }
}

export function playerNames(names, count) {
  return Array.from({ length: count }, (_, i) => names[i]?.trim() || `Jugador ${i + 1}`)
}

// "Ana", "Ana y Bruno", "Ana, Bruno e Inés": "y" turns into "e" before an /i/ sound.
export function joinNames(names) {
  if (names.length < 2) return names[0] ?? ''
  const last = names[names.length - 1]
  return `${names.slice(0, -1).join(', ')} ${/^h?[ií](?![aeiouáéíóú])/i.test(last) ? 'e' : 'y'} ${last}`
}
