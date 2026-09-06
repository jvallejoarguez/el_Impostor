import { WORKER_BASE } from './config.js'
import { cleanFeedback } from '../../shared/engagement.js'

export function claimPrompt(kind, now = Date.now()) {
  try {
    const key = `el-impostor-prompt-${kind}`
    const last = Number(localStorage.getItem(key) || 0)
    if (last && now - last < 86400000) return false
    localStorage.setItem(key, String(now))
    return true
  } catch { return false } // Never repeatedly prompt when storage is unavailable.
}

export async function submitFeedback(draft, signal) {
  const value = cleanFeedback(draft)
  if (!value) throw new Error('Selecciona una opción o escribe un comentario.')
  const response = await fetch(`${WORKER_BASE}/feedback`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value), credentials: 'omit', signal,
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('Has enviado varias respuestas. Prueba más tarde.')
    throw new Error('No se ha podido guardar. Tu respuesta sigue aquí para reintentarlo.')
  }
}
