import React, { useId } from 'react'
import { AVATAR_NAMES, portraitSeed, avatarIndex } from '../../../shared/avatars.js'
export { portraitSeed } from '../../../shared/avatars.js'

// Original marker-doodle portraits, drawn for El Impostor: big heads, thick ink, a meme face each.
// No external avatar service.
const INK = '#1C0B40'
const WHITE = '#FFFFFF'
const PINK = '#FF8FB0'
const RED = '#FF4766'
const GOLD = '#FFCF26'
const TEAR = '#6FB6FF'
// One flat backdrop per character, spread so neighbours in the picker grid never match.
const BACKGROUNDS = ['#7FE3C4', '#FF9DB0', '#8EC5FF', '#FFD95E', '#C4B5FF', '#FFB27A', '#FF9DB0', '#8EC5FF', '#FFD95E', '#7FE3C4', '#C4B5FF', '#FFB27A']
export const CLUB_CHARACTERS = AVATAR_NAMES

const f = n => +n.toFixed(1)
// Closed, slightly lumpy oval through n points (Catmull-Rom), so shapes look drawn with a marker.
function blob(cx, cy, rx, ry = rx, wobble = .04, n = 8) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2, k = 1 + wobble * Math.sin(i * 2.4 + cx + cy)
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]
  })
  const p = i => pts[(i + n) % n]
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`
  }
  return d + 'Z'
}
// Scalloped circle for fluffy things.
function fluff(cx, cy, r, n = 14, puff = 6) {
  let d = `M${f(cx + r)} ${f(cy)}`
  for (let i = 1; i <= n; i++) {
    const a = i / n * Math.PI * 2, m = (i - .5) / n * Math.PI * 2
    d += `Q${f(cx + Math.cos(m) * (r + puff))} ${f(cy + Math.sin(m) * (r + puff))} ${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`
  }
  return d + 'Z'
}
const RIM = blob(80, 80, 71, 71, .025, 10)

// Googly eye: white ball with the pupil pushed toward (dx, dy).
function Eye({ x, y, r = 11, dx = 0, dy = 0, pupil = r * .42 }) {
  return <><path d={blob(x, y, r)} fill={WHITE}/><circle cx={x + dx} cy={y + dy} r={pupil} fill={INK} stroke="none"/></>
}
function Blush({ x, y }) {
  return <ellipse cx={x} cy={y} rx="9" ry="5.5" fill={PINK} stroke="none" opacity=".85"/>
}
function Sparkle({ x, y, r = 8 }) {
  return <path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill={WHITE} strokeWidth="3"/>
}
function Drop({ x, y, s = 1 }) {
  return <path d="M0-11Q7-1 4 4Q0 8-4 4Q-7-1 0-11Z" transform={`translate(${x} ${y}) scale(${s})`} fill={TEAR} strokeWidth={3.5 / s}/>
}

function Portrait({ kind, look }) {
  switch (kind) {
    case 0: { // zorro: smug, side-eyeing, absolutely the impostor
      const head = 'M28 86Q28 50 80 48Q132 50 132 86Q133 108 112 120L80 136 48 120Q27 108 28 86Z'
      return <>
        <path d="M38 70 30 18 72 48Z" fill="#FF8A3D"/><path d="M122 70 130 18 88 48Z" fill="#FF8A3D"/>
        <path d="M41 56 37 32 56 47Z" fill="#FFE7D1" stroke="none"/><path d="M119 56 123 32 104 47Z" fill="#FFE7D1" stroke="none"/>
        <path d={head} fill="#FF8A3D" stroke="none"/>
        <path d="M37 101Q58 89 80 103Q102 89 123 101L108 120 80 133 52 120Z" fill={WHITE} stroke="none"/>
        <path d={head}/>
        <path d="M47 80H73Q71 93 60 93Q49 93 47 80Z" fill={WHITE}/><circle cx={60 + look * 6} cy="85" r="4.5" fill={INK} stroke="none"/>
        <path d="M87 80H113Q111 93 100 93Q89 93 87 80Z" fill={WHITE}/><circle cx={100 + look * 6} cy="85" r="4.5" fill={INK} stroke="none"/>
        <path d="M46 70Q58 66 72 71M88 65Q100 53 114 60"/>
        <path d="M73 103H87L80 110Z" fill={INK}/>
        <path d="M67 118Q84 124 98 110M95 106l4 7"/>
      </>
    }
    case 1: // conejo: buck teeth, eyes going two ways
      return <>
        <path d="M50 66Q32 10 53 5Q72 5 68 62Z" fill="#F4F1FF"/><path d="M55 54Q46 22 55 16Q63 18 62 54Z" fill={PINK} stroke="none"/>
        <path d="M94 62Q110 12 138 24Q152 36 114 72Z" fill="#F4F1FF"/><path d="M103 58Q115 26 133 31Q140 38 113 63Z" fill={PINK} stroke="none"/>
        <path d={blob(80, 100, 48, 42)} fill="#F4F1FF"/>
        <Eye x={59} y={90} r={15} dx={-6 * look} dy={-5} pupil={5}/><Eye x={101} y={88} r={10} dx={4} dy={4 * look} pupil={4}/>
        <path d="M74 105H86L80 111Z" fill={PINK}/>
        <path d="M71 115H89V130Q85 134 80 130Q75 134 71 130Z" fill={WHITE}/><path d="M80 116V130" strokeWidth="3.5"/>
        <path d="M60 111Q70 118 80 114Q90 118 100 111"/>
        <Blush x={42} y={112}/><Blush x={118} y={110}/>
      </>
    case 2: { // búho: O_O
      const body = 'M30 124Q22 76 42 50L36 20 62 40Q80 34 98 40L124 20 118 50Q138 76 130 124Q120 150 80 150Q40 150 30 124Z'
      return <>
        <path d="M138 30l6-9M143 46l11-4M22 30l-6-9" strokeWidth="4.5"/>
        <path d={body} fill="#B9824F"/>
        <path d={blob(59, 86, 25)} fill="#F6DDB4" stroke="none"/><path d={blob(101, 86, 25)} fill="#F6DDB4" stroke="none"/>
        <Eye x={59} y={86} r={21} dx={look} pupil={3.5}/><Eye x={101} y={86} r={21} dx={look} pupil={3.5}/>
        <path d="M73 104H87L80 119Z" fill={GOLD}/>
        <path d="M62 132l5 5 5-5M88 132l5 5 5-5M75 140l5 5 5-5" strokeWidth="3.5"/>
      </>
    }
    case 3: // gato: 🥺
      return <>
        <path d="M28 104Q26 66 46 56L40 16 72 46Q80 44 88 46L120 16 114 56Q134 66 132 104Q132 142 80 142Q28 142 28 104Z" fill="#6A6690"/>
        <path d="M46 50 44 29 62 45Z" fill={PINK} stroke="none"/><path d="M114 50 116 29 98 45Z" fill={PINK} stroke="none"/>
        <path d="M45 71 64 63M115 71 96 63"/>
        <path d={blob(60, 92, 15, 17)} fill={INK}/><path d={blob(100, 92, 15, 17)} fill={INK}/>
        <circle cx="54" cy="85" r="6" fill={WHITE} stroke="none"/><circle cx="66" cy="99" r="3" fill={WHITE} stroke="none"/>
        <circle cx="94" cy="85" r="6" fill={WHITE} stroke="none"/><circle cx="106" cy="99" r="3" fill={WHITE} stroke="none"/>
        <path d="M46 103Q60 118 74 103M86 103Q100 118 114 103" stroke={TEAR} strokeWidth="4"/>
        <path d="M75 109H85L80 114Z" fill={PINK} stroke="none"/>
        <path d="M71 118Q75.5 123 80 117Q84.5 123 89 118" strokeWidth="4"/>
        <path d="M44 112 16 106M44 120 18 127M116 112 144 106M116 120 142 127" strokeWidth="3.5"/>
        <Drop x={121} y={112}/>
      </>
    case 4: // oso: blep
      return <>
        <path d={blob(40, 50, 17)} fill="#C08350"/><path d={blob(120, 50, 17)} fill="#C08350"/>
        <circle cx="41" cy="51" r="8" fill="#8A5530" stroke="none"/><circle cx="119" cy="51" r="8" fill="#8A5530" stroke="none"/>
        <path d={blob(80, 100, 54, 48)} fill="#C08350"/>
        <circle cx="67" cy="85" r="4.5" fill={INK} stroke="none"/><circle cx="93" cy="85" r="4.5" fill={INK} stroke="none"/>
        <path d={blob(80, 111, 25, 18)} fill="#FFF1DC"/>
        <path d="M74 118Q73 135 81 135Q89 135 88 118Z" fill={PINK}/><path d="M81 122V129" strokeWidth="3"/>
        <path d="M70 101Q80 95 90 101Q88 109 80 109Q72 109 70 101Z" fill={INK}/>
        <path d="M80 109V115M68 115Q74 121 80 115Q86 121 92 115"/>
        <Blush x={44} y={106}/><Blush x={116} y={106}/>
      </>
    case 5: // mapache: plotting something
      return <>
        <path d="M36 70 38 24 70 50Z" fill="#A9ACC2"/><path d="M124 70 122 24 90 50Z" fill="#A9ACC2"/>
        <path d="M42 58 42 37 58 50Z" fill="#3A3157" stroke="none"/><path d="M118 58 118 37 102 50Z" fill="#3A3157" stroke="none"/>
        <path d={blob(80, 98, 52, 45)} fill="#A9ACC2"/>
        <path d="M80 56V68M70 58l2 9M90 58l-2 9" stroke="#3A3157" strokeWidth="4"/>
        <path d="M34 92Q40 75 60 77Q72 79 80 87Q88 79 100 77Q120 75 126 92Q118 107 100 104Q88 102 80 96Q72 102 60 104Q42 107 34 92Z" fill="#3A3157" stroke="none"/>
        <Eye x={60} y={90} r={10} dx={4 * look} pupil={4.5}/><Eye x={100} y={90} r={10} dx={4 * look} pupil={4.5}/>
        <path d="M47 68 68 77M113 68 92 77"/>
        <path d={blob(80, 120, 24, 15)} fill={WHITE} stroke="none"/>
        <ellipse cx="80" cy="110" rx="8" ry="5.5" fill={INK}/>
        <path d="M62 120Q80 138 98 120Q80 128 62 120Z" fill={INK}/><path d="M68 122 71 130 75 123Z" fill={WHITE} stroke="none"/>
      </>
    case 6: // rana: unimpressed, eyes not agreeing
      return <>
        <path d={blob(52, 66, 22)} fill="#62D47F"/><path d={blob(108, 66, 22)} fill="#62D47F"/>
        <path d={blob(80, 106, 58, 38)} fill="#62D47F"/>
        <Eye x={52} y={64} r={14} dx={5} dy={4} pupil={5.5}/><Eye x={108} y={64} r={14} dx={-5 * look} dy={5} pupil={5.5}/>
        <path d="M38 63Q38 49 52 49Q66 49 66 63Z" fill="#62D47F"/><path d="M94 63Q94 49 108 49Q122 49 122 63Z" fill="#62D47F"/>
        <circle cx="72" cy="96" r="2.5" fill={INK} stroke="none"/><circle cx="88" cy="96" r="2.5" fill={INK} stroke="none"/>
        <path d="M38 110Q80 132 122 110M34 106l6 6M126 106l-6 6"/>
        <Blush x={46} y={124}/><Blush x={114} y={124}/>
      </>
    case 7: // perro: one big eye, tongue out sideways
      return <>
        <path d="M46 58Q18 50 20 96Q24 113 40 100Q44 78 54 64Z" fill="#B8743C"/>
        <path d="M112 58Q136 44 146 74Q148 93 132 92Q124 72 106 64Z" fill="#B8743C"/>
        <path d={blob(80, 98, 46, 44)} fill="#F3D2A2"/>
        <path d={blob(100, 84, 18, 17)} fill="#B8743C" stroke="none"/>
        <Eye x={60} y={84} r={10} dx={3} dy={3} pupil={4.5}/><Eye x={100} y={84} r={14} dx={-4 * look} dy={-4} pupil={4.5}/>
        <path d={blob(80, 112, 23, 16)} fill={WHITE}/>
        <path d="M84 119Q85 139 96 138Q105 136 99 118Z" fill={PINK}/><path d="M91 124l2 8" strokeWidth="3"/>
        <path d="M70 102Q80 96 90 102Q88 110 80 110Q72 110 70 102Z" fill={INK}/>
        <path d="M80 110V116M67 115Q73 122 80 116Q87 122 94 115"/>
      </>
    case 8: // polilla: has seen the lamp
      return <>
        <path d="M72 96Q28 34 12 62Q4 96 38 110Q18 130 36 144Q58 152 74 120Z" fill="#FFF1D6"/>
        <path d="M88 96Q132 34 148 62Q156 96 122 110Q142 130 124 144Q102 152 86 120Z" fill="#FFF1D6"/>
        <circle cx="30" cy="76" r="7" fill="#B8743C" stroke="none"/><circle cx="130" cy="76" r="7" fill="#B8743C" stroke="none"/>
        <circle cx="34" cy="128" r="4" fill="#B8743C" stroke="none"/><circle cx="126" cy="128" r="4" fill="#B8743C" stroke="none"/>
        <path d="M68 64Q58 36 42 28M92 64Q102 36 118 28"/>
        <path d="M60 48l-7 3M53 38l-7 0M100 48l7 3M107 38l7 0" strokeWidth="3.5"/>
        <path d={fluff(80, 140, 26, 10, 5)} fill={WHITE}/>
        <path d={fluff(80, 96, 34)} fill="#E9B872"/>
        <path d={blob(62, 93, 14, 16)} fill={INK}/><path d={blob(98, 93, 14, 16)} fill={INK}/>
        <circle cx="56" cy="86" r="5.5" fill={WHITE} stroke="none"/><circle cx="92" cy="86" r="5.5" fill={WHITE} stroke="none"/>
        <circle cx="68" cy="101" r="3" fill={GOLD} stroke="none"/><circle cx="104" cy="101" r="3" fill={GOLD} stroke="none"/>
        <path d="M74 115Q80 120 86 115" strokeWidth="4"/>
        <Blush x={50} y={112}/><Blush x={110} y={112}/>
        <Sparkle x={140} y={30}/><Sparkle x={22} y={34} r={6}/>
      </>
    case 9: // paloma: nothing behind the eyes
      return <>
        <path d="M18 164Q24 116 80 112Q136 116 142 164Z" fill="#A8B0D6"/>
        <path d="M46 124Q80 106 114 124Q104 142 80 142Q56 142 46 124Z" fill="#3FD3A8" stroke="none"/>
        <path d="M54 133Q80 121 106 133" stroke="#B07BFF" strokeWidth="6"/>
        <path d={blob(80, 80, 44, 42)} fill="#A8B0D6"/>
        <path d="M78 38Q70 24 80 17M84 38Q90 27 99 28" strokeWidth="4"/>
        <circle cx="45" cy="78" r="11" fill="#FF8A3D"/><circle cx={45 + look} cy="78" r="3.5" fill={INK} stroke="none"/>
        <circle cx="115" cy="78" r="11" fill="#FF8A3D"/><circle cx={115 + look} cy="78" r="3.5" fill={INK} stroke="none"/>
        <path d="M72 88Q80 83 88 88L80 108Z" fill="#5B5470"/>
        <path d={blob(80, 87, 8, 4.5)} fill={WHITE} strokeWidth="3.5"/>
      </>
    case 10: // nutria: has a rock, is thrilled
      return <>
        <path d={blob(40, 64, 9)} fill="#A0693F"/><path d={blob(120, 64, 9)} fill="#A0693F"/>
        <path d={blob(80, 96, 50, 44)} fill="#A0693F"/>
        <path d="M40 106Q44 84 64 90Q80 96 96 90Q116 84 120 106Q116 130 80 132Q44 130 40 106Z" fill="#F4DCBC" stroke="none"/>
        <path d="M52 84Q60 73 68 84M92 84Q100 73 108 84"/>
        <path d="M70 98Q80 92 90 98Q88 106 80 106Q72 106 70 98Z" fill={INK}/>
        <path d="M68 110Q80 111 92 110Q90 126 80 126Q70 126 68 110Z" fill={RED}/><path d="M73 121Q80 115 87 121Q84 125 80 125Q76 125 73 121Z" fill={PINK} stroke="none"/>
        <path d="M80 106V110"/>
        <g fill={INK} stroke="none"><circle cx="62" cy="104" r="1.8"/><circle cx="58" cy="110" r="1.8"/><circle cx="98" cy="104" r="1.8"/><circle cx="102" cy="110" r="1.8"/></g>
        <Blush x={46} y={98}/><Blush x={114} y={98}/>
        <path d={blob(80, 146, 18, 11)} fill="#B9B4C9"/>
        <path d={blob(60, 141, 9, 8)} fill="#A0693F"/><path d={blob(100, 141, 9, 8)} fill="#A0693F"/>
        <Sparkle x={136} y={36} r={7}/>
      </>
    default: // ratón: sweating bullets
      return <>
        <path d={blob(40, 54, 27)} fill="#C3BED6"/><path d={blob(120, 54, 27)} fill="#C3BED6"/>
        <path d={blob(41, 55, 16)} fill={PINK} stroke="none"/><path d={blob(119, 55, 16)} fill={PINK} stroke="none"/>
        <path d={blob(80, 100, 44, 42)} fill="#C3BED6"/>
        <path d="M54 76 68 70M106 76 92 70"/>
        <Eye x={64} y={90} r={11} dx={look} pupil={3}/><Eye x={96} y={90} r={11} dx={look} pupil={3}/>
        <circle cx="80" cy="107" r="5" fill={PINK}/>
        <path d="M63 116Q80 112 97 116L96 128Q80 132 64 128Z" fill={WHITE}/>
        <path d="M64 122Q80 120 96 122M72 115V129M80 114V130M88 115V129" strokeWidth="3"/>
        <path d="M46 110 18 106M46 118 20 124M114 110 142 106M114 118 140 124" strokeWidth="3.5"/>
        <Drop x={126} y={86} s={1.2}/>
      </>
  }
}

export function ClubAvatar({ name = '', size = 72, speaking = false, eliminated = false, showCrown = false, character }) {
  const id = useId().replaceAll(':', '')
  const seed = portraitSeed(name)
  const kind = avatarIndex(name, character)
  return <span className={`club-avatar ${speaking ? 'is-speaking' : ''} ${eliminated ? 'is-eliminated' : ''}`} data-avatar={CLUB_CHARACTERS[kind]} style={{width:size, height:size}} aria-hidden="true">
    <svg viewBox="0 0 160 160" width={size} height={size} className="portrait-illustration" focusable="false">
      <defs><clipPath id={`portrait-${id}`}><path d={RIM}/></clipPath></defs>
      <path d={RIM} fill={INK} transform="translate(0 4)"/>
      <path d={RIM} fill={BACKGROUNDS[kind]}/>
      <g clipPath={`url(#portrait-${id})`}>
        <path d="M28 58Q36 32 62 21" fill="none" stroke={WHITE} strokeWidth="7" strokeLinecap="round" opacity=".5"/>
        <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><Portrait kind={kind} look={seed % 2 ? 1 : -1}/></g>
      </g>
      <path d={RIM} fill="none" stroke={INK} strokeWidth="5"/>
    </svg>
    {showCrown && <svg className="portrait-host" viewBox="0 0 32 36" width="24" height="27"><path d="m9 20-3 14 10-5 9 5-2-15" fill={RED} stroke={INK} strokeWidth="1.5"/><path d="m16 2 4 3 5 1 1 5 3 4-3 4-1 5-5 1-4 3-4-3-5-1-1-5-3-4 3-4 1-5 5-1Z" fill={GOLD} stroke={INK} strokeWidth="1.5"/><path d="m16 8 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill={INK}/></svg>}
  </span>
}
