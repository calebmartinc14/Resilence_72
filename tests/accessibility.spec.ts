import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const screens = [
  ['inicio', 'Prepárate a tu ritmo'],
  ['preparacion', 'Mi kit de 72 horas'],
  ['guias', 'Guías de emergencia'],
  ['autonomia', 'Autonomía energética'],
  ['alertas', 'Avisos oficiales'],
  ['mapa', 'Mapa de Granada'],
] as const

test('las seis pantallas móviles pasan las reglas automáticas de accesibilidad', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/**', route => route.fulfill({ status: 502 }))

  for (const [path, title] of screens) {
    await test.step(path, async () => {
      await page.goto('/#' + path)
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
      if (path === 'preparacion') {
        await page.getByText('Configurar hogar y reserva de agua').click()
        await page.getByText('Plan familiar y contactos').click()
      }
      if (path === 'alertas') await expect(page.getByRole('heading', { name: 'Avisos meteorológicos de Granada' })).toBeVisible()
      if (path === 'mapa') await expect(page.getByRole('region', { name: 'Mapa interactivo de Granada' })).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => node.target) }))).toEqual([])
    })
  }
})

test('el enlace para saltar al contenido y el menú se pueden usar con teclado', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await nav.getByRole('link', { name: 'Guías' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Guías de emergencia', level: 1 })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('searchbox', { name: 'Buscar por tema' })).toBeFocused()
})
