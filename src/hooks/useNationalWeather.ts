import { useEffect, useState } from 'react'
import { fetchNationalIndex, fetchNationalNotice, type NationalIndex, type Notice } from '../services/aemet'

const indexKey = 'resilience72:aemet:espana:index:v1'
const detailKey = 'resilience72:aemet:espana:cap:v1'
type Status = 'loading' | 'ready' | 'error'

function readLocal(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

function writeLocal(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* La consulta sigue disponible en memoria. */ }
}

function savedIndex() {
  const saved = readLocal(indexKey) as NationalIndex | null
  return saved && Number.isFinite(Date.parse(saved.consulted)) && Number.isFinite(Date.parse(saved.published)) &&
    Array.isArray(saved.entries) && saved.entries.every(entry => entry && typeof entry.title === 'string' &&
      typeof entry.summary === 'string' && typeof entry.url === 'string' &&
      entry.url.startsWith('https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/cap/')) ? saved : null
}

function savedDetails(): Notice[] {
  const saved = readLocal(detailKey) as Notice[] | null
  return Array.isArray(saved) ? saved.filter(notice => notice && typeof notice.url === 'string' &&
    typeof notice.title === 'string' && Number.isFinite(Date.parse(notice.ends)) && Number.isFinite(Date.parse(notice.starts))) : []
}

export function useNationalWeather(online: boolean, enabled: boolean) {
  const [index, setIndex] = useState(savedIndex)
  const [details, setDetails] = useState(savedDetails)
  const [status, setStatus] = useState<Status>('loading')
  const [detailStatus, setDetailStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const notice = details.find(item => item.url === selectedUrl)

  useEffect(() => {
    if (!online || !enabled) return
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)])
    setStatus('loading')
    void fetchNationalIndex(signal).then(result => {
      if (controller.signal.aborted) return
      setIndex(result)
      setSelectedUrl(url => result.entries.some(entry => entry.url === url) ? url : null)
      setStatus('ready')
      setNow(Date.now())
      writeLocal(indexKey, result)
    }).catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [online, enabled, attempt])

  useEffect(() => {
    if (!online || !enabled || !selectedUrl || notice) return
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)])
    setDetailStatus('loading')
    void fetchNationalNotice(selectedUrl, signal).then(result => {
      if (controller.signal.aborted) return
      if (!result) {
        setDetailStatus('error')
        return
      }
      // Solo guardamos los últimos detalles abiertos; el índice no incluye geometrías.
      setDetails(previous => [result, ...previous.filter(item => item.url !== result.url)].slice(0, 20))
      setDetailStatus('ready')
    }).catch(() => { if (!controller.signal.aborted) setDetailStatus('error') })
    return () => controller.abort()
  }, [online, enabled, selectedUrl, notice, attempt])

  useEffect(() => { if (details.length) writeLocal(detailKey, details) }, [details])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    const update = window.setInterval(() => { if (online && enabled) setAttempt(value => value + 1) }, 5 * 60_000)
    return () => { window.clearInterval(clock); window.clearInterval(update) }
  }, [online, enabled])

  const stale = !online || status !== 'ready' || !index ||
    now - Date.parse(index.consulted) > 15 * 60_000 || now - Date.parse(index.published) > 72 * 60 * 60_000

  return {
    index, notice, selectedUrl, detailStatus, status, stale, now,
    select: (url: string | null) => { setDetailStatus('loading'); setSelectedUrl(url) },
    refresh: () => setAttempt(value => value + 1),
  }
}
