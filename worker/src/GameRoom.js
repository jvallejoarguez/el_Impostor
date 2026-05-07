// worker/src/GameRoom.js
// Minimal placeholder — fully implemented in Task 6.
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.state = null
    this.sessions = new Map()
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/exists') {
      return Response.json({ active: this.state !== null || this.sessions.size > 0 })
    }
    return new Response('Not Implemented', { status: 501 })
  }
}
