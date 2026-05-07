// frontend/src/app.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { HomeScreen, JoinScreen } from './components/screens-entry.jsx'
import { LobbyScreen, CountdownScreen } from './components/screens-lobby.jsx'
import { RoleRevealScreen, GameplayScreen } from './components/screens-game.jsx'
import { BetweenRoundScreen, VotingScreen, ResultsScreen } from './components/screens-vote.jsx'
import { useGameSocket } from './ws/useGameSocket.js'
import { initSounds } from './audio/soundManager.js'

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
  const [theme] = useState(DEFAULT_THEME)

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

  // ── Navigation helpers ────────────────────────────────────────

  const handleSoundsInit = useCallback(() => {
    initSounds() // must be called from a user interaction
  }, [])

  const handleCreateRoom = useCallback(async (name) => {
    handleSoundsInit()
    setPlayerName(name)
    try {
      const res = await fetch('/rooms', { method: 'POST' })
      const { code } = await res.json()
      setRoomCode(code)
      connect(code, name)
      setScreen('lobby')
    } catch {
      setJoinError('No se pudo crear la sala. Inténtalo de nuevo.')
    }
  }, [connect, handleSoundsInit])

  const handleJoinRoom = useCallback((name, code) => {
    handleSoundsInit()
    setPlayerName(name)
    setRoomCode(code)
    setJoinError(null)
    connect(code, name)
    setScreen('lobby')
  }, [connect, handleSoundsInit])

  const handleLeaveRoom = useCallback(() => {
    disconnect()
    setScreen('home')
    setRoomCode('')
    setPlayerName('')
  }, [disconnect])

  // ── Game actions (delegate to server via send()) ──────────────

  const handleReady = useCallback(() => send('READY'), [send])
  const handleUpdateRules = useCallback((rules) => send('UPDATE_RULES', { rules }), [send])
  const handleStartGame = useCallback(() => send('START_GAME'), [send])
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
        onSubmitName={handleCreateRoom}
        onBack={() => setScreen('home')}
      />
    )
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        theme={theme}
        error={joinError || lastError}
        onJoin={handleJoinRoom}
        onBack={() => setScreen('home')}
      />
    )
  }

  // From here on, we need gameState
  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Space Grotesk, sans-serif' }}>
        {connectionState === 'connecting' ? 'Conectando...' : 'Desconectado — reconectando...'}
      </div>
    )
  }

  switch (phase) {
    case 'lobby':
      return (
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

    case 'countdown':
      return <CountdownScreen theme={theme} />

    case 'roleReveal':
      return (
        <RoleRevealScreen
          theme={theme}
          myRole={myRole}
          revealStyle={theme.revealStyle}
        />
      )

    case 'playing':
      return (
        <GameplayScreen
          theme={theme}
          room={gameState}
          myId={myId}
          myRole={myRole}
          onSubmitWord={handleSubmitWord}
        />
      )

    case 'betweenRound':
      return (
        <BetweenRoundScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onVote={handleBetweenVote}
        />
      )

    case 'voting':
      return (
        <VotingScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onCastVote={handleCastVote}
          onConfirmVote={handleConfirmVote}
        />
      )

    case 'results':
      return (
        <ResultsScreen
          theme={theme}
          room={gameState}
          myId={myId}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={amOwner ? handleBackToLobby : undefined}
        />
      )

    default:
      return null
  }
}
