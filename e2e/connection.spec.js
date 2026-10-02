import { test, expect } from '@playwright/test'

async function createRoom(page) {
  await page.goto('/?create=1')
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click()
  await page.getByLabel('Tu nombre', { exact: true }).fill('Ana')
  await page.getByRole('button', { name: 'Crear sala →', exact: true }).click()
  await expect(page.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
}

test('a duplicate tab takes over once without an automatic reconnection fight', async ({ page, context }) => {
  let firstConnections = 0
  page.on('websocket', ws => { if (ws.url().includes('/rooms/')) firstConnections++ })
  await createRoom(page)
  const saved = await page.evaluate(() => ({ ...sessionStorage }))
  const duplicate = await context.newPage()
  await duplicate.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value)
  }, saved)
  await duplicate.goto(page.url())
  await expect(duplicate.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('otra pestaña')
  // Several old 300ms retries would have happened within this window.
  await page.waitForTimeout(1400)
  expect(firstConnections).toBe(1)
  await expect(duplicate.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
  await page.getByRole('button', { name: 'Reintentar conexión' }).click()
  await expect(page.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
  await expect(duplicate.getByRole('alert')).toContainText('otra pestaña')
  await duplicate.close()
})

test('a backgrounded mobile tab gives its heartbeat time to recover on return', async ({ page }) => {
  let connections = 0
  let suspended = false
  await page.routeWebSocket('**/rooms/*/ws', ws => {
    const server = ws.connectToServer()
    server.onMessage(message => { if (!suspended) ws.send(message) })
  })
  page.on('websocket', ws => { if (ws.url().includes('/rooms/')) connections++ })
  await page.clock.install()
  await createRoom(page)
  suspended = true
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }))
  await page.clock.fastForward(45000)
  suspended = false
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(1000)
  expect(connections).toBe(1)
  await expect(page.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
})

test('reconnection waits offline and resumes with the same player when online', async ({ page }) => {
  let socket, connections = 0
  await page.routeWebSocket('**/rooms/*/ws', ws => {
    socket = ws
    connections++
    ws.connectToServer()
  })
  await createRoom(page)
  const playerId = await page.evaluate(() => sessionStorage.getItem('el-impostor-player-id'))
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }))
  await socket.close({ code: 1012, reason: 'restart' })
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
  expect(connections).toBe(1)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
  })
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
  expect(connections).toBe(2)
  expect(await page.evaluate(() => sessionStorage.getItem('el-impostor-player-id'))).toBe(playerId)
  await expect(page.getByRole('region', { name: 'El grupo', exact: true })).toContainText('1 / 8')
})
