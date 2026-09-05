export const RADIO_TRACK = {
  title: 'George Street Shuffle',
  artist: 'Kevin MacLeod',
  src: '/music/george-street-shuffle.mp3',
  duration: 268.303673,
  source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300035',
  license: 'https://creativecommons.org/licenses/by/4.0/',
}
const PREFERENCE_KEY = 'el-impostor-radio'
export const DEFAULT_RADIO_PREFERENCES = { enabled: true, volume: 0.18 }

export function readRadioPreferences(storage) {
  try {
    storage ||= localStorage
    const saved = JSON.parse(storage.getItem(PREFERENCE_KEY))
    return {
      enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : DEFAULT_RADIO_PREFERENCES.enabled,
      volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(1, saved.volume)) : DEFAULT_RADIO_PREFERENCES.volume,
    }
  } catch { return { ...DEFAULT_RADIO_PREFERENCES } }
}
export function saveRadioPreferences(preferences) {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences)) } catch {}
}

// A radio, not a personal playlist: the room code selects an offset in a shared
// server-time timeline. Late joiners and reconnecting players join the same bar.
export function roomPlaybackPosition(code, serverNow, duration) {
  if (!Number.isFinite(serverNow) || !Number.isFinite(duration) || duration <= 0) return 0
  let seed = 0
  for (const char of code.toUpperCase()) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0
  const position = serverNow / 1000 + seed % 997
  return ((position % duration) + duration) % duration
}
export function loopDistance(actual, expected, duration) {
  const distance = Math.abs(actual - expected) % duration
  return Math.min(distance, duration - distance)
}

export function createRoomRadio(audio, { code, clock, onStatus = () => {} }) {
  let wanted = false
  let disposed = false
  let request = 0
  const status = value => { if (!disposed) onStatus(value) }
  const sync = (force = false) => {
    if (disposed || !wanted || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const expected = Math.min(audio.duration - 0.01, roomPlaybackPosition(code, clock.now(), RADIO_TRACK.duration))
    if (force || loopDistance(audio.currentTime, expected, RADIO_TRACK.duration) > 0.8) {
      try { audio.currentTime = expected } catch { /* retry when the media is seekable */ }
    }
  }
  const listeners = {
    loadedmetadata: () => sync(true),
    playing: () => { if (wanted) status('playing'); else audio.pause() },
    waiting: () => { if (wanted) status('buffering') },
    pause: () => { if (!wanted) status('paused') },
    error: () => { wanted = false; status('error') },
  }
  for (const [event, fn] of Object.entries(listeners)) audio.addEventListener(event, fn)
  const interval = setInterval(() => { if (!audio.paused) sync() }, 8000)

  return {
    async start() {
      if (disposed) return false
      wanted = true
      const current = ++request
      status('loading')
      sync(true)
      try {
        await audio.play()
        if (disposed || current !== request || !wanted) return false
        sync()
        status('playing')
        return true
      } catch (error) {
        if (disposed || current !== request) return false
        wanted = false
        status(error?.name === 'NotAllowedError' ? 'blocked' : 'error')
        return false
      }
    },
    pause() { wanted = false; request++; audio.pause(); status('paused') },
    setVolume(value) { audio.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_RADIO_PREFERENCES.volume },
    sync,
    dispose() {
      disposed = true; wanted = false; request++
      clearInterval(interval)
      for (const [event, fn] of Object.entries(listeners)) audio.removeEventListener(event, fn)
      audio.pause()
    },
  }
}
