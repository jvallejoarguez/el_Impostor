// Shared by the static guides and the app. Only coarse attribution leaves the browser.
(() => {
  try {
    const params = new URLSearchParams(location.search)
    const safe = value => /^[a-zA-Z0-9_-]{1,64}$/.test(value || '') ? value : ''
    const key = 'el-impostor-acquisition'
    let saved = JSON.parse(sessionStorage.getItem(key) || 'null')
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
      const sameCampaign = saved && JSON.stringify(saved.attribution) === JSON.stringify(attribution)
      if (!sameCampaign) saved = { id: crypto.randomUUID(), attribution, landing: location.pathname, invited: false }
    }
    // A plain room URL also occurs on reload. Only explicit new invitations replace attribution.
    if (params.get('utm_medium') === 'invite' || ((!saved.sent) && (params.has('room') || params.has('sala')))) saved.invited = true
    sessionStorage.setItem(key, JSON.stringify(saved))
    if (saved.sent || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || localStorage.getItem('el-impostor-measurement') === 'off') return
    const local = ['localhost', '127.0.0.1'].includes(location.hostname)
    const endpoint = `${local ? 'http://localhost:8787' : 'https://el-impostor-worker-production.jvallejoarguez.workers.dev'}/events`
    const data = { id: saved.id, event: 'visit', attribution: { ...saved.attribution, landing: saved.landing }, context: { path: saved.landing, wasInvited: saved.invited } }
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true, credentials: 'omit' })
      .then(response => {
        if (!response.ok) return
        const current = JSON.parse(sessionStorage.getItem(key) || 'null')
        if (current?.id === saved.id) sessionStorage.setItem(key, JSON.stringify({ ...current, sent: true }))
      }).catch(() => {})
  } catch { /* Storage, network or analytics failures never block a page. */ }
})()
