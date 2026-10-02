// Fixed-origin, same-site proxy. Authentication and authorization live in the Worker.
// No report key or password is embedded in Pages assets or returned to the browser.
const WORKER = 'https://el-impostor-worker-production.jvallejoarguez.workers.dev'
export async function onRequest({ request }) {
  const url = new URL(request.url)
  if (!/^\/admin-panel\/api\/(login|logout|session|report)$/.test(url.pathname)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  const headers = new Headers()
  for (const name of ['Content-Type', 'Cookie', 'Origin', 'CF-Connecting-IP']) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name))
  }
  try {
    const response = await fetch(`${WORKER}${url.pathname}${url.search}`, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    })
    const safe = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' })
    for (const name of ['Set-Cookie', 'Retry-After']) if (response.headers.has(name)) safe.set(name, response.headers.get(name))
    return new Response(response.body, { status: response.status, headers: safe })
  } catch {
    return Response.json({ error: 'No se ha podido conectar con el panel.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
