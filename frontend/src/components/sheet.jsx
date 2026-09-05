import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({ title, children, onClose, className = '' }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return createPortal(<dialog ref={dialogRef} className={`game-sheet ${className}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
  }}>
    <header className="sheet-heading"><h2 id={titleId}>{title}</h2><button type="button" className="sheet-close" onClick={onClose} aria-label={`Cerrar ${title.toLowerCase()}`}>×</button></header>
    <div className="sheet-body">{children}</div>
  </dialog>, document.body)
}
