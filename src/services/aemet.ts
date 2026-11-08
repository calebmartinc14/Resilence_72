const atom = 'http://www.w3.org/2005/Atom'
const cap = 'urn:oasis:names:tc:emergency:cap:1.2'
const api = '/api/avisos/granada'
const capPath = /^\/documentos_d\/eltiempo\/prediccion\/avisos\/cap\/(Z_CAP_C_LEMM_\d{14}_AFA[ZP]6118[A-Z0-9]*\.xml)$/
export const officialPage = 'https://www.aemet.es/es/eltiempo/prediccion/avisos?p=6118'

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
}

export type Bulletin = {
  consulted: string
  published: string
  notices: Notice[]
}

function children(parent: Element, name: string) {
  return Array.from(parent.children).filter(element => element.localName === name && element.namespaceURI === parent.namespaceURI)
}

function value(parent: Element, name: string) {
  return children(parent, name)[0]?.textContent?.trim() ?? ''
}

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

function getCapFile(url: URL) {
  if (url.origin !== 'https://www.aemet.es' || url.username || url.password || url.search || url.hash) return undefined
  return capPath.exec(url.pathname)?.[1]
}

async function fetchNotice(url: URL, signal: AbortSignal) {
  const alert = await fetchXml(api + '/' + getCapFile(url), cap, 'alert', signal)
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
  }
  if (!notice.id || !notice.title || !notice.area || notice.ends <= notice.starts) throw new Error('Aviso incompleto')
  return { replaces, notice }
}

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
