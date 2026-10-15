// worker/src/index.js
import { GameRoom } from './GameRoom.js'
import { handleEngagement, recordRoomEvent } from './Engagement.js'
import { cleanAttribution } from '../../shared/engagement.js'
import { consentReceipt } from '../../shared/consent.js'
import { handleAdmin } from './Admin.js'

export { GameRoom }
export { Engagement } from './Engagement.js'
export { AdminAuth } from './Admin.js'

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
  return code
}

function allowedOrigins(env) {
  const configured = env.FRONTEND_ORIGINS || env.FRONTEND_ORIGIN || ''
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean)
}

// Entries may use one leading wildcard label, e.g. https://*.el-impostor-djf.pages.dev
function isAllowedOrigin(origin, origins) {
  return !!origin && origins.some(allowed => allowed === origin ||
    (allowed.includes('://*.') && origin.startsWith(allowed.split('*.')[0]) && origin.endsWith(`.${allowed.split('*.')[1]}`)))
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const origins = allowedOrigins(env)
  const allowOrigin = origins.includes('*')
    ? '*'
    : isAllowedOrigin(origin, origins) ? origin : origins[0] || '*'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // Private routes never inherit the public game's CORS policy.
    if (url.pathname.startsWith('/admin-panel/api/')) return handleAdmin(request, env)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (['/events', '/feedback', '/insights/report'].includes(url.pathname)) {
      try { return await handleEngagement(request, env, cors) }
      catch { return Response.json({ error: 'No se ha podido guardar. Inténtalo de nuevo.' }, { status: 503, headers: cors }) }
    }

    // POST /rooms — create a new room, return its code
    if (request.method === 'POST' && url.pathname === '/rooms') {
      if (env.ROOM_LIMITER) {
        const { success } = await env.ROOM_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })
        if (!success) return Response.json({ error: 'Has creado demasiadas salas seguidas. Espera un minuto.' }, { status: 429, headers: { ...cors, 'Retry-After': '60' } })
      }
      try {
        const category = encodeURIComponent(url.searchParams.get('category') || 'all')
        let consent
        try { consent = consentReceipt(JSON.parse(url.searchParams.get('consent'))) } catch {}
        const attribution = new URLSearchParams(cleanAttribution(consent ? Object.fromEntries(url.searchParams) : { source: 'unattributed' }))
        let code = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generateCode()
          const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(candidate))
          const res = await stub.fetch(new Request(`http://internal/claim?code=${candidate}&category=${category}&${attribution}&wasInvited=${!!consent && url.searchParams.get('wasInvited') === 'true'}&consent=${encodeURIComponent(JSON.stringify(consent || null))}`))
          if ((await res.json()).claimed) { code = candidate; break }
        }
        if (!code) {
          recordRoomEvent(ctx, env, 'server_error', crypto.randomUUID(), { source: 'unattributed' }, { method: 'room_capacity' })
          return new Response(JSON.stringify({ error: 'No hay salas libres ahora mismo. Inténtalo en un momento.' }), {
            status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ code }), {
          status: 201, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      } catch {
        recordRoomEvent(ctx, env, 'server_error', crypto.randomUUID(), { source: 'unattributed' }, { method: 'room_create_failed' })
        return Response.json({ error: 'No se ha podido crear la sala. Inténtalo de nuevo.' }, { status: 503, headers: cors })
      }
    }

    // GET /rooms/:code/ws — WebSocket upgrade, proxied to GameRoom DO
    const wsMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]{4})\/ws$/)
    if (wsMatch) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Upgrade Required: WebSocket', { status: 426, headers: cors })
      }
      // Browsers always send Origin on WebSocket upgrades; block other sites' pages.
      const origin = request.headers.get('Origin'), origins = allowedOrigins(env)
      if (origin && !origins.includes('*') && !isAllowedOrigin(origin, origins)) {
        return new Response('Origin not allowed', { status: 403 })
      }
      const code = wsMatch[1]
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
      try { return await stub.fetch(request) }
      catch {
        recordRoomEvent(ctx, env, 'server_error', crypto.randomUUID(), { source: 'unattributed' }, { method: 'websocket_open_failed' })
        return Response.json({ error: 'No se ha podido conectar.' }, { status: 503, headers: cors })
      }
    }

    return new Response('Not Found', { status: 404, headers: cors })
  },
}
