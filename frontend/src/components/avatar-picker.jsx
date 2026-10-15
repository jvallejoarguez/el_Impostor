import React, { useState } from 'react'
import { ClubAvatar, CLUB_CHARACTERS } from './club-avatars.jsx'
import { avatarIndex } from '../../../shared/avatars.js'
import { Sheet } from './sheet.jsx'

export function AvatarPickerButton({ name, avatarId, onSelect, size = 76, showCrown = false, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const selected = avatarIndex(name, avatarId)
  return <>
    <button type="button" className="avatar-edit" disabled={disabled} onClick={() => {setError(''); setOpen(true)}} aria-label={`Cambiar tu avatar: ${CLUB_CHARACTERS[selected]}`} aria-haspopup="dialog">
      <ClubAvatar name={name} character={selected} size={size} showCrown={showCrown}/><span className="avatar-edit-mark" aria-hidden="true">✎</span>
    </button>
    {open && <Sheet title="Elige tu avatar" onClose={() => setOpen(false)} className="avatar-sheet">
      <div className="avatar-options">{CLUB_CHARACTERS.map((character, index) => <button type="button" key={character} className="avatar-option" aria-pressed={index === selected} autoFocus={index === selected} onClick={() => {
        if (onSelect(index) === false) { setError('No se ha podido guardar. Comprueba la conexión y reinténtalo.'); return }
        setOpen(false)
      }}><ClubAvatar name={name} character={index} size={72}/><span>{character}</span>{index === selected && <span className="avatar-check" aria-hidden="true">✓</span>}</button>)}</div>
      {error && <p role="alert">{error}</p>}
    </Sheet>}
  </>
}
