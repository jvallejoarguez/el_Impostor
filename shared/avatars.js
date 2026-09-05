// Stable IDs in this array are part of the room protocol. Append; do not reorder.
export const AVATAR_NAMES = ['zorro', 'conejo', 'búho', 'gato', 'oso', 'mapache', 'rana', 'perro', 'polilla', 'paloma', 'nutria', 'ratón']
export function isAvatarId(value) {
  return Number.isInteger(value) && value >= 0 && value < AVATAR_NAMES.length
}
export function portraitSeed(name = '') {
  let value = 2166136261
  for (const char of name.normalize('NFC').toLowerCase()) value = Math.imul(value ^ char.codePointAt(0), 16777619)
  return value >>> 0
}
export function avatarIndex(name, avatarId) {
  return isAvatarId(avatarId) ? avatarId : portraitSeed(name) % AVATAR_NAMES.length
}
