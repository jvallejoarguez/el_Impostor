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
  it('only the creator can withdraw campaign attribution and it stays removed after reconnect', async () => {
    const { room, players, send, join } = await trio()
    const consent = {version:1,decision:'accepted',at:Date.now()}
    Object.assign(room.state.engagement, {consent, attribution:{source:'instagram',campaign:'private'},wasInvited:true})
    expect(room.state.engagement.attributionOwnerId).toBe('Ana')
    await send(players[1], 'MEASUREMENT_PREFERENCE', {enabled:false,playerId:'Ana'})
    expect(room.state.engagement.consent).toEqual(consent)
    await send(players[0], 'MEASUREMENT_PREFERENCE', {enabled:false})
    expect(room.state.engagement.consent).toBeNull()
    expect(room.state.engagement.attribution.source).toBe('unattributed')
    expect(room.state.engagement.wasInvited).toBe(false)
    await join('Ana')
    expect(room.state.engagement.consent).toBeNull()
    expect(room._publicState()).not.toHaveProperty('engagement')
  })

  it('a creator reconnect without consent removes old attribution and expired receipts never attribute counts', async () => {
    const { room, join, ctx } = await trio()
    Object.assign(room.state.engagement, {consent:{version:1,decision:'accepted',at:Date.now()}, attribution:{source:'instagram'}})
    await join('Ana')
    expect(room.state.engagement.consent).toBeNull()
    const requests = [], tasks = []
    ctx.waitUntil = task => tasks.push(task)
    room.env.ENGAGEMENT = {idFromName: v => v, get: () => ({fetch: async request => {requests.push(await request.json());return new Response('{}')}})}
    Object.assign(room.state.engagement, {consent:{version:1,decision:'accepted',at:1}, attribution:{source:'instagram'}})
    room._record('game_started',crypto.randomUUID())
    await Promise.all(tasks)
    expect(requests[0].data.attribution).toEqual({source:'unattributed'})
  })

  it('broadcasts a chosen avatar, ignores spoofed player IDs and preserves it across reconnect and replay', async () => {
    const {room, players, send, join} = await trio()
    await send(players[1], 'UPDATE_AVATAR', {playerId:'Ana', avatarId:0})
    expect(room.state.players.find(p => p.id === 'Bruno').avatarId).toBe(0)
    const before = room.state.players.find(p => p.id === 'Ana').avatarId
    for (const ws of players) expect(messages(ws, 'STATE').at(-1).payload.players.find(p => p.id === 'Bruno').avatarId).toBe(0)
    const rejoined = await join('Bruno')
    expect(messages(rejoined, 'STATE').at(-1).payload.players.find(p => p.id === 'Bruno').avatarId).toBe(0)
    expect(room.state.players.find(p => p.id === 'Ana').avatarId).toBe(before)
    await send(players[0], 'START_GAME')
    await send(rejoined, 'UPDATE_AVATAR', {avatarId:11})
    expect(room.state.players.find(p => p.id === 'Bruno').avatarId).toBe(0)
    await room.alarm(); await room.alarm()
    for (const [i, ws] of [players[0], rejoined, players[2]].entries()) {
      await send(ws, 'SUBMIT_WORD', {word:`Pista${i}`})
    }
    await room.alarm()
    await send(players[0], 'BETWEEN_VOTE', {choice:'vote'})
    await send(rejoined, 'BETWEEN_VOTE', {choice:'vote'})
    await room.alarm()
    expect(room.state.phase).toBe('results')
    await send(rejoined, 'PLAY_AGAIN')
    expect(room.state.players.find(p => p.id === 'Bruno').avatarId).toBe(0)
  })

  it('rejects invalid avatar payloads and accepts a chosen avatar on initial join', async () => {
    const {room, players, send, join} = await trio()
    const initial = room.state
    for (const avatarId of [null, -1, 12, 1.5, '2', {}, true]) {
      await send(players[0], 'UPDATE_AVATAR', {avatarId})
      expect(room.state).toBe(initial)
    }
    const newcomer = await join('Diego')
    // A fresh room also accepts the portrait chosen before entry.
    const isolated = await setup()
    const ws = {send:vi.fn(), close:vi.fn(), serializeAttachment:vi.fn()}
    isolated.sockets.push(ws)
    await isolated.send(ws, 'JOIN', {name:'Elena', playerId:'Elena', code:'TEST', avatarId:11})
    expect(isolated.room.state.players[0].avatarId).toBe(11)
    expect(messages(newcomer, 'STATE').at(-1).payload).not.toHaveProperty('secretWord')
  })

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
      for (const key of ['impostorIdx', 'secretWord', 'hint', 'engagement']) expect(message.payload).not.toHaveProperty(key)
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
