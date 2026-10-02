import { useState, useEffect, useRef, useCallback } from 'react'
import { createServerClock } from './serverClock.js'
import { saveSession } from '../session.js'
import { readAvatarPreference } from '../avatarPreferences.js'
import { getAttribution, getMeasurementConsent, wasInvited, track } from '../analytics.js'
import { WORKER_BASE } from '../config.js'
export { WORKER_BASE } from '../config.js'

function getOrCreatePlayerId() {
  try {
    const key = 'el-impostor-player-id'
    const id = sessionStorage.getItem(key) || crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch { return crypto.randomUUID() }
}

export function useGameSocket() {
  const [gameState, setGameState] = useState(null)
  const [myRole, setMyRole] = useState(null)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [lastError, setLastError] = useState(null)
  const [myId] = useState(getOrCreatePlayerId)
  const clockRef = useRef(createServerClock())
  const connectionRef = useRef(null)
  const wsRef = useRef(null)
  const timersRef = useRef({})
  const retriesRef = useRef(0)
  const hadStateRef = useRef(false)
  const openRef = useRef(null)
  const resumeRef = useRef(null)

  const stopTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout)
    timersRef.current = {}
  }, [])

  const closeSocket = useCallback(() => {
    const socket = wsRef.current
    wsRef.current = null // ignore late callbacks from an obsolete socket
    try { socket?.close() } catch {}
  }, [])

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false
    try {
      wsRef.current.send(JSON.stringify({ type, payload }))
      return true
    } catch {
      try { wsRef.current?.close() } catch {}
      return false
    }
  }, [])

  const disconnect = useCallback(() => {
    connectionRef.current = null
    stopTimers()
    closeSocket()
    hadStateRef.current = false
    clockRef.current.reset()
    setGameState(null)
    setMyRole(null)
    setLastError(null)
    setConnectionState('disconnected')
  }, [closeSocket, stopTimers])

  function openConnection() {
    const connection = connectionRef.current
    if (!connection) return
    stopTimers()
    closeSocket()
    const ws = new WebSocket(`${WORKER_BASE.replace(/^http/, 'ws')}/rooms/${connection.code}/ws`)
    wsRef.current = ws
    let joined = false
    let lastMessageAt = performance.now()
    setConnectionState(hadStateRef.current ? 'reconnecting' : 'connecting')

    const ping = () => {
      if (wsRef.current === ws) send('PING', { clientSentAt: performance.now() })
    }
    resumeRef.current = () => {
      // Mobile browsers can suspend timers and messages while backgrounded.
      // Start a fresh grace period before judging a resumed socket stale.
      lastMessageAt = performance.now()
      ping()
    }

    // Includes opening the socket and waiting for JOIN to be accepted.
    timersRef.current.join = setTimeout(() => {
      if (wsRef.current !== ws || joined) return
      track('join_failed', { method: 'timeout' })
      setLastError('La conexión está tardando. Puedes reintentarlo o volver a la entrada.')
      try { ws.close() } catch {}
    }, 12000)

    ws.onopen = () => {
      if (wsRef.current !== ws) return
      const consent = getMeasurementConsent()
      if (!send('JOIN', { ...connection, playerId: myId, ...(consent ? { consent, attribution: getAttribution(), wasInvited: wasInvited() } : {}) })) return
      ping()
      timersRef.current.heartbeat = setInterval(ping, 20000)
      timersRef.current.watchdog = setInterval(() => {
        if (document.visibilityState !== 'visible') return
        if (performance.now() - lastMessageAt > 35000) ws.close()
      }, 5000)
    }

    ws.onmessage = event => {
      if (wsRef.current !== ws) return
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      lastMessageAt = performance.now()
      const roundTrip = msg.type === 'PONG' && Number.isFinite(msg.clientSentAt)
        ? Math.max(0, performance.now() - msg.clientSentAt) : 0
      clockRef.current.sync(msg.serverNow, roundTrip)
      if (msg.type === 'STATE') {
        const player = msg.payload?.players?.find(p => p.id === myId)
        if (!player) return
        joined = true
        hadStateRef.current = true
        retriesRef.current = 0
        clearTimeout(timersRef.current.join)
        setLastError(null)
        setConnectionState('connected')
        setGameState(msg.payload)
        if (['lobby', 'countdown'].includes(msg.payload.phase)) setMyRole(null)
        saveSession({ code: connection.code, name: player.name })
      } else if (msg.type === 'ROLE') {
        setMyRole(msg.payload)
      } else if (msg.type === 'ERROR') {
        setLastError(msg.payload?.message || 'No se ha podido entrar en la sala.')
        if (!joined) {
          const reason = msg.payload?.reason
          track('join_failed', { method: ['room_not_found', 'game_in_progress', 'room_full', 'invalid_join'].includes(reason) ? reason : 'rejected' })
          connectionRef.current = null
          stopTimers()
          closeSocket()
          setGameState(null)
          setMyRole(null)
          setConnectionState('failed')
        }
      }
    }

    ws.onclose = event => {
      if (wsRef.current !== ws) return
      stopTimers()
      wsRef.current = null
      if (!connectionRef.current) return
      if (event.code === 1000 && event.reason === 'replaced') {
        // Duplicating a tab copies sessionStorage, including the player ID.
        // Only an explicit retry should take control back from that tab.
        connectionRef.current = null
        setGameState(null)
        setMyRole(null)
        setLastError('Tu jugador está conectado en otra pestaña. Continúa allí o pulsa Reintentar conexión para volver aquí.')
        setConnectionState('failed')
        return
      }
      if (joined) track('client_error', { method: 'socket_disconnected' })
      setConnectionState('reconnecting')
      const delay = Math.min(300 * (2 ** retriesRef.current++), 8000)
      if (navigator.onLine !== false && document.visibilityState === 'visible') {
        timersRef.current.retry = setTimeout(() => openRef.current(), delay)
      }
    }
    ws.onerror = () => { try { ws.close() } catch {} }
  }
  openRef.current = openConnection

  const connect = useCallback((code, name) => {
    stopTimers()
    closeSocket()
    connectionRef.current = { code, name, avatarId: readAvatarPreference() }
    retriesRef.current = 0
    hadStateRef.current = false
    clockRef.current.reset()
    setGameState(null)
    setMyRole(null)
    setLastError(null)
    openRef.current()
  }, [closeSocket, stopTimers])

  useEffect(() => {
    const onConsent = () => { if (!getMeasurementConsent()) send('MEASUREMENT_PREFERENCE', { enabled: false }) }
    window.addEventListener('el-impostor:consent-change', onConsent)
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !connectionRef.current) return
      if (navigator.onLine === false) return
      if (wsRef.current?.readyState === WebSocket.OPEN) resumeRef.current?.()
      else if (wsRef.current?.readyState !== WebSocket.CONNECTING) openRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.removeEventListener('el-impostor:consent-change', onConsent)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      connectionRef.current = null
      stopTimers()
      closeSocket()
    }
  }, [send, closeSocket, stopTimers])

  return { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send, clock: clockRef.current }
}
