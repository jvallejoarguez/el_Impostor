// frontend/src/app.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { HomeScreen, JoinScreen } from './components/screens-entry.jsx'
import { LobbyScreen, CountdownScreen } from './components/screens-lobby.jsx'
import { RoleRevealScreen, GameplayScreen } from './components/screens-game.jsx'
import { BetweenRoundScreen, VotingScreen, ResultsScreen } from './components/screens-vote.jsx'
import { useGameSocket, WORKER_BASE } from './ws/useGameSocket.js'
import { initSounds } from './audio/soundManager.js'
import { clearInviteCodeFromUrl, getInviteCodeFromUrl, track } from './analytics.js'

// Theming defaults (keep existing theme system intact)
const DEFAULT_THEME = {
  primaryColor: '#E63946',
  logoVariant: 'stacked',
  avatarStyle: 'blob',
  circleLayout: 'orbit',
  revealStyle: 'flash',
  typography: 'archivo',
  dark: false,
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [theme] = useState(DEFAULT_THEME)
  const trackedPhaseRef = useRef(null)

  const { gameState, myRole, myId, connectionState, lastError, connect, disconnect, send } =
    useGameSocket()

  // Apply theme variables to document (preserved from previous app.jsx behavior)
  useEffect(() => {
    document.documentElement.style.setProperty('--red', theme.primaryColor)
    document.documentElement.setAttribute('data-theme', theme.dark ? 'dark' : 'light')
    const fonts = {
      archivo: ['Archivo Black', 'Space Grotesk', 'JetBrains Mono'],
      bricolage: ['Bricolage Grotesque', 'Space Grotesk', 'JetBrains Mono'],
      condensed: ['Anton', 'Space Grotesk', 'JetBrains Mono'],
      rounded: ['DM Sans', 'DM Sans', 'JetBrains Mono'],
    }
    const [disp, ui, mono] = fonts[theme.typography] || fonts.archivo
    document.documentElement.style.setProperty('--font-display', `"${disp}", sans-serif`)
    document.documentElement.style.setProperty('--font-ui', `"${ui}", sans-serif`)
    document.documentElement.style.setProperty('--font-mono', `"${mono}", monospace`)
  }, [theme])

  // Derived values
  const phase = gameState?.phase ?? null
  const myPlayer = gameState?.players?.find(p => p.id === myId) ?? null
  const amOwner = myPlayer?.isOwner ?? false

  useEffect(() => {
    const inviteCode = getInviteCodeFromUrl()
    if (!inviteCode) return
    setRoomCode(inviteCode)
    setScreen('join')
    track('invite_link_opened', { roomCode: inviteCode })
  }, [])

  useEffect(() => {
    if (!phase) return
    if (trackedPhaseRef.current === phase) return
    trackedPhaseRef.current = phase
    track(`phase_${phase}`, {
      roomCode: gameState?.code || roomCode,
      playerCount: gameState?.players?.filter(p => p.connected !== false).length,
    })
  }, [phase, gameState?.code, gameState?.players, roomCode])

  // ── Navigation helpers ────────────────────────────────────────

  const handleSoundsInit = useCallback(() => {
    initSounds() // must be called from a user interaction
  }, [])

  const handleCreateRoom = useCallback(async (name) => {
    handleSoundsInit()
    setCreateError(null)
    setPlayerName(name)
    try {
      const res = await fetch(`${WORKER_BASE}/rooms`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { code } = await res.json()
      if (!code) throw new Error('No room code returned')
      setRoomCode(code)
      connect(code, name)
      track('create_room', { roomCode: code })
      setScreen('lobby')
    } catch {
      setCreateError('No se pudo crear la sala. Inténtalo de nuevo.')
    }
  }, [connect, handleSoundsInit])

  const handleJoinRoom = useCallback((name, code) => {
    handleSoundsInit()
    setPlayerName(name)
    setRoomCode(code)
    setJoinError(null)
    connect(code, name)
    track('join_room', { roomCode: code })
    setScreen('lobby')
  }, [connect, handleSoundsInit])

  const handleLeaveRoom = useCallback(() => {
    disconnect()
    clearInviteCodeFromUrl()
    setScreen('home')
    setRoomCode('')
    setPlayerName('')
  }, [disconnect])

  // ── Game actions (delegate to server via send()) ──────────────

  const handleReady = useCallback(() => { track('ready'); send('READY') }, [send])
  const handleUpdateRules = useCallback((rules) => { track('update_rules'); send('UPDATE_RULES', { rules }) }, [send])
  const handleStartGame = useCallback(() => { track('start_game', { roomCode }); send('START_GAME') }, [roomCode, send])
  const handleSubmitWord = useCallback((word) => send('SUBMIT_WORD', { word }), [send])
  const handleBetweenVote = useCallback((choice) => send('BETWEEN_VOTE', { choice }), [send])
  const handleCastVote = useCallback((targetId) => send('CAST_VOTE', { targetId }), [send])
  const handleConfirmVote = useCallback(() => send('CONFIRM_VOTE'), [send])
  const handlePlayAgain = useCallback(() => send('PLAY_AGAIN'), [send])
  const handleBackToLobby = useCallback(() => send('BACK_TO_LOBBY'), [send])

  // ── Screen routing ────────────────────────────────────────────
  // Map server phase to the appropriate screen component.
  // 'home', 'create' and 'join' are local-only (no server phase yet).

  if (screen === 'home') {
    return (
      <HomeScreen
        theme={theme}
        onCreateRoom={() => setScreen('create')}
        onJoinRoom={() => setScreen('join')}
      />
    )
  }

  if (screen === 'create') {
    return (
      <HomeScreen
        theme={theme}
        mode="create"
        error={createError}
        onSubmitName={handleCreateRoom}
        onBack={() => { setCreateError(null); setScreen('home') }}
      />
    )
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        theme={theme}
        error={joinError || lastError}
        initialCode={roomCode}
        onJoin={handleJoinRoom}
        onBack={() => { clearInviteCodeFromUrl(); setScreen('home') }}
      />
    )
  }

  // From here on, we need gameState
  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Space Grotesk, sans-serif' }}>
        Conectando...
      </div>
    )
  }

  let screenEl = null
  switch (phase) {
    case 'lobby':
      screenEl = (
        <LobbyScreen
          theme={theme}
          room={{ ...gameState, code: roomCode }}
          myId={myId}
          amOwner={amOwner}
          onReady={handleReady}
          onUpdateRules={handleUpdateRules}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
        />
      )
      break
    case 'countdown':
      screenEl = <CountdownScreen theme={theme} />
      break
    case 'roleReveal':
      screenEl = <RoleRevealScreen theme={theme} myRole={myRole} revealStyle={theme.revealStyle} />
      break
    case 'playing':
    case 'roundReview':
      screenEl = (
        <GameplayScreen
          theme={theme}
          room={gameState}
          myId={myId}
          myRole={myRole}
          onSubmitWord={handleSubmitWord}
        />
      )
      break
    case 'betweenRound':
      screenEl = <BetweenRoundScreen theme={theme} room={gameState} myId={myId} onVote={handleBetweenVote} />
      break
    case 'voting':
      screenEl = (
        <VotingScreen
          theme={theme}
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
          theme={theme}
          room={gameState}
          myId={myId}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={amOwner ? handleBackToLobby : undefined}
        />
      )
      break
  }

  return (
    <>
      {screenEl}
      {connectionState === 'reconnecting' && <ReconnectBanner />}
    </>
  )
}

function ReconnectBanner() {
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
      boxShadow: '4px 4px 0 var(--mustard)',
      zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--mustard)',
        animation: 'pulse 1s ease-in-out infinite',
      }}/>
      Reconectando…
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
