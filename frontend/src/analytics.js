const PRODUCTION_ORIGIN = 'https://juegoimpostor.app'

let campaign = {}

export function captureCampaign() {
  try {
    const params = new URLSearchParams(window.location.search)
    const keys = ['utm_source', 'utm_medium', 'utm_campaign']
    const incoming = Object.fromEntries(keys.map(key => [key, params.get(key)]).filter(([, value]) => value && /^[a-zA-Z0-9_-]{1,64}$/.test(value)))
    campaign = Object.keys(incoming).length ? incoming : JSON.parse(sessionStorage.getItem('el-impostor-campaign') || '{}')
    sessionStorage.setItem('el-impostor-campaign', JSON.stringify(campaign))
  } catch {}
}

export function trackOnce(key, eventName, props) {
  try {
    const seen = JSON.parse(sessionStorage.getItem('el-impostor-events') || '[]')
    if (seen.includes(key)) return
    sessionStorage.setItem('el-impostor-events', JSON.stringify([...seen.slice(-63), key]))
  } catch {}
  track(eventName, props)
}

function compactProps(props = {}) {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]),
  )
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

export function getInviteUrl(code) {
  const cleanCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `${getPublicOrigin()}/?room=${encodeURIComponent(cleanCode)}`
}

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
  if (typeof window === 'undefined' || !eventName) return
  const eventProps = compactProps({
    app: 'el-impostor',
    path: window.location.pathname,
    ...campaign,
    ...props,
  })

  window.dispatchEvent(new CustomEvent('el-impostor:event', {
    detail: { event: eventName, props: eventProps },
  }))

  window.zaraz?.track?.(eventName, eventProps)
  window.gtag?.('event', eventName, eventProps)
  window.plausible?.(eventName, { props: eventProps })
  window.dataLayer?.push?.({ event: eventName, ...eventProps })

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT
  if (endpoint && navigator.sendBeacon) {
    const body = JSON.stringify({ event: eventName, props: eventProps, ts: Date.now() })
    navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
  }
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
