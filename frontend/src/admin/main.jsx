import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { summarizeReport, errorLabels, feedbackLabels } from './report.js'
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
    <a className="login-brand" href="/">el impostor<span>●</span></a>
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

function Metric({ label, value, note, accent = false }) {
  return <article className={`metric${accent ? ' metric-accent' : ''}`}><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></article>
}
function Empty({ children }) { return <p className="empty">{children}</p> }
function Panel({ title, note, children, className = '' }) {
  return <section className={`panel ${className}`}><header className="panel-heading"><h2>{title}</h2>{note && <p>{note}</p>}</header>{children}</section>
}

function Trend({ daily }) {
  const max = Math.max(1, ...daily.flatMap(row => [row.game_started || 0, row.game_finished || 0]))
  return <Panel title="Partidas a lo largo del tiempo" note="Actividad diaria · UTC · El último día está en curso">
    <div className="chart-legend"><span><i className="started" />Iniciadas</span><span><i className="finished" />Terminadas</span></div>
    <div className="trend" role="img" aria-label="Partidas iniciadas y terminadas por día. Valores exactos en Ver detalle diario.">
      <div className="chart-scale"><span>{number(max)}</span><span>{number(max / 2)}</span><span>0</span></div>
      <div className="chart-bars">{daily.map((row, i) => <div className="day-column" key={row.day}>
        <div className="bar-pair" title={`${dayLabel(row.day)}: ${row.game_started || 0} iniciadas, ${row.game_finished || 0} terminadas`}>
          <div className="bar started" style={{ height: `${(row.game_started || 0) / max * 100}%` }} />
          <div className="bar finished" style={{ height: `${(row.game_finished || 0) / max * 100}%` }} />
        </div>
        <span className="day-tick">{i === 0 || i === daily.length - 1 || (i % Math.ceil(daily.length / 4) === 0 && i < daily.length - 3) ? dayLabel(row.day) : ''}</span>
      </div>)}</div>
    </div>
    <details className="daily-details"><summary>Ver detalle diario</summary><div className="table-scroll"><table>
      <thead><tr><th>Día UTC</th><th>Iniciadas</th><th>Terminadas</th><th>Interrumpidas</th></tr></thead>
      <tbody>{daily.map(row => <tr key={row.day}><td>{dayLabel(row.day)}</td><td>{row.game_started || 0}</td><td>{row.game_finished || 0}</td><td>{row.game_interrupted || 0}</td></tr>)}</tbody>
    </table></div></details>
  </Panel>
}

