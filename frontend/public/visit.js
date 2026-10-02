// All optional reads, writes and requests are behind the shared consent gate.
(() => {
  if (location.pathname.startsWith('/admin-panel')) return
  const key = 'el-impostor-acquisition'
  const active = new Set()
  let initialized = false
  let pageSent = false
  let errorCount = 0
  const allowed = () => window.elImpostorConsent?.allowed() === true
  const pagePath = () => {
    const path = location.pathname.replace(/\/index\.html$/, '/')
    return /^\/[a-z0-9/-]{0,100}$/.test(path) ? path : '/'
  }
  const endpoint = `${['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : 'https://el-impostor-worker-production.jvallejoarguez.workers.dev'}/events`
  function send(data, onSuccess) {
    if (!allowed()) return
    const controller = new AbortController()
    active.add(controller)
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'omit', signal: controller.signal })
      .then(response => { if (response.ok && !controller.signal.aborted && allowed()) onSuccess?.() })
      .catch(() => {}).finally(() => active.delete(controller))
  }
  function capture() {
    if (!allowed()) { active.forEach(controller => controller.abort()); active.clear(); initialized = false; pageSent = false; return }
    if (initialized) return
    try {
      const params = new URLSearchParams(location.search)
      const safe = value => /^[a-zA-Z0-9_-]{1,64}$/.test(value || '') ? value : ''
      let saved = JSON.parse(sessionStorage.getItem(key) || 'null')
      if (!saved?.id || !saved.attribution) saved = null
      const incoming = safe(params.get('utm_source'))
      if (!saved || incoming) {
        let source = 'direct', medium = 'none'
        if (document.referrer) {
          const ref = new URL(document.referrer)
          if (ref.origin !== location.origin) {
            source = /(^|\.)google\.[a-z.]+$/.test(ref.hostname) ? 'google' : /(^|\.)bing\.com$/.test(ref.hostname) ? 'bing' : 'referral'
            medium = ['google', 'bing'].includes(source) ? 'organic' : 'referral'
          }
        }
        const attribution = { source: incoming || source, medium: safe(params.get('utm_medium')) || medium, campaign: safe(params.get('utm_campaign')), content: safe(params.get('utm_content')) }
        if (!saved || JSON.stringify(saved.attribution) !== JSON.stringify(attribution)) saved = { id: crypto.randomUUID(), attribution, landing: location.pathname, invited: false }
      }
      if (params.get('utm_medium') === 'invite' || (!saved.sent && (params.has('room') || params.has('sala')))) saved.invited = true
      sessionStorage.setItem(key, JSON.stringify(saved))
      initialized = true
      const attribution = { ...saved.attribution, landing: saved.landing }
      if (!pageSent) {
        pageSent = true
        send({ id: crypto.randomUUID(), event: 'page_view', consent: window.elImpostorConsent.read(), attribution, context: { path: pagePath() } })
      }
      if (saved.sent) return
      send({ id: saved.id, event: 'visit', consent: window.elImpostorConsent.read(), attribution, context: { path: saved.landing, wasInvited: saved.invited } }, () => {
        const current = JSON.parse(sessionStorage.getItem(key) || 'null')
        if (current?.id === saved.id) sessionStorage.setItem(key, JSON.stringify({ ...current, sent: true }))
      })
    } catch { /* Blocked storage or network must never stop the game. */ }
  }
  window.addEventListener('el-impostor:consent-change', capture)
  function reportError(method, event) {
    if (!allowed() || errorCount >= 5) return
    errorCount++
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
      if (!saved) return
      const errorName = (event.error || event.reason)?.name
      const diagnostic = { version: 'connection-2026-10-03',
        errorName: ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'SecurityError', 'NotAllowedError', 'AbortError', 'NetworkError', 'InvalidStateError', 'QuotaExceededError'].includes(errorName) ? errorName : 'Unknown',
        script: 'unknown' }
      // Keep only a fixed source category and numeric position, never the URL.
      if (event.filename) {
        try {
          const url = new URL(event.filename, location.origin)
          if (url.origin !== location.origin) diagnostic.script = 'external'
          else if (/^\/assets\/[a-zA-Z0-9_-]+\.js$/.test(url.pathname)) diagnostic.script = 'app'
          else if (url.pathname === '/visit.js') diagnostic.script = 'visit'
          else if (url.pathname === '/consent.js') diagnostic.script = 'consent'
          if (['app', 'visit', 'consent'].includes(diagnostic.script)) {
            for (const [key, value] of [['line', event.lineno], ['column', event.colno]]) {
              if (Number.isInteger(value) && value > 0 && value <= 10000000) diagnostic[key] = value
            }
          }
        } catch {}
      }
      send({ id: crypto.randomUUID(), event: 'client_error', consent: window.elImpostorConsent.read(),
        attribution: { ...saved.attribution, landing: saved.landing }, context: { path: pagePath(), method, ...diagnostic } })
    } catch {}
  }
  // Deliberately omit messages, stacks, URLs, names and submitted content.
  window.addEventListener('error', event => reportError('script_error', event))
  window.addEventListener('unhandledrejection', event => reportError('unhandled_rejection', event))
  capture()
})()
