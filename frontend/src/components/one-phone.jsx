import React, { useEffect, useState } from 'react'
import words from '../../../worker/src/words.json'
import { Avatar, Sticker } from './primitives.jsx'
import { Sheet } from './sheet.jsx'
import { CategoryPicker, RuleStepper } from './screens-lobby.jsx'
import { play, setMusic } from '../audio/soundManager.js'
import { normalizeWordCategories, wordCategoriesLabel } from '../wordCategories.js'
import { dealRound, playerNames } from '../localGame.js'
import { track } from '../analytics.js'
import '../one-phone.css'

// components/one-phone.jsx — a group sitting together shares one phone: it
// deals roles locally, is handed round so each player sees their own role in
// private, then keeps time while the group gives clues and votes out loud.

const SETUP_KEY = 'el-impostor-one-phone'
const TIMER_OPTIONS = [[0, 'Sin límite'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min']]

function readSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_KEY))
    return {
      count: Math.min(12, Math.max(3, Number.isInteger(saved?.count) ? saved.count : 4)),
      names: Array.isArray(saved?.names) ? saved.names.slice(0, 12).map(name => String(name).slice(0, 16)) : [],
      categories: normalizeWordCategories(saved?.categories),
      hint: saved?.hint !== false,
      timer: TIMER_OPTIONS.some(([value]) => value === saved?.timer) ? saved.timer : 120,
    }
  } catch { return { count: 4, names: [], categories: ['all'], hint: true, timer: 120 } }
}

export default function OnePhoneGame({ onExit }) {
  const [setup, setSetup] = useState(readSetup)
  const [game, setGame] = useState(null)
  const [stage, setStage] = useState({ name: 'setup' })

  useEffect(() => { setMusic(stage.name === 'play' ? 'game' : stage.name === 'result' ? null : 'home') }, [stage.name])

  const deal = (players, used, method) => {
    setGame({ players, used, ...dealRound(words, { playerCount: players.length, categories: setup.categories, used }) })
    setStage({ name: 'pass', idx: 0 })
    track('one_phone_started', { playerCount: players.length, category: setup.categories.join('_'), method })
  }
  const start = () => {
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)) } catch {}
    deal(playerNames(setup.names, setup.count), [], 'setup')
  }
  const hide = () => {
    const next = stage.idx + 1
    if (stage.again) return setStage({ name: 'play' })
    if (next < game.players.length) return setStage({ name: 'pass', idx: next })
    setGame(g => ({ ...g, timerEnd: Date.now() + setup.timer * 1000 }))
    setStage({ name: 'play' })
  }

  if (stage.name === 'setup') return <SetupScreen setup={setup} onChange={patch => setSetup(s => ({ ...s, ...patch }))} onStart={start} onBack={onExit}/>
  const name = game.players[stage.idx]
  if (stage.name === 'pass') return <PassScreen key={`${stage.idx}-${stage.again}`} name={name} step={stage.again ? null : stage.idx + 1} total={game.players.length}
    onReveal={() => { play('wordSubmit'); setStage({ ...stage, name: 'secret' }) }} onCancel={() => setStage(stage.again ? { name: 'play' } : { name: 'setup' })}/>
  if (stage.name === 'secret') return <SecretScreen isImpostor={stage.idx === game.impostorIdx} word={game.word} hint={setup.hint ? game.hint : ''}
    last={stage.again || stage.idx === game.players.length - 1} onHide={hide}/>
  if (stage.name === 'play') return <PlayScreen game={game} timed={setup.timer > 0} onRestartTimer={() => setGame(g => ({ ...g, timerEnd: Date.now() + setup.timer * 1000 }))} onPeek={idx => setStage({ name: 'pass', idx, again: true })}
    onReveal={() => { play('roleImpostor'); setStage({ name: 'result' }) }} onExit={() => setStage({ name: 'setup' })}/>
  return <ResultScreen game={game} hint={setup.hint} onAgain={() => deal(game.players, [...game.used, game.word], 'repeat')} onSetup={() => setStage({ name: 'setup' })} onExit={onExit}/>
}

