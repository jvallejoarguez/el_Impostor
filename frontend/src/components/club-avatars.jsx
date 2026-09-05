import React, { useId } from 'react'
import { AVATAR_NAMES, portraitSeed, avatarIndex } from '../../../shared/avatars.js'
export { portraitSeed } from '../../../shared/avatars.js'

// Original vector portraits, drawn for El Impostor. No external avatar service.
const INK = '#28251E'
const CREAM = '#F6EBD3'
const RUST = '#B8432E'
const GREEN = '#485F42'
const BLUE = '#375666'
const GOLD = '#C79239'
const BACKGROUNDS = ['#D6BF89', '#C4C9AB', '#BAC7C7', '#D8AA89']
export const CLUB_CHARACTERS = AVATAR_NAMES

function Eyes({ y = 76, left = 61, right = 96, narrow = false, look = 1 }) {
  return <g className="portrait-eyes">
    <ellipse cx={left} cy={y} rx="9" ry={narrow ? 5 : 9} fill={CREAM}/>
    <ellipse cx={right} cy={y} rx="9" ry={narrow ? 5 : 9} fill={CREAM}/>
    <ellipse cx={left + look * 2} cy={y + 1} rx="3" ry={narrow ? 4 : 6} fill={INK}/>
    <ellipse cx={right + look * 2} cy={y + 1} rx="3" ry={narrow ? 4 : 6} fill={INK}/>
  </g>
}
function Shirt({ color = GREEN, tie = false, collar = true }) {
  return <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
    <path d="M37 156 42 128Q46 115 66 112H94Q115 114 120 129L127 156Z" fill={color}/>
    {collar && <path d="m65 112 15 13 15-13 5 19-20-6-20 6Z" fill={CREAM}/>}
    {tie ? <path d="m77 127-5 19 8 9 8-9-5-19Z" fill={RUST}/> : <path d="M80 129v26" fill="none"/>}
    <path d="m51 140-2 15m63-15 2 15" fill="none" opacity=".45"/>
  </g>
}
function Portrait({ kind, look }) {
  switch (kind) {
    case 0: return <>
      <Shirt color={GOLD} tie/>
      <path d="m40 67-5-43 29 18q17-8 33 0l27-20-5 49 9 15-25 21-23 13-24-14-24-23Z" fill="#BB5F32"/>
      <path d="m40 65 2-27 19 16m41-1 17-17-3 30" fill={INK} stroke="none"/>
      <path d="m40 83 29 8 11 20 12-20 27-8-19 25-20 11-23-13Z" fill={CREAM} stroke="none"/>
      <Eyes y={76} narrow look={look}/><path d="m72 96 8 8 9-8Z" fill={INK}/>
      <path d="m80 103-1 8m-10 0q10 5 19-1M52 62l16 3m23-1 14-5" fill="none"/>
      <path d="M52 37q4-14 25-15 22 0 30 13l-3 10H54Z" fill={GREEN}/><path d="m43 45 57 3 19-8-8-5-30 7Z" fill={GREEN}/>
    </>
    case 1: return <>
      <Shirt color={BLUE}/>
      <path d="M46 68Q28 19 44 10q15-3 21 50M88 61q1-53 16-53 18 8 3 61" fill={CREAM}/>
      <path d="M49 55q-12-34-7-34m56 33q3-29 7-31" stroke="#CA9179" strokeWidth="7" fill="none"/>
      <path d="M43 72q3-22 37-22 38 2 39 36-1 32-38 34-40-1-38-34Z" fill={CREAM}/>
      <Eyes look={-look}/><path d="m75 94 7 5 7-6Z" fill={RUST}/><path d="m82 101 1 8m-9-1q8 6 17-1" fill="none"/>
      <path d="M41 67q17-30 54-18l18 14-2 9-40-8Z" fill={RUST}/><path d="m43 67 48 1 27 6-7 5-32-4Z" fill={RUST}/>
      <path d="m66 137 11 4-11 4m28-8-11 4 11 4" fill={GOLD}/>
    </>
    case 2: return <>
      <Shirt color={RUST} collar={false}/>
      <path d="m41 39 18 10q20-13 39-1l24-15-3 30q17 52-39 63-50-8-43-49Z" fill="#80613F"/>
      <path d="M44 69q5-20 24-12l12 10 14-12q18-6 24 15l-5 31-32 19-35-21Z" fill={CREAM} stroke="none"/>
      <Eyes y={79} left={62} right={101} look={look}/>
      <g fill="none" strokeWidth="3"><circle cx="61" cy="78" r="19"/><circle cx="103" cy="78" r="19"/><path d="M80 76h4m-44-1-8-4m91 4 7-4"/></g>
      <path d="m75 97 7 13 7-13Z" fill={GOLD}/><path d="m64 111 3 3m31-4-3 4" fill="none"/>
      <path d="M67 135q14 10 27 0m-30 9q16 9 32 0" fill="none" stroke={CREAM}/>
    </>
    case 3: return <>
      <Shirt color={CREAM} collar={false}/>
      <path d="M49 130h65m-68 10h72m-73 10h75" fill="none" strokeWidth="6" stroke={BLUE}/>
      <path d="m39 73 3-44 27 25q14-5 27-1l23-23-1 43q16 44-36 48-47 0-43-31Z" fill={INK}/>
      <path d="m48 49 1 19 13-7m40 0 10-13-1 21" fill="#A97B65" stroke="none"/>
      <Eyes narrow look={-look}/><path d="m77 96 6 5 7-6Z" fill={RUST} stroke="none"/>
      <path d="m69 107 14-3 12 3m-45-6-17-3m20 10-20 1m71-9 17-5m-16 13 18 3" fill="none" stroke={CREAM} strokeWidth="1.6"/>
      <path d="M42 53q-13-13 13-24 31-11 47 2 8 4 5 15l-23 8Z" fill={RUST}/><path d="m70 25 4-8 7 2-2 9" fill={INK}/>
    </>
    case 4: return <>
      <Shirt color={GREEN}/>
      <circle cx="44" cy="54" r="17" fill="#9D7149"/><circle cx="115" cy="53" r="17" fill="#9D7149"/>
      <circle cx="44" cy="54" r="8" fill="#684E38" stroke="none"/><circle cx="115" cy="53" r="8" fill="#684E38" stroke="none"/>
      <path d="M42 71q1-33 38-33 39 2 39 40v19q-5 27-40 26-38-1-39-29Z" fill="#AE8154"/>
      <Eyes y={73} look={look}/><ellipse cx="81" cy="100" rx="24" ry="17" fill={CREAM} stroke="none"/>
      <path d="M72 92q9-6 18 0-2 9-9 8-7 0-9-8Z" fill={INK}/><path d="M81 100v9m-9 0q10 6 19-1" fill="none"/>
      <path d="M47 42q6-22 38-19 27 2 29 24-27-10-67-5Z" fill={GOLD}/><path d="M46 40q36-7 69 4v10q-35-9-70-4Z" fill={GOLD}/>
      <path d="m60 28 2 9m10-12 1 10m13-10v10m13-7-2 9" fill="none" strokeWidth="1.3"/>
    </>
    case 5: return <>
      <Shirt color={BLUE} collar={false}/><path d="M62 120h35v12H62Z" fill={BLUE}/>
      <path d="m43 64-7-32 30 17q17-5 32 0l24-19-4 38 10 19-11 19-37 16-36-17-13-23Z" fill="#A4A797"/>
      <path d="m42 77 16-18 22 13 19-13 23 15-15 22-27-8-26 8Z" fill={INK} stroke="none"/>
      <Eyes y={77} narrow look={look}/><path d="m57 100 22-14 28 16-25 19Z" fill={CREAM} stroke="none"/>
      <path d="m73 99 9 7 9-8Z" fill={INK}/><path d="m82 106 1 8m-7 0 15-1" fill="none"/>
      <path d="M53 45q20-31 45-8l11 8-22 4Z" fill={RUST}/><path d="M46 46q18-2 44 2l25 10-39-6Z" fill={RUST}/>
    </>
    case 6: return <>
      <Shirt color={GOLD} tie/>
      <path d="M40 68q-12-33 12-32 18-1 25 21h10q9-25 26-20 21 8 7 37l4 19q-1 33-44 31-49 0-45-29Z" fill="#78905A"/>
      <Eyes y={57} left={54} right={107} look={-look}/>
      <path d="M49 94q31 22 61-2" fill="none" strokeWidth="3"/><path d="m47 89-4 8m69-11 5 8" fill="none"/>
      <ellipse cx="75" cy="82" rx="2" ry="3" fill={INK} stroke="none"/><ellipse cx="88" cy="82" rx="2" ry="3" fill={INK} stroke="none"/>
      <path d="m83 97 18-1q-4 12-12 11Z" fill={RUST} stroke="none"/>
    </>
    case 7: return <>
      <Shirt color={RUST}/>
      <path d="M45 51q31-18 61-2l15 28-8 25q-12 28-38 19-39 0-36-29Z" fill="#D6B982"/>
      <path d="M48 48Q27 42 24 74q-4 27 13 28 16-8 16-38m55-14q22-11 28 25 4 24-12 28-12-2-15-28" fill="#6D5137"/>
      <Eyes y={77} look={look}/><path d="M64 97q13-19 32-1l8 13-17 14-20-4-9-9Z" fill={CREAM} stroke="none"/>
      <ellipse cx="85" cy="98" rx="10" ry="6" fill={INK}/><path d="M84 104v9m-10-1q10 9 19-2" fill="none"/>
      <path d="m41 49 12-22 44 2 14 24Z" fill={BLUE}/><path d="M27 57q47-16 106 0l-2 8q-53-12-101 1Z" fill={BLUE}/><path d="m50 42 50 1" fill="none" stroke={GOLD} strokeWidth="6"/>
    </>
    case 8: return <>
      <path d="M78 60Q12 31 16 87q2 42 42 57l23-22 21 23q48-22 43-61-2-43-64-23Z" fill={GOLD}/>
      <path d="m73 77-30-8-12 13 23 30m34-35 29-10 14 16-25 28" fill="none" stroke={RUST} strokeWidth="7"/>
      <path d="M62 140 56 85q2-29 23-30 25 2 26 30l-7 55Z" fill={BLUE}/>
      <path d="M64 65q-19-25-26-19m56 17q17-28 29-23" fill="none"/><circle cx="36" cy="44" r="5" fill={RUST}/><circle cx="126" cy="39" r="5" fill={RUST}/>
      <Eyes y={84} left={68} right={95} look={look}/><path d="m76 103 12 1m-24 12h34m-35 10h35" fill="none" stroke={CREAM}/><path d="m54 117-10 13m60-13 11 10" fill="none"/>
    </>
    case 9: return <>
      <Shirt color={GOLD}/>
      <path d="M52 111q-18-28 0-61 20-23 46-8 27 20 13 65l-15 17Z" fill="#A6AFAC"/>
      <path d="M57 105q26 19 50-9l-9 24-34 4Z" fill={GREEN} stroke="none"/>
      <Eyes y={76} look={look}/><path d="m75 89 27 9-24 9Z" fill={RUST}/>
      <path d="M44 52q-1-26 31-29 30-2 38 18l-17 16Z" fill={BLUE}/><path d="m43 51 58-2 26 8-36 4Z" fill={BLUE}/>
      <path d="m71 130 9 12 15-15" fill="none" strokeWidth="5" stroke={CREAM}/>
    </>
    case 10: return <>
      <Shirt color={RUST} collar={false}/>
      <circle cx="44" cy="63" r="12" fill="#996C45"/><circle cx="116" cy="63" r="12" fill="#996C45"/>
      <path d="M40 80q-3-39 40-39 39-1 41 38 1 47-41 44-43 1-40-43Z" fill="#AB7C4E"/>
      <Eyes look={look}/><path d="M45 92q18-18 36-2 19-18 36 2-1 28-36 29-33 0-36-29Z" fill={CREAM} stroke="none"/>
      <path d="m73 93 9 6 9-6q-8-8-18 0Z" fill={INK}/><path d="m82 100-1 11m-10-1q10 5 20 0m-27-10-22-2m20 8-19 5m54-12 22-2m-22 8 20 5" fill="none" strokeWidth="1.4"/>
      <path d="M42 57q7-37 41-32 33-2 37 36-33-14-78-4Z" fill={GREEN}/><path d="M42 54q35-9 77 4v12q-46-10-77-4Z" fill={GREEN}/>
      <path d="M52 137h56m-57 11h59" stroke={CREAM} strokeWidth="4"/>
    </>
    default: return <>
      <Shirt color={BLUE} tie/>
      <circle cx="40" cy="47" r="26" fill="#B5A48D"/><circle cx="120" cy="47" r="26" fill="#B5A48D"/>
      <circle cx="40" cy="47" r="16" fill="#BD7E64" stroke="none"/><circle cx="120" cy="47" r="16" fill="#BD7E64" stroke="none"/>
      <path d="M42 69q1-28 38-28 34 0 38 30l-9 26-27 25-30-22Z" fill="#B5A48D"/>
      <Eyes y={73} look={-look}/><path d="m75 100 7 7 8-8Z" fill={RUST}/><path d="m65 100-25-2m22 8-20 5m54-12 24-4m-23 12 23 6" fill="none" strokeWidth="1.4"/>
      <path d="m57 41 9-19 31 1 9 22Z" fill={GREEN}/><path d="M48 46q33-8 63 1l-1 7q-30-6-62 0Z" fill={GREEN}/>
    </>
  }
}

