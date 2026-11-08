import { chromium, expect, test } from '@playwright/test'

test('el kit móvil conserva los cambios al cerrar y reabrir el navegador', async ({ baseURL }, testInfo) => {
  const profile = testInfo.outputPath('profile')
  const options = { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, baseURL }
  let context = await chromium.launchPersistentContext(profile, options)
  try {
    let page = await context.newPage()
    await page.goto('/')
    await page.getByRole('link', { name: 'Abrir mi lista' }).click()
    await expect(page.getByRole('heading', { name: 'Mi kit de 72 horas' })).toBeFocused()

    await page.getByLabel('Nuevo elemento').fill('Cargador de prueba')
    await page.getByRole('button', { name: 'Añadir' }).click()
    await page.getByLabel('Estado de Cargador de prueba').selectOption('disponible')
    await page.getByRole('button', { name: 'Disponible', exact: true }).click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('listitem')).toContainText('Cargador de prueba')

    await page.getByText('Configurar hogar y reserva de agua').click()
    await page.getByLabel('Personas en el hogar').fill('3')
    await page.getByRole('button', { name: 'Guardar hogar' }).click()
    await expect(page.getByText('18 litros', { exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Datos guardados en este dispositivo' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)

    await context.close()
    context = await chromium.launchPersistentContext(profile, options)
    page = await context.newPage()
    await page.goto('/')
    const summary = page.getByRole('region', { name: 'Tu kit de emergencia' })
    await expect(summary.getByText('1 de 9 elementos disponibles')).toBeVisible()
    await page.getByRole('link', { name: 'Continuar mi lista' }).click()
    await expect(page.getByLabel('Estado de Cargador de prueba')).toHaveValue('disponible')
    await page.getByText('Configurar hogar y reserva de agua').click()
    await expect(page.getByLabel('Personas en el hogar')).toHaveValue('3')
  } finally {
    await context.close()
  }
})

test('la navegación de escritorio permite buscar, descargar y volver a una herramienta', async ({ page }) => {
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
  await navigation.getByRole('link', { name: 'Guías' }).click()
  await expect(navigation.getByRole('link', { name: 'Guías' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('searchbox', { name: 'Buscar por tema' }).fill('frio')
  await expect(page.getByText('1 guía', { exact: true })).toBeVisible()
  await page.getByText('Ola de frío', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Protección Civil y Emergencias' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar todas las guías' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('resilience72-guias.txt')

  await navigation.getByRole('link', { name: 'Herramientas' }).click()
  await page.getByRole('link', { name: 'Calcular energía' }).click()
  await expect(page.getByText('37,0 Wh', { exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Herramientas' })).toHaveAttribute('aria-current', 'location')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Herramientas' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Guías de emergencia' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Buscar por tema' })).toHaveValue('frio')
})
