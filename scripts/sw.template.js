const scope = self.registration.scope
const cachePrefix = 'resilience72:' + scope + ':'
const cacheName = cachePrefix + VERSION
const index = new URL('index.html', scope).href
const metadata = new URL('__offline_status__', scope).href
const precache = new Set(ASSETS.map(asset => new URL(asset, scope).href))
// These are immutable build files. Browsers may send different Origin headers
// for the precache request and the later module request.
const matchStatic = url => caches.match(url, { cacheName, ignoreVary: true })

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await cache.addAll([...precache].map(url => new Request(url, { cache: 'reload' })))
    await cache.put(metadata, new Response(new Date().toISOString()))
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const root = new URL(scope)
  const isApp = request.mode === 'navigate' && url.origin === root.origin &&
    (url.pathname === root.pathname || url.pathname === new URL(index).pathname)
  if (!isApp && !precache.has(request.url)) return

  event.respondWith((async () => {
    const cached = await matchStatic(isApp ? index : request.url)
    return cached ?? fetch(request)
  })())
})

self.addEventListener('message', event => {
  if (event.data !== 'OFFLINE_STATUS' || !event.ports[0]) return
  event.waitUntil((async () => {
    const entries = await Promise.all([...precache].map(matchStatic))
    const stamp = await caches.match(metadata, { cacheName })
    event.ports[0].postMessage(entries.every(Boolean) && stamp ? await stamp.text() : null)
  })())
})
