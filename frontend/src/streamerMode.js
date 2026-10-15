import { useSyncExternalStore } from 'react'

// Streamer mode hides what viewers must not see: the room code and your role.
// It is a per-device preference, remembered in localStorage.
const KEY = 'el-impostor-streamer'
const listeners = new Set()
let on = (() => { try { return localStorage.getItem(KEY) === 'on' } catch { return false } })()

export const isStreamerMode = () => on

export function setStreamerMode(value) {
  on = value
  try { localStorage.setItem(KEY, value ? 'on' : 'off') } catch {}
  listeners.forEach(listener => listener())
}

export function useStreamerMode() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => on, () => false)
}
