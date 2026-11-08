export type NewsItem = { id: string; title: string; published: string; url: string }
export type NewsSnapshot = { consulted: string; items: NewsItem[] }

export const newsSource = 'https://news.un.org/feed/subscribe/es/news/topic/peace-and-security/feed/rss.xml'
export const esAlertInfo = 'https://www.proteccioncivil.es/coordinacion/redes/ran/public-warning-system'

function child(parent: Element, name: string) {
  return Array.from(parent.children).find(element => element.localName === name && !element.namespaceURI)
}

function text(parent: Element, name: string) {
  return child(parent, name)?.textContent?.trim() ?? ''
}

function officialArticle(href: string) {
  try {
    const url = new URL(href)
    if (url.origin !== 'https://news.un.org' || url.username || url.password) return null
    const match = /^(?:\/feed\/view)?(\/es\/story\/\d{4}\/\d{2}\/\d+)\/?$/.exec(url.pathname)
    return match ? { id: match[1], url: url.origin + match[1] } : null
  } catch { return null }
}

export function validNewsItem(item: NewsItem) {
  return item && typeof item.title === 'string' && !!item.title &&
    Number.isFinite(Date.parse(item.published)) && officialArticle(item.url)?.id === item.id
}

export async function fetchInternationalNews(signal: AbortSignal): Promise<NewsSnapshot> {
  const response = await fetch('/api/internacional/onu', { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Noticias ONU no disponible')
  const document = new DOMParser().parseFromString(await response.text(), 'application/xml')
  const root = document.documentElement
  const channel = child(root, 'channel')
  if (document.doctype || root.localName !== 'rss' || root.namespaceURI || !channel ||
    !text(channel, 'title').startsWith('Noticias ONU') || text(channel, 'language') !== 'es') {
    throw new Error('Canal de Noticias ONU no reconocido')
  }

  // Solo mostramos titulares, fechas y enlaces oficiales. El HTML del canal nunca se inserta en la página.
  const items = new Map<string, NewsItem>()
  for (const item of channel.children) {
    if (item.localName !== 'item' || item.namespaceURI) continue
    const article = officialArticle(text(item, 'link'))
    const title = text(item, 'title')
    const published = Date.parse(text(item, 'pubDate'))
    if (!article || !title || !Number.isFinite(published)) continue
    items.set(article.id, { ...article, title, published: new Date(published).toISOString() })
  }
  if (!items.size) throw new Error('Canal de Noticias ONU sin publicaciones verificables')

  return {
    consulted: new Date().toISOString(),
    items: [...items.values()].sort((a, b) => b.published.localeCompare(a.published)).slice(0, 24),
  }
}
