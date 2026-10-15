import { test, expect } from '@playwright/test'

test('a group shares one phone: private reveals, play, reveal impostor and repeat', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click()
  await page.getByRole('button', { name: 'Jugar con un solo móvil' }).click()
  await expect(page).toHaveURL(/modo=un-movil/)

  await page.getByRole('button', { name: 'Reducir jugadores' }).click()
  await expect(page.getByLabel('Jugadores', { exact: true })).toHaveText('3')
  const names = ['Ana', 'Bruno', 'Clara']
  for (const [i, name] of names.entries()) await page.getByLabel(`Nombre del jugador ${i + 1}`).fill(name)
  await page.getByRole('button', { name: /Categorías/ }).click()
  await page.getByRole('dialog', { name: 'Categorías' }).getByRole('button', { name: 'Animales' }).click()
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.screenshot({ path: testInfo.outputPath('setup-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Repartir palabras →' }).click()

  const roles = []
  for (const [i, name] of names.entries()) {
    await expect(page.getByText('Pasa el móvil a')).toBeVisible()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText(`${i + 1} de 3`)).toBeVisible()
    if (!i) await page.screenshot({ path: testInfo.outputPath('pass-mobile.png') })
    await page.getByRole('button', { name: `Soy ${name}: ver mi palabra` }).click()
    const kicker = await page.locator('.reveal-kicker').textContent()
    roles.push({ name, impostor: kicker === 'Eres el', secret: await page.locator('.one-phone-secret').textContent() })
    if (!i) await page.screenshot({ path: testInfo.outputPath('secret-mobile.png') })
    await page.getByRole('button', { name: i < 2 ? 'Ocultar y pasar el móvil' : 'Ocultar' }).click()
  }
  const impostors = roles.filter(role => role.impostor)
  expect(impostors).toHaveLength(1)
  const crew = roles.filter(role => !role.impostor)
  expect(crew[0].secret).toBe(crew[1].secret)

  await expect(page.getByRole('heading', { name: /^Empieza (Ana|Bruno|Clara)$/ })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText(/^[12]:\d\d$/)
  await page.screenshot({ path: testInfo.outputPath('play-mobile.png'), fullPage: true })

  // A forgotten word can be checked again without restarting the round.
  await page.getByText('¿Alguien olvidó su palabra?').click()
  await page.getByRole('button', { name: 'Bruno', exact: true }).click()
  await page.getByRole('button', { name: 'Soy Bruno: ver mi palabra' }).click()
  await page.getByRole('button', { name: 'Ocultar', exact: true }).click()

  await page.getByRole('button', { name: 'Revelar impostor' }).click()
  await expect(page.getByRole('heading', { name: `¡Era ${impostors[0].name}!` })).toBeVisible()
  await expect(page.locator('.result-word')).toContainText(crew[0].secret, { ignoreCase: true })
  await page.screenshot({ path: testInfo.outputPath('result-mobile.png'), fullPage: true })

  await page.getByRole('button', { name: '↻ Otra partida' }).click()
  await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible()
  await expect(page.getByText('1 de 3')).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: testInfo.outputPath('pass-desktop.png') })
  await page.getByRole('button', { name: 'Volver a la configuración' }).click()
  await expect(page.getByLabel('Nombre del jugador 3')).toHaveValue('Clara')
  await page.screenshot({ path: testInfo.outputPath('setup-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '← Volver' }).click()
  await expect(page.getByRole('button', { name: 'Jugar con un solo móvil' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png') })
  expect(errors).toEqual([])
})
