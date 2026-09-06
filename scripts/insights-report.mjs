import { readFile } from 'node:fs/promises'

const base = process.env.INSIGHTS_URL || 'https://el-impostor-worker-production.jvallejoarguez.workers.dev'
const days = Number(process.argv[2] || 7)
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Uso: npm run insights -- 7 (de 1 a 30 días)')
const token = process.env.INSIGHTS_READ_TOKEN || await readFile(new URL('../.local/insights-token', import.meta.url), 'utf8').then(s => s.trim()).catch(() => '')
if (!token) throw new Error('Falta la clave privada. Consulta docs/growth.md para configurar el informe.')
const url = new URL('/insights/report', base)
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Usa HTTPS para enviar la clave privada.')
url.searchParams.set('days', String(days))
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`No se pudo obtener el informe (HTTP ${response.status}). Revisa el despliegue y la clave privada.`)
const report = await response.json()
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  // User comments are untrusted: remove terminal controls and escape Markdown cells.
  const cell = value => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[|<>`*\[\]\\]/g, char => `\\${char}`)
  const totals = {}, channels = new Map(), feedback = []
  for (const day of report.reports) {
    feedback.push(...day.feedback)
    for (const row of day.counters) {
      totals[row.event] = (totals[row.event] || 0) + row.count
      const key = [row.source, row.medium, row.campaign || '—', row.content || '—', row.landing].map(cell).join(' / ')
      const counts = channels.get(key) || {}
      counts[row.event] = (counts[row.event] || 0) + row.count
      channels.set(key, counts)
    }
  }
  console.log(`# El Impostor — últimos ${days} días UTC\n`)
  console.log('| Medida | Total |\n|---|---:|')
  for (const [event, label] of Object.entries({ visit: 'Visitas por sesión de pestaña', room_created: 'Salas creadas', group_ready: 'Salas que reunieron 3 jugadores', room_activated: 'Salas que empezaron a jugar', game_started: 'Partidas iniciadas (incluye repeticiones)', game_finished: 'Partidas terminadas', game_repeated: 'Partidas iniciadas tras terminar otra', player_joined: 'Entradas confirmadas (sin reconexiones)', share_invite: 'Acciones de compartir', lobby_left: 'Salidas explícitas de la sala de espera', create_failed: 'Errores al crear sala', join_failed: 'Errores de entrada (incluye reintentos)' })) {
    console.log(`| ${label} | ${totals[event] || 0} |`)
  }
  console.log('\nLos totales son actividad del periodo, no una cohorte: una sala puede crearse antes del periodo y jugar dentro. Las visitas dependen del navegador y su preferencia de privacidad; las partidas las cuenta el servidor. Compartir no confirma que alguien haya recibido la invitación.\n')
  console.log('| Fuente / medio / campaña / pieza / entrada | Visitas | Salas | Empezaron | Terminadas |\n|---|---:|---:|---:|---:|')
  for (const [key, counts] of [...channels].sort((a, b) => (b[1].game_finished || 0) - (a[1].game_finished || 0))) {
    console.log(`| ${key} | ${counts.visit || 0} | ${counts.room_created || 0} | ${counts.room_activated || 0} | ${counts.game_finished || 0} |`)
  }
  const invitedJoins = report.reports.flatMap(day => day.counters).filter(row => row.event === 'player_joined' && row.wasInvited).reduce((sum, row) => sum + row.count, 0)
  const invitedHosts = report.reports.flatMap(day => day.counters).filter(row => row.event === 'room_created' && row.wasInvited).reduce((sum, row) => sum + row.count, 0)
  console.log(`\nEntradas desde invitación: ${invitedJoins}. Salas creadas por visitantes previamente invitados en esa sesión: ${invitedHosts}.\n`)
  console.log(`## Opiniones (${feedback.length})\n`)
  const breakdown = {}
  for (const item of feedback) {
    const label = [item.kind, item.rating, item.topic].filter(Boolean).join(' / ')
    breakdown[label] = (breakdown[label] || 0) + 1
  }
  for (const [label, count] of Object.entries(breakdown)) console.log(`- ${cell(label)}: ${count}`)
  for (const item of feedback.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))) {
    console.log(`\n- ${cell(item.receivedAt)} · ${cell(item.kind)} · ${cell(item.rating)} · ${cell(item.topic)} · ${cell(item.context.phase)} · ${cell(item.context.category)} · ${item.context.playerCount ?? '?'} jugadores`)
    if (item.comment) console.log(`  > ${cell(item.comment)}`)
  }
}
