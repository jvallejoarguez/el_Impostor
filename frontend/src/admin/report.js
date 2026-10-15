export function isVerification(row) {
  return row.source === 'verification' || row.medium === 'qa' ||
    /^(activation_|consent_check_)/.test(row.campaign || '')
}

export function summarizeReport(report, excludeTests = true) {
  const totals = {}, pages = new Map(), landings = new Map(), errors = new Map()
  const daily = [], feedback = []
  for (const day of [...report.reports].sort((a, b) => a.day.localeCompare(b.day))) {
    const counts = {}
    feedback.push(...day.feedback.map(item => ({ ...item, day: day.day })))
    for (const row of day.counters) {
      if (excludeTests && isVerification(row)) continue
      counts[row.event] = (counts[row.event] || 0) + row.count
      totals[row.event] = (totals[row.event] || 0) + row.count
      const increment = (map, key) => map.set(key, (map.get(key) || 0) + row.count)
      if (row.event === 'page_view') increment(pages, row.path || '/')
      if (row.event === 'visit') increment(landings, row.landing || '/')
      if (['create_failed', 'join_failed', 'client_error', 'server_error', 'join_rejected'].includes(row.event)) {
        const key = JSON.stringify([row.event, row.method || 'unknown', row.version, row.errorName, row.script, row.line, row.column])
        const value = errors.get(key) || { key, event: row.event, method: row.method || 'unknown', version: row.version, errorName: row.errorName, script: row.script, line: row.line, column: row.column, count: 0 }
        errors.set(key, { ...value, count: value.count + row.count })
      }
    }
    daily.push({ day: day.day, ...counts })
  }
  const ranked = map => [...map].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
  return { totals, daily, pages: ranked(pages), landings: ranked(landings),
    errors: [...errors.values()].sort((a, b) => b.count - a.count),
    feedback: feedback.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    // Do not add server rejections to client reports: the same attempt can generate both.
    clientErrors: (totals.create_failed || 0) + (totals.join_failed || 0) + (totals.client_error || 0),
    serverErrors: (totals.server_error || 0) + (totals.join_rejected || 0),
    javascriptErrors: [...errors.values()].filter(row => row.event === 'client_error' && ['script_error', 'unhandled_rejection'].includes(row.method)).reduce((sum, row) => sum + row.count, 0),
    disconnections: [...errors.values()].filter(row => row.event === 'client_error' && row.method === 'socket_disconnected').reduce((sum, row) => sum + row.count, 0),
  }
}

export const errorLabels = {
  create_failed: 'Creación de sala (navegador)', join_failed: 'Entrada fallida (navegador)',
  client_error: 'Incidencia de navegador', server_error: 'Error de servidor', join_rejected: 'Entrada rechazada (servidor)',
  timeout: 'Tiempo de espera agotado', rejected: 'Entrada rechazada', network: 'Red',
  script_error: 'Error de JavaScript', unhandled_rejection: 'Operación no completada',
  socket_disconnected: 'Conexión interrumpida', room_not_found: 'Sala no encontrada', room_full: 'Sala llena',
  game_in_progress: 'Partida ya iniciada', invalid_join: 'Datos de entrada inválidos',
  room_capacity: 'No quedan códigos disponibles', room_create_failed: 'Error al crear sala',
  websocket_open_failed: 'Error al abrir conexión', reconnect_timeout: 'Reconexión lenta',
  message_failed: 'Error al procesar una acción', alarm_failed: 'Error en un temporizador', unknown: 'Sin detalle',
}

export const feedbackLabels = {
  rating: 'Valoración', problem: 'Problema', idea: 'Idea', words: 'Palabras', exit: 'Salida de sala',
  good: 'Bien', okay: 'Regular', bad: 'Mal', connection: 'Conexión', rules: 'Reglas', pace: 'Ritmo',
  missing_players: 'Faltan jugadores', just_looking: 'Solo miraba', other: 'Otro',
}
