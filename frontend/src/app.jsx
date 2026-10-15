// frontend/src/app.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { HomeScreen, JoinScreen } from './components/screens-entry.jsx'
import { LobbyScreen, CountdownScreen } from './components/screens-lobby.jsx'
import { RoleRevealScreen, GameplayScreen } from './components/screens-game.jsx'
import { BetweenRoundScreen, VotingScreen, ResultsScreen } from './components/screens-vote.jsx'
import { useGameSocket, WORKER_BASE } from './ws/useGameSocket.js'
import { setMusic } from './audio/soundManager.js'
import { useStreamerMode } from './streamerMode.js'
import { captureCampaign, getAttribution, getMeasurementConsent, wasInvited, track } from './analytics.js'
import { useFeedback } from './components/feedback.jsx'
import { readSession, clearSession, entryFromUrl, updateEntryUrl } from './session.js'
import { ServerClockContext } from './ws/useServerCountdown.js'
import { saveAvatarPreference } from './avatarPreferences.js'

export default function App() {
  const [entry] = useState(() => entryFromUrl(window.location.search, readSession()))
  const [screen, setScreen] = useState(entry.screen)
  const [playerName, setPlayerName] = useState(entry.name)
  const [roomCode, setRoomCode] = useState(entry.code)
  const [category, setCategory] = useState(entry.category)
  const [creating, setCreating] = useState(false)
  const createRequestRef = useRef(null)
  const [joinError, setJoinError] = useState(null)
  const [createError, setCreateError] = useState(null)
  const { setContext: setFeedbackContext, offerExitSurvey } = useFeedback()
  const lobbyEnteredAt = useRef(0)
  const hasPlayed = useRef(false)

  const { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send, clock } =
    useGameSocket()

  // Derived values
  const phase = gameState?.phase ?? null
  // Home track before and between games, the sneaky track while clues and votes
  // happen; countdown, role reveal and results leave room for their own sounds.
  useEffect(() => {
    setMusic(!phase || phase === 'lobby' ? 'home' : ['playing', 'roundReview', 'betweenRound', 'voting'].includes(phase) ? 'game' : null)
  }, [phase])
  const myPlayer = gameState?.players?.find(p => p.id === myId) ?? null
  const amOwner = myPlayer?.isOwner ?? false

  useEffect(() => {
    captureCampaign()
    if (entry.resume) connect(entry.code, entry.name)
    else if (entry.screen === 'join') track('invite_link_opened')
    return () => createRequestRef.current?.abort()
  }, [entry, connect])

  // Streamer mode keeps the room code out of the address bar (it shows on stream).
  const streamer = useStreamerMode()
  useEffect(() => {
    if (!gameState) return
    updateEntryUrl(streamer ? '' : gameState.code)
    setPlayerName(myPlayer?.name || playerName)
  }, [gameState, phase, myPlayer?.name, playerName, streamer])

  const playerCount = gameState?.players.filter(p => p.connected !== false).length || 0
  const feedbackCategory = gameState?.rules?.wordCategories?.join('_') || category
  useEffect(() => {
    setFeedbackContext({ phase: ['home', 'create', 'join'].includes(screen) ? screen : phase || 'connecting', gameId: gameState?.gameId, playerCount, category: feedbackCategory })
  }, [screen, phase, gameState?.gameId, playerCount, feedbackCategory, setFeedbackContext])
  useEffect(() => {
    if (phase === 'lobby') lobbyEnteredAt.current = Date.now()
    if (phase === 'playing' || phase === 'results') hasPlayed.current = true
  }, [phase])

  useEffect(() => {
    if (connectionState === 'failed') clearSession()
  }, [connectionState])

  // ── Navigation helpers ────────────────────────────────────────

  const handleCreateRoom = useCallback(async (name) => {
    if (createRequestRef.current) return
    setCreateError(null)
    setPlayerName(name)
    setCreating(true)
    const controller = new AbortController()
    createRequestRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const consent = getMeasurementConsent()
      const query = new URLSearchParams({ category, ...(consent ? { ...getAttribution(), wasInvited: String(wasInvited()), consent: JSON.stringify(consent) } : {}) })
      const res = await fetch(`${WORKER_BASE}/rooms?${query}`, { method: 'POST', signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { code } = await res.json()
      if (!code) throw new Error('No room code returned')
      if (createRequestRef.current !== controller) return
      clearSession()
      setRoomCode(code)
      connect(code, name)
      setScreen('lobby')
    } catch {
      if (createRequestRef.current === controller) setCreateError('No se pudo crear la sala. Comprueba tu conexión e inténtalo de nuevo.')
      track('create_failed', { category })
    } finally {
      clearTimeout(timeout)
      if (createRequestRef.current === controller) { createRequestRef.current = null; setCreating(false) }
    }
  }, [connect, category])

  const handleJoinRoom = useCallback((name, code) => {
    setPlayerName(name)
    setRoomCode(code)
    setJoinError(null)
    clearSession()
    connect(code, name)
    track('join_attempt')
    setScreen('lobby')
  }, [connect])

  const handleLeaveRoom = useCallback(() => {
    if (phase === 'lobby') {
      track('lobby_left', { playerCount })
      if (!hasPlayed.current && Date.now() - lobbyEnteredAt.current >= 20000) offerExitSurvey({ phase: 'lobby', playerCount, category: feedbackCategory })
    }
    createRequestRef.current?.abort()
    createRequestRef.current = null
    setCreating(false)
    setCreateError(null)
    setJoinError(null)
    send('LEAVE') // frees the seat instead of leaving a "Sin conexión" ghost
    disconnect()
    clearSession()
    updateEntryUrl()
    setScreen('home')
    setRoomCode('')
    setCategory('all')
  }, [disconnect, send, phase, playerCount, feedbackCategory, offerExitSurvey])

  const handleCreateIntent = () => { track('create_intent', { category }); setScreen('create') }
  const handleNewGroup = () => {
    track('new_group_intent', { wasInvited: wasInvited() })
    handleLeaveRoom()
    setScreen('create')
  }

  const editConnection = () => {
    disconnect()
    clearSession()
    setScreen('join')
  }

  // ── Game actions (delegate to server via send()) ──────────────

  const handleReady = useCallback(() => send('READY'), [send])
  const handleUpdateRules = useCallback((rules) => send('UPDATE_RULES', { rules }), [send])
  const handleCustomWords = useCallback((words, only) => send('SET_CUSTOM_WORDS', { words, only }), [send])
  const handleSelectAvatar = useCallback((avatarId) => {
    if (!send('UPDATE_AVATAR', { avatarId })) return false
    saveAvatarPreference(avatarId)
    return true
  }, [send])
  const handleStartGame = useCallback(() => send('START_GAME'), [send])
  const handleSubmitWord = useCallback((word) => send('SUBMIT_WORD', { word }), [send])
  const handleBetweenVote = useCallback((choice) => send('BETWEEN_VOTE', { choice }), [send])
  const handleCastVote = useCallback((targetId) => send('CAST_VOTE', { targetId }), [send])
  const handleConfirmVote = useCallback(() => send('CONFIRM_VOTE'), [send])
  const handlePlayAgain = useCallback(() => { track('play_again_requested', { gameId: gameState?.gameId }); send('PLAY_AGAIN') }, [send, gameState?.gameId])
  const handleBackToLobby = useCallback(() => send('BACK_TO_LOBBY'), [send])

  // ── Screen routing ────────────────────────────────────────────
  // Map server phase to the appropriate screen component.
  // 'home', 'create' and 'join' are local-only (no server phase yet).

  if (screen === 'home') {
    return (
      <HomeScreen
        onCreateRoom={handleCreateIntent}
        onJoinRoom={() => setScreen('join')}
      />
    )
  }

  if (screen === 'create') {
    return (
      <HomeScreen
        mode="create"
        error={createError}
        creating={creating}
        category={category}
        initialName={playerName}
        onSubmitName={handleCreateRoom}
        onBack={handleLeaveRoom}
      />
    )
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        error={joinError || lastError}
        initialCode={roomCode}
        initialName={playerName}
        onCreateRoom={() => { disconnect(); setRoomCode(''); setScreen('create') }}
        onJoin={handleJoinRoom}
        onBack={handleLeaveRoom}
      />
    )
  }

  // From here on, we need gameState
  if (!gameState) {
    return (
      <main className="connection-screen screen-pad">
        <section className="card connection-card" aria-labelledby="connection-title">
          <p className="eyebrow-text">Sala {roomCode}</p>
          <h1 id="connection-title">{connectionState === 'failed' ? 'No hemos podido entrar' : 'Entrando en la sala…'}</h1>
          <p role={lastError ? 'alert' : 'status'}>{lastError || `Conectando como ${playerName}…`}</p>
          <button className="btn btn--primary btn--block" onClick={() => connect(roomCode, playerName)}>Reintentar conexión</button>
          <button className="btn btn--ghost btn--block" onClick={editConnection}>Cambiar nombre o código</button>
          <button className="text-button" onClick={handleLeaveRoom}>Volver al inicio</button>
        </section>
      </main>
    )
  }

  let screenEl = null
  switch (phase) {
    case 'lobby':
      screenEl = (
        <LobbyScreen
          room={{ ...gameState, code: roomCode }}
          myId={myId}
          amOwner={amOwner}
          onReady={handleReady}
          onUpdateRules={handleUpdateRules}
          onCustomWords={handleCustomWords}
          onSelectAvatar={handleSelectAvatar}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
        />
      )
      break
    case 'countdown':
      screenEl = <CountdownScreen timerEnd={gameState.timerEnd} />
      break
    case 'roleReveal':
      screenEl = <RoleRevealScreen myRole={myRole} timerEnd={gameState.timerEnd} />
      break
    case 'playing':
    case 'roundReview':
      screenEl = (
        <GameplayScreen
          room={gameState}
          myId={myId}
          myRole={myRole}
          onSubmitWord={handleSubmitWord}
        />
      )
      break
    case 'betweenRound':
      screenEl = <BetweenRoundScreen room={gameState} myId={myId} onVote={handleBetweenVote} />
      break
    case 'voting':
      screenEl = (
        <VotingScreen
          room={gameState}
          myId={myId}
          onCastVote={handleCastVote}
          onConfirmVote={handleConfirmVote}
        />
      )
      break
    case 'results':
      screenEl = (
        <ResultsScreen
          room={gameState}
          myId={myId}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={amOwner ? handleBackToLobby : undefined}
          onNewGroup={handleNewGroup}
        />
      )
      break
  }

  return (
    <ServerClockContext.Provider value={clock}>
      {screenEl}
      {!['lobby', 'countdown', 'roleReveal'].includes(phase) && <footer className="game-exit"><button className="text-button" onClick={handleLeaveRoom}>Salir de la sala</button></footer>}
      {connectionState !== 'connected' && <ReconnectBanner onLeave={handleLeaveRoom} />}
    </ServerClockContext.Provider>
  )
}

function ReconnectBanner({ onLeave }) {
  // Only paint after 800ms of disconnection — avoids flicker for instant reconnects.
  const [show, setShow] = React.useState(false)
  React.useEffect(() => {
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'var(--ink)', color: 'var(--paper)',
      border: '2.5px solid var(--ink)', borderRadius: 10,
      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
      letterSpacing: '0.04em',
      boxShadow: '0 4px 0 var(--mustard)',
      zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--mustard)',
        animation: 'pulse 1s ease-in-out infinite',
      }}/>
      Reconectando…
      <button className="reconnect-exit" onClick={onLeave}>Salir</button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
