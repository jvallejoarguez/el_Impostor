import React from 'react'
import { isMuted, setMuted, initSounds } from '../audio/soundManager.js'

export function SoundToggle() {
  const [on, setOn] = React.useState(() => !isMuted())
  const toggle = () => { initSounds(); setMuted(on); setOn(!on) }
  return <button type="button" className="sound-toggle" aria-pressed={on} aria-label={on ? 'Silenciar sonidos' : 'Activar sonidos'} onClick={toggle}>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/>
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/> : <path d="m17 9 5 6m0-6-5 6"/>}
    </svg>
  </button>
}
