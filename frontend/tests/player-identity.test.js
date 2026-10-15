import { describe, it, expect, vi, afterEach } from 'vitest'
import { playerIdFor } from '../src/ws/useGameSocket.js'

const memoryStorage = () => {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data }
}
function browser({ dev = false, local = memoryStorage() } = {}) {
  vi.stubEnv('DEV', dev)
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('localStorage', local)
  return local
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('player identity', () => {
  it('rejoins the last room as the same player from a new tab', () => {
    const local = browser()
    const id = playerIdFor('ABCD')
    browser({ local }) // a new tab shares localStorage but not sessionStorage
    expect(playerIdFor('ABCD')).toBe(id)
    expect(playerIdFor('WXYZ')).toBe(id) // the tab keeps its own identity in another room
    expect([...local.data.keys()]).toEqual(['el-impostor-last-room'])
  })

  it('keeps separate local tabs as separate players in development', () => {
    const local = browser({ dev: true })
    const id = playerIdFor('ABCD')
    browser({ dev: true, local })
    expect(playerIdFor('ABCD')).not.toBe(id)
    expect(local.data.size).toBe(0)
  })
})
