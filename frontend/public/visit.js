// All optional reads, writes and requests are behind the shared consent gate.
(() => {
  const key = 'el-impostor-acquisition'
  let active = null
  let initialized = false
  const allowed = () => window.elImpostorConsent?.allowed() === true
  function capture() {
    if (!allowed()) { active?.abort(); active = null; initialized = false; return }
    if (active || initialized) return
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
      if (saved.sent) return
      const local = ['localhost', '127.0.0.1'].includes(location.hostname)
      const endpoint = `${local ? 'http://localhost:8787' : 'https://el-impostor-worker-production.jvallejoarguez.workers.dev'}/events`
      const data = { id: saved.id, event: 'visit', consent: window.elImpostorConsent.read(), attribution: { ...saved.attribution, landing: saved.landing }, context: { path: saved.landing, wasInvited: saved.invited } }
      const controller = new AbortController()
      active = controller
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'omit', signal: controller.signal })
        .then(response => {
          if (!response.ok || !allowed()) return
          const current = JSON.parse(sessionStorage.getItem(key) || 'null')
          if (current?.id === saved.id) sessionStorage.setItem(key, JSON.stringify({ ...current, sent: true }))
        }).catch(() => {}).finally(() => { if (active === controller) active = null })
    } catch { /* Blocked storage or network must never stop the game. */ }
  }
  window.addEventListener('el-impostor:consent-change', capture)
  capture()
})()
