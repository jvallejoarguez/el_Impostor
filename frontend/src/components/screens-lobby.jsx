import React, { useState } from 'react'
import { Avatar } from './primitives.jsx'
import { AvatarPickerButton } from './avatar-picker.jsx'
import { Sheet } from './sheet.jsx'
import { play } from '../audio/soundManager.js'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { WORD_CATEGORIES, normalizeWordCategories, wordCategoriesLabel } from '../wordCategories.js'
import { getInviteUrl, getInviteText, getWhatsAppShareUrl, track } from '../analytics.js'
import { InviteSheet } from './invite-sheet.jsx'
import { useStreamerMode, setStreamerMode } from '../streamerMode.js'

function LobbyScreen({ room, myId, amOwner, onReady, onUpdateRules, onCustomWords, onSelectAvatar, onStartGame, onLeave }) {
  const [feedback, setFeedback] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showCustomWords, setShowCustomWords] = useState(false)
  const streamer = useStreamerMode()
  const customCount = room.rules.customWordCount || 0
  const connected = room.players.filter(p => p.connected !== false)
  const waiting = connected.filter(p => !p.ready && !p.isOwner)
  const missing = Math.max(0, 3 - connected.length)
  const canStart = amOwner && !missing && !waiting.length
  const iAmReady = room.players.find(p => p.id === myId)?.ready
  const categoryValue = room.rules.wordCategories ?? room.rules.wordCategory ?? 'all'
  const status = missing ? `Falta${missing === 1 ? '' : 'n'} ${missing} para empezar`
    : waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'persona por confirmar' : 'personas por confirmar'}` : 'Todo el grupo está listo'

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setFeedback('Código copiado.')
      track('copy_room_code')
    } catch { setShowInvite(true) }
  }
  const invite = () => { setShowInvite(true); track('qr_opened', { phase: 'lobby' }) }
  // A pop for every new arrival, like players dropping into a party lobby.
  const joinedRef = React.useRef(connected.length)
  React.useEffect(() => {
    if (connected.length > joinedRef.current) play('join')
    joinedRef.current = connected.length
  }, [connected.length])

  return <main className="room-lobby">
    <header className="room-topbar">
      <button type="button" onClick={onLeave} className="room-leave" aria-label="Salir de la sala">← Salir</button>
      <h1>Sala de espera</h1>
      <button type="button" className="room-code" onClick={copyCode} aria-label={`Copiar código de sala ${room.code}`}><span>{streamer ? '••••' : room.code}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 5V3H3v13h2"/></svg></button>
    </header>
    <div className="room-panels">
      <section className="room-group" aria-labelledby="players-title">
        <div className="room-section-heading"><h2 id="players-title">El grupo</h2><span>{connected.length} / {room.rules.maxPlayers}</span></div>
        <div className="room-roster">
          {room.players.map(p => <div key={p.id} className={`room-person ${p.connected === false ? 'is-disconnected' : ''}`}>
            {p.id === myId ? <AvatarPickerButton name={p.name} avatarId={p.avatarId} onSelect={onSelectAvatar} size={76} showCrown={p.isOwner}/>
              : <Avatar name={p.name} avatarId={p.avatarId} size={76} showCrown={p.isOwner}/>}
            <strong title={p.name}>{p.name}{p.id === myId && <small> · tú</small>}</strong>
            <span className={`room-person-status ${p.ready || p.isOwner ? 'is-ready' : ''}`}>{p.connected === false ? 'Sin conexión' : p.isOwner ? '★ Anfitrión' : p.ready ? '✓ Listo' : 'Preparándose'}</span>
          </div>)}
          {Array.from({length:missing}, (_, i) => <button type="button" className="room-empty-seat" key={`seat-${i}`} onClick={invite} aria-label="Invitar a un jugador"><span aria-hidden="true">＋</span><small>Invitar</small></button>)}
        </div>
        <div className="room-social"><button type="button" onClick={invite} className="room-invite">＋ Invitar / QR</button><a className="text-button" href={getWhatsAppShareUrl(getInviteText(connected.length), getInviteUrl(room.code, 'whatsapp'))} target="_blank" rel="noreferrer" onClick={() => track('share_invite', { method: 'whatsapp', phase: 'lobby' })}>WhatsApp ↗</a></div>
        <div className="room-streamer">
          <span><strong>Modo streamer</strong><small>Oculta el código y tu palabra en pantalla</small></span>
          <button type="button" className="room-switch" role="switch" aria-checked={streamer} aria-label="Modo streamer" onClick={() => setStreamerMode(!streamer)}><span/></button>
        </div>
        <p className="room-feedback" role="status">{feedback}</p>
      </section>
      <section className="room-settings" aria-labelledby="settings-title">
        <div className="room-section-heading"><h2 id="settings-title">{amOwner ? 'Personalizar partida' : 'La partida'}</h2><span aria-hidden="true">⚙</span></div>
        {!amOwner && <p className="room-host-note">El anfitrión ajusta las reglas.</p>}
        <button type="button" className="room-category-button" onClick={() => setShowCategories(true)} aria-haspopup="dialog"><span><small>Categorías</small><strong>{wordCategoriesLabel(categoryValue)}</strong></span><span aria-hidden="true">›</span></button>
        <button type="button" className="room-category-button room-custom-words" onClick={() => setShowCustomWords(true)} aria-haspopup="dialog" disabled={!amOwner && !customCount}><span><small>Palabras propias</small><strong>{customCount ? `${customCount} palabra${customCount === 1 ? '' : 's'} · ${room.rules.customWordsOnly ? 'solo propias' : 'mezcladas con las categorías'}` : amOwner ? 'Añade las vuestras' : 'Ninguna'}</strong></span>{amOwner && <span aria-hidden="true">›</span>}</button>
        <div className="room-quick-rules">
          <RuleStepper label="Tiempo por turno" value={room.rules.turnTime} min={10} max={60} step={5} suffix=" s" editable={amOwner} onChange={v => onUpdateRules({turnTime:v})}/>
          <RuleStepper label="Rondas antes de votar" value={room.rules.roundsBeforeVote} min={1} max={5} step={1} editable={amOwner} onChange={v => onUpdateRules({roundsBeforeVote:v})}/>
        </div>
        <div className="room-extra-rules">
          <label className="room-capacity"><span>Plazas</span>{amOwner ? <select aria-label="Máximo de jugadores" value={room.rules.maxPlayers} onChange={e => onUpdateRules({maxPlayers:Number(e.target.value)})}>{Array.from({length:14}, (_, i) => i + 3).map(n => <option key={n} value={n} disabled={n < connected.length}>{n}</option>)}</select> : <strong>{room.rules.maxPlayers}</strong>}</label>
          <div className="room-hint"><span>Pista al impostor</span>{amOwner ? <button type="button" className="room-switch" role="switch" aria-checked={room.rules.imposterHasHint} aria-label="Dar una pista al impostor" onClick={() => onUpdateRules({imposterHasHint:!room.rules.imposterHasHint})}><span/></button> : <strong>{room.rules.imposterHasHint ? 'Sí' : 'No'}</strong>}</div>
        </div>
      </section>
    </div>
    <footer className="room-launch">
      <p role="status"><span className={`room-ready-dot ${!missing && !waiting.length ? 'is-ready' : ''}`}/>{status}</p>
      {amOwner ? <button type="button" className="btn btn--primary" disabled={!canStart} onClick={onStartGame}>Empezar partida →</button>
        : <button type="button" className={`btn ${iAmReady ? 'btn--teal' : 'btn--primary'}`} disabled={iAmReady} onClick={onReady}>{iAmReady ? '✓ Estás listo' : 'Estoy listo →'}</button>}
    </footer>
    {showInvite && <InviteSheet code={room.code} playerCount={connected.length} onClose={() => setShowInvite(false)}/>}
    {showCustomWords && amOwner && <CustomWordsSheet count={customCount} only={!!room.rules.customWordsOnly} onSave={onCustomWords} onClose={() => setShowCustomWords(false)}/>}
    {showCategories && <Sheet title="Categorías" onClose={() => setShowCategories(false)} className="category-sheet"><CategoryPicker value={categoryValue} editable={amOwner} onChange={v => onUpdateRules({wordCategories:v})}/><button type="button" className="btn btn--primary sheet-done" onClick={() => setShowCategories(false)}>Listo</button></Sheet>}
  </main>
}

const CUSTOM_DRAFT_KEY = 'el-impostor-custom-words'
function CustomWordsSheet({ count, only, onSave, onClose }) {
  const [text, setText] = useState(() => { try { return sessionStorage.getItem(CUSTOM_DRAFT_KEY) || '' } catch { return '' } })
  const [onlyMine, setOnlyMine] = useState(only)
  const words = text.split(/[\n,;]+/).map(word => word.trim()).filter(Boolean)
  const save = () => {
    try { sessionStorage.setItem(CUSTOM_DRAFT_KEY, text) } catch {}
    onSave(words, onlyMine)
    onClose()
  }
  return <Sheet title="Palabras propias" onClose={onClose}>
    <p className="sheet-intro">Una palabra por línea o separadas por comas: bromas internas, vuestra comunidad, un tema. El resto del grupo solo verá cuántas hay. Estas palabras no llevan pista para el impostor.</p>
    <textarea className="custom-words-input" rows={8} value={text} onChange={e => setText(e.target.value)} aria-label="Tus palabras" placeholder={'Pizza con piña\nEl profe de mates\nNuestro servidor de Discord'}/>
    <p className="helper-text">{words.length} palabra{words.length === 1 ? '' : 's'} escrita{words.length === 1 ? '' : 's'}. Máximo 100, de 2 a 30 caracteres.{count && !text ? ` La sala ya tiene ${count} guardada${count === 1 ? '' : 's'}.` : ''}</p>
    <label className="custom-words-only"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)}/> Usar solo mis palabras</label>
    <button type="button" className="btn btn--primary sheet-done" onClick={save}>Guardar palabras</button>
  </Sheet>
}

function RuleStepper({ label, value, min, max, step, suffix = '', editable, onChange }) {
  return <div className="room-stepper"><span>{label}</span><div>{editable && <button type="button" aria-label={`Reducir ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>}<output aria-label={label}>{value}{suffix}</output>{editable && <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>＋</button>}</div></div>
}

