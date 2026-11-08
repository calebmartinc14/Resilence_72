import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { preview } from 'vite'

test('recupera una instalación interrumpida y aplica una versión nueva tras cerrar las pestañas', async ({ context, page }) => {
  const worker = await readFile('dist/sw.js', 'utf8')
  let version: 'blocked' | 'original' | 'update' = 'blocked'

  // El servidor de la prueba simula un fallo temporal y luego una publicación nueva.
  const server = await preview({
    preview: { host: '127.0.0.1', port: 43174, strictPort: true },
    plugins: [{
      name: 'test-pwa-versions',
      configurePreviewServer(previewServer) {
        previewServer.middlewares.use((req, res, next) => {
          if (req.url !== '/sw.js') return next()
          res.setHeader('Cache-Control', 'no-store')
          if (version === 'blocked') {
            res.writeHead(503).end()
            return
          }
          const script = version === 'update'
            ? worker.replace(/const VERSION = "[a-f0-9]+"/, 'const VERSION = "prueba-actualizacion"')
            : worker
          res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(script)
        })
      },
    }],
  })

  try {
    const url = 'http://127.0.0.1:43174/'
    await page.goto(url)
    await expect(page.getByText('Copia sin conexión no preparada', { exact: true })).toBeVisible()

    version = 'original'
    await context.setOffline(true)
    await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('Copia preparada', { exact: true })).toBeVisible()

    version = 'update'
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    await expect(page.getByText('Hay una actualización preparada.', { exact: false })).toBeVisible()
    await page.close()

    const reopened = await context.newPage()
    await reopened.goto(url)
    await expect(reopened.getByText('Copia preparada', { exact: true })).toBeVisible()
    await expect.poll(() => reopened.evaluate(() => caches.keys())).toEqual([
      'resilience72:' + url + ':prueba-actualizacion',
    ])
    await reopened.close()
  } finally {
    await new Promise<void>(resolve => server.httpServer.close(() => resolve()))
  }
})
