import { describe, it, expect, vi } from 'vitest'
import { GameRoom } from '../src/GameRoom.js'

async function setup(category = 'animales') {
  const sockets = []
  let hydration
  const ctx = {
    blockConcurrencyWhile: fn => { hydration = fn() },
    getWebSockets: () => sockets,
    storage: { get: vi.fn(), put: vi.fn(), setAlarm: vi.fn(), deleteAlarm: vi.fn() },
  }
  const room = new GameRoom(ctx, {})
  await hydration
  await room.fetch(new Request(`https://room/claim?code=TEST&category=${category}`))
  const send = (ws, type, payload = {}) => room.webSocketMessage(ws, JSON.stringify({ type, payload }))
  async function join(id, name = id, existingWs) {
    let attachment
    const ws = existingWs || { send: vi.fn(), close: vi.fn(), serializeAttachment: v => { attachment = v }, deserializeAttachment: () => attachment }
    sockets.push(ws)
    await send(ws, 'JOIN', { name, playerId: id, code: 'TEST' })
    return ws
  }
  return { room, ctx, sockets, send, join }
}

function messages(ws, type) { return ws.send.mock.calls.map(([raw]) => JSON.parse(raw)).filter(m => m.type === type) }
async function trio() {
  const game = await setup()
  game.players = await Promise.all(['Ana', 'Bruno', 'Clara'].map(id => game.join(id)))
  await game.send(game.players[1], 'READY')
  await game.send(game.players[2], 'READY')
  return game
}

describe('room flow and private roles', () => {
  it('plays two rounds, preserves the clue history, reconnects and replays', async () => {
    const { room, players, send, join, ctx } = await trio()
    await send(players[0], 'START_GAME')
    expect(room.state.rules.wordCategories).toEqual(['animales'])
    expect(room.state.phase).toBe('countdown')
    const gameId = room.state.gameId
    expect(gameId).toBeTruthy()
    const end = room.state.timerEnd
    await send(players[0], 'START_GAME')
    expect(room.state.timerEnd).toBe(end)
    expect(room.state.gameId).toBe(gameId)
    await room.alarm()
    expect(room.state.phase).toBe('roleReveal')
    expect(room.state.timerEnd).toBeGreaterThan(Date.now())
    const roles = players.map(ws => messages(ws, 'ROLE').at(-1).payload)
    expect(roles.filter(role => role.isImpostor)).toHaveLength(1)
    expect(roles.find(role => role.isImpostor).word).toBeNull()
    for (const ws of players) {
      const message = messages(ws, 'STATE').at(-1)
      expect(message.serverNow).toBeGreaterThan(0)
      for (const key of ['impostorIdx', 'secretWord', 'hint']) expect(message.payload).not.toHaveProperty(key)
    }
    await room.alarm()
    expect(room.state.phase).toBe('playing')
    const rejoined = await join('Clara')
    expect(messages(rejoined, 'ROLE').at(-1).payload).toEqual(roles[2])
    await room.webSocketClose(players[2]) // a late close must not disconnect the replacement
    expect(room.state.players[2].connected).toBe(true)
    expect(room.sessions.get('Clara')).toBe(rejoined)
    players[2] = rejoined
    for (let round = 1; round <= 2; round++) {
      for (const [i, ws] of players.entries()) await send(ws, 'SUBMIT_WORD', {word: `Pista${round}${i}`})
      expect(room.state.phase).toBe('roundReview')
      await room.alarm()
      if (round === 1) {
        expect(room.state.phase).toBe('betweenRound')
        await send(players[0], 'BETWEEN_VOTE', {choice:'continue'})
        await send(players[1], 'BETWEEN_VOTE', {choice:'continue'})
        expect(room.state.currentRound).toBe(2)
      }
    }
    expect(room.state.phase).toBe('voting')
    expect(room.state.wordHistory).toHaveLength(6)
    const impostorId = room.state.players[room.state.impostorIdx].id
    for (const ws of players) {
      await send(ws, 'CAST_VOTE', {targetId:impostorId})
      await send(ws, 'CONFIRM_VOTE')
    }
    expect(room.state.phase).toBe('results')
    expect(room.state.result.found).toBe(true)
    expect(room.state.result.secretWord).toBeTruthy()
    expect(ctx.storage.deleteAlarm).toHaveBeenCalled()
    await send(players[1], 'PLAY_AGAIN')
    expect(room.state.phase).toBe('lobby')
    expect(room.state.players).toHaveLength(3)
    expect(room.state.rules.wordCategories).toEqual(['animales'])
    expect(room.state.gameId).toBeNull()
    expect(room.state.secretWord).toBeNull()
    expect(room.state.wordHistory).toEqual([])
  })

  it('does not move deadlines or reset play after rejected or stale actions', async () => {
    const {room, players, ctx, send} = await trio()
    await send(players[0], 'START_GAME')
    await room.alarm(); await room.alarm()
    const state = room.state
    ctx.storage.setAlarm.mockClear()
    await send(players[1], 'SUBMIT_WORD', {word:'No es mi turno'})
    await send(players[0], 'SUBMIT_WORD', {word:'   '})
    await send(players[0], 'BETWEEN_VOTE', {choice:'continue'})
    await send(players[0], 'PLAY_AGAIN')
    await send(players[0], 'BACK_TO_LOBBY')
    expect(room.state).toBe(state)
    expect(ctx.storage.setAlarm).not.toHaveBeenCalled()
  })

  it('rejects invalid names and joiners during play, without public broadcasts to them', async () => {
    const {room, players, join, sockets, send} = await trio()
    const invalid = await join('invalid', 'x')
    expect(messages(invalid, 'ERROR').at(-1).payload.message).toContain('2 a 16')
    await send(players[0], 'START_GAME')
    const late = await join('late', 'Diego')
    expect(messages(late, 'ERROR').at(-1).payload.message).toContain('Partida en curso')
    room._broadcast()
    expect(messages(invalid, 'STATE')).toHaveLength(0)
    expect(messages(late, 'STATE')).toHaveLength(0)
    expect(sockets).toHaveLength(5)
  })

  it('echoes monotonic ping identifiers with authoritative time', async () => {
    const {players, send} = await trio()
    await send(players[0], 'PING', {clientSentAt:1234})
    expect(messages(players[0], 'PONG').at(-1)).toEqual({type:'PONG', clientSentAt:1234, serverNow:expect.any(Number)})
  })

  it('validates the initial category and preserves it when a claimed room is reused', async () => {
    const {room} = await setup('not-real')
    expect(room.state.rules.wordCategories).toEqual(['all'])
    await room.fetch(new Request('https://room/claim?code=TEST&category=futbol'))
    expect(room.state.rules.wordCategories).toEqual(['all'])
  })
})
