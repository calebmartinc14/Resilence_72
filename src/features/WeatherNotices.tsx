import { useEffect, useRef, useState } from 'react'
import { fetchBulletin, officialPage, type Bulletin, type Notice } from '../services/aemet'

const storageKey = 'resilience72:aemet:granada:v1'
const minute = 60_000
const retention = 30 * 24 * 60 * minute
type HistoryEntry = { notice: Notice; lastSeen: string }
type StoredBulletin = Bulletin & { history?: HistoryEntry[] }
const formatDate = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid',
})

function isNotice(notice: Notice) {
  return notice && Number.isFinite(Date.parse(notice.starts)) && Number.isFinite(Date.parse(notice.ends)) &&
    Number.isFinite(Date.parse(notice.sent)) && typeof notice.url === 'string' &&
    notice.url.startsWith('https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/cap/') &&
    [notice.id, notice.title, notice.area, notice.level, notice.description, notice.instruction]
      .every(field => typeof field === 'string')
}

function loadCopy(): StoredBulletin | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as StoredBulletin | null
    if (value && Number.isFinite(Date.parse(value.consulted)) && Number.isFinite(Date.parse(value.published)) &&
      Array.isArray(value.notices) && value.notices.every(isNotice)) {
      const history = Array.isArray(value.history) ? value.history.filter(entry =>
        entry && isNotice(entry.notice) && Number.isFinite(Date.parse(entry.lastSeen))) : undefined
      return { ...value, history }
    }
  } catch {
  }
  return null
}

function archive(result: Bulletin, previous: StoredBulletin | null): StoredBulletin {
  const history = new Map<string, HistoryEntry>()
  for (const entry of previous?.history ?? []) history.set(entry.notice.id, entry)
  if (previous) {
    for (const notice of previous.notices) history.set(notice.id, { notice, lastSeen: previous.consulted })
  }
  for (const notice of result.notices) history.set(notice.id, { notice, lastSeen: result.consulted })
  const cutoff = Date.parse(result.consulted) - retention
  return { ...result, history: [...history.values()].filter(entry => Date.parse(entry.lastSeen) >= cutoff)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, 100) }
}

function DateLabel({ date }: { date: string }) {
  return <time dateTime={date}>{formatDate.format(new Date(date))}</time>
}

export function useWeatherBulletin(online: boolean) {
  const [bulletin, setBulletin] = useState(loadCopy)
  const latest = useRef(bulletin)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!online) return
    const controller = new AbortController()
    setStatus('loading')
    void fetchBulletin(AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)])).then(result => {
      if (controller.signal.aborted) return
      const stored = archive(result, loadCopy() ?? latest.current)
      latest.current = stored
      setBulletin(stored)
      setNow(Date.now())
      setStatus('ready')
      try { localStorage.setItem(storageKey, JSON.stringify(stored)) } catch { /* storage is optional */ }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })
    return () => controller.abort()
  }, [online, attempt])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), minute)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!online) return
    const timer = window.setInterval(() => setAttempt(value => value + 1), 5 * minute)
    return () => window.clearInterval(timer)
  }, [online])

  const stale = !online || status !== 'ready' || !bulletin ||
    now - Date.parse(bulletin.consulted) > 15 * minute || now - Date.parse(bulletin.published) > 72 * 60 * minute
  return { bulletin, status, now, stale, refresh: () => setAttempt(value => value + 1) }
}

export default function WeatherNotices({ online }: { online: boolean }) {
  const { bulletin, status, now, stale, refresh } = useWeatherBulletin(online)
  const notices = [...(bulletin?.notices ?? [])].sort((a, b) => a.starts.localeCompare(b.starts))
  const upcoming = notices.filter(notice => Date.parse(notice.ends) > now)
  const upcomingIds = new Set(upcoming.map(notice => notice.id))
  const observed = bulletin?.history ?? bulletin?.notices.map(notice => ({ notice, lastSeen: bulletin.consulted })) ?? []
  const previousNotices = observed.filter(entry =>
    Date.parse(entry.lastSeen) >= now - retention && !upcomingIds.has(entry.notice.id))

  function renderNotice(notice: Notice, lastSeen?: string) {
    return <details key={notice.id} className="weather-notice">
      <summary>
        <strong>{notice.title}</strong>
        <span>{lastSeen ? 'Registro histórico' : stale ? 'Consulta anterior' : Date.parse(notice.starts) > now ? 'Previsto' : 'En vigor'} · {notice.area}</span>
      </summary>
      {notice.level && <p>Nivel comunicado: <strong>{notice.level}</strong></p>}
      <p>Vigencia: <DateLabel date={notice.starts} /> a <DateLabel date={notice.ends} /> (hora peninsular).</p>
      <p>Emitido por AEMET: <DateLabel date={notice.sent} />.</p>
      {lastSeen && <p>Última vez que apareció en una consulta: <DateLabel date={lastSeen} />.</p>}
      {notice.description && <p>{notice.description}</p>}
      {notice.instruction && <p>{notice.instruction}</p>}
      <a href={notice.url}>Mensaje oficial de AEMET</a>
    </details>
  }

  return <section className="tool-section weather-panel" aria-labelledby="weather-heading">
    <h2 id="weather-heading">Avisos meteorológicos de Granada</h2>
    <p>Provincia de Granada · <a href={officialPage}>Consultar en AEMET</a></p>
    <p role="status">
      {!online ? 'Sin conexión. El estado actual de los avisos no se puede comprobar.'
        : status === 'loading' ? 'Consultando AEMET…'
        : status === 'error' ? 'No se pudo completar la consulta a AEMET.'
        : stale ? 'La información disponible no permite confirmar el estado actual.'
        : upcoming.length === 0 ? 'AEMET no muestra avisos vigentes ni previstos en esta consulta.'
        : upcoming.length + (upcoming.length === 1 ? ' aviso vigente o previsto.' : ' avisos vigentes o previstos.')}
    </p>
    {!bulletin ? <p>Sin datos de alertas guardados.</p> : <>
      {stale && <p><strong>Copia de la última consulta. Puede haber cambiado.</strong></p>}
      <p>Última consulta válida: <DateLabel date={bulletin.consulted} />. Canal actualizado por AEMET: <DateLabel date={bulletin.published} />.</p>
      {upcoming.map(notice => renderNotice(notice))}
    </>}
    {online && <button type="button" disabled={status === 'loading'} onClick={refresh}>Actualizar avisos</button>}
    <details className="weather-history">
      <summary>Historial guardado en este dispositivo</summary>
      <p>Incluye avisos vistos en consultas de los últimos 30 días. La vigencia que figura en cada registro es la publicada en ese mensaje.</p>
      {previousNotices.length === 0 && <p>Todavía no hay avisos anteriores guardados.</p>}
      {previousNotices.map(entry => renderNotice(entry.notice, entry.lastSeen))}
      <p><a href="https://opendata.aemet.es/">Archivo oficial de AEMET OpenData</a></p>
    </details>
  </section>
}
