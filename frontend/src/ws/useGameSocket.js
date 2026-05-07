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

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || ''
// In dev, Vite proxies /rooms → localhost:8787, so WORKER_BASE is empty.
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
  const myId = getOrCreatePlayerId()

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const connect = useCallback((code, name) => {
    activeCodeRef.current = code
    activeNameRef.current = name
    retryCountRef.current = 0
    _openConnection(code, name)
  }, [])

  const disconnect = useCallback(() => {
    activeCodeRef.current = null
    activeNameRef.current = null
    clearTimeout(retryTimerRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setGameState(null)
    setMyRole(null)
    setConnectionState('disconnected')
  }, [])

  function _openConnection(code, name) {
    clearTimeout(retryTimerRef.current)
    const wsUrl = `${WORKER_BASE.replace(/^http/, 'ws')}/rooms/${code}/ws`
    setConnectionState('connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      retryCountRef.current = 0
      setConnectionState('connected')
      ws.send(JSON.stringify({ type: 'JOIN', payload: { name, code, playerId: myId } }))
    }

    ws.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
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
      }
    }

    ws.onclose = () => {
      setConnectionState('disconnected')
      if (activeCodeRef.current && activeNameRef.current) {
        // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(
          () => _openConnection(activeCodeRef.current, activeNameRef.current),
          delay,
        )
      }
    }

    ws.onerror = () => ws.close()
  }

  useEffect(() => () => {
    clearTimeout(retryTimerRef.current)
    wsRef.current?.close()
  }, [])

  return { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send }
}
