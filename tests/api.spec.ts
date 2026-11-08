import { expect, test } from '@playwright/test'

test('la API bloquea métodos y rutas que no pertenecen a los canales previstos', async ({ request }) => {
  const invalid = [
    '/api/avisos/granada/https%3A%2F%2Fexample.com%2F',
    '/api/avisos/granada/Z_CAP_C_LEMM_20261108100503_AFAZ659302PRP10818.xml',
    '/api/sismos/ign?url=https://example.com',
    '/api/avisos/espana/https%3A%2F%2Fexample.com%2F',
    '/api/avisos/espana?url=https://example.com',
    '/api/internacional/onu?url=https://example.com',
  ]
  for (const path of invalid) expect((await request.get(path)).status()).toBe(404)

  const response = await request.post('/api/sismos/ign')
  expect(response.status()).toBe(405)
  expect(response.headers()['allow']).toBe('GET')
  expect(response.headers()['cache-control']).toBe('no-store')
})
