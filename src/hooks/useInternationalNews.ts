import { useEffect, useRef, useState } from 'react'
import { fetchInternationalNews, validNewsItem, type NewsItem, type NewsSnapshot } from '../services/internationalNews'

const prefix = 'resilience72:internacional:'
const minute = 60_000

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(prefix + key) ?? 'null') } catch { return null }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)) } catch { /* La consulta sigue funcionando en memoria. */ }
}

function loadSnapshot(): NewsSnapshot | null {
  const value = read('copia') as NewsSnapshot | null
  return value && Number.isFinite(Date.parse(value.consulted)) && Array.isArray(value.items) &&
    value.items.length && value.items.every(validNewsItem) ? value : null
}

function loadSeen(): string[] | null {
  const value = read('vistas')
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? value : null
}

async function notifyDevice(items: NewsItem[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.active) return
  await registration.showNotification('Noticias ONU · Paz y Seguridad', {
    body: items.length === 1 ? items[0].title : items.length + ' publicaciones nuevas. Abre Resilience 72 para consultarlas.',
    tag: 'resilience72-internacional',
  })
}

export function useInternationalNews(online: boolean, activePage: boolean) {
  const [enabled, setEnabled] = useState(() => read('avisos') === true)
  const [snapshot, setSnapshot] = useState(loadSnapshot)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unavailable' : Notification.permission)
  const [attempt, setAttempt] = useState(0)
  const [unread, setUnread] = useState(0)
  const seen = useRef(loadSeen())
  const shouldCheck = enabled || activePage

  useEffect(() => {
    if (activePage) setUnread(0)
  }, [activePage])

  useEffect(() => {
    if (!online || !shouldCheck) return
    const controller = new AbortController()
    let busy = false

    async function refresh() {
      if (document.visibilityState !== 'visible' || busy) return
      busy = true
      setStatus('loading')
      try {
        const result = await fetchInternationalNews(AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]))
        if (controller.signal.aborted) return
        setSnapshot(result)
        save('copia', result)
        setStatus('ready')

        if (enabled) {
          // La primera consulta establece una referencia. Solo avisamos de titulares nuevos y recientes.
          const known = loadSeen() ?? seen.current
          const now = Date.now()
          const newItems = known === null ? [] : result.items.filter(item => {
            const age = now - Date.parse(item.published)
            return !known.includes(item.id) && age >= -5 * minute && age <= 24 * 60 * minute
          })
          const ids = [...new Set([...result.items.map(item => item.id), ...(known ?? [])])].slice(0, 150)
          seen.current = ids
          save('vistas', ids)
          if (newItems.length) {
            if (!activePage) setUnread(previous => previous + newItems.length)
            void notifyDevice(newItems).catch(() => {})
          }
        }
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      } finally { busy = false }
    }

    void refresh()
    const timer = window.setInterval(refresh, 5 * minute)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [online, shouldCheck, enabled, activePage, attempt])

  function toggle() {
    const next = !enabled
    seen.current = null
    save('vistas', null)
    save('avisos', next)
    setEnabled(next)
    setUnread(0)
  }

  async function allowDevice() {
    if (typeof Notification === 'undefined') return
    try { setPermission(await Notification.requestPermission()) } catch { setPermission('unavailable') }
  }

  return {
    enabled, toggle, snapshot, status, permission, allowDevice, unread,
    refresh: () => setAttempt(previous => previous + 1), clearUnread: () => setUnread(0),
  }
}
