const atom = 'http://www.w3.org/2005/Atom'
const cap = 'urn:oasis:names:tc:emergency:cap:1.2'
const api = '/api/avisos/granada'
const nationalApi = '/api/avisos/espana'
const capPath = /^\/documentos_d\/eltiempo\/prediccion\/avisos\/cap\/(Z_CAP_C_LEMM_\d{14}_AFA[ZP]6118[A-Z0-9]*\.xml)$/
const nationalCapPath = /^\/documentos_d\/eltiempo\/prediccion\/avisos\/cap\/(Z_CAP_C_LEMM_\d{14}_AFA[ZP]\d{4}[A-Z0-9]*\.xml)$/
export const officialPage = 'https://www.aemet.es/es/eltiempo/prediccion/avisos?p=6118'
export const nationalOfficialPage = 'https://www.aemet.es/es/eltiempo/prediccion/avisos'
export type Coordinate = [lat: number, lng: number]

export type Notice = {
  id: string
  title: string
  area: string
  level: string
  description: string
  instruction: string
  sent: string
  starts: string
  ends: string
  url: string
  polygons?: Coordinate[][]
}

export type Bulletin = {
  consulted: string
  published: string
  notices: Notice[]
}

// Buscamos solo hijos del espacio XML esperado para no mezclar datos de secciones distintas.
function children(parent: Element, name: string) {
  return Array.from(parent.children).filter(element => element.localName === name && element.namespaceURI === parent.namespaceURI)
}

function value(parent: Element, name: string) {
  return children(parent, name)[0]?.textContent?.trim() ?? ''
}

// Convertimos fechas con zona horaria a UTC para compararlas correctamente.
function date(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) throw new Error('Fecha de aviso incompleta')
  return new Date(raw).toISOString()
}

async function fetchXml(path: string, namespace: string, root: string, signal: AbortSignal) {
  const response = await fetch(path, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo consultar AEMET')
  const document = new DOMParser().parseFromString(await response.text(), 'application/xml')
  const element = document.documentElement
  if (document.doctype || element.namespaceURI !== namespace || element.localName !== root) {
    throw new Error('Formato de aviso inesperado')
  }
  return element
}

function getCapFile(url: URL, national = false) {
  if (url.origin !== 'https://www.aemet.es' || url.username || url.password || url.search || url.hash) return undefined
  return (national ? nationalCapPath : capPath).exec(url.pathname)?.[1]
}

// El CAP da pares latitud,longitud. Una geometría inválida se omite y el aviso sigue en la lista.
function parsePolygon(text: string): Coordinate[] {
  const ring = text.trim().split(/\s+/).map(pair => pair.split(',').map(part => part.trim()))
  if (ring.length < 4 || ring.some(parts => parts.length !== 2 || parts.some(part => part === ''))) return []
  const coords = ring.map(([lat, lng]): Coordinate => [Number(lat), Number(lng)])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1] || coords.some(([lat, lng]) =>
    !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) return []
  return coords
}

// Leemos el mensaje CAP oficial y conservamos únicamente los avisos públicos reales.
async function fetchNotice(url: URL, signal: AbortSignal, national = false) {
  const file = getCapFile(url, national)
  if (!file) throw new Error('Enlace de AEMET no reconocido')
  const alert = await fetchXml((national ? nationalApi : api) + '/' + file, cap, 'alert', signal)
  const status = value(alert, 'status')
  const scope = value(alert, 'scope')
  if (!status || !scope) throw new Error('Aviso sin estado o ámbito')
  if (status !== 'Actual' || scope !== 'Public') return null

  const kind = value(alert, 'msgType')
  const replaces = value(alert, 'references').split(/\s+/).map(reference => reference.split(',')[1]).filter(Boolean)
  if (kind === 'Cancel') return { replaces, notice: null }
  if (kind !== 'Alert' && kind !== 'Update') throw new Error('Tipo de aviso desconocido')

  const info = children(alert, 'info').find(item => /^es(?:-|$)/i.test(value(item, 'language')))
  if (!info || !children(info, 'category').some(category => category.textContent?.trim() === 'Met')) {
    throw new Error('Aviso meteorológico en español no disponible')
  }
  const notice = {
    id: value(alert, 'identifier'),
    title: value(info, 'headline') || value(info, 'event'),
    area: children(info, 'area').map(area => value(area, 'areaDesc')).filter(Boolean).join(' · '),
    level: children(info, 'parameter').filter(item => value(item, 'valueName') === 'AEMET-Meteoalerta nivel')
      .map(item => value(item, 'value'))[0] ?? '',
    description: value(info, 'description'),
    instruction: value(info, 'instruction'),
    sent: date(value(alert, 'sent')),
    starts: date(value(info, 'onset') || value(info, 'effective')),
    ends: date(value(info, 'expires')),
    url: url.href,
    polygons: children(info, 'area').flatMap(area => children(area, 'polygon'))
      .map(polygon => parsePolygon(polygon.textContent ?? '')).filter(ring => ring.length > 0),
  }
  if (!notice.id || !notice.title || !notice.area || notice.ends <= notice.starts) throw new Error('Aviso incompleto')
  return { replaces, notice }
}

