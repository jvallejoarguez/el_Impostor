// worker/src/index.js
import { GameRoom } from './GameRoom.js'

export { GameRoom }

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

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const origins = allowedOrigins(env)
  const allowOrigin = origins.includes('*')
    ? '*'
    : (origin && origins.includes(origin)) ? origin : origins[0] || '*'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // POST /rooms — create a new room, return its code
    if (request.method === 'POST' && url.pathname === '/rooms') {
      let code = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode()
        const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(candidate))
        const res = await stub.fetch(new Request('http://internal/exists'))
        const { active } = await res.json()
        if (!active) {
          // Claim immediately so a concurrent POST cannot pick the same code.
          await stub.fetch(new Request(`http://internal/claim?code=${candidate}`))
          code = candidate
          break
        }
      }
      if (!code) {
        return new Response(JSON.stringify({ error: 'Could not generate room' }), {
          status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ code }), {
        status: 201, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // GET /rooms/:code/ws — WebSocket upgrade, proxied to GameRoom DO
    const wsMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]{4})\/ws$/)
    if (wsMatch) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Upgrade Required: WebSocket', { status: 426, headers: cors })
      }
      const code = wsMatch[1]
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
      return stub.fetch(request)
    }

    return new Response('Not Found', { status: 404, headers: cors })
  },
}
