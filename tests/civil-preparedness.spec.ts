import { expect, test } from '@playwright/test'

test('las guías civiles y el kit de 14 días funcionan sin red', async ({ context, page }) => {
  await page.goto('/')
  await expect(page.getByText('Copia preparada', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('link', { name: 'Qué hago ahora' }).click()
  await page.getByRole('button', { name: 'Emergencia nacional · 72 horas', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Instrucciones por situación' })
  await expect(panel.getByText('Qué tener para tres días', { exact: true })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Protección Civil · ES-Alert' })).toBeVisible()
  await page.getByRole('button', { name: 'Conflicto armado · Preparación prolongada', exact: true }).click()
  await expect(panel.getByText('Qué preparar para más días', { exact: true })).toBeVisible()
  await expect(panel.getByRole('link', { name: /MCF/ })).toBeVisible()
  await panel.getByRole('link', { name: 'Preparar mi kit' }).click()
  await page.getByText('Configurar hogar y reserva de agua').click()
  await page.getByLabel('Personas en el hogar').fill('2')
  await page.getByLabel('Periodo de preparación').selectOption('14')
  await page.getByRole('button', { name: 'Guardar hogar' }).click()
  await expect(page.getByText('56 litros', { exact: true })).toBeVisible()

  await page.getByText('Sugerencias para ampliar el kit').click()
  const add = page.getByRole('button', { name: 'Añadir sugerencias que faltan' })
  await add.click()
  await expect(add).toBeDisabled()
  await expect(page.getByText('Datos guardados en este dispositivo', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Mi kit · 14 días', exact: true })).toBeVisible()
  await page.getByText('Configurar hogar y reserva de agua').click()
  await expect(page.getByLabel('Periodo de preparación')).toHaveValue('14')
  await expect(page.getByText('56 litros', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Estado de Dinero en efectivo')).toHaveValue('necesario')
})

test('Noticias ONU guarda la copia y avisa solo de novedades posteriores a activar los avisos', async ({ context, page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    // Simulamos el permiso y registramos la llamada sin mostrar un aviso real del sistema.
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' })
    Object.defineProperty(ServiceWorkerRegistration.prototype, 'showNotification', {
      configurable: true,
      value: async (title: string, options: NotificationOptions) => {
        sessionStorage.setItem('test:notificacion', JSON.stringify({ title, ...options }))
      },
    })
  })
  let fresh = false
  const endpoint = '/api/internacional/onu'
  const today = new Date().toUTCString()
  const item = (id: string, title: string) => `<item><title>${title}</title><pubDate>${today}</pubDate>
    <link>https://news.un.org/feed/view/es/story/2026/11/${id}</link></item>`
  await context.route('**' + endpoint, route => route.fulfill({
    contentType: 'application/rss+xml',
    body: `<rss version="2.0"><channel><title>Noticias ONU - Mirada global Historias humanas</title><language>es</language>
      ${fresh ? item('1542002', 'Novedad internacional de prueba') : ''}
      ${item('1542001', 'Publicación anterior de prueba')}</channel></rss>`,
  }))

  await page.goto('/')
  await expect(page.getByText('Copia preparada', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Herramientas' }).click()
  await page.getByRole('link', { name: 'Información internacional' }).click()
  await expect(page.getByRole('link', { name: 'Publicación anterior de prueba' }))
    .toHaveAttribute('href', 'https://news.un.org/es/story/2026/11/1542001')
  const setting = page.getByRole('button', { name: 'Avisos en la app' })
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith(endpoint)),
    setting.click(),
  ])
  await expect(setting).toHaveAttribute('aria-pressed', 'true')
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith(endpoint)),
    page.getByRole('link', { name: 'Inicio', exact: true }).click(),
  ])
  await expect(page.getByRole('link', { name: 'Ver novedades' })).toHaveCount(0)

  fresh = true
  await page.clock.fastForward(5 * 60_000)
  await expect(page.getByText('Una publicación nueva de Noticias ONU')).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('test:notificacion') ?? ''))
    .toContain('Novedad internacional de prueba')
  await page.getByRole('link', { name: 'Ver novedades' }).click()
  await expect(page.getByRole('link', { name: 'Novedad internacional de prueba' })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Copia de la última consulta válida.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Novedad internacional de prueba' })).toBeVisible()
  await expect(setting).toHaveAttribute('aria-pressed', 'true')
})
