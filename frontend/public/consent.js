// Shared by React and static guides. No optional storage is read before consent.
(() => {
  const KEY = 'el-impostor-consent'
  const VERSION = 1
  const MAX_AGE = 180 * 86400000
  let transient = null
  let panel, status, trigger
  const signalDenies = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true
  const clearOptional = () => {
    for (const key of ['el-impostor-acquisition', 'el-impostor-events', 'el-impostor-campaign']) {
      try { sessionStorage.removeItem(key) } catch {}
    }
    for (const key of ['el-impostor-measurement', 'el-impostor-prompt-rating', 'el-impostor-prompt-exit']) {
      try { localStorage.removeItem(key) } catch {}
    }
  }
  const read = () => {
    let saved = transient
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null') || transient } catch {}
    if (signalDenies()) return { decision: 'rejected', signal: true }
    if (saved?.version === VERSION && ['accepted', 'rejected'].includes(saved.decision) &&
      Number.isFinite(saved.at) && saved.at <= Date.now() && Date.now() - saved.at < MAX_AGE) return saved
    return { decision: 'pending' }
  }
  const allowed = () => {
    const yes = read().decision === 'accepted'
    if (!yes) clearOptional()
    return yes
  }
  const notify = () => {
    if (!allowed()) clearOptional()
    window.dispatchEvent(new CustomEvent('el-impostor:consent-change', { detail: read() }))
  }
  const hide = () => {
    if (panel) panel.hidden = true
    if (trigger?.isConnected) trigger.focus({ preventScroll: true })
  }
  const choose = decision => {
    if (!['accepted', 'rejected'].includes(decision)) return
    transient = { version: VERSION, decision: signalDenies() ? 'rejected' : decision, at: Date.now() }
    try { localStorage.setItem(KEY, JSON.stringify(transient)) } catch {}
    if (transient.decision !== 'accepted') clearOptional()
    notify()
    hide()
  }
  const open = () => {
    if (!panel) return
    panel.hidden = false
    const saved = read()
    panel.querySelector('[data-accept]').disabled = !!saved.signal
    status.textContent = saved.signal ? 'Tu navegador indica que no deseas seguimiento. La medición está desactivada.'
      : saved.decision === 'accepted' ? 'La medición está activada. Puedes retirarla con «Rechazar».'
      : saved.decision === 'rejected' ? 'La medición está desactivada.' : ''
  }
  window.elImpostorConsent = { allowed, read, choose, open, clearOptional }
  allowed() // An old “on” preference is not evidence of prior consent.
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) { transient = null; notify(); if (panel && !panel.hidden) open() }
  })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') notify() })
  function mount() {
    panel = document.createElement('section')
    panel.className = 'consent-panel'
    panel.setAttribute('aria-labelledby', 'consent-title')
    panel.hidden = true
    panel.innerHTML = '<h2 id="consent-title">Tú decides sobre la medición</h2><p>Usamos almacenamiento necesario para jugar y recordar tus ajustes. Si aceptas, también medimos visitas, clics y campañas con almacenamiento propio para mejorar el juego.</p><p>Puedes jugar igual si rechazas o sigues sin elegir. Cambia tu decisión en «Configurar medición».</p><p class="consent-status" role="status"></p><div class="consent-actions"><button type="button" data-reject>Rechazar</button><button type="button" data-accept>Aceptar medición</button></div><a href="/privacidad/">Privacidad, cookies y almacenamiento</a>'
    status = panel.querySelector('.consent-status')
    panel.querySelector('[data-reject]').addEventListener('click', () => choose('rejected'))
    panel.querySelector('[data-accept]').addEventListener('click', () => choose('accepted'))
    const footer = document.createElement('div')
    footer.className = 'consent-footer'
    trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.textContent = 'Configurar medición'
    trigger.addEventListener('click', () => { open(); panel.querySelector('[data-reject]').focus({ preventScroll: true }) })
    const link = document.createElement('a')
    link.href = '/privacidad/'
    link.textContent = 'Privacidad y cookies'
    footer.append(trigger, link)
    document.body.append(footer, panel)
    if (read().decision === 'pending') open()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
})()
