// frontend/src/ws/useGameSocket.js
import { useState, useEffect, useRef, useCallback } from 'react'

function getOrCreatePlayerId() {
  const key = 'el-impostor-player-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

export const WORKER_BASE = import.meta.env.VITE_WORKER_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : '')
// In dev we hit wrangler directly (bypassing Vite proxy — its WebSocket
// support is unreliable). Worker CORS allows http://localhost:3000.
// In production, set VITE_WORKER_URL=https://el-impostor-worker.<account>.workers.dev

export function useGameSocket() {
  const [gameState, setGameState] = useState(null)
  const [myRole, setMyRole] = useState(null)     // { isImpostor, word, hint }
  const [connectionState, setConnectionState] = useState('disconnected')
  const [lastError, setLastError] = useState(null)

  const wsRef = useRef(null)
  const retryTimerRef = useRef(null)
  const retryCountRef = useRef(0)
  const activeCodeRef = useRef(null)
  const activeNameRef = useRef(null)
  const heartbeatRef = useRef(null)
  const watchdogRef = useRef(null)
  const lastMessageAtRef = useRef(0)
  const myIdRef = useRef(null)
  if (!myIdRef.current) myIdRef.current = getOrCreatePlayerId()
  const myId = myIdRef.current

  const HEARTBEAT_MS = 20000     // send PING every 20s
  const WATCHDOG_MS = 35000      // if no message in 35s, assume dead and reconnect

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const _stopTimers = () => {
    clearInterval(heartbeatRef.current)
    clearInterval(watchdogRef.current)
    heartbeatRef.current = null
    watchdogRef.current = null
  }

  const connect = useCallback((code, name) => {
    clearTimeout(retryTimerRef.current)
    _stopTimers()
    if (wsRef.current) {
      const old = wsRef.current
      wsRef.current = null   // orphan it so onclose's `wsRef.current !== ws` check skips retry
      try { old.close() } catch {}
    }
    activeCodeRef.current = code
    activeNameRef.current = name
    retryCountRef.current = 0
    _openConnection(code, name)
  }, [])

  const disconnect = useCallback(() => {
    activeCodeRef.current = null
    activeNameRef.current = null
    clearTimeout(retryTimerRef.current)
    _stopTimers()
    wsRef.current?.close()
    wsRef.current = null
    setGameState(null)
    setMyRole(null)
    setLastError(null)
    setConnectionState('disconnected')
  }, [])

  function _openConnection(code, name) {
    clearTimeout(retryTimerRef.current)
    _stopTimers()
    const wsUrl = `${WORKER_BASE.replace(/^http/, 'ws')}/rooms/${code}/ws`
    setConnectionState(prev => prev === 'connected' ? 'reconnecting' : 'connecting')

    console.log('[ws] opening', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (wsRef.current !== ws) return
      console.log('[ws] open, sending JOIN', { code, name, playerId: myIdRef.current })
      retryCountRef.current = 0
      lastMessageAtRef.current = Date.now()
      setLastError(null)
      setConnectionState('connected')
      ws.send(JSON.stringify({ type: 'JOIN', payload: { name, code, playerId: myIdRef.current } }))

      // Heartbeat: keep the WS alive across idle proxies / dev tunnels.
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'PING' })) } catch {}
        }
      }, HEARTBEAT_MS)

      // Watchdog: if we haven't heard anything in WATCHDOG_MS, force-close to trigger retry.
      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastMessageAtRef.current > WATCHDOG_MS) {
          try { ws.close() } catch {}
        }
      }, 5000)
    }

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return
      lastMessageAtRef.current = Date.now()
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.type !== 'PONG') console.log('[ws] recv', msg.type, msg.payload)
      switch (msg.type) {
        case 'STATE':
          setGameState(msg.payload)
          break
        case 'ROLE':
          setMyRole(msg.payload)
          break
        case 'ERROR':
          setLastError(msg.payload.message)
          break
        case 'PONG':
          break
      }
    }

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return  // superseded by a newer socket — do nothing
      console.log('[ws] close', { code: event.code, reason: event.reason, wasClean: event.wasClean })
      _stopTimers()
      setConnectionState('reconnecting')
      if (activeCodeRef.current && activeNameRef.current) {
        // Fast first retry, then exponential backoff: 300ms, 800ms, 1.6s, 3.2s, max 8s.
        const delay = retryCountRef.current === 0
          ? 300
          : Math.min(800 * Math.pow(2, retryCountRef.current - 1), 8000)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(
          () => _openConnection(activeCodeRef.current, activeNameRef.current),
          delay,
        )
      } else {
        setConnectionState('disconnected')
      }
    }

    ws.onerror = () => ws.close()
  }

  useEffect(() => () => {
    activeCodeRef.current = null
    activeNameRef.current = null
    clearTimeout(retryTimerRef.current)
    _stopTimers()
    const ws = wsRef.current
    wsRef.current = null
    try { ws?.close() } catch {}
  }, [])

  return { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send }
}
