const ignOrigin = 'https://www.ign.es'
const eventPath = '/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto'
export const ignCatalog = ignOrigin + '/web/ign/portal/ultimos-terremotos/-/ultimos-terremotos/index.htm'

function children(element: Element, tag: string) {
  return Array.from(element.children).filter(child => child.localName === tag && !child.namespaceURI)
}

function field(element: Element, tag: string) {
  return children(element, tag)[0]?.textContent?.trim() ?? ''
}

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
    return { id, description, url: ignOrigin + eventPath + '?evid=' + encodeURIComponent(id) }
  })
}
