// Monotonic elapsed time keeps a changed device clock from changing the countdown.
export function createServerClock(monotonicNow = () => performance.now(), wallNow = () => Date.now()) {
  let anchor = null
  return {
    sync(serverNow, roundTrip = 0) {
      if (!Number.isFinite(serverNow)) return
      anchor = { server: serverNow + Math.max(0, Math.min(roundTrip, 2000)) / 2, local: monotonicNow() }
    },
    now() {
      return anchor ? anchor.server + Math.max(0, monotonicNow() - anchor.local) : wallNow()
    },
    reset() { anchor = null },
  }
}

export function secondsRemaining(end, now, duration) {
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.min(Math.ceil(duration), Math.ceil((end - now) / 1000)))
}
