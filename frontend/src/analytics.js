import { cleanAttribution, cleanContext, CLIENT_EVENTS } from '../../shared/engagement.js'
import { WORKER_BASE, APP_VERSION } from './config.js'
import { consentReceipt } from '../../shared/consent.js'
const PRODUCTION_ORIGIN = 'https://juegoimpostor.app'

export function captureCampaign() {
  // visit.js captures campaigns on both static SEO pages and the app before navigation.
  return getAttribution()
}

function acquisition() {
  if (!measurementEnabled()) return {}
  try { return JSON.parse(sessionStorage.getItem('el-impostor-acquisition') || '{}') || {} } catch { return {} }
}
export function measurementEnabled() {
  try { return window.elImpostorConsent?.allowed() === true } catch { return false }
}
export function getMeasurementConsent() {
  try { return measurementEnabled() ? consentReceipt(window.elImpostorConsent.read()) : null } catch { return null }
}
export function getAttribution() {
  const saved = acquisition()
  return cleanAttribution(measurementEnabled() ? { ...saved.attribution, landing: saved.landing } : { source: 'unattributed' })
}
export function wasInvited() { return acquisition().invited === true }
export function setMeasurementEnabled(enabled) {
  window.elImpostorConsent?.choose(enabled ? 'accepted' : 'rejected')
}

export function trackOnce(key, eventName, props) {
  if (!measurementEnabled()) return
  try {
    const seen = JSON.parse(sessionStorage.getItem('el-impostor-events') || '[]')
    if (seen.includes(key)) return
    sessionStorage.setItem('el-impostor-events', JSON.stringify([...seen.slice(-63), key]))
  } catch {}
  track(eventName, props)
}

export function getPublicOrigin() {
  if (import.meta.env.VITE_PUBLIC_APP_URL) {
    return import.meta.env.VITE_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin
    : PRODUCTION_ORIGIN
}

export function getInviteUrl(code, method = 'share') {
  const cleanCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `${getPublicOrigin()}/?room=${encodeURIComponent(cleanCode)}&utm_source=${encodeURIComponent(method)}&utm_medium=invite&utm_campaign=room`
}

export function getInviteText(playerCount = 1) {
  const missing = Math.max(0, 3 - playerCount)
  return `${missing ? `Nos falta${missing === 1 ? '' : 'n'} ${missing} para jugar a El Impostor.` : '¿Una partida de El Impostor?'} Entra aquí, pon tu nombre y listo. Gratis y sin instalar nada.`
}
export function getNewGroupUrl() { return `${getPublicOrigin()}/?create=1&utm_source=result&utm_medium=referral&utm_campaign=new_group` }

export function getInviteCodeFromUrl() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('room') || params.get('sala') || ''
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

export function clearInviteCodeFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('room')
  url.searchParams.delete('sala')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function track(eventName, props = {}) {
  if (typeof window === 'undefined' || !CLIENT_EVENTS.has(eventName) || !measurementEnabled()) return
  try {
    const consent = getMeasurementConsent()
    if (!consent) return
    const event = { id: crypto.randomUUID(), event: eventName, consent, attribution: getAttribution(), context: cleanContext({
      path: window.location.pathname, version: APP_VERSION, wasInvited: wasInvited(), ...props,
    }) }
    const body = JSON.stringify(event)
    try {
      if (navigator.sendBeacon?.(`${WORKER_BASE}/events`, new Blob([body], { type: 'text/plain' }))) return
    } catch {}
    fetch(`${WORKER_BASE}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(() => {})
  } catch { /* Optional measurement must never break an action or reconnection. */ }
}

export async function sharePayload({ title, text, url }, props = {}) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      track('share_invite', { ...props, method: 'native' })
      return 'native'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }

  if (!navigator.clipboard?.writeText) throw new Error('No se pudo copiar. Selecciona el enlace para compartirlo.')
  await navigator.clipboard.writeText(`${text}\n${url}`)
  track('share_invite', { ...props, method: 'copy_fallback' })
  return 'copy_fallback'
}

export function getWhatsAppShareUrl(text, url) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
}
