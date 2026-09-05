// Node 22+; run against npm run dev. Exercises the real local Worker over HTTP + WebSockets.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = 'http://localhost:8787'
const clients = []
class Player {
  constructor(code, name, id = randomUUID()) {
    this.id = id; this.name = name; this.messages = []; this.waiters = []
    this.ws = new WebSocket(`${base.replace('http', 'ws')}/rooms/${code}/ws`)
    clients.push(this)
    this.ws.addEventListener('open', () => this.send('JOIN', {code, name, playerId:id}))
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      this.messages.push(message)
      if (message.type === 'STATE') {
        this.state = message.payload
        assert.ok(Number.isFinite(message.serverNow))
        for (const secret of ['secretWord','hint','impostorIdx']) assert.ok(!(secret in message.payload))
      }
      if (message.type === 'ROLE') this.role = message.payload
      for (const fn of [...this.waiters]) fn()
    })
    this.ws.addEventListener('error', () => { this.error = new Error('WebSocket connection failed'); for (const fn of [...this.waiters]) fn() })
  }
  send(type, payload = {}) { this.ws.send(JSON.stringify({type, payload})) }
  until(predicate, label) {
    return new Promise((resolve, reject) => {
      const finish = error => {clearTimeout(timer); this.waiters = this.waiters.filter(fn => fn !== check); error ? reject(error) : resolve()}
      const check = () => { if (this.error) finish(this.error); else if (predicate(this)) finish() }
      const timer = setTimeout(() => finish(new Error(`Timeout: ${this.name} ${label}`)), 25000)
      this.waiters.push(check); check()
    })
  }
  phase(phase) { return this.until(p => p.state?.phase === phase, phase) }
}

try {
  const res = await fetch(`${base}/rooms?category=animales`, {method:'POST', headers:{Origin:'http://localhost:3000'}})
  assert.equal(res.status, 201)
  const {code} = await res.json()
  const group = ['Ana','Bruno','Clara'].map(name => new Player(code, name))
  await Promise.all(group.map(p => p.until(p => p.state?.players.length === 3, 'three joined')))
  const host = group.find(p => p.state.players.find(player => player.id === p.id).isOwner)
  assert.ok(host)
  assert.deepEqual(host.state.rules.wordCategories, ['animales'])
  for (const p of group.filter(p => p !== host)) p.send('READY')
  await host.until(p => p.state.players.every(player => player.ready || player.isOwner), 'everyone ready')
  host.send('START_GAME')
  await Promise.all(group.map(p => p.phase('playing')))
  assert.equal(group.filter(p => p.role.isImpostor).length, 1)
  assert.equal(new Set(group.filter(p => !p.role.isImpostor).map(p => p.role.word)).size, 1)
  assert.equal(group.find(p => p.role.isImpostor).role.word, null)
  const late = new Player(code, 'Invitado')
  await late.until(p => p.messages.some(m => m.type === 'ERROR'), 'entry rejected during play')
  assert.equal(late.state, undefined)
  const old = group[2]
  const replacement = new Player(code, old.name, old.id)
  await replacement.phase('playing')
  assert.deepEqual(replacement.role, old.role)
  group[2] = replacement
  for (let round = 1; round <= 2; round++) {
    for (let turn = 0; turn < 3; turn++) {
      const state = group[0].state
      const active = group.find(p => p.id === state.players[state.activePlayerIdx].id)
      active.send('SUBMIT_WORD', {word:`Pista ${round}-${turn}`})
      await Promise.all(group.map(p => p.until(p => p.state.wordHistory.length >= (round-1)*3+turn+1, 'clue broadcast')))
    }
    if (round === 1) {
      await Promise.all(group.map(p => p.phase('betweenRound')))
      group[0].send('BETWEEN_VOTE', {choice:'continue'})
      group[1].send('BETWEEN_VOTE', {choice:'continue'})
      await Promise.all(group.map(p => p.phase('playing')))
    }
  }
  await Promise.all(group.map(p => p.phase('voting')))
  assert.equal(group[0].state.wordHistory.length, 6)
  const impostorId = group.find(p => p.role.isImpostor).id
  for (const p of group) {
    p.send('CAST_VOTE', {targetId:impostorId})
    await p.until(p => p.state.votes[p.id] === impostorId, 'vote registered')
    p.send('CONFIRM_VOTE')
  }
  await Promise.all(group.map(p => p.phase('results')))
  assert.ok(group.every(p => p.state.result.found))
  group[0].send('PLAY_AGAIN')
  await Promise.all(group.map(p => p.phase('lobby')))
  assert.ok(group.every(p => p.state.players.length === 3 && p.state.wordHistory.length === 0))
  console.log('PASS: real local Worker, three clients, category, private roles, reconnect, two rounds, six clues, voting, results and replay.')
} finally {
  for (const p of clients) p.ws.close()
}
