import { describe, it, expect, vi } from 'vitest'
import worker from '../src/index.js'
import { Engagement, recordRoomEvent } from '../src/Engagement.js'
import { cleanFeedback } from '../../shared/engagement.js'

function setup() {
  const objects = new Map()
  const namespace = { idFromName: day => day, get: day => {
    if (!objects.has(day)) {
      const values = new Map()
      let alarm, queue = Promise.resolve()
      const storage = {
        get: async key => structuredClone(values.get(key)),
        put: async (key, value) => values.set(key, structuredClone(value)),
        list: async ({ prefix }) => new Map([...values].filter(([key]) => key.startsWith(prefix))),
        getAlarm: async () => alarm, setAlarm: async value => { alarm = value },
        deleteAll: async () => values.clear(),
        transaction: fn => { const work = queue.then(() => fn(storage)); queue = work.catch(() => {}); return work },
      }
      const object = new Engagement({ storage })
      objects.set(day, { object, values, storage })
    }
    return { fetch: request => objects.get(day).object.fetch(typeof request === 'string' ? new Request(request) : request) }
  } }
  const env = { ENGAGEMENT: namespace, FRONTEND_ORIGINS: 'https://juegoimpostor.app', INSIGHTS_READ_TOKEN: 'test-only-private-report-token-at-least-32-chars' }
  const post = (path, body, origin = 'https://juegoimpostor.app') => worker.fetch(new Request(`https://worker${path}`, { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(body) }), env)
  const report = async () => {
    const response = await worker.fetch(new Request('https://worker/insights/report?days=1', { headers: { Authorization: `Bearer ${env.INSIGHTS_READ_TOKEN}` } }), env)
    return response.json()
  }
  return { env, objects, post, report }
}
const event = () => ({ consent: { version: 1, decision: 'accepted', at: Date.now() }, id: crypto.randomUUID(), event: 'visit', attribution: { source: 'instagram', campaign: 'impostor', content: 'clip01' }, context: { path: '/' } })

