import { describe, it, expect, vi } from 'vitest'
import worker from '../src/index.js'

function env(extra = {}) {
  const claimed = new Set()
  const fetch = vi.fn(async request => {
    const url = new URL(request.url)
    if (url.pathname === '/claim') {
      // The first candidate is already taken, so POST /rooms must try again.
      const ok = claimed.size > 0
      claimed.add(url.searchParams.get('code'))
      return Response.json({ claimed: ok })
    }
    return new Response('proxied')
  })
  return { FRONTEND_ORIGINS: 'https://juegoimpostor.app,https://*.el-impostor-djf.pages.dev', GAME_ROOM: { idFromName: name => name, get: () => ({ fetch }) }, fetch, ...extra }
}
const call = (path, init, e = env()) => worker.fetch(new Request(`https://worker${path}`, init), e, { waitUntil: () => {} })

describe('worker routing', () => {
  it('allows preview deployments without trusting look-alike origins', async () => {
    const preview = 'https://4f2a.el-impostor-djf.pages.dev'
    expect((await call('/rooms', { method: 'OPTIONS', headers: { Origin: preview } })).headers.get('Access-Control-Allow-Origin')).toBe(preview)
    const lookalike = await call('/rooms', { method: 'OPTIONS', headers: { Origin: 'https://el-impostor-djf.pages.dev.evil.example' } })
    expect(lookalike.headers.get('Access-Control-Allow-Origin')).toBe('https://juegoimpostor.app')
  })

  it('rejects WebSocket upgrades from other sites', async () => {
    const e = env()
    const foreign = await call('/rooms/ABCD/ws', { headers: { Upgrade: 'websocket', Origin: 'https://evil.example' } }, e)
    expect(foreign.status).toBe(403)
    expect(e.fetch).not.toHaveBeenCalled()
    const own = await call('/rooms/ABCD/ws', { headers: { Upgrade: 'websocket', Origin: 'https://juegoimpostor.app' } }, e)
    expect(await own.text()).toBe('proxied')
  })

  it('retries until a code is actually claimed and rate-limits room creation', async () => {
    const e = env()
    const created = await call('/rooms', { method: 'POST' }, e)
    expect(created.status).toBe(201)
    expect(e.fetch).toHaveBeenCalledTimes(2)
    const { code } = await created.json()
    expect(new URL(e.fetch.mock.calls[1][0].url).searchParams.get('code')).toBe(code)
    const limited = await call('/rooms', { method: 'POST' }, env({ ROOM_LIMITER: { limit: async () => ({ success: false }) } }))
    expect(limited.status).toBe(429)
  })
})
