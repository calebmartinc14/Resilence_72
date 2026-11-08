import { expect, test } from '@playwright/test'

const atom = 'http://www.w3.org/2005/Atom'
const folder = 'https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/cap/'
const api = '/api/avisos/granada'
const published = new Date().toISOString()
const starts = new Date(Date.now() - 60_000).toISOString()
const ends = new Date(Date.now() + 3600_000).toISOString()
const capFile = 'Z_CAP_C_LEMM_20261108100503_AFAZ611801PRP10818.xml'
const noNotices = '<entry><title>Estado completo de avisos para Granada. No hay avisos para Granada</title>' +
  '<link href="' + folder + 'Z_CAP_C_LEMM_20261108100503_AFAP6118.tar.gz"/></entry>'

function feed(entries: string) {
  return '<feed xmlns="' + atom + '"><title>AEMET - Avisos de fenómenos meteorológicos adversos - Granada</title>' +
    '<updated>' + published + '</updated>' + entries + '</feed>'
}

test('muestra el aviso CAP y conserva una copia identificada ante errores y sin red', async ({ page, context }) => {
  let failing = false
  let noLongerPublished = false
  await context.route('**' + api, route => failing
    ? route.fulfill({ status: 502 })
    : route.fulfill({ contentType: 'application/xml',
      body: feed(noLongerPublished ? noNotices : '<entry><link href="' + folder + capFile + '"/></entry>') }))
  await context.route('**' + api + '/' + capFile, route => route.fulfill({
    contentType: 'application/xml',
    body: `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>aviso-de-prueba</identifier><sent>${published}</sent><status>Actual</status>
      <msgType>Alert</msgType><scope>Public</scope>
      <info><language>es-ES</language><category>Met</category><event>Aviso de lluvia de prueba</event>
      <headline>Aviso de lluvia de prueba</headline><onset>${starts}</onset><expires>${ends}</expires>
      <description>Descripción de prueba</description><instruction>Instrucción de prueba</instruction>
      <parameter><valueName>AEMET-Meteoalerta nivel</valueName><value>amarillo</value></parameter>
      <area><areaDesc>Cuenca del Genil</areaDesc></area></info></alert>`,
  }))

  await page.goto('/#alertas')
  await expect(page.getByText('En vigor · Cuenca del Genil')).toBeVisible()
  await page.getByText('Aviso de lluvia de prueba', { exact: true }).click()
  await expect(page.getByText('amarillo', { exact: true })).toBeVisible()
  await expect(page.getByText('Instrucción de prueba')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mensaje oficial de AEMET' })).toHaveAttribute('href', folder + capFile)

  failing = true
  await page.getByRole('button', { name: 'Actualizar avisos' }).click()
  await expect(page.getByText('No se pudo completar la consulta a AEMET.')).toBeVisible()
  await expect(page.getByText('Consulta anterior · Cuenca del Genil')).toBeVisible()
  await expect(page.getByText('Copia de la última consulta. Puede haber cambiado.')).toBeVisible()

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Consulta anterior · Cuenca del Genil')).toBeVisible()
  await expect(page.getByText('Sin conexión. El estado actual de los avisos no se puede comprobar.')).toBeVisible()

  failing = false
  await context.setOffline(false)
  await expect(page.getByText('En vigor · Cuenca del Genil')).toBeVisible()

  noLongerPublished = true
  await page.getByRole('button', { name: 'Actualizar avisos' }).click()
  await expect(page.getByText('AEMET no muestra avisos vigentes ni previstos en esta consulta.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('AEMET no muestra avisos vigentes ni previstos en esta consulta.')).toBeVisible()
  await page.getByText('Historial guardado en este dispositivo').click()
  await expect(page.getByText('Registro histórico · Cuenca del Genil')).toBeVisible()
  await page.getByText('Aviso de lluvia de prueba', { exact: true }).click()
  await expect(page.getByText('Última vez que apareció en una consulta:', { exact: false })).toBeVisible()
})

test('solo una respuesta explícita de AEMET confirma que no hay avisos', async ({ page }) => {
  let valid = false
  await page.route('**' + api, route => route.fulfill({
    contentType: 'application/xml',
    body: valid ? feed(noNotices) : feed(''),
  }))

  await page.goto('/#alertas')
  await expect(page.getByText('No se pudo completar la consulta a AEMET.')).toBeVisible()
  await expect(page.getByText('Sin datos de alertas guardados.')).toBeVisible()

  valid = true
  await page.getByRole('button', { name: 'Actualizar avisos' }).click()
  await expect(page.getByText('AEMET no muestra avisos vigentes ni previstos en esta consulta.')).toBeVisible()
})
