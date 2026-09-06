import { cleanEvent, cleanFeedback } from '../../shared/engagement.js'

export const RETENTION_DAYS = 30
const DAY = 86400000
export const dayKey = (time = Date.now()) => new Date(time).toISOString().slice(0, 10)
export const engagementStub = (env, day = dayKey()) => env.ENGAGEMENT.get(env.ENGAGEMENT.idFromName(day))

// One object per UTC day; it is independent of game rooms and their alarms.
export class Engagement {
  constructor(ctx) {
    this.ctx = ctx
    this.rates = new Map()
  }

  async alarm() { await this.ctx.storage.deleteAll() }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/report') {
      const counters = await this.ctx.storage.list({ prefix: 'count:' })
      const feedback = await this.ctx.storage.list({ prefix: 'feedback:' })
      return Response.json({ counters: [...counters.values()], feedback: [...feedback.values()] })
    }
    const { data, trusted = false, ip = 'unknown' } = await request.json()
    const isFeedback = url.pathname === '/feedback'
    const value = isFeedback ? cleanFeedback(data) : cleanEvent(data, trusted)
    if (!value) return Response.json({ error: 'Datos no válidos.' }, { status: 400 })

    if (!trusted) {
      const hour = Math.floor(Date.now() / 3600000)
      if (this.rateHour !== hour) { this.rates.clear(); this.rateHour = hour }
      const key = `${isFeedback ? 'feedback' : 'event'}:${ip}`
      const used = this.rates.get(key) || 0
      if (used >= (isFeedback ? 30 : 600) || (this.rates.size >= 5000 && !this.rates.has(key))) {
        return Response.json({ error: 'Demasiados envíos. Prueba más tarde.' }, { status: 429 })
      }
      this.rates.set(key, used + 1) // IPs exist only in memory, never in storage or reports.
    }

    // Transactions prevent retries or simultaneous votes from double-counting.
    return this.ctx.storage.transaction(async storage => {
      const key = `${isFeedback ? 'feedback' : 'seen'}:${value.id}:${isFeedback ? '' : value.event}`
      if (await storage.get(key)) return Response.json({ ok: true })
      const usageKey = isFeedback ? 'feedbackCount' : trusted ? 'serverEventCount' : 'eventCount'
      const usage = await storage.get(usageKey) || 0
      if (usage >= (isFeedback ? 500 : 20000)) return Response.json({ error: 'Prueba de nuevo mañana.' }, { status: 429 })
      if (!await storage.getAlarm()) await storage.setAlarm((Math.floor(Date.now() / DAY) + RETENTION_DAYS) * DAY)
      if (isFeedback) {
        await storage.put(key, { ...value, receivedAt: new Date().toISOString() })
      } else {
        const dimensions = { event: value.event, ...value.attribution, method: value.context.method || '', wasInvited: value.context.wasInvited === true }
        const counterKey = `count:${JSON.stringify(dimensions)}`
        const counter = await storage.get(counterKey) || { ...dimensions, count: 0 }
        await storage.put(counterKey, { ...counter, count: counter.count + 1 })
        await storage.put(key, true)
      }
      await storage.put(usageKey, usage + 1)
      return Response.json({ ok: true })
    })
  }
}

// Failures in optional measurement must never reject a move or interrupt an alarm.
export function recordRoomEvent(ctx, env, event, id, attribution, context = {}) {
  if (!env.ENGAGEMENT) return
  const work = Promise.resolve().then(() => engagementStub(env).fetch(new Request('https://internal/event', {
    method: 'POST', body: JSON.stringify({ trusted: true, data: { id, event, attribution, context } }),
  }))).then(response => { if (!response.ok) console.warn('Engagement event rejected', event, response.status) })
    .catch(() => console.warn('Engagement temporarily unavailable'))
  ctx.waitUntil(work)
}

async function readSmallJson(request) {
  if (Number(request.headers.get('Content-Length')) > 8192) return null
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 8192) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) } catch { return null }
}

export async function handleEngagement(request, env, cors) {
  const url = new URL(request.url)
  const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const reply = (data, status) => Response.json(data, { status, headers })
  if (!env.ENGAGEMENT) return reply({ error: 'Servicio no disponible.' }, 503)
  if (url.pathname === '/insights/report' && request.method === 'GET') {
    const token = env.INSIGHTS_READ_TOKEN
    if (!token || token.length < 32) return reply({ error: 'El informe necesita una clave privada.' }, 503)
    if (request.headers.get('Authorization') !== `Bearer ${token}`) return reply({ error: 'No autorizado.' }, 401)
    const days = Number(url.searchParams.get('days') || 7)
    if (!Number.isInteger(days) || days < 1 || days > RETENTION_DAYS) return reply({ error: 'days debe estar entre 1 y 30.' }, 400)
    const reports = []
    // Small batches stay below the Workers simultaneous outbound connection limit.
    for (let offset = 0; offset < days; offset += 5) {
      reports.push(...await Promise.all(Array.from({ length: Math.min(5, days - offset) }, async (_, i) => {
        const day = dayKey(Date.now() - (offset + i) * DAY)
        const response = await engagementStub(env, day).fetch('https://internal/report')
        return { day, ...await response.json() }
      })))
    }
    return reply({ retentionDays: RETENTION_DAYS, reports }, 200)
  }
  if (!['/events', '/feedback'].includes(url.pathname) || request.method !== 'POST') return reply({ error: 'Not found' }, 404)
  const origins = (env.FRONTEND_ORIGINS || env.FRONTEND_ORIGIN || '').split(',').map(v => v.trim())
  if (!origins.includes(request.headers.get('Origin'))) return reply({ error: 'Origen no permitido.' }, 403)
  const data = await readSmallJson(request)
  if (!data) return reply({ error: 'Datos no válidos o demasiado largos.' }, 400)
  const response = await engagementStub(env).fetch(new Request(`https://internal${url.pathname === '/feedback' ? '/feedback' : '/event'}`, {
    method: 'POST', body: JSON.stringify({ data, ip: request.headers.get('CF-Connecting-IP') || 'unknown' }),
  }))
  return new Response(response.body, { status: response.status, headers })
}
