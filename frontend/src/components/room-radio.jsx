import React, { useContext, useEffect, useRef, useState } from 'react'
import { ServerClockContext } from '../ws/useServerCountdown.js'
import { RADIO_TRACK, createRoomRadio, readRadioPreferences, saveRadioPreferences } from '../audio/roomRadio.js'
import { Sheet } from './sheet.jsx'

function Turntable({ spinning }) {
  return <svg viewBox="0 0 144 116" className={`turntable ${spinning ? 'is-spinning' : ''}`} aria-hidden="true">
    <rect x="5" y="9" width="134" height="98" rx="13" fill="#B78B50" stroke="#28251E" strokeWidth="2.5"/>
    <rect x="11" y="15" width="122" height="86" rx="8" fill="#D0AF77" stroke="#28251E" strokeWidth="1"/>
    <path d="M19 20v75m6-75v75m98-75v75" stroke="#8F693D" strokeWidth="1" opacity=".3"/>
    <g className="record-disc"><circle cx="62" cy="57" r="37" fill="#28251E"/><g fill="none" stroke="#F3E8D0" opacity=".18"><circle cx="62" cy="57" r="31"/><circle cx="62" cy="57" r="27"/><circle cx="62" cy="57" r="22"/></g><path d="M37 36a32 32 0 0 1 33-9l-6 17Z" fill="#F3E8D0" opacity=".09"/><circle cx="62" cy="57" r="14" fill="#B8432E"/><path d="M52 53h20m-18 7h16" stroke="#F3E8D0" strokeWidth="1.5"/><circle cx="62" cy="57" r="3" fill="#F3E8D0"/></g>
    <circle cx="115" cy="30" r="8" fill="#28251E"/><path d="M115 30v24L95 75" fill="none" stroke="#28251E" strokeWidth="6" strokeLinecap="round"/><path d="M115 30v24L95 75" fill="none" stroke="#ECE0C4" strokeWidth="3" strokeLinecap="round"/><path d="m95 69-7 9 6 5 8-10Z" fill="#28251E"/>
    <circle cx="118" cy="88" r="4" fill={spinning ? '#567349' : '#7B6B52'}/><path d="M21 99h20" stroke="#28251E" strokeWidth="2"/>
  </svg>
}

export function RoomRadio({ code }) {
  const clock = useContext(ServerClockContext)
  const [preferences, setPreferences] = useState(readRadioPreferences)
  const [status, setStatus] = useState('paused')
  const [expanded, setExpanded] = useState(false)
  const audioRef = useRef(null)
  const playerRef = useRef(null)
  const prefsRef = useRef(preferences)
  const playing = status === 'playing'
  const busy = status === 'loading' || status === 'buffering'
  const listening = playing || busy

  useEffect(() => {
    const player = createRoomRadio(audioRef.current, { code, clock, onStatus: setStatus })
    playerRef.current = player
    player.setVolume(prefsRef.current.volume)
    if (prefsRef.current.enabled) void player.start()
    const onVisible = () => { if (document.visibilityState === 'visible') player.sync() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      player.dispose()
      playerRef.current = null
    }
  }, [code, clock])

  // A restored tab may lack a user gesture. Retry on its next real interaction,
  // without asking for a separate click or overriding the listener's mute.
  useEffect(() => {
    if (status !== 'blocked' || !preferences.enabled) return
    const resume = event => {
      if (event.target.closest?.('[data-radio-control]') || !prefsRef.current.enabled) return
      void playerRef.current?.start()
    }
    document.addEventListener('click', resume)
    document.addEventListener('keydown', resume)
    return () => { document.removeEventListener('click', resume); document.removeEventListener('keydown', resume) }
  }, [status, preferences.enabled])

  function remember(next) {
    prefsRef.current = next
    setPreferences(next)
    saveRadioPreferences(next)
  }
  function toggle() {
    if (listening) {
      playerRef.current?.pause()
      remember({ ...preferences, enabled:false })
    } else {
      remember({ ...preferences, enabled:true })
      void playerRef.current?.start()
    }
  }
  function volumeChanged(event) {
    const volume = Number(event.target.value) / 100
    playerRef.current?.setVolume(volume)
    remember({ ...preferences, volume })
  }
  const message = status === 'blocked' ? 'Toca el botón de sonido para escuchar.'
    : status === 'error' ? 'La canción no ha cargado. Puedes reintentarlo.'
    : busy ? 'Sintonizando la sala…'
    : playing ? (preferences.volume === 0 ? 'Radio conectada · Tu volumen está a cero' : 'La misma canción para todo el grupo')
    : 'Un poco de jazz mientras llega el grupo.'

  return <section className={`room-radio-mini ${playing ? 'is-playing' : ''}`} aria-label="Radio de la sala" data-radio-control>
    <audio ref={audioRef} src={RADIO_TRACK.src} preload="none" loop aria-hidden="true"/>
    <button type="button" className="radio-record-button" onClick={() => setExpanded(true)} aria-label="Abrir controles de la radio" aria-haspopup="dialog"><Turntable spinning={playing && preferences.volume > 0}/><span aria-hidden="true">{status === 'blocked' || status === 'error' ? 'Activar' : busy ? 'Cargando' : 'Radio'}⌃</span></button>
    <button type="button" className="radio-mute" onClick={toggle} aria-label={listening ? 'Silenciar música para mí' : status === 'error' ? 'Reintentar música' : 'Activar música de la sala'} aria-pressed={listening}>
      <SoundIcon on={listening && preferences.volume > 0}/>
    </button>
    <span className="sr-only" role="status">{message}</span>
    {expanded && <Sheet title="Radio de la sala" onClose={() => setExpanded(false)} className="radio-sheet">
      <div data-radio-control>
        <div className="radio-expanded-track"><Turntable spinning={playing && preferences.volume > 0}/><div><h3>{RADIO_TRACK.title}</h3><p>{RADIO_TRACK.artist} · Jazz</p><p>Sonando juntos en {code}</p></div></div>
        <div className="radio-expanded-controls"><button type="button" className="room-invite" onClick={toggle}>{listening ? 'Silenciar para mí' : 'Escuchar música'}</button><label><span>Tu volumen <output>{Math.round(preferences.volume * 100)}%</output></span><input type="range" min="0" max="100" step="1" value={Math.round(preferences.volume * 100)} onChange={volumeChanged} aria-label="Tu volumen de música"/></label></div>
        <p className="sheet-intro" role="status">{message}</p>
        <p className="radio-note">Volumen y silencio solo para ti. La música se detiene al empezar la partida.</p>
        <p className="radio-license">«<a href={RADIO_TRACK.source} target="_blank" rel="noreferrer">George Street Shuffle</a>» de Kevin MacLeod (incompetech.com). <a href={RADIO_TRACK.license} target="_blank" rel="noreferrer">CC BY 4.0</a>. Archivo recomprimido, sin cortes.</p>
      </div>
    </Sheet>}
  </section>
}

function SoundIcon({ on }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>{on ? <><path d="M15 8q4 4 0 8m3-11q7 7 0 14"/></> : <path d="m16 9 6 6m0-6-6 6"/>}</svg>
}
