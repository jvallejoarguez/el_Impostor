// Separate Vite entry for the local art board; excluded from the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClubAvatar, CLUB_CHARACTERS } from './components/club-avatars.jsx'
import './styles.css'
import './club.css'
import './atelier.css'

function downloadPortrait(event, name) {
  const svg = event.currentTarget.closest('article').querySelector('svg')
  const source = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([source], {type:'image/svg+xml;charset=utf-8'}))
  const link = document.createElement('a')
  link.href = url; link.download = `el-impostor-${name}.svg`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const captions = ['La coartada impecable', 'Ha oído demasiado', 'No se le escapa nada', 'Demasiado tranquila', 'El vecino de confianza', 'Sabe algo que tú no', 'Sonríe, por si acaso', 'Sigue todas las pistas', 'Donde haya luz', 'Noticias del barrio', 'Aquí no pasa nada', 'Pequeño gran secreto']
function Atelier() {
  return <main className="atelier"><header className="club-masthead"><span className="club-monogram">ei.</span><span>CUADERNO DE PERSONAJES / 01</span><a href="/">Entrar al juego ↗</a></header>
    <div className="atelier-title"><p className="eyebrow-text">Doce caras. Ninguna garantía.</p><h1>Los habituales<br/>del club.</h1><p>Pequeños retratos en tinta, con mucho que esconder.</p></div>
    <div className="atelier-grid">{CLUB_CHARACTERS.map((name,index) => <article className="atelier-portrait" key={name}><span className="eyebrow-text">SOCIO / {String(index+1).padStart(2,'0')}</span><ClubAvatar name={name} character={index} size={150}/><h2>{name}</h2><p>{captions[index]}</p><button className="text-button" onClick={event => downloadPortrait(event,name)}>Guardar SVG ↓</button></article>)}</div>
    <footer><span>Ilustraciones originales para El Impostor.</span><span>Tinta · Arcilla · Bosque · Latón</span></footer>
  </main>
}
createRoot(document.getElementById('root')).render(<Atelier/> )
