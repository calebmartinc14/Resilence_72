import { useEffect, useState } from 'react'

type OfflineStatus = { state: 'preparing' | 'unavailable' } | { state: 'ready'; since: string }

export function useOffline() {
  const supported = import.meta.env.PROD && 'serviceWorker' in navigator
  const [status, setStatus] = useState<OfflineStatus>({ state: supported ? 'preparing' : 'unavailable' })
  const [updateWaiting, setUpdateWaiting] = useState(false)

  useEffect(() => {
    if (!supported) return
    const workers = navigator.serviceWorker
    let active = true
    let registration: ServiceWorkerRegistration | undefined
    let observed: ServiceWorker | null = null
    let cancelCheck = () => {}

    function checkCache() {
      cancelCheck()
      const controller = workers.controller
      if (!active || !controller) return

      const channel = new MessageChannel()
      const timer = window.setTimeout(() => {
        cancelCheck()
        if (active) setStatus({ state: 'unavailable' })
      }, 3000)
      cancelCheck = () => {
        window.clearTimeout(timer)
        channel.port1.close()
      }
      channel.port1.onmessage = event => {
        cancelCheck()
        if (!active) return
        const since = event.data
        setStatus(typeof since === 'string' && Number.isFinite(Date.parse(since))
          ? { state: 'ready', since }
          : { state: 'unavailable' })
      }
      controller.postMessage('OFFLINE_STATUS', [channel.port2])
    }

    function checkInstallState() {
      if (!active) return
      setUpdateWaiting(Boolean(registration?.waiting))
      if (observed?.state === 'redundant' && !workers.controller) setStatus({ state: 'unavailable' })
    }

    function watchInstall() {
      observed?.removeEventListener('statechange', checkInstallState)
      observed = registration?.installing ?? null
      observed?.addEventListener('statechange', checkInstallState)
      checkInstallState()
    }

    function reconnect() {
      checkCache()
      void registration?.update().catch(() => {})
    }

    workers.addEventListener('controllerchange', checkCache)
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', checkCache)
    checkCache()
    void workers.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' }).then(result => {
      if (!active) return
      registration = result
      result.addEventListener('updatefound', watchInstall)
      watchInstall()
      checkCache()
    }).catch(() => {
      if (active && !workers.controller) setStatus({ state: 'unavailable' })
    })

    return () => {
      active = false
      cancelCheck()
      registration?.removeEventListener('updatefound', watchInstall)
      observed?.removeEventListener('statechange', checkInstallState)
      workers.removeEventListener('controllerchange', checkCache)
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', checkCache)
    }
  }, [supported])

  return { status, updateWaiting }
}