function CategoryPicker({ value, editable, onChange }) {
  const [query, setQuery] = useState('')
  const selected = normalizeWordCategories(value)
  const toggle = id => {
    if (id === 'all') return onChange(['all'])
    const current = selected.includes('all') ? [] : selected
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    onChange(next.length ? next : ['all'])
  }
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const visible = WORD_CATEGORIES.filter(category => normalize(category.label).includes(normalize(query)))
  return <>
    <p className="sheet-intro">{editable ? 'Mezcla las que os apetezcan. Se guardan al tocar.' : 'Estas son las categorías que ha elegido el anfitrión.'}</p>
    <input className="category-search" type="search" aria-label="Buscar categorías" placeholder="Buscar una categoría…" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="room-category-options">{visible.map(category => <button type="button" key={category.id} disabled={!editable} aria-pressed={selected.includes(category.id)} onClick={() => toggle(category.id)}><span>{category.label}</span><span aria-hidden="true">{selected.includes(category.id) ? '✓' : '＋'}</span></button>)}</div>
    {!visible.length && <p role="status">No hay categorías con ese nombre.</p>}
  </>
}

// === COUNTDOWN ===
// Server drives phase transition via alarm; this component is a 4s visual animation only.
function CountdownScreen({ timerEnd }) {
  const remaining = useServerCountdown(timerEnd, 4);
  const n = Math.max(0, remaining - 1);
  React.useEffect(() => { play(n > 0 ? 'tick' : 'go'); }, [n]);

  return (
    <div className="reveal" style={{ background: "var(--stage)", zIndex: 100 }}>
      <div className="reveal-rays" aria-hidden="true"/>
      <div key={n} className="reveal-word slam" style={{ fontSize: "min(42vw, 340px)", color: n === 0 ? "var(--teal)" : "var(--mustard)" }}>
        {n === 0 ? "¡YA!" : n}
      </div>
    </div>
  );
}

export { LobbyScreen, CountdownScreen }
