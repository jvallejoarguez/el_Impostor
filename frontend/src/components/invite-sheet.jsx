import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Sheet } from './sheet.jsx'
import { getInviteText, getInviteUrl, getWhatsAppShareUrl, sharePayload, track } from '../analytics.js'

export function InviteSheet({ code, playerCount, onClose }) {
  const [message, setMessage] = useState('')
  const text = getInviteText(playerCount)
  const share = async () => {
    try {
      const method = await sharePayload({ title: '¿Una partida de El Impostor?', text, url: getInviteUrl(code) })
      if (method === 'copy_fallback') setMessage('Invitación copiada. Pégala en el grupo de tus amigos.')
    } catch { setMessage('Puedes seleccionar y copiar el enlace de abajo.') }
  }
  return <Sheet title="Invita a tu grupo" onClose={onClose} className="invite-sheet">
    <p>En persona, escanead el QR. A distancia, pasad el enlace por vuestro grupo.</p>
    <div className="invite-qr"><QRCodeSVG value={getInviteUrl(code, 'qr')} size={224} marginSize={4} level="M" title={`Entrar en la sala ${code}`}/><strong>{code}</strong><span>Cada uno desde su móvil</span></div>
    <div className="invite-actions">
      <a className="btn btn--primary" href={getWhatsAppShareUrl(text, getInviteUrl(code, 'whatsapp'))} target="_blank" rel="noreferrer" onClick={() => track('share_invite', { method: 'whatsapp' })}>Enviar por WhatsApp ↗</a>
      <button className="btn btn--ghost" onClick={share}>Compartir o copiar enlace</button>
    </div>
    <label htmlFor="invite-url">Enlace de invitación</label>
    <input id="invite-url" readOnly value={getInviteUrl(code, 'copy')} onFocus={e => e.target.select()}/>
    <p className="inline-feedback" role="status">{message}</p>
  </Sheet>
}