function SetupScreen({ setup, onChange, onStart, onBack }) {
  const [showCategories, setShowCategories] = useState(false)
  const setName = (i, value) => { const names = [...setup.names]; names[i] = value; onChange({ names }) }
  return <main className="entry-page screen-pad one-phone-setup">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => { e.preventDefault(); onStart() }}>
      <h1>Jugar con un solo móvil</h1>
      <p className="helper-text">Os vais pasando el móvil para que cada uno vea su palabra en secreto. Después dais las pistas en voz alta.</p>
      <RuleStepper label="Jugadores" value={setup.count} min={3} max={12} step={1} editable onChange={count => onChange({ count })}/>
      <fieldset className="one-phone-names">
        <legend>Nombres <small>(opcional)</small></legend>
        {Array.from({ length: setup.count }, (_, i) => <input key={i} aria-label={`Nombre del jugador ${i + 1}`} placeholder={`Jugador ${i + 1}`} maxLength={16} autoComplete="off"
          value={setup.names[i] ?? ''} onChange={e => setName(i, e.target.value)}/>)}
      </fieldset>
      <button type="button" className="room-category-button" onClick={() => setShowCategories(true)} aria-haspopup="dialog"><span><small>Categorías</small><strong>{wordCategoriesLabel(setup.categories)}</strong></span><span aria-hidden="true">›</span></button>
      <div className="room-extra-rules">
        <label className="room-capacity"><span>Tiempo para hablar</span><select value={setup.timer} onChange={e => onChange({ timer: Number(e.target.value) })}>{TIMER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="room-hint"><span>Pista al impostor</span><button type="button" className="room-switch" role="switch" aria-checked={setup.hint} aria-label="Dar una pista al impostor" onClick={() => onChange({ hint: !setup.hint })}><span/></button></div>
      </div>
      <button type="submit" className="btn btn--primary btn--block">Repartir palabras →</button>
    </form>
    {showCategories && <Sheet title="Categorías" onClose={() => setShowCategories(false)} className="category-sheet"><CategoryPicker value={setup.categories} editable onChange={categories => onChange({ categories })}/><button type="button" className="btn btn--primary sheet-done" onClick={() => setShowCategories(false)}>Listo</button></Sheet>}
  </main>
}

// Holds nothing secret: this is what the table sees while the phone changes hands.
function PassScreen({ name, step, total, onReveal, onCancel }) {
  return <main className="reveal one-phone-stage">
    <div className="reveal-rays" aria-hidden="true"/>
    {step && <p className="one-phone-step">{step} de {total}</p>}
    <p className="reveal-kicker pop">Pasa el móvil a</p>
    <Avatar name={name} size={110}/>
    <h1 className="reveal-word slam one-phone-name">{name}</h1>
    <p className="one-phone-note">Que nadie más mire la pantalla.</p>
    <button className="btn btn--primary btn--lg one-phone-armed" onClick={onReveal}>Soy {name}: ver mi palabra</button>
    <button className="text-button one-phone-cancel" onClick={onCancel}>{step ? 'Volver a la configuración' : 'Cancelar'}</button>
  </main>
}

// Both roles share one look and one sound, so nobody learns anything from across the table.
function SecretScreen({ isImpostor, word, hint, last, onHide }) {
  const text = isImpostor ? 'IMPOSTOR' : word.toUpperCase()
  const longest = Math.max(...text.split(/\s+/).map(part => part.length), 1)
  return <main className="reveal one-phone-stage">
    <p className="reveal-kicker">{isImpostor ? 'Eres el' : 'Tu palabra es'}</p>
    <h1 className="reveal-word one-phone-secret" style={{ fontSize: `min(22vw, ${(110 / longest).toFixed(2)}vw, 160px)` }}>{text}</h1>
    <div className="reveal-hint">
      {isImpostor ? <>{hint ? <><span>Tu pista</span><strong>{hint}</strong></> : null}<span>Escucha las pistas y finge que conoces la palabra.</span></>
        : <span>No la digas en voz alta. Uno de vosotros no la sabe.</span>}
    </div>
    <button className="btn btn--primary btn--lg one-phone-armed" onClick={onHide}>{last ? 'Ocultar' : 'Ocultar y pasar el móvil'}</button>
  </main>
}

