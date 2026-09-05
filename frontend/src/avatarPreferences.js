import { isAvatarId } from '../../shared/avatars.js'
const KEY = 'el-impostor-avatar'
export function readAvatarPreference(storage) {
  try {
    const value = JSON.parse((storage || sessionStorage).getItem(KEY))
    return isAvatarId(value) ? value : null
  } catch { return null }
}
export function saveAvatarPreference(value) {
  if (!isAvatarId(value)) return
  try { sessionStorage.setItem(KEY, JSON.stringify(value)) } catch {}
}
