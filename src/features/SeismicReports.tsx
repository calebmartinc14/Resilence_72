import { useEffect, useState } from 'react'
import { ignCatalog, parseSeismicFeed } from '../services/ign'

const key = 'resilience72:ign:v1'
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid',
})

function savedFeed() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (saved && typeof saved.xml === 'string' && Number.isFinite(Date.parse(saved.consulted))) {
      return { consulted: String(saved.consulted), events: parseSeismicFeed(saved.xml) }
    }
  } catch { /* Offline copy is optional. */ }
  return null
}

export function useSeismicReports(open: boolean, online: boolean) {
  const [report, setReport] = useState(savedFeed)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open || !online) return
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)])
    setStatus('loading')

    async function refresh() {
      const response = await fetch('/api/sismos/ign', { signal, cache: 'no-store' })
      if (!response.ok) throw new Error('IGN no disponible')
      const xml = await response.text()
      const events = parseSeismicFeed(xml)
      if (controller.signal.aborted) return

      const consulted = new Date().toISOString()
      setReport({ consulted, events })
      setStatus('ready')
      try { localStorage.setItem(key, JSON.stringify({ consulted, xml })) } catch { /* storage is optional */ }
    }

    void refresh().catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })
    return () => controller.abort()
  }, [open, online, attempt])

  return { report, status, refresh: () => setAttempt(value => value + 1) }
}

export default function SeismicReports({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false)
  const { report, status, refresh } = useSeismicReports(open, online)

  return <details className="tool-section official-panel" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Sismos recientes · Instituto Geográfico Nacional</summary>
    <p>Últimos registros del canal para España y su entorno. El IGN puede revisar sus datos.</p>
    {open && <>
      <p role="status">
        {!online ? 'Sin conexión con el IGN.'
          : status === 'loading' ? 'Consultando el IGN…'
          : status === 'error' ? 'No se pudo completar la consulta al IGN.'
          : report?.events.length === 0 ? 'El canal consultado no contiene registros.'
          : 'Registros de la última consulta al IGN.'}
      </p>
      {report && <>
        {(!online || status !== 'ready') && <p><strong>Copia guardada del IGN.</strong></p>}
        <p>Consulta: <time dateTime={report.consulted}>{dateFormat.format(new Date(report.consulted))}</time> (hora peninsular).</p>
        <ul className="seismic-events">{report.events.slice(0, 5).map(event => <li key={event.id}>
          <p>{event.description}</p>
          <a href={event.url}>Ficha del IGN · {event.id}</a>
        </li>)}</ul>
      </>}
      <p><a href={ignCatalog}>Consultar el catálogo del IGN</a></p>
      {online && <button type="button" disabled={status === 'loading'} onClick={refresh}>Actualizar sismos</button>}
    </>}
  </details>
}
