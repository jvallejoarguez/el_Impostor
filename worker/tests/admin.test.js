import { describe, it, expect, vi, afterEach } from 'vitest'
import worker from '../src/index.js'
import { AdminAuth } from '../src/Admin.js'

const password = 'test-only-admin-password-with-more-than-32-chars'
function setup() {
  const values = new Map()
  let alarm, queue = Promise.resolve()
  const storage = {
    get: async key => structuredClone(values.get(key)),
    put: async (key, value) => values.set(key, structuredClone(value)),
    delete: async key => values.delete(key),
    list: async ({ prefix = '', limit = Infinity } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix)).slice(0, limit)),
    getAlarm: async () => alarm, setAlarm: async value => { alarm = value },
    transaction: fn => { const work = queue.then(() => fn(storage)); queue = work.catch(() => {}); return work },
  }
  const env = { ADMIN_PASSWORD: password, FRONTEND_ORIGINS: 'https://juegoimpostor.app',
    ENGAGEMENT: { idFromName: v => v, get: () => ({ fetch: async () => Response.json({ counters: [], feedback: [] }) }) } }
  const auth = new AdminAuth({ storage }, env)
  env.ADMIN_AUTH = { idFromName: v => v, get: () => auth }
  const request = (path, { method = 'GET', body, cookie, origin = 'https://juegoimpostor.app', contentType = 'application/json' } = {}) => worker.fetch(new Request(`https://worker.example/admin-panel/api/${path}`, {
    method, headers: { Origin: origin, 'Content-Type': contentType, ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': '192.0.2.10' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), env)
  const login = () => request('login', { method: 'POST', body: { password } })
  return { env, request, login, auth, values }
}
afterEach(() => vi.useRealTimers())

describe('owner-only admin sessions', () => {
  it('protects reports, issues an HttpOnly cookie without exposing credentials, and revokes logout', async () => {
    const { request, login, values } = setup()
    expect((await request('report')).status).toBe(401)
    expect((await request('report', { cookie: '__Host-impostor-admin=forged' })).status).toBe(401)
    const response = await login()
    expect(response.status).toBe(200)
    const cookie = response.headers.get('Set-Cookie')
    for (const flag of ['__Host-impostor-admin=', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) expect(cookie).toContain(flag)
    const body = await response.text()
    expect(body).not.toContain(password)
    expect(body).not.toContain('token')
    expect(JSON.stringify([...values])).not.toContain(password)
    const report = await request('report?days=2', { cookie })
    expect(report.status).toBe(200)
    expect(report.headers.get('Cache-Control')).toContain('no-store')
    expect(report.headers.has('Access-Control-Allow-Origin')).toBe(false)
    expect((await report.json()).reports).toHaveLength(2)
    expect((await request('logout', { method: 'POST', cookie })).status).toBe(200)
    expect((await request('report', { cookie })).status).toBe(401)
  })
  it('fails closed for missing configuration, bad origins, methods, body size and periods', async () => {
    const { env, request, login } = setup()
    expect((await request('login', { method: 'POST', body: { password }, origin: 'https://evil.test' })).status).toBe(403)
    expect((await request('login', { method: 'POST', body: 'x'.repeat(2000) })).status).toBe(400)
    expect((await request('login', { method: 'POST', body: { password }, contentType: 'text/plain' })).status).toBe(400)
    expect((await request('login')).status).toBe(405)
    const cookie = (await login()).headers.get('Set-Cookie')
    for (const days of ['0', '31', 'NaN', '1.5']) expect((await request(`report?days=${days}`, { cookie })).status).toBe(400)
    delete env.ADMIN_PASSWORD
    expect((await login()).status).toBe(503)
    expect((await request('report', { cookie })).status).toBe(401)
  })
  it('enforces the durable attempt limit across simultaneous requests and cleans up', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-24T10:01:00Z'))
    const { request, values, auth } = setup()
    const results = await Promise.all(Array.from({ length: 7 }, () => request('login', { method: 'POST', body: { password: 'wrong' } })))
    expect(results.filter(r => r.status === 401)).toHaveLength(5)
    expect(results.filter(r => r.status === 429)).toHaveLength(2)
    expect(JSON.stringify([...values])).not.toContain('192.0.2.10')
    vi.setSystemTime(new Date('2026-09-24T10:17:00Z'))
    await auth.alarm()
    expect(values.size).toBe(0)
    expect((await request('login', { method: 'POST', body: { password } })).status).toBe(200)
  })
  it('expires sessions and invalidates every session when the owner key is rotated', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
    const { env, request, login, auth, values } = setup()
    const cookie = (await login()).headers.get('Set-Cookie')
    vi.setSystemTime(new Date('2026-09-24T18:00:01Z'))
    expect((await request('report', { cookie })).status).toBe(401)
    await auth.alarm()
    expect(values.size).toBe(0)
    const newerCookie = (await login()).headers.get('Set-Cookie')
    env.ADMIN_PASSWORD = `${password}-rotated`
    expect((await request('report', { cookie: newerCookie })).status).toBe(401)
  })
})
