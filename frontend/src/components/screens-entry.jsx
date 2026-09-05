import React from 'react'
import { Sticker, Logo, Avatar, useIsMobile } from './primitives.jsx'
import { wordCategoriesLabel } from '../wordCategories.js'
import { track } from '../analytics.js'

function HomeScreen({ theme, mode, error, creating, category, initialName, onCreateRoom, onJoinRoom, onSubmitName, onBack }) {
  const isMobile = useIsMobile()
  const [suspect, setSuspect] = React.useState(null)
  if (mode === 'create') return <CreateNameForm error={error} creating={creating} category={category} initialName={initialName} onSubmitName={onSubmitName} onBack={onBack}/>
  return <main className="home-page screen-pad">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-kicker"><Sticker color="mustard" rotate={-2}>El juego empieza con una sospecha</Sticker></div>
      <h1 id="home-title" className="home-brand"><span className="sr-only">El Impostor online: juego de palabras con amigos</span><span aria-hidden="true"><Logo variant={theme.logoVariant} theme={theme} size={isMobile ? 0.52 : 0.8}/></span></h1>
      <p className="home-tagline">Todos menos uno conocen la palabra.<br/><strong>¿A quién vas a creer?</strong></p>
      <p className="home-benefits">3–12 jugadores <span>·</span> Gratis <span>·</span> Sin registro</p>
      <div className="home-actions">
        <button className="btn btn--primary btn--lg" onClick={onCreateRoom}>＋ Crear sala</button>
        <button className="btn btn--ghost btn--lg" onClick={onJoinRoom}>Unirse con código →</button>
      </div>
      <p className="helper-text">Cada uno juega en su móvil. Juntos en persona o por llamada.</p>
    </section>
    <section className="card home-example" aria-labelledby="example-title">
      <div className="example-heading"><div><p className="eyebrow-text">Pruébalo en 10 segundos</p><h2 id="example-title">La palabra es «León».</h2></div><span className="example-label">Ejemplo</span></div>
      <p>Han escrito estas pistas. Toca a quien te haga sospechar.</p>
      <div className="example-players">{[{name:'Ana', word:'Sabana'}, {name:'Bruno', word:'Melena'}, {name:'Clara', word:'Corona'}].map(p => <button key={p.name} className={`example-player ${suspect === p.name ? 'is-selected' : ''}`} aria-pressed={suspect === p.name} onClick={() => {setSuspect(p.name); track('demo_guess', {correct:p.name === 'Clara'})}}><Avatar name={p.name} style={theme.avatarStyle} size={48}/><strong>{p.name}</strong><span>«{p.word}»</span></button>)}</div>
      <div className="example-answer" role="status">{suspect ? <><strong>{suspect === 'Clara' ? '¡Has pillado a Clara!' : 'Esta vez era Clara.'}</strong> Solo tenía la pista «Trono». Ha intentado pasar desapercibida con «Corona».</> : 'Una pista demasiado vaga… o una muy buena coartada.'}</div>
    </section>
    <ol className="home-steps"><li>Recibe tu palabra en secreto.</li><li>Escribe una pista en tu turno.</li><li>Comentad las sospechas y votad.</li></ol>
    <nav className="home-seo-links" aria-label="Guías de El Impostor"><a href="/como-jugar/">Cómo jugar</a><a href="/palabras-para-el-impostor/">Palabras y categorías</a><a href="/juego-impostor-online/">Jugar online con amigos</a></nav>
  </main>
}

function CreateNameForm({ error, creating, category = 'all', initialName = '', onSubmitName, onBack }) {
  const [name, setName] = React.useState(initialName)
  const canSubmit = name.trim().length >= 2 && !creating
  return <main className="entry-page screen-pad">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => {e.preventDefault(); if (canSubmit) onSubmitName(name.trim())}} aria-busy={creating}>
      <Sticker color="red" rotate={-3}>Una sala para vuestro grupo</Sticker>
      <h1>Crea la primera sospecha.</h1>
      <p className="helper-text">Elige tu nombre y comparte el enlace. No necesitas una cuenta.</p>
      {category !== 'all' && <p className="category-notice">Categoría: <strong>{wordCategoriesLabel(category)}</strong>. Podrás cambiarla en la sala.</p>}
      <label htmlFor="create-name">Tu nombre</label>
      <input id="create-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={16} required autoComplete="nickname" placeholder="Ej. Ana" autoFocus disabled={creating}/>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>{creating ? 'Creando tu sala…' : 'Crear sala →'}</button>
      <p className="helper-text">Gratis · De 3 a 12 jugadores</p>
    </form>
  </main>
}

function cleanCode(value) { return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) }
function JoinScreen({ error, initialCode = '', initialName = '', onJoin, onBack, onCreateRoom }) {
  const [code, setCode] = React.useState(() => cleanCode(initialCode))
  const [name, setName] = React.useState(initialName)
  const canJoin = code.length === 4 && name.trim().length >= 2
  return <main className="entry-page screen-pad">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => {e.preventDefault(); if (canJoin) onJoin(name.trim(), code)}}>
      <Sticker color="teal" rotate={-3}>Tu grupo te espera</Sticker>
      <h1>Entra en la partida.</h1>
      {initialCode && <p className="helper-text">El código de tu invitación ya está preparado.</p>}
      <label htmlFor="join-name">Tu nombre</label>
      <input id="join-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={16} required autoComplete="nickname" placeholder="Ej. Ana" autoFocus/>
      <label htmlFor="join-code">Código de sala</label>
      <input id="join-code" className="room-code-input" value={code} onChange={e => setCode(cleanCode(e.target.value))} onPaste={e => {e.preventDefault(); setCode(cleanCode(e.clipboardData.getData('text')))}} maxLength={4} minLength={4} required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCD" aria-describedby="code-help"/>
      <p id="code-help" className="helper-text">Los 4 caracteres que te ha pasado quien creó la sala.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={!canJoin}>Entrar a la sala →</button>
      <p className="helper-text">¿No tienes código? <button type="button" className="text-button" onClick={onCreateRoom}>Crea una sala</button></p>
    </form>
  </main>
}
export { HomeScreen, JoinScreen }
