import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, RotateCcw } from 'lucide-react'
import * as L from 'leaflet'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import 'leaflet/dist/leaflet.css'
import { useWeatherBulletin } from './WeatherNotices'
import { useSeismicReports } from './SeismicReports'
import type { Coordinate } from '../services/aemet'

type Municipalities = FeatureCollection<Polygon | MultiPolygon, { name: string }> & {
  sourceDate: string
  bbox: [west: number, south: number, east: number, north: number]
}

const source = 'https://api-features.ign.es/collections/administrativeunit?f=html'
const timeFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })
const colors = new Map([['amarillo', '#fae087'], ['naranja', '#ffae78'], ['rojo', '#ff817d']])

function validRing(ring: Coordinate[]) {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) &&
    Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180)
}

function MapDate({ value }: { value: string }) {
  return <time dateTime={value}>{timeFormat.format(new Date(value))}</time>
}

export default function GranadaMap({ online }: { online: boolean }) {
  const [base, setBase] = useState<Municipalities | null>(null)
  const [baseError, setBaseError] = useState(false)
  const [municipality, setMunicipality] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [locationPending, setLocationPending] = useState(false)
  const [position, setPosition] = useState<L.LatLngTuple | null>(null)
  const element = useRef<HTMLDivElement>(null)
  const view = useRef<{
    map: L.Map
    bounds: L.LatLngBounds
    municipalities: Map<string, L.Path & { getBounds(): L.LatLngBounds }>
    alerts: L.LayerGroup
    events: L.LayerGroup
    location: L.LayerGroup
  } | null>(null)

  const weather = useWeatherBulletin(online)
  const seismic = useSeismicReports(true, online)
  const notices = (weather.bulletin?.notices ?? []).filter(notice => Date.parse(notice.ends) > weather.now)
  const seismicCopy = !online || seismic.status !== 'ready'
  const regionalBounds = useMemo(() => base ? L.geoJSON(base).getBounds().pad(.35) : null, [base])
  const events = useMemo(() => (seismic.report?.events ?? []).filter(event =>
    event.position && regionalBounds?.contains(event.position)).slice(0, 12), [seismic.report, regionalBounds])

  useEffect(() => {
    const controller = new AbortController()
    void fetch(import.meta.env.BASE_URL + 'granada.geojson', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Cartografía no disponible')
      const data = await response.json() as Municipalities
      if (data.type !== 'FeatureCollection' || !data.features.length ||
        data.bbox?.length !== 4 || !data.bbox.every(Number.isFinite) || !Number.isFinite(Date.parse(data.sourceDate))) {
        throw new Error('Cartografía inválida')
      }
      if (!controller.signal.aborted) setBase(data)
    }).catch(() => {
      if (!controller.signal.aborted) setBaseError(true)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!base || !element.current) return
    const map = L.map(element.current, {
      minZoom: 7, maxZoom: 13, scrollWheelZoom: false, attributionControl: false, zoomControl: false,
    })
    L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    const municipalities = new Map<string, L.Path & { getBounds(): L.LatLngBounds }>()
    const boundary = L.geoJSON(base, {
      style: { color: '#678e81', weight: 1, fillColor: '#315149', fillOpacity: .72 },
      onEachFeature(feature, layer) {
        municipalities.set(String(feature.id), layer as L.Path & { getBounds(): L.LatLngBounds })
        layer.on('click', () => setMunicipality(String(feature.id)))
      },
    }).addTo(map)
    const bounds = boundary.getBounds()
    map.fitBounds(bounds, { padding: [12, 12] })
    map.setMaxBounds(bounds.pad(1.25))
    L.control.scale({ imperial: false }).addTo(map)
    view.current = {
      map, bounds, municipalities, alerts: L.layerGroup().addTo(map),
      events: L.layerGroup().addTo(map), location: L.layerGroup().addTo(map),
    }
    return () => {
      view.current = null
      map.remove()
    }
  }, [base])

  useEffect(() => {
    const current = view.current
    if (!current) return
    const { map, municipalities } = current
    for (const [id, layer] of municipalities) {
      layer.setStyle({ color: id === municipality ? '#d4f2bd' : '#678e81', weight: id === municipality ? 2 : 1 })
    }
    const selected = municipalities.get(municipality)
    if (selected) map.fitBounds(selected.getBounds(), { padding: [24, 24], maxZoom: 12 })
  }, [base, municipality])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.alerts.clearLayers()
    for (const notice of weather.bulletin?.notices ?? []) {
      if (Date.parse(notice.ends) <= weather.now || !Array.isArray(notice.polygons)) continue
      for (const ring of notice.polygons.filter(validRing)) {
        L.polygon(ring, {
          color: weather.stale ? '#c6c6c6' : colors.get(notice.level) ?? '#c6c6c6',
          weight: 2, fillOpacity: .25, dashArray: weather.stale ? '5 5' : undefined,
          interactive: false, className: 'aemet-area',
        }).addTo(current.alerts)
      }
    }

  }, [base, weather.bulletin, weather.stale, weather.now])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.events.clearLayers()
    for (const event of events) {
      if (!event.position) continue
      L.circleMarker(event.position, {
        radius: 5, color: '#161f26', weight: 2, fillColor: '#86cdff', fillOpacity: 1,
        interactive: false, className: 'ign-epicenter',
      }).addTo(current.events)
    }
  }, [base, events])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.location.clearLayers()
    if (position) {
      L.circleMarker(position, {
        radius: 8, color: '#f3ffef', fillColor: '#279d75', fillOpacity: 1, interactive: false,
      }).addTo(current.location)
      current.map.setView(position, Math.max(current.map.getZoom(), 11))
    }
  }, [base, position])

  function reset() {
    setMunicipality('')
    const current = view.current
    if (current) current.map.fitBounds(current.bounds, { padding: [12, 12] })
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage('El navegador no ofrece acceso a la ubicación.')
      return
    }
    setLocationPending(true)
    setLocationMessage('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(result => {
      setLocationPending(false)
      const coords: L.LatLngTuple = [result.coords.latitude, result.coords.longitude]
      if (!view.current?.bounds.pad(.35).contains(coords)) {
        setPosition(null)
        setLocationMessage('Tu ubicación queda fuera del área que cubre este mapa.')
        return
      }
      setPosition(coords)
      setLocationMessage('Ubicación mostrada en esta sesión.')
    }, () => {
      setLocationPending(false)
      setLocationMessage('No se pudo obtener tu ubicación. Puedes elegir un municipio.')
    }, { timeout: 8000, maximumAge: 0 })
  }

  function focusArea(polygons: Coordinate[][]) {
    const bounds = L.latLngBounds(polygons.flat())
    if (bounds.isValid()) view.current?.map.fitBounds(bounds, { padding: [16, 16], maxZoom: 12 })
  }

  const options = useMemo(() => [...(base?.features ?? [])]
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es')), [base])

  return <div className="map-page">
    <section className="tool-section" aria-labelledby="map-tools">
      <h2 id="map-tools">Explorar Granada</h2>
      <p>Mapa de orientación con límites municipales. Consulta las capas también en la lista debajo del mapa.</p>
      <div className="map-actions">
        <label>Municipio<select value={municipality} onChange={event => {
          const id = event.target.value
          if (id) setMunicipality(id)
          else reset()
        }} disabled={!base}>
          <option value="">Toda la provincia</option>
          {options.map(feature => <option key={feature.id} value={feature.id}>{feature.properties.name}</option>)}
        </select></label>
        <button type="button" onClick={reset} disabled={!base}><RotateCcw size={18} aria-hidden="true" /> Ver provincia</button>
        <button type="button" onClick={locate} disabled={!base || locationPending}><Crosshair size={18} aria-hidden="true" /> Mi ubicación</button>
      </div>
      <p>La ubicación se usa en esta pantalla. No se guarda ni se envía.</p>
      {locationMessage && <p role="status">{locationMessage}</p>}
      {!base && <p role="status">{baseError ? 'No se pudo abrir la cartografía guardada.' : 'Cargando cartografía…'}</p>}
      <div ref={element} className="granada-map" hidden={!base} role="region" aria-label="Mapa interactivo de Granada" />
      {base && <>
        <p>Contornos destacados: zonas de aviso de AEMET. Los trazos discontinuos indican una consulta anterior. Puntos azules: epicentros del IGN.</p>
        <p className="map-source">Obra derivada de <a href={source}>BDLJE</a> Continua <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> <a href="https://www.ign.es/">ign.es</a>. Límites simplificados. Copia cartográfica del <MapDate value={base.sourceDate} />.</p>
      </>}
    </section>

    <section className="tool-section map-list" aria-labelledby="map-data">
      <h2 id="map-data">Capas y datos</h2>
      <h3>Zonas de aviso · AEMET</h3>
      {!online && <p>Sin conexión. El estado actual de las capas no se puede comprobar.</p>}
      {weather.bulletin && <p>{weather.stale ? 'Copia de la última consulta, sin confirmar.' : 'Consulta de AEMET.'} <MapDate value={weather.bulletin.consulted} /></p>}
      {!weather.bulletin && <p>{online && weather.status === 'loading' ? 'Consultando AEMET…' : 'Sin consulta de AEMET disponible.'}</p>}
      {weather.bulletin && notices.length === 0 && <p>No aparecen avisos con un periodo de vigencia abierto en la consulta mostrada.</p>}
      {notices.length > 0 && <ul>{notices.map(notice => {
        const rings = Array.isArray(notice.polygons) ? notice.polygons.filter(validRing) : []
        return <li key={notice.id}>
          <strong>{notice.title}</strong>
          <p>{notice.area}{notice.level && ' · Nivel ' + notice.level} · Del <MapDate value={notice.starts} /> al <MapDate value={notice.ends} /></p>
          {rings.length > 0 ? <button type="button" disabled={!base} onClick={() => focusArea(rings)}>Ver zona de {notice.area}</button>
            : <p>Sin geometría disponible en esta consulta.</p>}
          <p><a href={notice.url}>Aviso oficial de AEMET</a></p>
        </li>
      })}</ul>}
      <p><a href="#alertas">Ver detalles e instrucciones en Avisos</a></p>

      <h3>Epicentros recientes · IGN</h3>
      {seismic.report ? <p>{seismicCopy ? 'Copia guardada del IGN.' : 'Consulta del IGN.'} <MapDate value={seismic.report.consulted} /></p>
        : <p>{online && seismic.status === 'loading' ? 'Consultando el IGN…' : 'Sin consulta del IGN disponible.'}</p>}
      {base && seismic.report && <p>Hasta 12 registros del canal dentro del encuadre de Granada y su entorno. El IGN puede revisar estos datos.</p>}
      {base && seismic.report && events.length === 0 && <p>La consulta mostrada no contiene epicentros en este encuadre.</p>}
      {events.length > 0 && <ul>{events.map(event => <li key={event.id}>
        <p>{event.description}</p>
        <button type="button" onClick={() => { if (event.position) view.current?.map.setView(event.position, 11) }}>Ver epicentro {event.id}</button>
        <p><a href={event.url}>Ficha oficial del IGN</a></p>
      </li>)}</ul>}
    </section>
  </div>
}
