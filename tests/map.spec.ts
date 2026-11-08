import { expect, test } from '@playwright/test'

const capFile = 'Z_CAP_C_LEMM_20261108100503_AFAZ611801PRP10818.xml'
const capLink = 'https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/cap/' + capFile

test('abre por primera vez el mapa municipal sin red en un móvil estrecho', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await expect(page.getByText('Lista para usar sin conexión', { exact: true })).toBeVisible()
  await context.setOffline(true)

  const offline = await context.newPage()
  await offline.setViewportSize({ width: 320, height: 700 })
  await offline.goto('/#mapa')
  const map = offline.getByRole('region', { name: 'Mapa interactivo de Granada' })
  await expect(map).toBeVisible()
  await expect(map.locator('path')).toHaveCount(174)
  await expect(offline.getByText('Sin consulta de AEMET disponible.')).toBeVisible()
  await expect(offline.getByText('Sin conexión. El estado actual de las capas no se puede comprobar.')).toBeVisible()
  await offline.getByLabel('Municipio').selectOption({ label: 'Motril' })
  await expect(offline.getByLabel('Municipio').locator('option:checked')).toHaveText('Motril')
  await offline.getByRole('button', { name: 'Ver provincia' }).click()
  await expect(offline.getByLabel('Municipio')).toHaveValue('')
  expect(await offline.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('dibuja geometrías oficiales de prueba y las identifica como copias al perder la red', async ({ context, page }) => {
  const now = new Date().toISOString()
  const end = new Date(Date.now() + 3600_000).toISOString()
  const xml = (body: string) => ({ contentType: 'application/xml', body })
  await context.route('**/api/avisos/granada', route => route.fulfill(xml(`<feed xmlns="http://www.w3.org/2005/Atom">
    <title>AEMET - Avisos de fenómenos meteorológicos adversos - Granada</title><updated>${now}</updated>
    <entry><link href="${capLink}"/></entry></feed>`)))
  await context.route('**/api/avisos/granada/' + capFile, route => route.fulfill(xml(`<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>mapa-de-prueba</identifier><sent>${now}</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope>
    <info><language>es-ES</language><category>Met</category><headline>Aviso de prueba</headline>
    <onset>${now}</onset><expires>${end}</expires><area><areaDesc>Cuenca del Genil</areaDesc>
    <polygon>37.1,-3.7 37.3,-3.6 37.15,-3.5 37.1,-3.7</polygon></area></info></alert>`)))
  await context.route('**/api/sismos/ign', route => route.fulfill(xml(`<rss xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
    <channel><title>GeoRSS Sismología IGN</title><item><description>Sismo de prueba</description>
    <link>http://www.ign.es/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto?evid=es2026mapa</link>
    <geo:lat>37.14</geo:lat><geo:long>-3.61</geo:long></item></channel></rss>`)))

  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 37.18, longitude: -3.60 })
  await page.goto('/#mapa')
  await expect(page.locator('.aemet-area')).toHaveCount(1)
  await expect(page.locator('.ign-epicenter')).toHaveCount(1)
  await page.getByRole('button', { name: 'Ver zona de Cuenca del Genil' }).click()
  await page.getByRole('button', { name: 'Ver epicentro es2026mapa' }).click()
  await page.getByRole('button', { name: 'Mi ubicación' }).click()
  await expect(page.getByText('Ubicación mostrada en esta sesión.')).toBeVisible()

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.aemet-area')).toHaveAttribute('stroke-dasharray', '5 5')
  await expect(page.locator('.ign-epicenter')).toHaveCount(1)
  await expect(page.getByText('Copia de la última consulta, sin confirmar.', { exact: false })).toBeVisible()
  await expect(page.getByText('Copia guardada del IGN.', { exact: false })).toBeVisible()
  await expect(page.getByText('Ubicación mostrada en esta sesión.')).toHaveCount(0)
})
