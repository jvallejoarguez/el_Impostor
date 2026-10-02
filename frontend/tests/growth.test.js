import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { getInviteText, getInviteUrl, getNewGroupUrl, track, getAttribution, measurementEnabled, getMeasurementConsent } from '../src/analytics.js'
import { claimPrompt, submitFeedback } from '../src/feedback.js'

const consent = () => ({ version: 1, decision: 'accepted', at: Date.now() })
const consentApi = { allowed: () => !navigator.globalPrivacyControl && navigator.doNotTrack !== '1', read: consent }
const memory = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) }
}
afterEach(() => vi.unstubAllGlobals())

describe('growth flows', () => {
  it('never throws into gameplay when consent access or the network API throws', () => {
    vi.stubGlobal('window', { location: { pathname: '/' }, elImpostorConsent: { allowed: () => true, read: () => { throw Error('unavailable') } } })
    expect(getMeasurementConsent()).toBeNull()
    expect(() => track('join_failed', { method: 'timeout' })).not.toThrow()
    vi.stubGlobal('window', { location: { pathname: '/' }, elImpostorConsent: consentApi })
    vi.stubGlobal('navigator', { sendBeacon: () => { throw Error('blocked') } })
    vi.stubGlobal('sessionStorage', memory())
    vi.stubGlobal('fetch', () => { throw Error('blocked') })
    expect(() => track('join_failed', { method: 'timeout' })).not.toThrow()
  })
  it('creates usable room links, distinct QR attribution and result links without stale rooms', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000', hostname: 'localhost' } })
    const url = new URL(getInviteUrl('ab-cd', 'qr'))
    expect(url.searchParams.get('room')).toBe('ABCD')
    expect(url.searchParams.get('utm_source')).toBe('qr')
    expect(url.searchParams.get('utm_medium')).toBe('invite')
    expect(getInviteText(1)).toContain('Nos faltan 2')
    expect(getInviteText(2)).toContain('Nos falta 1')
    expect(getInviteText(3)).not.toContain('falta')
    expect(new URL(getNewGroupUrl()).searchParams.get('create')).toBe('1')
    expect(new URL(getNewGroupUrl()).searchParams.has('room')).toBe(false)
  })

  it('limits prompts across games and safely skips prompts when storage is unavailable', () => {
    vi.stubGlobal('localStorage', memory())
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { elImpostorConsent: consentApi })
    expect(claimPrompt('rating', 100000000)).toBe(true)
    expect(claimPrompt('rating', 100000001)).toBe(false)
    expect(claimPrompt('rating', 200000000)).toBe(true)
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked') } })
    expect(claimPrompt('exit')).toBe(false)
  })

  it('keeps the same feedback id for safe retry and only resolves after successful storage', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetch)
    const draft = { id: crypto.randomUUID(), kind: 'problem', topic: 'connection', comment: 'Se cortó', context: { name: 'Ana', phase: 'voting' } }
    await expect(submitFeedback(draft)).rejects.toThrow('Tu respuesta sigue aquí')
    await expect(submitFeedback(draft)).resolves.toBeUndefined()
    const bodies = fetch.mock.calls.map(call => JSON.parse(call[1].body))
    expect(bodies[0].id).toBe(bodies[1].id)
    expect(bodies[0].context).toEqual({ phase: 'voting' })
  })

  it('uses the collector fallback, strips private properties and respects browser privacy signals', async () => {
    vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory())
    vi.stubGlobal('window', { location: { pathname: '/' }, elImpostorConsent: consentApi })
    vi.stubGlobal('navigator', { sendBeacon: () => false })
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    track('share_invite', { method: 'whatsapp', roomCode: 'ABCD', name: 'Ana', secretWord: 'León' })
    expect(JSON.parse(fetch.mock.calls[0][1].body).context).toMatchObject({ method: 'whatsapp' })
    expect(fetch.mock.calls[0][1].body).not.toContain('León')
    track('game_finished')
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    expect(measurementEnabled()).toBe(false)
    track('share_invite')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getAttribution().source).toBe('unattributed')
  })

  it('preserves a campaign from an SEO page to the game and deduplicates visits after reload', async () => {
    const source = readFileSync(new URL('../public/visit.js', import.meta.url), 'utf8')
    const sessionStorage = memory(), localStorage = memory()
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    const sandbox = { URL, URLSearchParams, crypto, AbortController, window: { elImpostorConsent: { allowed: () => true, read: consent }, addEventListener() {} }, sessionStorage, localStorage, navigator: {}, fetch,
      document: { referrer: '' }, location: new URL('https://juegoimpostor.app/palabras-para-el-impostor/animales/?utm_source=instagram&utm_medium=organic_social&utm_campaign=septiembre&utm_content=clip01') }
    runInNewContext(source, sandbox)
    await new Promise(resolve => setTimeout(resolve, 0))
    sandbox.location = new URL('https://juegoimpostor.app/?category=animales')
    sandbox.document.referrer = 'https://juegoimpostor.app/palabras-para-el-impostor/animales/'
    runInNewContext(source, sandbox)
    const bodies = () => fetch.mock.calls.map(([, options]) => JSON.parse(options.body))
    expect(bodies().filter(e => e.event === 'visit')).toHaveLength(1)
    expect(bodies().filter(e => e.event === 'page_view').map(e => e.context.path)).toEqual(['/palabras-para-el-impostor/animales/', '/'])
    const saved = JSON.parse(sessionStorage.getItem('el-impostor-acquisition'))
    expect(saved.attribution).toMatchObject({ source: 'instagram', content: 'clip01' })
    expect(saved.landing).toBe('/palabras-para-el-impostor/animales/')
    sandbox.location = new URL('https://juegoimpostor.app/?room=ABCD&utm_source=qr&utm_medium=invite&utm_campaign=room')
    runInNewContext(source, sandbox)
    expect(JSON.parse(sessionStorage.getItem('el-impostor-acquisition')).invited).toBe(true)
    expect(bodies().filter(e => e.event === 'visit')).toHaveLength(2)
    expect(bodies().filter(e => e.event === 'page_view')).toHaveLength(3)
  })
})
