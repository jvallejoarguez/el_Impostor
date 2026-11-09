import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { summarizeReport, splitPeriod, weekdayAverages, sourceLabels, errorLabels, feedbackLabels } from './report.js'
import './styles.css'

const number = value => new Intl.NumberFormat('es-ES').format(value || 0)
const dayLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const stamp = value => new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' })
async function api(path, options = {}) {
  const response = await fetch(`/admin-panel/api/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se han podido cargar los datos.'), { status: response.status })
  return data
}

// Same mark as the game's home screen (components/primitives.jsx), kept local so the panel stays light.
function Logo({ className }) {
  return <a className={`logo ${className}`} href="/" aria-label="El Impostor">
    <span className="logo-el" aria-hidden="true">EL</span>
    <span className="logo-word" aria-hidden="true">IMP<span className="logo-o">O<svg viewBox="0 0 44 18"><path d="M2 7q9-7 20 0q11-7 20 0q0 10-9 10q-6 0-11-5q-5 5-11 5q-9 0-9-10Z" fill="#1C0B40" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="9" r="3.4" fill="#fff" /><circle cx="32" cy="9" r="3.4" fill="#fff" /></svg></span>STOR</span>
  </a>
}

function Login({ onLogin, message = '' }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(message)
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await api('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      setPassword(''); onLogin()
    } catch (e) { setError(e.message); setPassword('') }
    finally { setBusy(false) }
  }
  return <main className="login-page">
    <Logo className="login-brand" />
    <section className="login-card">
      <span className="eyebrow">Solo administración</span>
      <h1>El juego,<br /><em>en números.</em></h1>
      <p>Entra a tu panel privado para consultar la actividad y escuchar a tus jugadores.</p>
      <form onSubmit={submit}>
        <label htmlFor="admin-password">Clave privada</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} autoFocus />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar al panel →'}</button>
      </form>
      <small>Acceso protegido · La sesión dura 8 horas</small>
    </section>
    <a className="back-link" href="/">← Volver al juego</a>
  </main>
}

const percent = value => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 }).format(value)
const ratio = (part, whole) => whole ? part / whole : null
const decimal = value => value == null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
function niceMax(value) {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value / 4))
  return [1, 2, 5, 10].map(step => step * power).find(step => step * 4 >= value) * 4
}

// Compared with the previous period of the same length; `invert` when going down is good.
function Delta({ now, before, invert = false, points = false }) {
  if (before == null || now == null) return null
  const change = points ? Math.round((now - before) * 100) : before ? (now - before) / before : null
  if (change == null) return now ? <span className="delta up">Nuevo</span> : null
  const direction = Math.sign(points ? change : Math.round(change * 100))
  const tone = direction === 0 ? 'flat' : (direction > 0) !== invert ? 'up' : 'down'
  return <span className={`delta ${tone}`} title="Comparado con el período anterior de la misma duración">
    {direction > 0 ? '▲' : direction < 0 ? '▼' : '='} {points ? `${Math.abs(change)} pts` : percent(Math.abs(change))}
  </span>
}

function Sparkline({ values }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const line = values.map((value, i) => `${i / (values.length - 1) * 100},${30 - value / max * 27}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 31" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`0,31 ${line} 100,31`} /><polyline points={line} />
  </svg>
}

function Metric({ label, value, display, note, before, invert, points, trend, accent = false }) {
  return <article className={`metric${accent ? ' metric-accent' : ''}`}>
    <span>{label}</span>
    <strong>{display ?? number(value)}</strong>
    <div className="metric-foot"><Delta now={value} before={before} invert={invert} points={points} /><small>{note}</small></div>
    {trend && <Sparkline values={trend} />}
  </article>
}
function Empty({ children }) { return <p className="empty">{children}</p> }
function Panel({ title, note, children, className = '', action }) {
  return <section className={`panel ${className}`}><header className="panel-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{action}</header>{children}</section>
}

const chartViews = {
  games: { label: 'Partidas', series: [['game_started', 'Iniciadas'], ['game_finished', 'Terminadas']] },
  rooms: { label: 'Salas', series: [['room_created', 'Creadas'], ['room_activated', 'Empezaron a jugar']] },
  players: { label: 'Jugadores', series: [['player_joined', 'Entradas a salas']] },
  traffic: { label: 'Visitas', series: [['visit', 'Visitas'], ['page_view', 'Páginas vistas']] },
}

function Trend({ daily, initial = 'games' }) {
  const [view, setView] = useState(initial)
  const [active, setActive] = useState(null)
  const { series } = chartViews[view]
  const max = niceMax(Math.max(0, ...daily.flatMap(row => series.map(([key]) => row[key] || 0))))
  const hovered = daily[active]
  const move = event => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (!step) return
    event.preventDefault()
    setActive(current => Math.min(daily.length - 1, Math.max(0, (current ?? daily.length) + step)))
  }
  return <Panel title="Actividad diaria" note="UTC · El último día está en curso" className="trend-panel"
    action={<div className="segmented" role="group" aria-label="Métrica del gráfico">{Object.entries(chartViews).map(([id, { label }]) =>
      <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>}>
    {series.length > 1 && <div className="chart-legend">{series.map(([key, label], i) => <span key={key}><i className={`series-${i}`} />{label}</span>)}</div>}
    <div className="trend">
      <div className="chart-scale" aria-hidden="true">{[4, 3, 2, 1, 0].map(step => <span key={step}>{number(max * step / 4)}</span>)}</div>
      <div className="chart-bars" tabIndex={0} role="group" aria-label={`${chartViews[view].label} por día. Usa las flechas para recorrer los días; los valores exactos están en Ver detalle diario.`}
        onKeyDown={move} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}>
        {daily.map((row, i) => <div className={`day-column${active === i ? ' is-active' : ''}`} key={row.day} onPointerEnter={() => setActive(i)}>
          <div className="bar-pair">{series.map(([key], s) => <div key={key} className={`bar series-${series.length === 1 ? 1 : s}`} style={{ height: `${(row[key] || 0) / max * 100}%` }} />)}</div>
          <span className="day-tick">{i === 0 || i === daily.length - 1 || (i % Math.ceil(daily.length / 4) === 0 && i < daily.length - 3) ? dayLabel(row.day) : ''}</span>
        </div>)}
        {hovered && <div className={`chart-tooltip${active < 3 ? ' edge-start' : active > daily.length - 4 ? ' edge-end' : ''}`} style={{ left: `${(active + .5) / daily.length * 100}%` }} role="status">
          <span>{dayLabel(hovered.day)}{active === daily.length - 1 ? ' · en curso' : ''}</span>
          {series.map(([key, label], s) => <div key={key}><i className={`series-${series.length === 1 ? 1 : s}`} /><strong>{number(hovered[key])}</strong>{label}</div>)}
        </div>}
      </div>
    </div>
    <details className="daily-details"><summary>Ver detalle diario</summary><div className="table-scroll"><table>
      <thead><tr><th>Día UTC</th><th>Salas creadas</th><th>Jugadores</th><th>Iniciadas</th><th>Terminadas</th><th>Interrumpidas</th><th>Visitas</th></tr></thead>
      <tbody>{[...daily].reverse().map(row => <tr key={row.day}><td>{dayLabel(row.day)}</td>{['room_created', 'player_joined', 'game_started', 'game_finished', 'game_interrupted', 'visit'].map(key => <td key={key}>{number(row[key])}</td>)}</tr>)}</tbody>
    </table></div></details>
  </Panel>
}

const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
function Weekdays({ daily }) {
  const values = weekdayAverages(daily, 'game_finished')
  const best = Math.max(...values.map(value => value ?? -1))
  const max = Math.max(1, best)
  return <Panel title="Mejor día para jugar" note="Media de partidas terminadas por día de la semana · días completos">
    <div className="weekdays">{values.map((value, i) => <div key={i} className={value === best && best > 0 ? 'is-best' : ''} title={value == null ? `${weekdayNames[i]}: sin días completos en el período` : `${weekdayNames[i]}: ${decimal(value)} partidas de media`}>
      <span className="weekday-value">{decimal(value)}</span>
      <div className="weekday-track"><div style={{ height: `${(value || 0) / max * 100}%` }} /></div>
      <span className="weekday-name">{weekdayNames[i]}</span>
    </div>)}</div>
  </Panel>
}

function Funnel({ totals }) {
  const groups = [
    ['Salas', [['room_created', 'Creadas'], ['group_ready', 'Llegaron a 3 jugadores'], ['room_activated', 'Empezaron a jugar']]],
    ['Partidas', [['game_started', 'Iniciadas'], ['game_finished', 'Llegaron a resultados']]],
  ]
  return <Panel title="Embudo de juego" note="Totales de actividad del período, no una cohorte: una sala de ayer puede jugar hoy.">
    {groups.map(([name, steps]) => <div className="funnel" key={name}><p className="funnel-name">{name}</p>
      {steps.map(([key, label], i) => <div className="funnel-step" key={key}>
        <div className="funnel-label"><span>{label}</span><strong>{number(totals[key])}</strong><small>{i ? percent(ratio(totals[key] || 0, totals[steps[0][0]])) : ''}</small></div>
        <div className="rank-track"><div style={{ width: `${Math.min(100, (ratio(totals[key] || 0, totals[steps[0][0]]) ?? 0) * 100)}%` }} /></div>
      </div>)}
    </div>)}
    <div className="mini-metrics funnel-ratios">
      <div><strong>{decimal(ratio(totals.game_started || 0, totals.room_activated))}</strong><span>Partidas por sala que jugó</span></div>
      <div><strong>{decimal(ratio(totals.player_joined || 0, totals.room_created))}</strong><span>Entradas por sala creada</span></div>
      <div><strong>{percent(ratio(totals.game_repeated || 0, totals.game_started))}</strong><span>Partidas que son revancha</span></div>
    </div>
  </Panel>
}

const ratingNames = { good: 'Bien', okay: 'Regular', bad: 'Mal' }
function Satisfaction({ ratings, before }) {
  const total = ratings.good + ratings.okay + ratings.bad
  const score = ratio(ratings.good, total)
  const previous = before && ratio(before.good, before.good + before.okay + before.bad)
  return <Panel title="Satisfacción" note="Valoraciones al terminar una partida">
    {total ? <>
      <div className="score"><strong>{percent(score)}</strong><span>dicen que fue bien</span><Delta now={score} before={previous} points /></div>
      <div className="segments" role="img" aria-label={Object.entries(ratingNames).map(([key, name]) => `${name}: ${ratings[key]}`).join(', ')}>
        {Object.keys(ratingNames).map(key => ratings[key] > 0 && <div key={key} className={`segment ${key}`} style={{ flexGrow: ratings[key] }} title={`${ratingNames[key]}: ${number(ratings[key])} (${percent(ratings[key] / total)})`}>{ratings[key] / total >= .12 ? percent(ratings[key] / total) : ''}</div>)}
      </div>
      <div className="chart-legend segments-legend">{Object.entries(ratingNames).map(([key, name]) => <span key={key}><i className={`segment ${key}`} />{name} · {number(ratings[key])}</span>)}</div>
    </> : <Empty>Aún no hay valoraciones en este período.</Empty>}
  </Panel>
}

function Invites({ data }) {
  const { totals } = data
  return <Panel title="Invitaciones" note="Cómo se reparte el juego entre amigos. Las acciones del navegador requieren consentimiento.">
    <div className="score"><strong>{percent(ratio(data.invitedJoins, totals.player_joined))}</strong><span>de las entradas a salas llegan por invitación</span></div>
    <div className="mini-metrics invite-metrics">
      <div><strong>{number(totals.share_invite)}</strong><span>Invitaciones compartidas</span></div>
      <div><strong>{number(totals.copy_room_code)}</strong><span>Códigos copiados</span></div>
      <div><strong>{number(totals.qr_opened)}</strong><span>QR mostrados</span></div>
      <div><strong>{number(totals.invite_link_opened)}</strong><span>Enlaces abiertos</span></div>
    </div>
  </Panel>
}

const pathLabel = path => path === '/' ? 'Inicio / juego' : path
function PageRanking({ rows, title, note, label = pathLabel, limit }) {
  const [search, setSearch] = useState('')
  const visible = rows.filter(row => row.path.toLowerCase().includes(search.toLowerCase()))
  const maximum = Math.max(1, ...rows.map(row => row.count))
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return <Panel title={title} note={note}>
    {!limit && rows.length > 8 && <input className="search" aria-label={`Buscar en ${title.toLowerCase()}`} placeholder="Buscar página…" value={search} onChange={e => setSearch(e.target.value)} />}
    {visible.length ? <ol className="ranking">{visible.slice(0, limit).map(row => <li key={row.path}>
      <div><span className="path-label">{label(row.path)}</span><span className="rank-value"><strong>{number(row.count)}</strong><small>{percent(row.count / total)}</small></span></div>
      <div className="rank-track"><div style={{ width: `${row.count / maximum * 100}%` }} /></div>
    </li>)}</ol> : <Empty>{rows.length ? 'No hay páginas que coincidan.' : 'Todavía no hay registros para este período.'}</Empty>}
  </Panel>
}

function Errors({ data }) {
  return <Panel title="Errores y entradas fallidas" note="Navegador y servidor se muestran por separado: un mismo intento puede aparecer en ambos.">
    <div className="mini-metrics"><div><strong>{number(data.clientErrors)}</strong><span>Reportes del navegador</span></div><div><strong>{number(data.serverErrors)}</strong><span>Errores o rechazos del servidor</span></div></div>
    <p className="footnote">Navegador: {number(data.javascriptErrors)} errores de JavaScript, {number(data.disconnections)} desconexiones y {number(data.totals.join_failed)} entradas fallidas. Servidor: {number(data.totals.server_error)} fallos técnicos y {number(data.totals.join_rejected)} rechazos de entrada.</p>
    {data.errors.length ? <div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Motivo</th><th>Diagnóstico</th><th>Eventos</th></tr></thead>
      <tbody>{data.errors.map(row => <tr key={row.key}><td>{errorLabels[row.event]}</td><td>{errorLabels[row.method] || row.method}</td><td>{[row.errorName, row.script && ({ app: 'Aplicación', visit: 'Medición', consent: 'Consentimiento', external: 'Script externo', unknown: 'Origen desconocido' }[row.script]), row.line && `L${row.line}${row.column ? `:${row.column}` : ''}`, row.version].filter(Boolean).join(' · ') || 'Sin detalle histórico'}</td><td>{number(row.count)}</td></tr>)}</tbody>
    </table></div> : <Empty>No hay errores registrados en este período.</Empty>}
    <p className="footnote">Los rechazos de entrada no siempre son fallos técnicos: pueden ser salas llenas o partidas ya iniciadas. Los errores de navegador requieren consentimiento; los reintentos pueden sumar varios eventos.</p>
  </Panel>
}

function Feedback({ items, compact = false }) {
  const [kind, setKind] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const matching = items.filter(item => (kind === 'all' || item.kind === kind) && `${item.comment} ${feedbackLabels[item.topic] || ''}`.toLowerCase().includes(search.toLowerCase()))
  const size = compact ? 3 : 20
  const safePage = Math.min(page, Math.max(0, Math.ceil(matching.length / size) - 1))
  const visible = matching.slice(safePage * size, (safePage + 1) * size)
  return <Panel title={compact ? 'Últimas opiniones' : 'Feedback de los jugadores'} note="Opiniones voluntarias. No contienen atribución, por lo que el filtro de pruebas no se aplica aquí.">
    {!compact && <div className="feedback-controls"><label>Tipo<select value={kind} onChange={e => { setKind(e.target.value); setPage(0) }}><option value="all">Todos los tipos</option>{['rating', 'problem', 'idea', 'words', 'exit'].map(value => <option key={value} value={value}>{feedbackLabels[value]}</option>)}</select></label><label>Buscar<input placeholder="Texto de la opinión…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label></div>}
    {visible.length ? <div className="feedback-list">{visible.map(item => <article className="feedback-item" key={item.id}>
      <div className="feedback-meta"><span className={`tag ${item.rating || ''}`}>{feedbackLabels[item.rating] || feedbackLabels[item.kind] || item.kind}</span>{item.topic && <span>{feedbackLabels[item.topic] || item.topic}</span>}<time dateTime={item.receivedAt}>{stamp(item.receivedAt)} UTC</time></div>
      <p>{item.comment || 'Sin comentario escrito.'}</p>
      <small>{[feedbackLabels[item.kind] || item.kind, item.context?.phase, item.context?.playerCount != null ? `${item.context.playerCount} jugadores` : null, item.context?.category].filter(Boolean).join(' · ')}</small>
    </article>)}</div> : <Empty>{items.length ? 'No hay opiniones que coincidan con los filtros.' : 'Aún no hay opiniones en este período.'}</Empty>}
    {!compact && matching.length > size && <div className="pagination"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Anterior</button><span>{safePage + 1} / {Math.ceil(matching.length / size)}</span><button disabled={(safePage + 1) * size >= matching.length} onClick={() => setPage(safePage + 1)}>Siguiente →</button></div>}
  </Panel>
}

const tabs = [['overview', 'Resumen'], ['traffic', 'Tráfico y páginas'], ['games', 'Partidas y errores'], ['feedback', 'Opiniones']]
const periods = [7, 14, 30]
const sourceLabel = key => key.split(' · ').map((part, i) => i ? part : sourceLabels[part] || part).join(' · ')
function Dashboard({ onExpired }) {
  const [tab, setTab] = useState('overview')
  const [days, setDays] = useState(7)
  const [excludeTests, setExcludeTests] = useState(true)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    // Read the whole retention window once; periods and comparisons are sliced locally.
    api('report?days=30', { signal: controller.signal }).then(setReport).catch(e => {
      if (e.name === 'AbortError') return
      if (e.status === 401) onExpired('La sesión ha caducado. Vuelve a entrar.')
      else setError(e.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  const { data, before } = useMemo(() => {
    if (!report) return {}
    const { current, previous } = splitPeriod(report, days)
    return { data: summarizeReport(current, excludeTests), before: previous && summarizeReport(previous, excludeTests) }
  }, [report, days, excludeTests])
  async function logout() {
    setLoggingOut(true)
    try { await api('logout', { method: 'POST' }); onExpired('') }
    catch (e) { if (e.status === 401) onExpired(''); else setError('No se ha podido cerrar la sesión. Inténtalo de nuevo.') }
    finally { setLoggingOut(false) }
  }
  const totals = data?.totals || {}
  const past = before?.totals
  const trend = key => data.daily.map(row => row[key] || 0)
  const today = data?.daily.at(-1) || {}
  const comparison = before ? `vs. ${days} días anteriores` : null
  const clockWarning = report?.generatedAt && Math.abs(new Date(report.generatedAt).getTime() - Date.now()) > 10 * 60 * 1000
  return <div className="admin-shell">
    <aside className="sidebar"><Logo className="brand" /><p className="sidebar-caption">Administración</p>
      <nav aria-label="Secciones del panel">{tabs.map(([id, label], i) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><span className="nav-number">0{i + 1}</span>{label}{id === 'feedback' && data?.feedback.length > 0 && <span className="nav-count">{data.feedback.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="private-dot">Acceso privado</span><a href="/">Abrir el juego ↗</a><button onClick={logout} disabled={loggingOut}>{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}</button></div>
    </aside>
    <main className="dashboard-main">
      <header className="page-heading"><div><p className="eyebrow">Tu comunidad, de cerca</p><h1>{tabs.find(([id]) => id === tab)[1]}</h1><p>{data ? `${dayLabel(data.daily[0].day)} — ${dayLabel(data.daily.at(-1).day)} · UTC${comparison ? ` · Cambios ${comparison}` : ''}` : 'Actividad de El Impostor'}</p></div><button className="refresh-button" onClick={() => setRefresh(value => value + 1)} disabled={loading}>↻ {loading ? 'Cargando…' : 'Actualizar'}</button></header>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Período">{periods.map(value => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{value} días</button>)}</div>
        <label className="check-label"><input type="checkbox" checked={excludeTests} onChange={e => setExcludeTests(e.target.checked)} />Excluir pruebas identificadas</label>
        {data && <span className="today"><span className="live-dot" />Hoy: <strong>{number(today.game_finished)}</strong> partidas terminadas · <strong>{number(today.player_joined)}</strong> entradas a salas</span>}
        {report?.generatedAt && <span className="updated">Actualizado {stamp(report.generatedAt)} UTC</span>}
      </div>
      {error && <div className="error" role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Reintentar</button></div>}
      {clockWarning && <p className="notice" role="status">El reloj del servidor y el de este dispositivo no coinciden. Las fechas del panel siguen el servidor, en UTC.</p>}
      {!data && loading && <div className="loading-state" role="status"><span className="loading-dot" />Consultando la actividad…</div>}
      {data && <div className={`dashboard-content${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
        {tab === 'overview' && <>
          <div className="metric-grid">
            <Metric label="Partidas terminadas" value={totals.game_finished} before={past?.game_finished} trend={trend('game_finished')} note={comparison || 'Llegaron a resultados'} accent />
            <Metric label="Entradas a salas" value={totals.player_joined} before={past?.player_joined} trend={trend('player_joined')} note={comparison || 'Jugadores que se unieron'} />
            <Metric label="Salas que jugaron" value={totals.room_activated} before={past?.room_activated} trend={trend('room_activated')} note={`de ${number(totals.room_created)} creadas`} />
            <Metric label="Visitas" value={totals.visit} before={past?.visit} trend={trend('visit')} note="Solo con consentimiento" />
            <Metric label="Satisfacción" value={ratio(data.ratings.good, data.ratings.good + data.ratings.okay + data.ratings.bad)} display={percent(ratio(data.ratings.good, data.ratings.good + data.ratings.okay + data.ratings.bad))} before={before && ratio(before.ratings.good, before.ratings.good + before.ratings.okay + before.ratings.bad)} points note={`${number(data.ratings.good + data.ratings.okay + data.ratings.bad)} valoraciones`} />
            <Metric label="Incidencias del navegador" value={data.clientErrors} before={before?.clientErrors} invert trend={trend('client_error')} note="Incluye entradas fallidas" />
          </div>
          <div className="grid-wide"><Trend daily={data.daily} /><Weekdays daily={data.daily} /></div>
          <div className="two-columns"><Funnel totals={totals} /><div className="stack"><Satisfaction ratings={data.ratings} before={before?.ratings} /><Feedback items={data.feedback.filter(item => item.comment)} compact /></div></div>
          <div className="two-columns"><PageRanking rows={data.sources} limit={6} label={sourceLabel} title="De dónde llegan" note="Origen de cada visita: buscadores, otras webs o campañas." /><PageRanking rows={data.pages} limit={6} title="Páginas más vistas" note="Cada carga de página aceptada." /></div>
        </>}
        {tab === 'traffic' && <>
          <div className="metric-grid short">
            <Metric label="Visitas" value={totals.visit} before={past?.visit} trend={trend('visit')} note="Sesiones de pestaña y atribución" accent />
            <Metric label="Vistas de página" value={totals.page_view} before={past?.page_view} trend={trend('page_view')} note="Cargas con medición aceptada" />
            <Metric label="Páginas vistas distintas" value={data.pages.length} before={before?.pages.length} note="Rutas registradas en el período" />
          </div>
          <div className="two-columns"><PageRanking rows={data.sources} label={sourceLabel} title="De dónde llegan" note="Buscadores y otras webs se detectan por la página de origen; las campañas, por sus parámetros UTM." /><Invites data={data} /></div>
          <div className="two-columns"><PageRanking rows={data.pages} title="Páginas visitadas" note="Incluye recargas y navegación entre guías." /><PageRanking rows={data.landings} title="Páginas de entrada" note="Dónde comenzó cada visita." /></div>
          <p className="footnote">Estos datos no cuentan personas únicas ni todas las visitas: requieren consentimiento. El panel de administración está excluido.</p>
        </>}
        {tab === 'games' && <>
          <div className="metric-grid short">
            <Metric label="Partidas iniciadas" value={totals.game_started} before={past?.game_started} trend={trend('game_started')} note="Comenzaron la fase de pistas" />
            <Metric label="Partidas terminadas" value={totals.game_finished} before={past?.game_finished} trend={trend('game_finished')} note="Llegaron a resultados" accent />
            <Metric label="Partidas interrumpidas" value={totals.game_interrupted} before={past?.game_interrupted} invert trend={trend('game_interrupted')} note="Se quedaron sin jugadores conectados" />
          </div>
          <p className="notice">Una interrupción puede recuperarse y terminar después. La diferencia entre iniciadas y terminadas no equivale a partidas fallidas.</p>
          <div className="grid-wide"><Trend daily={data.daily} /><Funnel totals={totals} /></div>
          <Panel title="Más señales de juego" note="Acciones del navegador: requieren consentimiento."><div className="mini-metrics"><div><strong>{number(totals.one_phone_started)}</strong><span>Partidas en un solo móvil</span></div><div><strong>{number(totals.play_again_requested)}</strong><span>Peticiones de revancha</span></div><div><strong>{number(totals.lobby_left)}</strong><span>Salidas de la sala de espera</span></div></div></Panel>
          <Errors data={data} />
          <p className="footnote">Son totales de actividad, no una cohorte de las mismas partidas.</p>
        </>}
        {tab === 'feedback' && <><Satisfaction ratings={data.ratings} before={before?.ratings} /><Feedback items={data.feedback} /></>}
        <footer className="dashboard-footer"><span>El Impostor · Panel privado</span><span>Retención máxima: {report.retentionDays} días · Medición de mejor esfuerzo</span></footer>
      </div>}
    </main>
  </div>
}

function AdminApp() {
  const [state, setState] = useState('checking')
  const [message, setMessage] = useState('')
  useEffect(() => {
    api('session').then(() => setState('ready')).catch(e => {
      setState('login')
      if (e.status !== 401) setMessage(e.message)
    })
  }, [])
  if (state === 'checking') return <main className="loading-state" role="status">Comprobando el acceso privado…</main>
  if (state === 'login') return <Login message={message} onLogin={() => { setMessage(''); setState('ready') }} />
  return <Dashboard onExpired={text => { setMessage(text); setState('login') }} />
}

createRoot(document.getElementById('root')).render(<AdminApp />)