// El canal Atom indica qué documentos CAP componen la consulta provincial.
export async function fetchBulletin(signal: AbortSignal): Promise<Bulletin> {
  const feed = await fetchXml(api, atom, 'feed', signal)
  if (!value(feed, 'title').endsWith(' - Granada')) throw new Error('Canal de otra provincia')
  const published = date(value(feed, 'updated'))
  const files = new Map<string, URL>()
  let explicitlyEmpty = false
  for (const entry of children(feed, 'entry')) {
    const href = children(entry, 'link')[0]?.getAttribute('href')
    const url = new URL(href ?? '')
    const file = getCapFile(url)
    if (file) {
      files.set(file, url)
    } else if (url.origin === 'https://www.aemet.es' &&
      /^\/documentos_d\/eltiempo\/prediccion\/avisos\/cap\/Z_CAP_C_LEMM_\d{14}_AFAP6118\.tar\.gz$/.test(url.pathname)) {
      explicitlyEmpty = /\.\s*No hay avisos para Granada\.?$/i.test(value(entry, 'title'))
    } else {
      throw new Error('Entrada de AEMET no reconocida')
    }
  }
  if ((!files.size && !explicitlyEmpty) || files.size > 80) throw new Error('Canal de avisos incompleto')

  // Limitamos las descargas simultáneas y retiramos los mensajes sustituidos o cancelados.
  const entries = [...files.values()]
  const notices = new Map<string, Notice>()
  const replaced = new Set<string>()
  for (let offset = 0; offset < entries.length; offset += 6) {
    const batch = await Promise.all(entries.slice(offset, offset + 6).map(url => fetchNotice(url, signal)))
    for (const item of batch) {
      if (!item) continue
      for (const id of item.replaces) replaced.add(id)
      if (item.notice) notices.set(item.notice.id, item.notice)
    }
  }
  for (const id of replaced) notices.delete(id)
  return { consulted: new Date().toISOString(), published, notices: [...notices.values()] }
}

export type NationalEntry = { title: string; summary: string; url: string }
export type NationalIndex = { consulted: string; published: string; entries: NationalEntry[] }

// Un boletín nacional puede tener cientos de avisos. Solo pedimos el CAP al abrir uno.
export async function fetchNationalIndex(signal: AbortSignal): Promise<NationalIndex> {
  const feed = await fetchXml(nationalApi, atom, 'feed', signal)
  if (!value(feed, 'title').endsWith(' - España')) throw new Error('Canal nacional no reconocido')
  const entries = new Map<string, NationalEntry>()
  let explicitlyEmpty = false
  for (const entry of children(feed, 'entry')) {
    const href = children(entry, 'link')[0]?.getAttribute('href') ?? ''
    const url = new URL(href)
    const title = value(entry, 'title')
    const file = getCapFile(url, true)
    if (file && title) entries.set(file, { title, summary: value(entry, 'summary'), url: url.href })
    else if (url.origin === 'https://www.aemet.es' && url.pathname.startsWith('/documentos_d/eltiempo/prediccion/avisos/cap/') &&
      url.pathname.endsWith('.tar.gz')) explicitlyEmpty ||= /\bNo hay avisos\b/i.test(title)
    else throw new Error('Entrada nacional no reconocida')
  }
  if (entries.size === 0 && !explicitlyEmpty) throw new Error('Canal nacional incompleto')
  return { entries: [...entries.values()], published: date(value(feed, 'updated')), consulted: new Date().toISOString() }
}

export async function fetchNationalNotice(url: string, signal: AbortSignal) {
  return (await fetchNotice(new URL(url), signal, true))?.notice ?? null
}
