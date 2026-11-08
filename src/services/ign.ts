const ignOrigin = 'https://www.ign.es'
const geo = 'http://www.w3.org/2003/01/geo/wgs84_pos#'
const eventPath = '/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto'
export const ignCatalog = ignOrigin + '/web/ign/portal/ultimos-terremotos/-/ultimos-terremotos/index.htm'

function children(element: Element, tag: string) {
  return Array.from(element.children).filter(child => child.localName === tag && !child.namespaceURI)
}

function field(element: Element, tag: string) {
  return children(element, tag)[0]?.textContent?.trim() ?? ''
}

// Extrae texto y coordenadas del RSS. Solo genera enlaces a fichas verificables del IGN.
export function parseSeismicFeed(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const rss = document.documentElement
  const channel = children(rss, 'channel')[0]
  if (document.doctype || rss.localName !== 'rss' || rss.namespaceURI ||
    !channel || field(channel, 'title') !== 'GeoRSS Sismología IGN') throw new Error('Canal sísmico no reconocido')

  return children(channel, 'item').slice(0, 150).map(item => {
    const source = new URL(field(item, 'link'))
    const id = source.searchParams.get('evid')
    const description = field(item, 'description')
    if (source.hostname !== 'www.ign.es' || !['http:', 'https:'].includes(source.protocol) ||
      source.pathname !== eventPath || !id || !/^es\d{4}[a-z0-9]+$/i.test(id) || !description) {
      throw new Error('Registro sísmico incompleto')
    }
    const lat = Number(item.getElementsByTagNameNS(geo, 'lat')[0]?.textContent?.trim() || NaN)
    const lng = Number(item.getElementsByTagNameNS(geo, 'long')[0]?.textContent?.trim() || NaN)
    const position: [number, number] | null = Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
    return { id, description, position, url: ignOrigin + eventPath + '?evid=' + encodeURIComponent(id) }
  })
}