export function ClubAvatar({ name = '', size = 72, speaking = false, eliminated = false, showCrown = false, character }) {
  const id = useId().replaceAll(':', '')
  const seed = portraitSeed(name)
  const kind = avatarIndex(name, character)
  const accent = [RUST, GREEN, BLUE, GOLD][(seed >>> 4) % 4]
  return <span className={`club-avatar ${speaking ? 'is-speaking' : ''} ${eliminated ? 'is-eliminated' : ''}`} data-avatar={CLUB_CHARACTERS[kind]} style={{width:size, height:size, '--portrait-accent':accent}} aria-hidden="true">
    <svg viewBox="0 0 160 160" width={size} height={size} className="portrait-illustration" focusable="false">
      <defs><clipPath id={`portrait-${id}`}><rect x="6" y="6" width="148" height="148" rx="70"/></clipPath><pattern id={`hatch-${id}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0v9" stroke={INK} strokeWidth=".6" opacity=".14"/></pattern></defs>
      <rect x="4" y="4" width="152" height="152" rx="73" fill={CREAM} stroke={INK} strokeWidth="2.5"/>
      <g clipPath={`url(#portrait-${id})`}>
        <path d="M6 6h148v148H6Z" fill={BACKGROUNDS[(seed >>> 8) % BACKGROUNDS.length]}/>
        <path d="M6 6h148v148H6Z" fill={`url(#hatch-${id})`}/>
        <path d="M19 130q59-30 122 0v30H19Z" fill={accent} opacity=".16"/>
        <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><Portrait kind={kind} look={seed % 2 ? 1 : -1}/></g>
      </g>
      <rect x="9" y="9" width="142" height="142" rx="67" fill="none" stroke={CREAM} strokeWidth="1.5" opacity=".6"/>
    </svg>
    {showCrown && <svg className="portrait-host" viewBox="0 0 32 36" width="24" height="27"><path d="m9 20-3 14 10-5 9 5-2-15" fill={RUST} stroke={INK} strokeWidth="1.5"/><path d="m16 2 4 3 5 1 1 5 3 4-3 4-1 5-5 1-4 3-4-3-5-1-1-5-3-4 3-4 1-5 5-1Z" fill={GOLD} stroke={INK} strokeWidth="1.5"/><path d="m16 8 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill={INK}/></svg>}
  </span>
}

export function ClubCast() {
  return <div className="club-cast" aria-hidden="true">
    <svg className="cast-orbit" viewBox="0 0 460 360"><path d="M24 202Q76 41 243 55T440 230M55 274Q264 357 428 130" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8"/><path d="m369 35 4 12 12 4-12 4-4 12-4-12-12-4 12-4ZM50 101l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="currentColor"/></svg>
    {[{name:'Nico', caption:'Yo no he sido.'}, {name:'Hugo', caption:'De total confianza.'}, {name:'Lola', caption:'Demasiado tranquila.'}].map((p,i) => <div className={`cast-card cast-card-${i}`} key={p.name}><span className="cast-number">SOCIO / 0{i+1}</span><ClubAvatar name={p.name} size={i === 1 ? 152 : 112}/><strong>{p.name}</strong><span className="cast-caption">{p.caption}</span></div>)}
    <span className="cast-stamp">SE ADMITEN<br/>COARTADAS</span>
  </div>
}
