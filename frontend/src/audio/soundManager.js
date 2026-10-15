// frontend/src/audio/soundManager.js
// Party-game sound effects synthesised with Web Audio, plus two looping music
// tracks. Browsers only allow audio after a user gesture, so the context is
// created on the first tap or key press; everything goes through one master
// gain, so the mute button silences music and effects alike.

const MUTE_KEY = 'el-impostor-sound'
let ctx = null
let master = null
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === 'off' } catch { return false } })()

export function initSounds() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.5
    const glue = ctx.createDynamicsCompressor()
    master.connect(glue)
    glue.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  syncMusic()
}
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, initSounds, { once: true, passive: true })
}

export const isMuted = () => muted
export function setMuted(value) {
  muted = value
  try { localStorage.setItem(MUTE_KEY, value ? 'off' : 'on') } catch {}
  if (master) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02)
  syncMusic()
}

// === Music: home and lobby get one track, the clue and vote rounds another ===
const TRACKS = { home: '/music/home.m4a', game: '/music/game.m4a' }
const MUSIC_VOLUME = 0.35
const music = {}
let wantedMusic = null

export function setMusic(name) {
  wantedMusic = name
  syncMusic()
}

function syncMusic() {
  if (!ctx) return
  for (const name of Object.keys(TRACKS)) {
    const on = name === wantedMusic && !muted
    if (!on && !music[name]) continue
    if (!music[name]) {
      const audio = new Audio(TRACKS[name])
      audio.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0
      ctx.createMediaElementSource(audio).connect(gain)
      gain.connect(master)
      music[name] = { audio, gain }
    }
    const { audio, gain } = music[name]
    // Cross-fade; a silent track pauses once its fade has finished.
    gain.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, ctx.currentTime, on ? 0.6 : 0.3)
    if (on) audio.play().catch(() => {})
    else setTimeout(() => { if (name !== wantedMusic || muted) audio.pause() }, 1500)
  }
}

const NOTE = { E3: 164.8, F3: 174.6, Fs3: 185, G3: 196, Ab3: 207.7, D4: 293.7, G4: 392, C5: 523.3, E5: 659.3, G5: 784, D6: 1174.7, C6: 1046.5, E6: 1318.5, G6: 1568 }

// One oscillator with a quick attack and exponential decay; optional pitch glide,
// low-pass filter and vibrato cover every effect below.
function tone(at, { type = 'square', f, to, d = 0.12, v = 0.3, a = 0.005, lp, vibrato }) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + d)
  if (vibrato) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain()
    lfo.frequency.value = 6; depth.gain.value = vibrato
    lfo.connect(depth); depth.connect(osc.frequency)
    lfo.start(t + d * 0.3); lfo.stop(t + d + 0.05)
  }
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(v, t + a)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  let out = osc
  if (lp) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lp; osc.connect(filter); out = filter }
  out.connect(gain); gain.connect(master)
  osc.start(t); osc.stop(t + d + 0.05)
}

function noise(at, { d = 0.08, v = 0.25, lp = 8000, hp = 200 }) {
  const t = ctx.currentTime + at
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = ctx.createBufferSource(), low = ctx.createBiquadFilter(), high = ctx.createBiquadFilter(), gain = ctx.createGain()
  src.buffer = buffer
  low.type = 'lowpass'; low.frequency.value = lp
  high.type = 'highpass'; high.frequency.value = hp
  gain.gain.value = v
  src.connect(high); high.connect(low); low.connect(gain); gain.connect(master)
  src.start(t)
}

const SOUNDS = {
  // 3-2-1: a wood-block knock.
  tick: () => { tone(0, { type: 'triangle', f: 1250, to: 820, d: 0.08, v: 0.5 }); noise(0, { d: 0.03, v: 0.15, hp: 3000 }) },
  // ¡YA!: a whoosh up into a bright chord.
  go: () => {
    tone(0, { type: 'sawtooth', f: 260, to: 1300, d: 0.25, v: 0.18, lp: 2600 })
    for (const f of [NOTE.C6, NOTE.E6, NOTE.G6]) tone(0.2, { type: 'square', f, d: 0.35, v: 0.07, lp: 4000 })
  },
  // Someone dropped into the lobby.
  join: () => tone(0, { type: 'sine', f: 380, to: 1350, d: 0.11, v: 0.45 }),
  yourTurn: () => {
    tone(0, { type: 'triangle', f: NOTE.G5, d: 0.14, v: 0.35 })
    tone(0.11, { type: 'triangle', f: NOTE.D6, d: 0.32, v: 0.35 })
    tone(0.11, { type: 'sine', f: NOTE.D6 * 2, d: 0.25, v: 0.08 })
  },
  wordSubmit: () => { tone(0, { type: 'sine', f: 520, to: 1250, d: 0.09, v: 0.4 }); tone(0.07, { type: 'sine', f: 1500, d: 0.07, v: 0.15 }) },
  // Last seconds of a turn: a dry clock tick.
  timerWarning: () => tone(0, { type: 'square', f: 1900, d: 0.04, v: 0.14, lp: 5000 }),
  // A rubber stamp.
  voteCast: () => { tone(0, { type: 'sine', f: 200, to: 55, d: 0.2, v: 0.7 }); noise(0, { d: 0.06, v: 0.35, lp: 1500 }) },
  // Dun, dun, duuun.
  roleImpostor: () => {
    noise(0, { d: 0.5, v: 0.4, lp: 700, hp: 40 })
    tone(0, { type: 'sawtooth', f: NOTE.D4, d: 0.16, v: 0.22, lp: 1500 })
    tone(0.22, { type: 'sawtooth', f: NOTE.D4, d: 0.16, v: 0.22, lp: 1500 })
    tone(0.44, { type: 'sawtooth', f: NOTE.Ab3, d: 1.1, v: 0.26, lp: 1300, vibrato: 5 })
    tone(0.44, { type: 'square', f: NOTE.Ab3 / 2, d: 1.1, v: 0.12, lp: 600 })
  },
  // A bright, rising arpeggio.
  roleCrewmate: () => {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(i * 0.08, { type: 'triangle', f, d: i === 3 ? 0.5 : 0.14, v: 0.32 }))
    tone(0.24, { type: 'sine', f: NOTE.C6 * 2, d: 0.4, v: 0.07 })
  },
  win: () => {
    [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(i * 0.1, { type: 'square', f, d: 0.12, v: 0.13, lp: 3500 }))
    for (const f of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]) tone(0.42, { type: 'triangle', f, d: 0.9, v: 0.2, vibrato: 3 })
    for (let i = 0; i < 6; i++) noise(0.42 + i * 0.07, { d: 0.05, v: 0.08, hp: 6000 })
  },
  // The sad trombone.
  lose: () => {
    [NOTE.G3, NOTE.Fs3, NOTE.F3].forEach((f, i) => tone(i * 0.36, { type: 'sawtooth', f, d: 0.32, v: 0.22, a: 0.03, lp: 1100 }))
    tone(1.08, { type: 'sawtooth', f: NOTE.E3, d: 1.1, v: 0.24, a: 0.03, lp: 1100, vibrato: 6 })
  },
}

export function play(name) {
  if (!ctx || muted || !SOUNDS[name]) return
  try { SOUNDS[name]() } catch {}
}