function PageRanking({ rows, title, note }) {
  const [search, setSearch] = useState('')
  const visible = rows.filter(row => row.path.toLowerCase().includes(search.toLowerCase()))
  const maximum = Math.max(1, ...rows.map(row => row.count))
  return <Panel title={title} note={note}>
    {rows.length > 8 && <input className="search" aria-label={`Buscar en ${title.toLowerCase()}`} placeholder="Buscar página…" value={search} onChange={e => setSearch(e.target.value)} />}
    {visible.length ? <ol className="ranking">{visible.map(row => <li key={row.path}>
      <div><span className="path-label">{row.path === '/' ? 'Inicio / juego' : row.path}</span><strong>{number(row.count)}</strong></div>
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

const tabs = [['overview', 'Resumen'], ['pages', 'Páginas'], ['games', 'Partidas y errores'], ['feedback', 'Opiniones']]
function Dashboard({ onExpired }) {
  const [tab, setTab] = useState('overview')
  const [days, setDays] = useState(30)
  const [excludeTests, setExcludeTests] = useState(true)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setReport(null)
    api(`report?days=${days}`, { signal: controller.signal }).then(setReport).catch(e => {
      if (e.name === 'AbortError') return
      if (e.status === 401) onExpired('La sesión ha caducado. Vuelve a entrar.')
      else setError(e.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [days, refresh])
  const data = useMemo(() => report ? summarizeReport(report, excludeTests) : null, [report, excludeTests])
  async function logout() {
    setLoggingOut(true)
    try { await api('logout', { method: 'POST' }); onExpired('') }
    catch (e) { if (e.status === 401) onExpired(''); else setError('No se ha podido cerrar la sesión. Inténtalo de nuevo.') }
    finally { setLoggingOut(false) }
  }
  const totals = data?.totals || {}
  const clockWarning = report?.generatedAt && Math.abs(new Date(report.generatedAt).getTime() - Date.now()) > 10 * 60 * 1000
  return <div className="admin-shell">
    <aside className="sidebar"><a className="brand" href="/">el impostor<span>●</span></a><p className="sidebar-caption">Administración</p>
      <nav aria-label="Secciones del panel">{tabs.map(([id, label], i) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><span className="nav-number">0{i + 1}</span>{label}{id === 'feedback' && data?.feedback.length > 0 && <span className="nav-count">{data.feedback.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="private-dot">Acceso privado</span><a href="/">Abrir el juego ↗</a><button onClick={logout} disabled={loggingOut}>{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}</button></div>
    </aside>
    <main className="dashboard-main">
      <header className="page-heading"><div><p className="eyebrow">Tu comunidad, de cerca</p><h1>{tabs.find(([id]) => id === tab)[1]}</h1><p>{report ? `${dayLabel(data.daily[0].day)} — ${dayLabel(data.daily.at(-1).day)} · UTC` : 'Actividad de El Impostor'}</p></div><button className="refresh-button" onClick={() => setRefresh(value => value + 1)} disabled={loading}>↻ {loading ? 'Cargando…' : 'Actualizar'}</button></header>
      <div className="toolbar"><label>Período<select value={days} onChange={e => setDays(Number(e.target.value))}><option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option><option value="30">Últimos 30 días</option></select></label><label className="check-label"><input type="checkbox" checked={excludeTests} onChange={e => setExcludeTests(e.target.checked)} />Excluir pruebas identificadas</label>{report?.generatedAt && <span className="updated">Actualizado {stamp(report.generatedAt)} UTC</span>}</div>
      {error && <div className="error" role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Reintentar</button></div>}
      {clockWarning && <p className="notice" role="status">El reloj del servidor y el de este dispositivo no coinciden. Las fechas del panel siguen el servidor, en UTC.</p>}
      {loading && <div className="loading-state" role="status"><span className="loading-dot" />Consultando la actividad…</div>}
      {!loading && data && <>
        {tab === 'overview' && <>
          <div className="metric-grid"><Metric label="Partidas terminadas" value={totals.game_finished} note="Llegaron a resultados" accent /><Metric label="Partidas iniciadas" value={totals.game_started} note="Incluye repeticiones" /><Metric label="Salas creadas" value={totals.room_created} note={`${number(totals.room_activated)} llegaron a jugar`} /><Metric label="Vistas de página" value={totals.page_view} note="Solo con consentimiento" /><Metric label="Incidencias del navegador" value={data.clientErrors} note="Incluye entradas fallidas" /><Metric label="Opiniones" value={data.feedback.length} note="Todas las respuestas del período" /></div>
          <Trend daily={data.daily} />
          <div className="two-columns"><PageRanking rows={data.pages.slice(0, 8)} title="Páginas más vistas" note="Cada carga de página aceptada. Disponible desde la publicación del panel." /><Feedback items={data.feedback} compact /></div>
        </>}
        {tab === 'pages' && <>
          <div className="metric-grid short"><Metric label="Vistas de página" value={totals.page_view} note="Cargas con medición aceptada" accent /><Metric label="Visitas de entrada" value={totals.visit} note="Sesiones de pestaña y atribución" /><Metric label="Páginas vistas distintas" value={data.pages.length} note="Rutas registradas en el período" /></div>
          <div className="two-columns"><PageRanking rows={data.pages} title="Páginas visitadas" note="Incluye recargas y navegación entre guías. Medición nueva desde la publicación del panel." /><PageRanking rows={data.landings} title="Páginas de entrada" note="Dónde comenzó cada visita. Histórico disponible desde la activación de la medición." /></div>
          <p className="footnote">Estos datos no cuentan personas únicas ni todas las visitas: requieren consentimiento. El panel de administración está excluido.</p>
        </>}
        {tab === 'games' && <>
          <div className="metric-grid short"><Metric label="Partidas iniciadas" value={totals.game_started} note="Comenzaron la fase de pistas" /><Metric label="Partidas terminadas" value={totals.game_finished} note="Llegaron a resultados" accent /><Metric label="Partidas interrumpidas" value={totals.game_interrupted} note="Se quedaron sin jugadores conectados" /></div>
          <p className="notice">Una interrupción puede recuperarse y terminar después. Se registra una vez por partida desde la publicación del panel. La diferencia entre iniciadas y terminadas no equivale a partidas fallidas.</p>
          <div className="panel mini-metrics"><div><strong>{number(totals.group_ready)}</strong><span>Salas con 3 jugadores</span></div><div><strong>{number(totals.room_activated)}</strong><span>Salas que empezaron a jugar</span></div><div><strong>{number(totals.game_repeated)}</strong><span>Partidas de repetición</span></div></div>
          <Trend daily={data.daily} /><Errors data={data} />
          <p className="footnote">Son totales de actividad, no una cohorte de las mismas partidas. Los errores de servidor, las desconexiones y los errores JavaScript se recogen desde la publicación del panel; los fallos de crear o entrar ya tenían medición con consentimiento.</p>
        </>}
        {tab === 'feedback' && <Feedback items={data.feedback} />}
        <footer className="dashboard-footer"><span>El Impostor · Panel privado</span><span>Retención máxima: {report.retentionDays} días · Medición de mejor esfuerzo</span></footer>
      </>}
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
