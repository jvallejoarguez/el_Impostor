import { WORD_CATEGORIES } from './wordCategories.js'

const SESSION_KEY = 'el-impostor-session'

// Only reconnect information is stored. Roles and words always come from the server.
export function readSession(storage) {
  try {
    storage ||= window.sessionStorage
    const saved = JSON.parse(storage.getItem(SESSION_KEY))
    if (typeof saved?.code === 'string' && /^[A-Z0-9]{4}$/.test(saved.code) && typeof saved?.name === 'string' &&
        saved.name.trim().length >= 2 && saved.name.length <= 16) return { code: saved.code, name: saved.name.trim() }
  } catch {}
  return null
}

export function saveSession(session) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: session.code, name: session.name })) } catch {}
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function entryFromUrl(search, saved) {
  const params = new URLSearchParams(search)
  const rawCode = params.get('room') || params.get('sala') || ''
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  const requestedCategory = params.get('category')
  const category = WORD_CATEGORIES.some(item => item.id === requestedCategory) ? requestedCategory : 'all'
  // An explicit invitation or new-game link takes precedence over a previous session.
  if (rawCode) return { screen: saved?.code === code ? 'lobby' : 'join', code, name: saved?.name || '', category, resume: saved?.code === code }
  if (requestedCategory || params.get('create') === '1') return { screen: 'create', code: '', name: saved?.name || '', category, resume: false }
  if (saved) return { screen: 'lobby', ...saved, category, resume: true }
  return { screen: 'home', code: '', name: '', category, resume: false }
}

export function updateEntryUrl(code = '') {
  const url = new URL(window.location.href)
  for (const key of ['room', 'sala', 'category', 'create']) url.searchParams.delete(key)
  if (code) url.searchParams.set('room', code)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
