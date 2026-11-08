import { expect, test } from '@playwright/test'

test('Qué hago ahora abre una guía breve y da acceso al 112 y a Energía sin red', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await expect(page.getByText('Copia preparada', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('link', { name: 'Qué hago ahora' }).click()
  await expect(page.getByRole('link', { name: 'Llamar al 112' })).toHaveAttribute('href', 'tel:112')
  await page.getByRole('button', { name: 'Corte eléctrico', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Corte eléctrico', exact: true })).toBeFocused()
  const guidance = page.getByRole('region', { name: 'Instrucciones por situación' })
  await expect(guidance.getByText('Mantén cerrados el frigorífico', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'FEMA' })).toBeVisible()
  await page.getByRole('link', { name: 'Calcular energía' }).click()
  await expect(page.getByRole('heading', { name: 'Autonomía energética' })).toBeVisible()
})