describe('engagement ingestion and private reports', () => {
  it('stores bounded diagnostics without messages, stacks or arbitrary error names', async () => {
    const { post, report } = setup()
    for (const context of [
      { method: 'script_error', version: 'connection-2026-10-03', errorName: 'TypeError', script: 'app', line: 42, column: 123, message: 'SECRET_MESSAGE', stack: 'SECRET_STACK', filename: 'SECRET_URL' },
      { method: 'unhandled_rejection', errorName: 'SECRET_WORD', script: 'SECRET_SCRIPT', line: 12, column: 50 },
      { method: 'script_error', errorName: 'SecurityError', script: 'app', line: -1, column: 10000001 },
    ]) expect((await post('/events', { ...event(), event: 'client_error', context })).status).toBe(200)
    const data = await report()
    const rows = data.reports[0].counters
    expect(rows.find(row => row.errorName === 'TypeError')).toMatchObject({ script: 'app', line: 42, column: 123, version: 'connection-2026-10-03' })
    expect(rows.find(row => row.errorName === 'SecurityError')).not.toHaveProperty('line')
    expect(rows.find(row => row.method === 'unhandled_rejection')).not.toHaveProperty('column')
    expect(JSON.stringify(data)).not.toContain('SECRET')
  })
  it('rejects missing, rejected, expired and future consent before storing events', async () => {
    const { post, objects } = setup()
    for (const consent of [undefined, {version:1,decision:'rejected',at:Date.now()}, {version:1,decision:'accepted',at:1}, {version:1,decision:'accepted',at:Date.now()+60000}]) {
      expect((await post('/events', {...event(), consent})).status).toBe(403)
    }
    for (const object of objects.values()) expect(object.values.size).toBe(0)
  })

  it('deduplicates simultaneous retries, strips private fields, and expires data', async () => {
    const { post, report, objects } = setup()
    const data = { ...event(), name: 'SECRET_NAME', context: { word: 'SECRET_WORD', roomCode: 'ABCD', hint: 'SECRET_HINT', path: '/?room=ABCD' } }
    const replies = await Promise.all([post('/events', data), post('/events', data)])
    expect(replies.every(r => r.ok)).toBe(true)
    const result = await report()
    expect(result.reports[0].counters).toHaveLength(1)
    expect(result.reports[0].counters[0]).toMatchObject({ event: 'visit', count: 1, source: 'instagram' })
    const first = [...objects.values()][0]
    expect([...first.values].find(([key]) => key.startsWith('seen:'))[1].consent).toEqual(data.consent)
    const stored = JSON.stringify([...first.values])
    for (const secret of ['SECRET_NAME', 'SECRET_WORD', 'SECRET_HINT', 'ABCD']) expect(stored).not.toContain(secret)
    const { object, storage, values } = first
    expect(await storage.getAlarm()).toBeGreaterThan(Date.now() + 28 * 86400000)
    await object.alarm()
    expect(values.size).toBe(0)
  })

  it('rejects forged game counts, bad origins, malformed and oversized input', async () => {
    const { post } = setup()
    expect((await post('/events', { ...event(), event: 'game_finished', trusted: true })).status).toBe(400)
    expect((await post('/events', event(), 'https://evil.example')).status).toBe(403)
    expect((await post('/events', { ...event(), comment: 'x'.repeat(9000) })).status).toBe(400)
    expect((await post('/feedback', { id: crypto.randomUUID(), kind: 'rating' })).status).toBe(400)
    expect((await post('/events', { ...event(), attribution: null, context: null })).status).toBe(200)
  })

  it('stores one feedback response, retains useful context and rejects empty submissions', async () => {
    const { post, report } = setup()
    const draft = { id: crypto.randomUUID(), kind: 'rating', rating: 'okay', topic: 'connection', comment: 'Se cortó al votar', context: { phase: 'results', playerCount: 5, category: 'animales', version: 'test', secretWord: 'León', name: 'Ana' } }
    expect((await post('/feedback', draft)).status).toBe(200)
    expect((await post('/feedback', draft)).status).toBe(200)
    const data = await report()
    expect(data.reports[0].feedback).toHaveLength(1)
    expect(data.reports[0].feedback[0]).toMatchObject({ comment: 'Se cortó al votar', context: { playerCount: 5, phase: 'results' } })
    expect(data.reports[0].feedback[0].context).not.toHaveProperty('secretWord')
    expect(cleanFeedback({ id: crypto.randomUUID(), kind: 'idea', comment: ' ' })).toBeNull()
  })

  it('requires a configured private token and bounds report date ranges', async () => {
    const { env } = setup()
    expect((await worker.fetch(new Request('https://worker/insights/report'), env)).status).toBe(401)
    expect((await worker.fetch(new Request('https://worker/insights/report', { headers: { Authorization: 'Bearer wrong' } }), env)).status).toBe(401)
    expect((await worker.fetch(new Request('https://worker/insights/report?days=31', { headers: { Authorization: `Bearer ${env.INSIGHTS_READ_TOKEN}` } }), env)).status).toBe(400)
    delete env.INSIGHTS_READ_TOKEN
    expect((await worker.fetch(new Request('https://worker/insights/report'), env)).status).toBe(503)
  })

  it('retains the current page separately from acquisition and rejects forged operational events', async () => {
    const { post, report } = setup()
    const data = { ...event(), event: 'page_view', attribution: { landing: '/como-jugar/' }, context: { path: '/palabras-para-el-impostor/' } }
    expect((await post('/events', data)).status).toBe(200)
    expect((await report()).reports[0].counters[0]).toMatchObject({ landing: '/como-jugar/', path: '/palabras-para-el-impostor/', event: 'page_view' })
    for (const name of ['game_interrupted', 'server_error', 'join_rejected']) expect((await post('/events', { ...event(), event: name })).status).toBe(400)
  })

  it('limits public feedback spam without consuming the trusted game event allowance', async () => {
    const { post, env, report } = setup()
    for (let i = 0; i < 30; i++) expect((await post('/feedback', { id: crypto.randomUUID(), kind: 'idea', comment: 'Una idea' })).status).toBe(200)
    expect((await post('/feedback', { id: crypto.randomUUID(), kind: 'idea', comment: 'Otra' })).status).toBe(429)
    const tasks = []
    recordRoomEvent({ waitUntil: task => tasks.push(task) }, env, 'game_started', crypto.randomUUID(), { source: 'google' })
    await Promise.all(tasks)
    expect((await report()).reports[0].counters[0]).toMatchObject({ event: 'game_started', count: 1 })
  })

  it('isolates collector failures from gameplay, including synchronous binding errors', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tasks = []
    expect(() => recordRoomEvent({ waitUntil: task => tasks.push(task) }, { ENGAGEMENT: { idFromName: () => { throw new Error('offline') } } }, 'game_started', crypto.randomUUID(), {})).not.toThrow()
    await Promise.all(tasks)
    expect(warning).toHaveBeenCalled()
    warning.mockRestore()
  })
})
