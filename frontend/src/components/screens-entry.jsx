import React from 'react'
import { Sticker, Logo, Avatar, useIsMobile } from './primitives.jsx'
import { wordCategoriesLabel } from '../wordCategories.js'
import { ClubCast } from './club-avatars.jsx'
import { AvatarPickerButton } from './avatar-picker.jsx'
import { readAvatarPreference, saveAvatarPreference } from '../avatarPreferences.js'
import { track } from '../analytics.js'

function HomeScreen({ theme, mode, error, creating, category, initialName, onCreateRoom, onJoinRoom, onSubmitName, onBack }) {
  const isMobile = useIsMobile()
  const [suspect, setSuspect] = React.useState(null)
  if (mode === 'create') return <CreateNameForm error={error} creating={creating} category={category} initialName={initialName} onSubmitName={onSubmitName} onBack={onBack}/>
  return <main className="home-page screen-pad">
    <header className="club-masthead"><span className="club-monogram" aria-hidden="true">ei.</span><span>EL CLUB DE LAS BUENAS COARTADAS</span><a href="/como-jugar/">Las reglas ↗</a></header>
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
      <div className="home-kicker"><Sticker color="mustard" rotate={-2}>Se busca al que disimula mejor</Sticker></div>
      <h1 id="home-title" className="home-brand"><span className="sr-only">El Impostor online: juego de palabras con amigos</span><span aria-hidden="true"><Logo variant={theme.logoVariant} theme={theme} size={isMobile ? 0.49 : 0.68}/></span></h1>
      <p className="home-tagline">Todos menos uno conocen la palabra.<br/><strong>¿A quién vas a creer?</strong></p>
      <p className="home-benefits">3–12 jugadores <span>·</span> Gratis <span>·</span> Sin registro</p>
      <div className="home-actions">
        <button className="btn btn--primary btn--lg" onClick={onCreateRoom}>＋ Crear sala</button>
        <button className="btn btn--ghost btn--lg" onClick={onJoinRoom}>Unirse con código →</button>
      </div>
      <p className="helper-text">Cada uno en su móvil. Todos en la misma conspiración.</p>
      </div>
      <div className="home-cast"><ClubCast/><p>Buena cara. Malas coartadas.</p></div>
    </section>
    <div className="home-bottom">
    <section className="card home-example" aria-labelledby="example-title">
      <div className="example-heading"><div><p className="eyebrow-text">Pruébalo en 10 segundos</p><h2 id="example-title">La palabra es «León».</h2></div><span className="example-label">Ejemplo</span></div>
      <p>Han escrito estas pistas. Toca a quien te haga sospechar.</p>
      <div className="example-players">{[{name:'Ana', word:'Sabana'}, {name:'Bruno', word:'Melena'}, {name:'Clara', word:'Corona'}].map(p => <button key={p.name} className={`example-player ${suspect === p.name ? 'is-selected' : ''}`} aria-pressed={suspect === p.name} onClick={() => {setSuspect(p.name); track('demo_guess', {correct:p.name === 'Clara'})}}><Avatar name={p.name} style={theme.avatarStyle} size={48}/><strong>{p.name}</strong><span>«{p.word}»</span></button>)}</div>
      <div className="example-answer" role="status">{suspect ? <><strong>{suspect === 'Clara' ? '¡Has pillado a Clara!' : 'Esta vez era Clara.'}</strong> Solo tenía la pista «Trono». Ha intentado pasar desapercibida con «Corona».</> : 'Una pista demasiado vaga… o una muy buena coartada.'}</div>
      {suspect && <button className="btn btn--primary btn--sm" onClick={onCreateRoom}>Jugar con mis amigos →</button>}
    </section>
    <aside className="club-how"><p className="eyebrow-text">El ritual</p><h2>Tres pasos.<br/>Mil sospechas.</h2><ol className="home-steps"><li><strong>Guarda el secreto.</strong><span>Todos reciben una palabra. El impostor, una coartada por inventar.</span></li><li><strong>Deja una pista.</strong><span>Una palabra por turno. Lo justo para que crean que sabes.</span></li><li><strong>Señala a alguien.</strong><span>Comentad las pistas y votad. ¿Quién está fingiendo?</span></li></ol><p className="helper-text">Juntos en persona o en vuestra llamada de siempre.</p></aside>
    </div>
    <nav className="home-seo-links" aria-label="Guías de El Impostor"><a href="/como-jugar/">Cómo jugar</a><a href="/palabras-para-el-impostor/">Palabras y categorías</a><a href="/juego-impostor-online/">Jugar online con amigos</a></nav>
  </main>
}

function CreateNameForm({ error, creating, category = 'all', initialName = '', onSubmitName, onBack }) {
  const [name, setName] = React.useState(initialName)
  const [avatarId, setAvatarId] = React.useState(readAvatarPreference)
  const canSubmit = name.trim().length >= 2 && !creating
  return <main className="entry-page screen-pad">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => {e.preventDefault(); if (canSubmit) onSubmitName(name.trim())}} aria-busy={creating}>
      <Sticker color="red" rotate={-3}>Una sala para vuestro grupo</Sticker>
      <h1>Crea la primera sospecha.</h1>
      <p className="helper-text">Elige tu nombre y comparte el enlace. No necesitas una cuenta.</p>
      {category !== 'all' && <p className="category-notice">Categoría: <strong>{wordCategoriesLabel(category)}</strong>. Podrás cambiarla en la sala.</p>}
      <div className="entry-portrait"><AvatarPickerButton name={name || "Ana"} avatarId={avatarId} size={88} disabled={creating} onSelect={value => {setAvatarId(value); saveAvatarPreference(value)}}/><span>Toca tu avatar para elegir personaje.</span></div>
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
  const [avatarId, setAvatarId] = React.useState(readAvatarPreference)
  const canJoin = code.length === 4 && name.trim().length >= 2
  return <main className="entry-page screen-pad">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => {e.preventDefault(); if (canJoin) onJoin(name.trim(), code)}}>
      <Sticker color="teal" rotate={-3}>Tu grupo te espera</Sticker>
      <h1>Entra en la partida.</h1>
      {initialCode && <p className="helper-text">El código de tu invitación ya está preparado.</p>}
      <div className="entry-portrait"><AvatarPickerButton name={name || "Ana"} avatarId={avatarId} size={88} onSelect={value => {setAvatarId(value); saveAvatarPreference(value)}}/><span>Toca tu avatar para elegir personaje.</span></div>
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
