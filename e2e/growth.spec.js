import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const headers = { Authorization: 'Bearer local-browser-test-only-key-32-characters' }
const report = async request => {
  const response = await request.get('http://localhost:8787/insights/report?days=1', { headers })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

test('three real players invite, finish, give feedback and repeat; counts survive reload', async ({ browser, request }, testInfo) => {
  const campaign = `test_${Date.now()}`
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })))
  const pages = await Promise.all(contexts.map(context => context.newPage()))
  const errors = []
  for (const page of pages) page.on('pageerror', error => errors.push(error.message))
  const [host, guest, third] = pages
  try {
    await host.goto(`/?utm_source=instagram&utm_medium=organic_social&utm_campaign=${campaign}`)
    await host.getByRole('button', { name: 'Crear sala', exact: false }).click()
    await host.getByLabel('Tu nombre', { exact: true }).fill('Ana')
    await host.getByRole('button', { name: 'Crear sala →', exact: true }).click()
    await expect(host.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
    await host.getByRole('button', { name: '＋ Invitar / QR' }).click()
    const dialog = host.getByRole('dialog', { name: 'Invita a tu grupo' })
    await expect(dialog.locator('svg')).toBeVisible()
    const inviteUrl = await dialog.getByLabel('Enlace de invitación').inputValue()
    const code = new URL(inviteUrl).searchParams.get('room')
    expect(code).toMatch(/^[A-Z0-9]{4}$/)
    expect(await dialog.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toContain('Nos%20faltan%202')
    await host.screenshot({ path: testInfo.outputPath('invite-mobile.png'), fullPage: true })
    await host.keyboard.press('Escape')
    await host.getByRole('button', { name: 'Reducir Rondas antes de votar' }).click()
    for (const [page, name] of [[guest, 'Bruno'], [third, 'Clara']]) {
      await page.goto(inviteUrl)
      await expect(page.getByLabel('Código de sala')).toHaveValue(code)
      await page.getByLabel('Tu nombre', { exact: true }).fill(name)
      await page.getByRole('button', { name: 'Entrar a la sala →' }).click()
      await page.getByRole('button', { name: 'Estoy listo →' }).click()
    }
    await host.getByRole('button', { name: 'Empezar partida →' }).click()
    for (const [page, clue] of [[host, 'Sabana'], [guest, 'Melena'], [third, 'Corona']]) {
      await page.getByLabel('Tu pista').fill(clue, { timeout: 20000 })
      await page.getByLabel('Tu pista').press('Enter')
    }
    await expect(host.getByRole('button', { name: 'Votar a Ana', exact: true })).toBeVisible({ timeout: 10000 })
    for (const page of pages) {
      await page.getByRole('button', { name: 'Votar a Ana', exact: true }).click()
      await page.getByRole('button', { name: 'Confirmar voto →' }).click()
    }
    await expect(host.getByRole('button', { name: '↻ Otra partida' })).toBeVisible()
    await host.getByRole('button', { name: '😐 Regular', exact: true }).click()
    await host.getByLabel('¿Qué mejorarías? (opcional)').selectOption('connection')
    await host.getByLabel('Cuéntanos un poco más (opcional)').fill(`Prueba real ${campaign}`)
    await host.getByRole('button', { name: 'Enviar opinión' }).click()
    await expect(host.getByText('¡Gracias por contárnoslo!')).toBeVisible()
    await host.getByRole('button', { name: 'Volver al juego' }).click()
    await host.screenshot({ path: testInfo.outputPath('results-mobile.png'), fullPage: true })
    await host.reload()
    await expect(host.getByRole('button', { name: '↻ Otra partida' })).toBeVisible()
    await expect(host.getByRole('button', { name: '😐 Regular', exact: true })).toHaveCount(0)
    await host.getByRole('button', { name: '↻ Otra partida' }).click()
    for (const page of [guest, third]) await page.getByRole('button', { name: 'Estoy listo →' }).click()
    await host.getByRole('button', { name: 'Empezar partida →' }).click()
    await expect(host.getByLabel('Tu pista')).toBeVisible({ timeout: 20000 })
    const expected = { room_created: 1, group_ready: 1, room_activated: 1, game_started: 2, game_finished: 1, game_repeated: 1 }
    await expect.poll(async () => {
      const data = await report(request)
      return Object.fromEntries(Object.keys(expected).map(event => [event, data.reports[0].counters.filter(row => row.campaign === campaign && row.event === event).reduce((sum, row) => sum + row.count, 0)]))
    }).toEqual(expected)
    const data = await report(request)
    expect(data.reports[0].feedback.filter(item => item.comment === `Prueba real ${campaign}`)).toHaveLength(1)
    const { stdout } = await promisify(execFile)(process.execPath, ['scripts/insights-report.mjs', '1'], { env: { ...process.env, INSIGHTS_URL: 'http://localhost:8787', INSIGHTS_READ_TOKEN: headers.Authorization.slice(7) } })
    expect(stdout).toContain(`Prueba real ${campaign}`)
    expect(stdout).toContain('Partidas terminadas')
    // Complete the repeat to check the guest-to-host action in its real result screen.
    for (const [page, clue] of [[host, 'Una'], [guest, 'Segunda'], [third, 'Partida']]) {
      await page.getByLabel('Tu pista').fill(clue)
      await page.getByLabel('Tu pista').press('Enter')
    }
    for (const page of pages) {
      await page.getByRole('button', { name: 'Votar a Ana', exact: true }).click()
      await page.getByRole('button', { name: 'Confirmar voto →' }).click()
    }
    await guest.getByRole('button', { name: 'Jugar con otro grupo →' }).click()
    await expect(guest.getByLabel('Tu nombre', { exact: true })).toHaveValue('Bruno')
    await guest.getByRole('button', { name: 'Crear sala →', exact: true }).click()
    await expect(guest.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
    expect(new URL(guest.url()).searchParams.get('room')).not.toBe(code)
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('leaving the first lobby offers optional feedback with the previous room context', async ({ page, request }) => {
  await page.goto('/?category=animales')
  await page.getByLabel('Tu nombre', { exact: true }).fill('Diego')
  await page.getByRole('button', { name: 'Crear sala →', exact: true }).click()
  await expect(page.getByRole('button', { name: '＋ Invitar / QR' })).toBeVisible()
  await page.clock.setFixedTime(new Date(Date.now() + 25000))
  await page.getByRole('button', { name: 'Salir de la sala', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Crear sala', exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Responder en 10 segundos' }).click()
  await page.getByLabel('El motivo principal').selectOption('missing_players')
  await page.getByRole('button', { name: 'Enviar opinión' }).click()
  await expect(page.getByText('¡Gracias por contárnoslo!')).toBeVisible()
  const data = await report(request)
  expect(data.reports[0].feedback.some(item => item.kind === 'exit' && item.topic === 'missing_players' && item.context.phase === 'lobby' && item.context.playerCount === 1 && item.context.category === 'animales')).toBe(true)
})

test('feedback retries preserve text, dialog fits desktop and mobile, privacy opt-out works', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '¿Algo falla o tienes una idea?' }).click()
  await page.getByLabel('Cuéntanos un poco más (opcional)').fill('Mi comentario de prueba')
  await page.route('**/feedback', route => route.fulfill({ status: 503, body: '{}' }))
  await page.getByRole('button', { name: 'Enviar opinión' }).click()
  await expect(page.getByRole('alert')).toContainText('Tu respuesta sigue aquí')
  await expect(page.getByLabel('Cuéntanos un poco más (opcional)')).toHaveValue('Mi comentario de prueba')
  await page.screenshot({ path: testInfo.outputPath('feedback-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('feedback-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Datos y privacidad', exact: true }).click()
  await page.getByRole('checkbox').uncheck()
  expect(await page.evaluate(() => localStorage.getItem('el-impostor-measurement'))).toBe('off')
  await page.keyboard.press('Escape')
  let events = 0
  await page.route('**/events', route => { events++; return route.fulfill({ status: 200, body: '{}' }) })
  await page.getByRole('button', { name: 'Crear sala', exact: false }).click()
  await page.reload()
  expect(events).toBe(0)
})
