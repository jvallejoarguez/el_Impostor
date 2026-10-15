import { describe, it, expect, vi, afterEach } from 'vitest'
import { createServerClock, secondsRemaining } from '../src/ws/serverClock.js'
import { readSession, saveSession, clearSession, entryFromUrl, updateEntryUrl } from '../src/session.js'

afterEach(() => vi.unstubAllGlobals())
describe('server clock', () => {
  it('ignores a device clock offset and subsequent clock changes', () => {
    let monotonic = 200, wall = 900000000
    const clock = createServerClock(() => monotonic, () => wall)
    clock.sync(100000)
    expect(secondsRemaining(130000, clock.now(), 30)).toBe(30)
    monotonic += 15250
    wall += 86400000
    expect(secondsRemaining(130000, clock.now(), 30)).toBe(15)
    monotonic += 20000
    expect(secondsRemaining(130000, clock.now(), 30)).toBe(0)
  })
  it('accounts for round-trip latency, ignores invalid time and clamps the fallback display', () => {
    const clock = createServerClock(() => 1000, () => 0)
    clock.sync(10000, 200)
    clock.sync(undefined)
    expect(clock.now()).toBe(10100)
    expect(secondsRemaining(1000000000, 0, 30)).toBe(30)
    expect(secondsRemaining(null, 0, 30)).toBe(0)
    clock.reset()
    expect(clock.now()).toBe(0)
  })
})

describe('entry and session recovery', () => {
  const saved = {code:'ABCD', name:'Ana'}
  it('resumes only the matching room and gives explicit links priority', () => {
    expect(entryFromUrl('', saved)).toMatchObject({screen:'lobby', resume:true, ...saved})
    expect(entryFromUrl('?room=ABCD', saved)).toMatchObject({screen:'lobby', resume:true})
    expect(entryFromUrl('?room=EFGH', saved)).toMatchObject({screen:'join', code:'EFGH', resume:false})
    expect(entryFromUrl('?category=animales', saved)).toMatchObject({screen:'create', category:'animales', resume:false})
    expect(entryFromUrl('?modo=un-movil', saved)).toMatchObject({screen:'local', resume:false})
    expect(entryFromUrl('?category=unknown', saved)).toMatchObject({screen:'create', category:'all'})
    expect(entryFromUrl('?create=1', saved)).toMatchObject({screen:'create', resume:false})
    expect(entryFromUrl('?sala=abcd', null)).toMatchObject({screen:'join', code:'ABCD'})
  })
  it('handles unavailable or corrupt storage and stores no secrets', () => {
    expect(readSession({getItem:() => '{'})).toBeNull()
    expect(readSession({getItem:() => JSON.stringify({...saved, code:'??'})})).toBeNull()
    expect(readSession({getItem:() => {throw new Error()}})).toBeNull()
    let raw
    const storage = {getItem:() => raw, setItem:(_, v) => {raw = v}, removeItem:() => {raw = null}}
    vi.stubGlobal('sessionStorage', storage)
    saveSession({...saved, word:'León', isImpostor:true})
    expect(JSON.parse(raw)).toEqual(saved)
    expect(readSession(storage)).toEqual(saved)
    clearSession()
    expect(readSession(storage)).toBeNull()
  })
  it('cleans entry instructions but preserves campaign parameters', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {location:{href:'https://juegoimpostor.app/?category=animales&create=1&utm_source=youtube#jugar'}, history:{replaceState}})
    updateEntryUrl('ABCD')
    expect(replaceState).toHaveBeenCalledWith({}, '', '/?utm_source=youtube&room=ABCD#jugar')
  })
})
