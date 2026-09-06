import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Sheet } from './sheet.jsx'
import { claimPrompt, submitFeedback } from '../feedback.js'
import { cleanContext } from '../../../shared/engagement.js'
import { APP_VERSION } from '../config.js'
import { measurementEnabled, track } from '../analytics.js'

const FeedbackContext = createContext(null)
export const useFeedback = () => useContext(FeedbackContext)
const topics = { connection: 'Conexión', rules: 'Reglas', words: 'Palabras', pace: 'Ritmo', missing_players: 'Faltaban jugadores', just_looking: 'Solo estaba mirando', other: 'Otra cosa' }
const ratings = [['good', '😍 Bien'], ['okay', '😐 Regular'], ['bad', '😕 Mal']]

export function FeedbackProvider({ children }) {
  const [context, setContext] = useState({ phase: 'home' })
  const [draft, setDraft] = useState(null)
  const [exitContext, setExitContext] = useState(null)
  const [privacy, setPrivacy] = useState(() => new URLSearchParams(window.location.search).get('privacy') === '1')
  const [enabled, setEnabled] = useState(measurementEnabled)
  useEffect(() => {
    const update = () => setEnabled(measurementEnabled())
    window.addEventListener('el-impostor:consent-change', update)
    return () => window.removeEventListener('el-impostor:consent-change', update)
  }, [])
  const open = useCallback((kind = 'problem', rating = null, snapshot) => {
    const details = cleanContext({ ...(snapshot || context), version: APP_VERSION })
    setDraft({ id: crypto.randomUUID(), kind, rating, topic: '', comment: '', context: details })
    setExitContext(null)
    track('feedback_opened', details)
  }, [context])
  const offerExitSurvey = useCallback(snapshot => {
    if (claimPrompt('exit')) setExitContext(cleanContext(snapshot))
  }, [])
  return <FeedbackContext.Provider value={{ setContext, open, offerExitSurvey }}>
    {children}
    {exitContext && <aside className="exit-survey" aria-label="Pregunta opcional">
      <p>Has salido antes de jugar. ¿Nos cuentas por qué?</p>
      <button className="text-button" onClick={() => open('exit', null, exitContext)}>Responder en 10 segundos</button>
      <button className="text-button" onClick={() => setExitContext(null)}>Ahora no</button>
    </aside>}
    <footer className="feedback-footer">
      <button className="text-button" onClick={() => open()}>¿Algo falla o tienes una idea?</button>
      <button className="text-button" onClick={() => setPrivacy(true)}>Datos y privacidad</button>
    </footer>
    {draft && <FeedbackForm key={draft.id} initial={draft} onClose={() => setDraft(null)}/>}
    {privacy && <Sheet title="Datos y privacidad" onClose={() => setPrivacy(false)}>
      <div className="privacy-copy">
        <p>Solo si aceptas medimos visitas, clics y campañas. El almacenamiento necesario para jugar funciona también al rechazar.</p>
        <p>Estos registros no incluyen nombres, códigos de sala, pistas ni roles. No usamos grabaciones de pantalla ni enviamos esta medición a servicios publicitarios.</p>
        <p>Si envías una opinión, guardamos tu respuesta junto con la fase, categoría, número de jugadores, versión y un identificador de partida, cuando están disponibles. No hace falta dar tu nombre ni tu correo. Evita incluir datos personales en el comentario.</p>
        <p>Los registros se eliminan automáticamente en un máximo de 30 días y las opiniones solo están disponibles en un informe privado. Las partidas se cuentan desde el servidor aunque desactives la medición del navegador.</p>
        <p>Medición opcional: <strong>{enabled ? 'activada' : 'desactivada'}</strong>.</p>
        <button className="btn btn--ghost" onClick={() => { setPrivacy(false); window.elImpostorConsent?.open() }}>Cambiar mi decisión</button>
        <p><a href="/privacidad/" target="_blank" rel="noreferrer">Leer la política de privacidad, cookies y almacenamiento</a></p>
        <p className="helper-text">Respetamos las señales de privacidad del navegador. Desactivar esta opción no impide jugar ni enviar opiniones.</p>
      </div>
    </Sheet>}
  </FeedbackContext.Provider>
}

