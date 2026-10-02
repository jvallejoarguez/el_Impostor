import { readEngagementReport } from './Engagement.js'

const SESSION_MS = 8 * 60 * 60 * 1000
const RATE_MS = 15 * 60 * 1000
const encoder = new TextEncoder()
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('')
const secureEqual = async (a, b) => {
  const [left, right] = await Promise.all([digest(a), digest(b)])
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}
const reply = (body, status = 200, extra = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', ...extra,
} })
function cookieName(request) {
  return ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname) ? 'impostor-admin-local' : '__Host-impostor-admin'
}
function cookie(request, value, maxAge) {
  const name = cookieName(request)
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${name.startsWith('__Host-') ? '; Secure' : ''}`
}
function sessionToken(request) {
  const name = cookieName(request)
  return (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || ''
}

// Server-only session store. Separate alarms and storage from gameplay and analytics.
export class AdminAuth {
  constructor(ctx, env) { this.ctx = ctx; this.env = env }

  async fetch(request) {
    const data = await request.json()
    const now = Date.now()
    if (!this.env.ADMIN_PASSWORD || this.env.ADMIN_PASSWORD.length < 32) return reply({ error: 'El acceso privado no está configurado.' }, 503)
    const passwordVersion = await digest(`admin-password-v1:${this.env.ADMIN_PASSWORD}`)
    if (data.action === 'login') {
      if (typeof data.password !== 'string' || data.password.length > 256) return reply({ error: 'Clave incorrecta.' }, 401)
      // A keyed, rotating digest prevents storage of IP addresses or reversible IP hashes.
      const ipKey = `rate:${await digest(`${passwordVersion}:${Math.floor(now / RATE_MS)}:${data.ip || 'unknown'}`)}`
      return this.ctx.storage.transaction(async storage => {
        const count = (await storage.get(ipKey))?.count || 0
        if (count >= 5) return reply({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429, { 'Retry-After': '900' })
        if (!await secureEqual(data.password, this.env.ADMIN_PASSWORD)) {
          // A hard cap bounds attack-driven storage until the next cleanup.
          const rates = await storage.list({ prefix: 'rate:', limit: 2000 })
          if (!rates.has(ipKey) && rates.size >= 2000) return reply({ error: 'Demasiados intentos. Inténtalo más tarde.' }, 429)
          await storage.put(ipKey, { count: count + 1, expires: now + RATE_MS })
          const alarm = await storage.getAlarm()
          if (!alarm || alarm > now + RATE_MS) await storage.setAlarm(now + RATE_MS)
          return reply({ error: 'Clave incorrecta.' }, 401)
        }
        const sessions = await storage.list({ prefix: 'session:' })
        // Limit concurrent sessions; only a successful owner login can reach this path.
        for (const [key, value] of sessions) if (value.expires <= now) await storage.delete(key)
        const live = [...sessions].filter(([, value]) => value.expires > now).sort((a, b) => a[1].expires - b[1].expires)
        while (live.length >= 10) await storage.delete(live.shift()[0])
        const token = `${crypto.randomUUID()}${crypto.randomUUID()}`
        const expires = now + SESSION_MS
        await storage.put(`session:${await digest(token)}`, { expires, passwordVersion })
        await storage.delete(ipKey)
        const alarm = await storage.getAlarm()
        if (!alarm || alarm > now + RATE_MS) await storage.setAlarm(now + RATE_MS)
        return reply({ token, expires })
      })
    }
    if (typeof data.token !== 'string' || !/^[a-f0-9-]{72}$/.test(data.token)) return reply({ error: 'Inicia sesión para acceder.' }, 401)
    const key = `session:${await digest(data.token)}`
    const session = await this.ctx.storage.get(key)
    if (!session || session.expires <= now || session.passwordVersion !== passwordVersion) {
      if (session) await this.ctx.storage.delete(key)
      return reply({ error: 'La sesión ha caducado. Vuelve a entrar.' }, 401)
    }
    if (data.action === 'logout') await this.ctx.storage.delete(key)
    return reply({ authenticated: true, expires: session.expires })
  }

  async alarm() {
    const now = Date.now()
    const values = await this.ctx.storage.list()
    let next = Infinity
    for (const [key, value] of values) {
      if (value.expires <= now) await this.ctx.storage.delete(key)
      else next = Math.min(next, value.expires)
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next)
  }
}

async function readPassword(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return null
  if (Number(request.headers.get('Content-Length')) > 1024 || !request.body) return null
  const reader = request.body.getReader()
  const chunks = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 1024) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let at = 0
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes))?.password } catch { return null }
}

export async function handleAdmin(request, env) {
  const path = new URL(request.url).pathname
  const action = path.split('/').at(-1)
  if (!['login', 'logout', 'session', 'report'].includes(action)) return reply({ error: 'No encontrado.' }, 404)
  if (request.method !== (['login', 'logout'].includes(action) ? 'POST' : 'GET')) return reply({ error: 'Método no permitido.' }, 405)
  if (!env.ADMIN_AUTH) return reply({ error: 'El acceso privado no está configurado.' }, 503)
  if (request.method === 'POST') {
    const origins = (env.FRONTEND_ORIGINS || env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim())
    if (!origins.includes(request.headers.get('Origin'))) return reply({ error: 'Origen no permitido.' }, 403)
  }
  const auth = env.ADMIN_AUTH.get(env.ADMIN_AUTH.idFromName('owner'))
  try {
    if (action === 'login') {
      const password = await readPassword(request)
      if (typeof password !== 'string' || password.length > 256) return reply({ error: 'Introduce una clave válida.' }, 400)
      const result = await auth.fetch(new Request('https://internal/auth', { method: 'POST', body: JSON.stringify({ action, password, ip: request.headers.get('CF-Connecting-IP') }) }))
      const data = await result.json()
      if (!result.ok) return reply({ error: data.error }, result.status, result.status === 429 ? { 'Retry-After': '900' } : {})
      return reply({ authenticated: true, expires: data.expires }, 200, { 'Set-Cookie': cookie(request, data.token, SESSION_MS / 1000) })
    }
    const result = await auth.fetch(new Request('https://internal/auth', { method: 'POST', body: JSON.stringify({ action: action === 'logout' ? 'logout' : 'session', token: sessionToken(request) }) }))
    if (!result.ok) return reply({ error: 'La sesión ha caducado. Vuelve a entrar.' }, 401, { 'Set-Cookie': cookie(request, '', 0) })
    if (action === 'logout') return reply({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) })
    if (action === 'session') return reply(await result.json())
    const days = Number(new URL(request.url).searchParams.get('days') || 30)
    if (!Number.isInteger(days) || days < 1 || days > 30) return reply({ error: 'El período debe ser de 1 a 30 días.' }, 400)
    return reply(await readEngagementReport(env, days))
  } catch { return reply({ error: 'No se ha podido cargar el panel. Inténtalo de nuevo.' }, 503) }
}
