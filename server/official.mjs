const origin = 'https://www.aemet.es'
const feed = '/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAP6118_ATOM.xml'
const capFolder = '/documentos_d/eltiempo/prediccion/avisos/cap/'
const prefix = '/api/avisos/granada'
const ignPath = '/api/sismos/ign'
const ignFeed = 'https://www.ign.es/ign/RssTools/sismologia.xml'
const capName = /^Z_CAP_C_LEMM_\d{14}_AFA[ZP]6118[A-Z0-9]*\.xml$/
const maxBytes = 512 * 1024

// Limitamos el tiempo, el tamaño y los redireccionamientos de la respuesta externa.
async function readXml(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
    headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' },
  })
  if (!response.ok || !response.body) throw new Error('Respuesta oficial no disponible')
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxBytes) throw new Error('Respuesta demasiado grande')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// El navegador llama al mismo origen. Este servidor decide qué fuentes oficiales puede consultar.
export async function proxyOfficial(req, res, next) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    res.writeHead(400).end()
    return
  }
  const isIgn = url.pathname === ignPath
  if (!isIgn && url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) return next()

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.writeHead(405).end()
    return
  }
  // No aceptamos URLs de la persona usuaria: solo rutas con el formato del catálogo de Granada.
  const filename = url.pathname.slice(prefix.length + 1)
  const path = url.pathname === prefix ? feed : capName.test(filename) ? capFolder + filename : null
  if ((!isIgn && !path) || url.search) {
    res.writeHead(404).end()
    return
  }

  try {
    const xml = await readXml(isIgn ? ignFeed : origin + path)
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' }).end(xml)
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No se pudo consultar la fuente oficial.')
  }
}