function PlayScreen({ game, timed, onRestartTimer, onPeek, onReveal, onExit }) {
  const { players, starterIdx } = game
  const order = players.map((_, i) => players[(starterIdx + i) % players.length])
  return <main className="results-page one-phone-play">
    <Sticker color="mustard" rotate={-2} size="lg">¡A jugar!</Sticker>
    <h1 className="results-title one-phone-title">Empieza {players[starterIdx]}</h1>
    <section className="card results-card">
      <p className="one-phone-rules">Por turnos, decid en voz alta una palabra relacionada con la secreta, sin decirla. Cuando acabe la ronda, votad a quién creéis que es el impostor.</p>
      <ol className="one-phone-order" aria-label="Orden de turnos">{order.map((name, i) => <li key={i}><Avatar name={name} size={30}/>{name}</li>)}</ol>
      {timed && <RoundTimer end={game.timerEnd} onRestart={onRestartTimer}/>}
    </section>
    <div className="results-actions">
      <button className="btn btn--primary btn--lg btn--block" onClick={onReveal}>Revelar impostor</button>
      <details className="result-share"><summary>¿Alguien olvidó su palabra?</summary><div className="result-share-actions">
        {players.map((name, i) => <button key={i} className="btn btn--ghost btn--sm" onClick={() => onPeek(i)}>{name}</button>)}
      </div></details>
    </div>
    <footer className="game-exit"><button className="text-button" onClick={onExit}>Terminar partida</button></footer>
  </main>
}

// The deadline lives in the game, so checking a forgotten word doesn't reset it.
function RoundTimer({ end, onRestart }) {
  const [now, setNow] = useState(Date.now)
  const left = Math.max(0, Math.ceil((end - now) / 1000))
  useEffect(() => {
    if (!left) return
    const id = setTimeout(() => setNow(Date.now()), 250)
    return () => clearTimeout(id)
  }, [now, left])
  useEffect(() => { if (!left) play('go'); else if (left <= 10) play('timerWarning') }, [left])
  return <div className={`one-phone-timer ${left <= 10 ? 'is-low' : ''}`}>
    <span role="timer" aria-label="Tiempo restante">{left ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '¡Tiempo! A votar'}</span>
    <button className="btn btn--ghost btn--sm" onClick={() => { onRestart(); setNow(Date.now()) }}>↻ Reiniciar</button>
  </div>
}

function ResultScreen({ game, hint, onAgain, onSetup, onExit }) {
  const impostor = game.players[game.impostorIdx]
  return <main className="results-page">
    <h1 className="results-title slam is-impostor one-phone-title">¡Era {impostor}!</h1>
    <section className="card results-card slide-up">
      <div className="imposter-row"><Avatar name={impostor} size={96}/><div><div className="result-label">El impostor era</div><div className="imposter-name">{impostor}</div></div></div>
      <div className="result-word"><div className="result-label">La palabra secreta era</div><div>{game.word}</div></div>
      {hint && <p className="helper-text">Pista del impostor: <strong>{game.hint}</strong></p>}
    </section>
    <div className="results-actions">
      <button className="btn btn--primary btn--lg btn--block" onClick={onAgain}>↻ Otra partida</button>
      <button className="btn btn--ghost btn--block" onClick={onSetup}>Cambiar jugadores o reglas</button>
      <button className="text-button" onClick={onExit}>Volver al inicio</button>
    </div>
  </main>
}
