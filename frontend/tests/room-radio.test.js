import { afterEach, describe, expect, it, vi } from 'vitest'
import { RADIO_TRACK, createRoomRadio, readRadioPreferences, roomPlaybackPosition, loopDistance } from '../src/audio/roomRadio.js'

class FakeAudio extends EventTarget {
  duration = RADIO_TRACK.duration
  currentTime = 0
  paused = true
  volume = 1
  play = vi.fn(async () => { this.paused = false; this.dispatchEvent(new Event('playing')) })
  pause = vi.fn(() => {this.paused = true; this.dispatchEvent(new Event('pause'))})
}
const cleanups = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.useRealTimers() })
function setup(overrides = {}) {
  const audio = new FakeAudio()
  const onStatus = vi.fn()
  let now = 123456789
  const player = createRoomRadio(audio, {code:'ABCD', clock:{now:() => now}, onStatus, ...overrides})
  cleanups.push(() => player.dispose())
  return {audio, player, onStatus, advance: milliseconds => {now += milliseconds}}
}

describe('shared lobby radio', () => {
  it('joins the same timeline at different times without depending on the decoder duration', async () => {
    const first = setup()
    const second = setup()
    second.audio.duration -= 0.026 // Browser codecs may report different padding.
    await first.player.start()
    second.advance(30000)
    await second.player.start()
    expect(second.audio.currentTime - first.audio.currentTime).toBeCloseTo(30, 6)
  })
  it('silences only this listener and rejoins at the current room position', async () => {
    const first = setup(), second = setup()
    await first.player.start(); await second.player.start()
    first.player.pause()
    expect(first.audio.paused).toBe(true)
    expect(second.audio.paused).toBe(false)
    const previous = first.audio.currentTime
    first.advance(8000)
    await first.player.start()
    expect(first.audio.currentTime).toBeCloseTo(previous + 8, 5)
  })
  it('recovers from autoplay rejection on an explicit retry', async () => {
    const {audio, player, onStatus} = setup()
    audio.play.mockRejectedValueOnce(Object.assign(new Error(), {name:'NotAllowedError'}))
    expect(await player.start()).toBe(false)
    expect(onStatus).toHaveBeenLastCalledWith('blocked')
    expect(await player.start()).toBe(true)
    expect(onStatus).toHaveBeenLastCalledWith('playing')
  })
  it('does not announce playing after a slow start was cancelled', async () => {
    const {audio, player, onStatus} = setup()
    let finish
    audio.play.mockImplementationOnce(() => new Promise(resolve => {finish = resolve}))
    const start = player.start()
    player.pause()
    finish()
    expect(await start).toBe(false)
    expect(onStatus).toHaveBeenLastCalledWith('paused')
  })
  it('stops playback and removes resync work when leaving the lobby', async () => {
    vi.useFakeTimers()
    const {audio, player, onStatus, advance} = setup()
    await player.start()
    player.dispose()
    onStatus.mockClear()
    advance(40000); vi.advanceTimersByTime(40000)
    audio.dispatchEvent(new Event('playing'))
    expect(audio.paused).toBe(true)
    expect(onStatus).not.toHaveBeenCalled()
    expect(await player.start()).toBe(false)
  })
  it('resyncs after a stalled stream and reports network failure', async () => {
    const {audio, player, onStatus, advance} = setup()
    await player.start()
    advance(60000)
    const previous = audio.currentTime
    player.sync()
    expect(audio.currentTime).toBeCloseTo(previous + 60, 5)
    audio.dispatchEvent(new Event('error'))
    expect(onStatus).toHaveBeenLastCalledWith('error')
  })
  it('validates local volume and handles unavailable preferences', () => {
    const {audio, player} = setup()
    player.setVolume(0); expect(audio.volume).toBe(0)
    player.setVolume(0.2); expect(audio.volume).toBe(0.2)
    player.setVolume(3); expect(audio.volume).toBe(1)
    expect(readRadioPreferences({getItem:() => '{'})).toEqual({enabled:true,volume:0.18})
    expect(readRadioPreferences({getItem:() => '{"enabled":true,"volume":-1}'})).toEqual({enabled:true,volume:0})
  })
  it('starts enabled for new listeners and remembers an explicit mute', () => {
    expect(readRadioPreferences({getItem:() => null})).toEqual({enabled:true, volume:0.18})
    expect(readRadioPreferences({getItem:() => '{"enabled":false,"volume":0.3}'})).toEqual({enabled:false, volume:0.3})
    expect(readRadioPreferences({getItem:() => '{"volume":0.2}'}).enabled).toBe(true)
  })
  it('wraps correctly at the end of the record', () => {
    expect(loopDistance(0.1, 267.9, 268)).toBeCloseTo(0.2)
    for (const time of [-1, 0, 1e12]) {
      const position = roomPlaybackPosition('ABCD', time, 268)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThan(268)
    }
    expect(roomPlaybackPosition('ABCD', 0, NaN)).toBe(0)
  })
})
