import { expect, test } from '@playwright/test'

const capFile = 'Z_CAP_C_LEMM_20261108100503_AFAZ611801PRP10818.xml'
const capLink = 'https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/cap/' + capFile
const tiles = 'https://tms-ign-base.idee.es/**'
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=', 'base64')

test.beforeEach(async ({ context }) => {
  await context.route(tiles, route => route.fulfill({ contentType: 'image/png', body: pixel }))
})

test('abre por primera vez el mapa nacional sin red en un móvil estrecho', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await expect(page.getByText('Copia preparada', { exact: true })).toBeVisible()
  await context.setOffline(true)

  const offline = await context.newPage()
  await offline.setViewportSize({ width: 320, height: 700 })
  await offline.goto('/#mapa')
  const map = offline.getByRole('region', { name: 'Mapa interactivo de España' })
  await expect(map).toBeVisible()
  await expect(map.locator('canvas')).toHaveCount(1)
  await expect(offline.getByText('Mapa guardado', { exact: true })).toBeVisible()
  const province = offline.getByLabel('Provincia o ciudad autónoma')
  await expect(province.locator('option')).toHaveCount(54)
  await offline.getByRole('button', { name: 'Canarias', exact: true }).click()
  await expect(offline.getByRole('button', { name: 'Canarias', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await province.selectOption({ label: 'Ceuta' })
  await expect(province.locator('option:checked')).toHaveText('Ceuta')
  await province.selectOption({ label: 'Granada' })
  await expect(map.locator('.offline-province-label').filter({ hasText: 'Granada' })).toBeVisible()
  await offline.getByRole('button', { name: 'Municipios de Granada' }).click()
  await expect(offline.getByLabel('Municipio de Granada').locator('option')).toHaveCount(175)
  await expect(offline.getByText('Sin consulta de AEMET disponible.')).toBeVisible()
  await expect(offline.getByText('Sin conexión. Las consultas guardadas pueden haber cambiado.')).toBeVisible()
  await offline.getByLabel('Municipio de Granada').selectOption({ label: 'Motril' })
  await expect(offline.getByLabel('Municipio de Granada').locator('option:checked')).toHaveText('Motril')
  await offline.getByRole('button', { name: 'Ver España' }).click()
  await expect(province).toHaveValue('')
  expect(await offline.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('dibuja geometrías oficiales de prueba y las identifica como copias al perder la red', async ({ context, page }) => {
  const now = new Date().toISOString()
  const end = new Date(Date.now() + 3600_000).toISOString()
  const xml = (body: string) => ({ contentType: 'application/xml', body })
  await context.route('**/api/avisos/espana', route => route.fulfill(xml(`<feed xmlns="http://www.w3.org/2005/Atom">
    <title>AEMET - Avisos de fenómenos meteorológicos adversos - España</title><updated>${now}</updated>
    <entry><title>Aviso de prueba</title><summary>Cuenca del Genil</summary><link href="${capLink}"/></entry></feed>`)))
  let capRequests = 0
  await context.route('**/api/avisos/espana/' + capFile, route => {
    capRequests += 1
    return route.fulfill(xml(`<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>mapa-de-prueba</identifier><sent>${now}</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope>
    <info><language>es-ES</language><category>Met</category><headline>Aviso de prueba</headline>
    <onset>${now}</onset><expires>${end}</expires><area><areaDesc>Cuenca del Genil</areaDesc>
    <polygon>37.1,-3.7 37.3,-3.6 37.15,-3.5 37.1,-3.7</polygon></area></info></alert>`))
  })
  await context.route('**/api/sismos/ign', route => route.fulfill(xml(`<rss xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
    <channel><title>GeoRSS Sismología IGN</title><item><description>Sismo de prueba</description>
    <link>http://www.ign.es/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto?evid=es2026mapa</link>
    <geo:lat>37.14</geo:lat><geo:long>-3.61</geo:long></item></channel></rss>`)))

  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 37.18, longitude: -3.60 })
  await page.goto('/#mapa')
  await expect(page.getByText('Callejero IGN', { exact: true })).toBeVisible()
  const listEntry = page.getByRole('button', { name: 'Aviso de prueba', exact: true })
  await expect(listEntry).toBeVisible()
  expect(capRequests).toBe(0)
  await page.getByLabel('Buscar aviso por zona o fenómeno').fill('geníl')
  await listEntry.click()
  await expect(page.locator('.aemet-area')).toHaveCount(1)
  expect(capRequests).toBe(1)
  await expect(page.locator('.ign-epicenter')).toHaveCount(1)
  await page.getByRole('button', { name: 'Ver zona en el mapa' }).click()
  await page.getByRole('button', { name: 'Sismos', exact: true }).click()
  await page.getByText('Ver lista de epicentros', { exact: false }).click()
  await page.getByRole('button', { name: 'Ver epicentro es2026mapa' }).click()
  await page.getByRole('button', { name: 'Mi ubicación' }).click()
  await expect(page.getByText('Ubicación mostrada en esta sesión.')).toBeVisible()
  await expect(page.getByText('Mapa guardado', { exact: true })).toBeVisible()
  await expect(page.locator('.leaflet-tile')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Callejero IGN (en línea)' })).toBeDisabled()

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Aviso de prueba', exact: true }).click()
  await expect(page.locator('.aemet-area')).toHaveAttribute('stroke-dasharray', '5 5')
  await expect(page.locator('.ign-epicenter')).toHaveCount(1)
  await expect(page.getByText('Copia de la última consulta, sin confirmar.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Sismos', exact: true }).click()
  await expect(page.getByText('Copia guardada del IGN.', { exact: false })).toBeVisible()
  await expect(page.getByText('Ubicación mostrada en esta sesión.')).toHaveCount(0)
})

test('si fallan las teselas en línea, el mapa sigue navegable con la copia local', async ({ context, page }) => {
  await context.route(tiles, route => route.abort())
  await context.route('**/api/**', route => route.fulfill({ status: 502 }))
  await page.goto('/#mapa')
  await expect(page.getByText('El callejero no está disponible. Mostramos el mapa guardado.')).toBeVisible()
  const map = page.getByRole('region', { name: 'Mapa interactivo de España' })
  await expect(map.locator('canvas')).toBeVisible()
  await page.getByLabel('Provincia o ciudad autónoma').selectOption({ label: 'Madrid' })
  await expect(map.locator('.offline-province-label').filter({ hasText: 'Madrid' })).toBeVisible()
})
