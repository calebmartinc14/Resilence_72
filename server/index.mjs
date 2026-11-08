import { createServer } from 'node:http'
import { proxyOfficial } from './official.mjs'

// En producción, el servidor HTTPS del despliegue reenvía estas rutas a un proceso local.
const port = Number(process.env.PORT ?? 8787)
createServer((req, res) => {
  void proxyOfficial(req, res, () => res.writeHead(404).end())
}).listen(port, '127.0.0.1', () => console.log('API de avisos en http://127.0.0.1:' + port))
