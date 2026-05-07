// frontend/src/audio/soundManager.js
import { Howl, Howler } from 'howler'

let initialized = false
const sounds = {}

const MANIFEST = {
  tick:          ['/sounds/tick.ogg',           '/sounds/tick.mp3'],
  roleImpostor:  ['/sounds/role-impostor.ogg',  '/sounds/role-impostor.mp3'],
  roleCrewmate:  ['/sounds/role-crewmate.ogg',  '/sounds/role-crewmate.mp3'],
  yourTurn:      ['/sounds/your-turn.ogg',      '/sounds/your-turn.mp3'],
  timerWarning:  ['/sounds/timer-warning.ogg',  '/sounds/timer-warning.mp3'],
  wordSubmit:    ['/sounds/word-submit.ogg',     '/sounds/word-submit.mp3'],
  voteCast:      ['/sounds/vote-cast.ogg',       '/sounds/vote-cast.mp3'],
  win:           ['/sounds/win.ogg',             '/sounds/win.mp3'],
  lose:          ['/sounds/lose.ogg',            '/sounds/lose.mp3'],
}

export function initSounds() {
  if (initialized) return
  initialized = true
  Howler.volume(0.7)
  for (const [name, src] of Object.entries(MANIFEST)) {
    sounds[name] = new Howl({ src, preload: true })
  }
}

export function play(name) {
  if (!initialized || !sounds[name]) return
  sounds[name].play()
}
