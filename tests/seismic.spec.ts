import { expect, test } from '@playwright/test'

test('el canal del IGN muestra observaciones y conserva su copia sin conexión', async ({ context, page }) => {
  const detail = 'www.ign.es/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto?evid=es2026prueba'
  await context.route('**/api/avisos/granada', route => route.fulfill({ status: 502 }))
  await context.route('**/api/sismos/ign', route => route.fulfill({
    contentType: 'application/xml',
    body: `<rss version="2.0"><channel><title>GeoRSS Sismología IGN</title><item>
      <description>Registro sísmico de prueba</description><link>http://${detail}</link>
      </item></channel></rss>`,
  }))
  await page.goto('/#alertas')
  await page.getByText('Sismos recientes · Instituto Geográfico Nacional').click()
  await expect(page.getByText('Registro sísmico de prueba')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ficha del IGN · es2026prueba' })).toHaveAttribute('href', 'https://' + detail)
  await expect(page.getByText('Registros de la última consulta al IGN.')).toBeVisible()

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await page.getByText('Sismos recientes · Instituto Geográfico Nacional').click()
  await expect(page.getByText('Sin conexión con el IGN.')).toBeVisible()
  await expect(page.getByText('Copia guardada del IGN.')).toBeVisible()
  await expect(page.getByText('Registro sísmico de prueba')).toBeVisible()
})
