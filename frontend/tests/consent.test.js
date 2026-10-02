import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { validMeasurementConsent, CONSENT_MAX_AGE } from '../../shared/consent.js'

const consentSource = readFileSync(new URL('../public/consent.js', import.meta.url), 'utf8')
const visitSource = readFileSync(new URL('../public/visit.js', import.meta.url), 'utf8')
function setup({ saved, signals = {}, blocked = false } = {}) {
  const values = new Map(Object.entries(saved || {}))
  const storage = {
    getItem: vi.fn(key => { if (blocked) throw Error('blocked'); return values.get(key) ?? null }),
    setItem: vi.fn((key, value) => { if (blocked) throw Error('blocked'); values.set(key, value) }),
    removeItem: vi.fn(key => values.delete(key)),
  }
  const listeners = {}
  const window = { addEventListener: (name, fn) => (listeners[name] ||= []).push(fn), dispatchEvent: event => listeners[event.type]?.forEach(fn => fn(event)) }
  const sandbox = { window, localStorage: storage, sessionStorage: storage, navigator: signals,
    document: { readyState: 'loading', addEventListener() {}, referrer: '' }, location: new URL('https://juegoimpostor.app/?utm_source=instagram'),
    CustomEvent: class { constructor(type, props) { this.type = type; Object.assign(this, props) } }, URL, URLSearchParams, crypto, AbortController,
    fetch: vi.fn().mockResolvedValue({ ok: true }),
  }
  runInNewContext(consentSource, sandbox)
  return { ...sandbox, values, storage, api: window.elImpostorConsent, sandbox }
}

describe('prior consent shared by static pages and React', () => {
  it('purges old opt-out tracking and never reads optional storage before acceptance', () => {
    const { api, values, storage, sandbox } = setup({ saved: {
      'el-impostor-measurement': 'on', 'el-impostor-acquisition': '{"attribution":{"source":"old"}}', 'el-impostor-prompt-rating': '123',
    } })
    runInNewContext(visitSource, sandbox)
    expect(api.read().decision).toBe('pending')
    expect(api.allowed()).toBe(false)
    expect(values.size).toBe(0)
    expect(storage.getItem.mock.calls.every(([key]) => key === 'el-impostor-consent')).toBe(true)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(sandbox.fetch).not.toHaveBeenCalled()
  })

  it('withdraws and cancels pending visits; a late response cannot restore acquisition', async () => {
    const { api, values, sandbox } = setup()
    const pending = []
    sandbox.fetch.mockImplementation(() => new Promise(r => { pending.push(r) }))
    runInNewContext(visitSource, sandbox)
    api.choose('accepted')
    expect(sandbox.fetch).toHaveBeenCalledTimes(2)
    const request = sandbox.fetch.mock.calls[0][1]
    expect(validMeasurementConsent(JSON.parse(request.body).consent)).toBe(true)
    expect(values.has('el-impostor-acquisition')).toBe(true)
    api.choose('rejected')
    expect(request.signal.aborted).toBe(true)
    for (const resolve of pending) resolve({ ok: true })
    await new Promise(r => setTimeout(r, 0))
    expect(values.has('el-impostor-acquisition')).toBe(false)
    expect(api.allowed()).toBe(false)
  })

  it('measures page views and coarse errors only after consent, excluding the admin panel', () => {
    const { api, window, sandbox } = setup()
    runInNewContext(visitSource, sandbox)
    window.dispatchEvent({ type: 'error', message: 'SECRET_NAME', filename: 'https://private/?token=SECRET' })
    expect(sandbox.fetch).not.toHaveBeenCalled()
    api.choose('accepted')
    for (let i = 0; i < 8; i++) window.dispatchEvent({ type: 'error', message: 'SECRET_NAME', error: { name: 'TypeError', stack: 'SECRET_STACK' }, filename: 'https://juegoimpostor.app/assets/index-ABC123.js?room=SECRET_ROOM', lineno: 42, colno: 123 })
    const bodies = sandbox.fetch.mock.calls.map(([, options]) => JSON.parse(options.body))
    expect(bodies.filter(e => e.event === 'page_view')).toHaveLength(1)
    expect(bodies.filter(e => e.event === 'client_error')).toHaveLength(5)
    expect(bodies.find(e => e.event === 'client_error').context).toMatchObject({ errorName: 'TypeError', script: 'app', line: 42, column: 123, version: 'connection-2026-10-03' })
    expect(JSON.stringify(bodies)).not.toContain('SECRET')
    api.choose('rejected')
    window.dispatchEvent({ type: 'unhandledrejection' })
    expect(sandbox.fetch).toHaveBeenCalledTimes(7)
    const admin = setup()
    admin.sandbox.location = new URL('https://juegoimpostor.app/admin-panel/')
    admin.api.choose('accepted')
    runInNewContext(visitSource, admin.sandbox)
    expect(admin.sandbox.fetch).not.toHaveBeenCalled()
  })

  it('only reports allowlisted exception names and never sends rejection content or external URLs', () => {
    const { api, window, sandbox } = setup()
    runInNewContext(visitSource, sandbox)
    api.choose('accepted')
    window.dispatchEvent({ type: 'unhandledrejection', reason: { name: 'SECRET_WORD', message: 'SECRET_MESSAGE', stack: 'SECRET_STACK' } })
    window.dispatchEvent({ type: 'error', filename: 'https://extension.example/SECRET.js', lineno: 12, colno: 50 })
    const bodies = sandbox.fetch.mock.calls.map(([, options]) => JSON.parse(options.body)).filter(e => e.event === 'client_error')
    expect(bodies[0].context.errorName).toBe('Unknown')
    expect(bodies[1].context.script).toBe('external')
    expect(bodies[1].context).not.toHaveProperty('line')
    expect(JSON.stringify(bodies)).not.toContain('SECRET')
  })

  it('rejects expired, future and malformed saved choices and respects DNT and GPC', () => {
    for (const saved of [null, {version:1,decision:'accepted',at:Date.now()-CONSENT_MAX_AGE}, {version:1,decision:'accepted',at:Date.now()+60000}, {version:0,decision:'accepted',at:Date.now()}]) {
      expect(setup({saved:{'el-impostor-consent':JSON.stringify(saved)}}).api.allowed()).toBe(false)
    }
    for (const signals of [{doNotTrack:'1'}, {globalPrivacyControl:true}]) {
      const { api } = setup({ signals })
      api.choose('accepted')
      expect(api.allowed()).toBe(false)
    }
  })

  it('works in memory with unavailable storage and applies withdrawal from another tab', () => {
    const unavailable = setup({ blocked: true })
    expect(unavailable.api.allowed()).toBe(false)
    unavailable.api.choose('accepted')
    expect(unavailable.api.allowed()).toBe(true)
    unavailable.api.choose('rejected')
    expect(unavailable.api.allowed()).toBe(false)
    const { api, values, window } = setup()
    api.choose('accepted')
    values.set('el-impostor-acquisition','old')
    values.set('el-impostor-consent', JSON.stringify({version:1,decision:'rejected',at:Date.now()}))
    window.dispatchEvent({type:'storage',key:'el-impostor-consent'})
    expect(api.allowed()).toBe(false)
    expect(values.has('el-impostor-acquisition')).toBe(false)
  })
})
