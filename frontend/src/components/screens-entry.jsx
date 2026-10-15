import React from 'react'
import { Logo, useIsMobile } from './primitives.jsx'
import { wordCategoriesLabel } from '../wordCategories.js'
import { AvatarPickerButton } from './avatar-picker.jsx'
import { readAvatarPreference, saveAvatarPreference } from '../avatarPreferences.js'

// Mirrors the crawlable copy in index.html, which React replaces on render.
const HOME_CATEGORY_LINKS = [['animales', 'animales'], ['comida', 'comida'], ['lugares', 'lugares'], ['futbol', 'fútbol'], ['streamers', 'streamers'], ['creadores-latinoamericanos', 'creadores latinoamericanos']]

function HomeScreen({ mode, error, creating, category, initialName, onCreateRoom, onJoinRoom, onOnePhone, onSubmitName, onBack }) {
  const isMobile = useIsMobile()
  if (mode === 'create') return <CreateNameForm error={error} creating={creating} category={category} initialName={initialName} onSubmitName={onSubmitName} onBack={onBack}/>
  return <main className="home-page screen-pad">
    <header className="club-masthead"><span className="club-monogram" aria-hidden="true">ei.</span><a href="/como-jugar/">Reglas</a></header>
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
      <h1 id="home-title" className="home-brand"><span className="sr-only">El Impostor online: juego de palabras con amigos</span><span aria-hidden="true"><Logo size={isMobile ? 0.62 : 1}/></span></h1>
      <p className="home-tagline">Todos reciben la misma palabra menos el impostor. Dad pistas por turnos y votad quién es.</p>
      <ul className="home-benefits"><li>3–12 jugadores</li><li>Gratis</li><li>Sin registro</li></ul>
      <div className="home-actions">
        <button className="btn btn--primary btn--lg" onClick={onCreateRoom}>＋ Crear sala</button>
        <button className="btn btn--ghost btn--lg" onClick={onJoinRoom}>Unirse con código →</button>
        <button className="btn btn--ghost btn--lg" onClick={onOnePhone}>Jugar con un solo móvil</button>
      </div>
      <p className="helper-text">En una sala cada uno juega con su móvil. Con un solo móvil, os lo vais pasando.</p>
      </div>
    </section>
    <section className="card club-how" aria-labelledby="how-title"><h2 id="how-title">Cómo se juega</h2><ol className="home-steps"><li><strong>Recibe tu palabra.</strong><span>Todos tienen la misma, menos el impostor.</span></li><li><strong>Da una pista.</strong><span>Una palabra por turno, sin decir la palabra secreta.</span></li><li><strong>Votad.</strong><span>Comentad las pistas y votad a quién creéis que es el impostor.</span></li></ol></section>
    <section className="home-about" aria-labelledby="about-title">
      <h2 id="about-title">El Impostor online, gratis y sin instalar</h2>
      <p>El Impostor es un juego de palabras y deducción social para jugar con amigos desde el navegador. Crea una sala privada, comparte el enlace y descubre quién no conoce la palabra secreta antes de que consiga engañar al grupo. ¿Estáis juntos con un solo móvil? También podéis pasároslo para que cada uno vea su palabra en privado y jugar en voz alta.</p>
      <p>El anfitrión puede combinar 20 categorías y 400 palabras con pistas, como {HOME_CATEGORY_LINKS.map(([slug, label], i) => <React.Fragment key={slug}>{i ? (i === HOME_CATEGORY_LINKS.length - 1 ? ' y ' : ', ') : ''}<a href={`/palabras-para-el-impostor/${slug}/`}>{label}</a></React.Fragment>)}.</p>
    </section>
    <nav className="home-seo-links" aria-label="Guías de El Impostor"><a href="/como-jugar/">Cómo jugar</a><a href="/palabras-para-el-impostor/">Palabras y categorías</a><a href="/juego-impostor-online/">Jugar online con amigos</a><a href="/que-decir-si-eres-el-impostor/">Qué decir si eres el impostor</a></nav>
  </main>
}

function CreateNameForm({ error, creating, category = 'all', initialName = '', onSubmitName, onBack }) {
  const [name, setName] = React.useState(initialName)
  const [avatarId, setAvatarId] = React.useState(readAvatarPreference)
  const canSubmit = name.trim().length >= 2 && !creating
  return <main className="entry-page screen-pad">
    <button onClick={onBack} className="btn btn--ghost btn--sm entry-back">← Volver</button>
    <form className="card entry-card slide-up" onSubmit={e => {e.preventDefault(); if (canSubmit) onSubmitName(name.trim())}} aria-busy={creating}>
      <h1>Crear sala</h1>
      <p className="helper-text">Elige tu nombre y comparte el enlace. No necesitas una cuenta.</p>
      {category !== 'all' && <p className="category-notice">Categoría: <strong>{wordCategoriesLabel(category)}</strong>. Podrás cambiarla en la sala.</p>}
      <div className="entry-portrait"><AvatarPickerButton name={name || "Ana"} avatarId={avatarId} size={88} disabled={creating} onSelect={value => {setAvatarId(value); saveAvatarPreference(value)}}/><span>Toca el avatar para cambiarlo.</span></div>
      <label htmlFor="create-name">Tu nombre</label>
      <input id="create-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={16} required autoComplete="nickname" placeholder="Ej. Ana" autoFocus disabled={creating}/>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>{creating ? 'Creando tu sala…' : 'Crear sala →'}</button>
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
      <h1>Unirse a una sala</h1>
      {initialCode && <p className="helper-text">El código de tu invitación ya está preparado.</p>}
      <div className="entry-portrait"><AvatarPickerButton name={name || "Ana"} avatarId={avatarId} size={88} onSelect={value => {setAvatarId(value); saveAvatarPreference(value)}}/><span>Toca el avatar para cambiarlo.</span></div>
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