export function PostGameRating({ gameId }) {
  const { open } = useFeedback()
  const [visible, setVisible] = useState(false)
  const checked = useRef(false)
  useEffect(() => {
    if (checked.current) return
    checked.current = true
    if (claimPrompt('rating')) { setVisible(true); track('rating_prompt_shown', { gameId, phase: 'results' }) }
  }, [gameId])
  if (!visible) return null
  return <section className="postgame-rating" aria-label="Valora la partida">
    <p>¿Qué tal esta partida?</p>
    <div>{ratings.map(([value, label]) => <button key={value} className="btn btn--ghost btn--sm" onClick={() => { setVisible(false); open('rating', value) }}>{label}</button>)}</div>
    <button className="text-button" onClick={() => setVisible(false)}>Ahora no</button>
  </section>
}

function FeedbackForm({ initial, onClose }) {
  const [draft, setDraft] = useState(initial)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const active = useRef(null)
  useEffect(() => () => active.current?.abort(), [])
  const change = patch => setDraft(value => ({ ...value, ...patch }))
  const submit = async event => {
    event.preventDefault()
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const timeout = setTimeout(() => controller.abort(), 12000)
    setStatus('sending'); setError('')
    try { await submitFeedback(draft, controller.signal); setStatus('sent') }
    catch (err) { setError(err.name === 'AbortError' ? 'La conexión está tardando. Puedes reintentar sin perder tu respuesta.' : err.message); setStatus('idle') }
    finally { clearTimeout(timeout); active.current = null }
  }
  const title = draft.kind === 'rating' ? '¿Qué tal la partida?' : draft.kind === 'exit' ? '¿Qué os ha impedido jugar?' : 'Te leemos'
  return <Sheet title={title} onClose={onClose} className="feedback-sheet">
    {status === 'sent' ? <div role="status" className="feedback-thanks"><p>¡Gracias por contárnoslo!</p><p>Tu respuesta nos ayuda a elegir qué mejorar.</p><button className="btn btn--primary" onClick={onClose}>Volver al juego</button></div> : <form onSubmit={submit} className="feedback-form">
      <fieldset disabled={status === 'sending'}>
        {!['rating', 'exit'].includes(draft.kind) && <><label htmlFor="feedback-kind">¿Qué quieres contarnos?</label><select id="feedback-kind" value={draft.kind} onChange={e => change({ kind: e.target.value })}><option value="problem">Algo falla</option><option value="idea">Tengo una idea</option><option value="words">Sobre las palabras</option></select></>}
        {draft.kind === 'rating' && <div className="feedback-ratings" role="group" aria-label="Valoración">{ratings.map(([value, label]) => <button type="button" key={value} className="btn btn--ghost btn--sm" aria-pressed={draft.rating === value} onClick={() => change({ rating: value })}>{label}</button>)}</div>}
        <label htmlFor="feedback-topic">{draft.kind === 'exit' ? 'El motivo principal' : '¿Qué mejorarías? (opcional)'}</label>
        <select id="feedback-topic" value={draft.topic} onChange={e => change({ topic: e.target.value })}><option value="">Elige una opción</option>{Object.entries(topics).filter(([key]) => draft.kind === 'exit' || !['missing_players', 'just_looking'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label htmlFor="feedback-comment">{draft.kind === 'idea' ? 'Tu idea' : 'Cuéntanos un poco más'} (opcional)</label>
        <textarea id="feedback-comment" rows={4} maxLength={1000} value={draft.comment} onChange={e => change({ comment: e.target.value })} placeholder="¿Qué ha pasado o qué te gustaría cambiar?" aria-describedby="feedback-note"/>
        <p id="feedback-note" className="helper-text">Al enviar solicitas que Javier Vallejo reciba y revise tu opinión y el contexto de esta pantalla. Se conserva hasta 30 días. No incluyas nombres, correos ni otros datos personales. <a href="/privacidad/#opiniones" target="_blank" rel="noreferrer">Información de privacidad y derechos</a>.</p>
        {['countdown', 'roleReveal', 'playing', 'roundReview', 'betweenRound', 'voting'].includes(draft.context.phase) && <p className="helper-text">La partida sigue mientras escribes. Puedes cerrar esta ventana y contárnoslo al terminar.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="btn btn--primary btn--block" disabled={!draft.rating && !draft.topic && !draft.comment.trim()}>{status === 'sending' ? 'Enviando…' : 'Enviar opinión'}</button>
      </fieldset>
    </form>}
  </Sheet>
}
