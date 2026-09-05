// A shareable graphic from public, finished-game data only. No invite code or private role.
export async function downloadResultCard(room) {
  if (room.phase !== 'results' || !room.result) throw new Error('La partida no ha terminado')
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  const { found, secretWord, impostorName, impostorId } = room.result
  const name = room.players.find(p => p.id === impostorId)?.name || impostorName || 'El impostor'
  const ink = '#28251E', paper = '#F8F0DF', accent = found ? '#485F42' : '#B8432E'
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 1080, 1350)
  ctx.fillStyle = ink; ctx.fillRect(60, 65, 970, 1230)
  ctx.fillStyle = accent; ctx.fillRect(45, 50, 970, 1230)
  ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.strokeRect(45, 50, 970, 1230)
  function text(value, y, maxSize, color = ink, maxWidth = 830) {
    let size = maxSize
    ctx.font = `${size}px "Fraunces", sans-serif`
    while (ctx.measureText(value).width > maxWidth && size > 20) ctx.font = `${--size}px "Fraunces", sans-serif`
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, 530, y)
  }
  text('EL IMPOSTOR', 170, 68, paper)
  text('UN SECRETO. MUCHAS SOSPECHAS.', 220, 24, paper)
  text(found ? '¡PILLADO!' : '¡SE HA ESCAPADO!', 380, 94, paper)
  ctx.fillStyle = paper; ctx.fillRect(110, 465, 840, 520)
  ctx.strokeRect(110, 465, 840, 520)
  text('EL IMPOSTOR ERA', 560, 30)
  text(name, 665, 76, ink, 760)
  text('LA PALABRA SECRETA', 800, 30)
  text(secretWord || '—', 895, 74, ink, 760)
  text(`${room.players.length} amigos. ¿Tú habrías acertado?`, 1100, 32, paper)
  text('juegoimpostor.app', 1210, 40, paper)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo crear la imagen')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = 'el-impostor-resultado.png'
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
