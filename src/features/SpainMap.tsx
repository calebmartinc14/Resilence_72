import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Layers3, MapPin, RotateCcw } from 'lucide-react'
import * as L from 'leaflet'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import 'leaflet/dist/leaflet.css'
import { useSeismicReports } from './SeismicReports'
import { useNationalWeather } from '../hooks/useNationalWeather'
import { nationalOfficialPage, type Coordinate } from '../services/aemet'

type Boundaries = FeatureCollection<Polygon | MultiPolygon, { name: string; label?: [number, number] }> & {
  sourceDate: string
  bbox: [west: number, south: number, east: number, north: number]
}
type BoundaryLayer = L.Path & { getBounds(): L.LatLngBounds }
type Region = 'espana' | 'peninsula' | 'canarias' | 'baleares' | 'ciudades'
type View = {
  map: L.Map
  bounds: L.LatLngBounds
  provinces: Map<string, BoundaryLayer>
  regions: Record<Region, L.LatLngBounds>
  municipalities: L.LayerGroup
  towns: Map<string, BoundaryLayer>
  alerts: L.LayerGroup
  events: L.LayerGroup
  location: L.LayerGroup
}

const regions = [
  { id: 'espana', name: 'España' }, { id: 'peninsula', name: 'Península' },
  { id: 'canarias', name: 'Canarias' }, { id: 'baleares', name: 'Baleares' },
  { id: 'ciudades', name: 'Ceuta y Melilla' },
] as const
const source = 'https://api-features.ign.es/collections/administrativeunit?f=html'
const streets = 'https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg'
const granadaId = '34011800000'
const colors = new Map([['amarillo', '#fae087'], ['naranja', '#ffae78'], ['rojo', '#ff817d']])
const dates = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })

function MapDate({ value }: { value: string }) {
  return <time dateTime={value}>{dates.format(new Date(value))}</time>
}

function regionOf(id: string): Exclude<Region, 'espana'> {
  const province = id.slice(4, 6)
  if (province === '35' || province === '38') return 'canarias'
  if (province === '07') return 'baleares'
  if (['51', '52', '54'].includes(province)) return 'ciudades'
  return 'peninsula'
}

function validRing(ring: Coordinate[]) {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) &&
    Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180)
}

function searchKey(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')
}

async function getBoundaries(name: 'espana' | 'granada', signal: AbortSignal): Promise<Boundaries> {
  const response = await fetch(import.meta.env.BASE_URL + name + '.geojson', { signal })
  if (!response.ok) throw new Error('Cartografía no disponible')
  const data = await response.json() as Boundaries
  if (data.type !== 'FeatureCollection' || !data.features.length ||
    data.bbox?.length !== 4 || !data.bbox.every(Number.isFinite) || !Number.isFinite(Date.parse(data.sourceDate))) {
    throw new Error('Cartografía inválida')
  }
  return data
}

// Leaflet interpreta cadenas como HTML. Usamos nodos de texto para los datos externos.
function safeLabel(text: string) {
  const label = document.createElement('span')
  label.textContent = text
  return label
}

export default function SpainMap({ online }: { online: boolean }) {
  const [base, setBase] = useState<Boundaries | null>(null)
  const [baseError, setBaseError] = useState(false)
  const [province, setProvince] = useState('')
  const [region, setRegion] = useState<Region>('espana')
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [eventsEnabled, setEventsEnabled] = useState(true)
  const [streetEnabled, setStreetEnabled] = useState(true)
  const [streetStatus, setStreetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [municipalEnabled, setMunicipalEnabled] = useState(false)
  const [municipal, setMunicipal] = useState<Boundaries | null>(null)
  const [municipalError, setMunicipalError] = useState(false)
  const [town, setTown] = useState('')
  const [position, setPosition] = useState<L.LatLngTuple | null>(null)
  const [locationPending, setLocationPending] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(8)
  const [list, setList] = useState<'avisos' | 'sismos'>('avisos')
  const element = useRef<HTMLDivElement>(null)
  const view = useRef<View | null>(null)
  const weather = useNationalWeather(online, alertsEnabled)
  const seismic = useSeismicReports(eventsEnabled, online)
  const useStreets = online && streetEnabled && !position && !locationPending
  const detailed = useStreets && streetStatus === 'ready'
  const activeList = alertsEnabled && eventsEnabled ? list : alertsEnabled ? 'avisos' : 'sismos'

  const bounds = useMemo(() => {
    if (!base) return null
    const [west, south, east, north] = base.bbox
    return L.latLngBounds([south, west], [north, east])
  }, [base])
  const provinceOptions = useMemo(() => [...(base?.features ?? [])]
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es')), [base])
  const townOptions = useMemo(() => [...(municipal?.features ?? [])]
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es')), [municipal])
  const events = useMemo(() => (seismic.report?.events ?? []).filter(event =>
    event.position && bounds?.pad(.12).contains(event.position)).slice(0, 50), [seismic.report, bounds])
  const matches = useMemo(() => {
    const term = searchKey(query.trim())
    return (weather.index?.entries ?? []).filter(entry => searchKey(entry.title + ' ' + entry.summary).includes(term))
  }, [weather.index, query])
  const selectedEntry = weather.index?.entries.find(entry => entry.url === weather.selectedUrl)
  const placeName = provinceOptions.find(feature => String(feature.id) === province)?.properties.name
    ?? regions.find(item => item.id === region)?.name ?? 'España'

  useEffect(() => {
    const controller = new AbortController()
    void getBoundaries('espana', controller.signal).then(data => {
      if (!controller.signal.aborted) setBase(data)
    }).catch(() => { if (!controller.signal.aborted) setBaseError(true) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!municipalEnabled || municipal) return
    const controller = new AbortController()
    setMunicipalError(false)
    void getBoundaries('granada', controller.signal).then(data => {
      if (!controller.signal.aborted) setMunicipal(data)
    }).catch(() => { if (!controller.signal.aborted) setMunicipalError(true) })
    return () => controller.abort()
  }, [municipalEnabled, municipal])

  useEffect(() => {
    if (!base || !bounds || !element.current) return
    const map = L.map(element.current, {
      minZoom: 3, maxZoom: 16, scrollWheelZoom: false, attributionControl: false, zoomControl: false,
    })
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    L.control.scale({ imperial: false }).addTo(map)
    const provinces = new Map<string, BoundaryLayer>()
    const groupBounds: View['regions'] = {
      espana: bounds, peninsula: L.latLngBounds([]), canarias: L.latLngBounds([]),
      baleares: L.latLngBounds([]), ciudades: L.latLngBounds([]),
    }
    // Los 53 recintos se dibujan sobre un solo lienzo. Los avisos y sismos tienen sus propias capas.
    const renderer = L.canvas()
    L.geoJSON(base, {
      style: { color: '#527569', weight: 1, fillColor: '#b9d1ad', fillOpacity: .95, renderer },
      onEachFeature(feature, layer) {
        const id = String(feature.id)
        const area = layer as BoundaryLayer
        provinces.set(id, area)
        groupBounds[regionOf(id)].extend(area.getBounds())
        layer.bindTooltip(safeLabel(feature.properties.name))
        layer.on('click', () => {
          setProvince(id)
          setRegion(regionOf(id))
          setTown('')
        })
      },
    }).addTo(map)
    view.current = {
      map, bounds, provinces, regions: groupBounds, municipalities: L.layerGroup().addTo(map),
      towns: new Map(), alerts: L.layerGroup().addTo(map),
      events: L.layerGroup().addTo(map), location: L.layerGroup().addTo(map),
    }
    map.fitBounds(bounds, { padding: [10, 12], animate: false })
    map.setMaxBounds(bounds.pad(.8))
    return () => { view.current = null; map.remove() }
  }, [base, bounds])

  useEffect(() => {
    const current = view.current
    if (!current) return
    for (const [id, layer] of current.provinces) {
      layer.setStyle({
        color: id === province ? '#226b55' : detailed ? '#486d60' : '#527569',
        weight: id === province ? 2.5 : .85,
        fillColor: id === province ? '#82b690' : '#b9d1ad',
        fillOpacity: detailed ? (id === province ? .12 : 0) : .95,
      })
    }
  }, [base, province, detailed])

  useEffect(() => {
    const current = view.current
    if (!current) return
    const target = current.provinces.get(province)?.getBounds() ?? current.regions[region]
    // Los saltos directos deben aplicar el último destino incluso si se eligen varios seguidos.
    if (target.isValid()) current.map.fitBounds(target, { padding: [18, 18], maxZoom: 12, animate: false })
  }, [base, province, region])

  useEffect(() => {
    const current = view.current
    if (!useStreets || !current) return
    setStreetStatus('loading')
    let arrived = 0
    const timeout = window.setTimeout(() => { if (!arrived) setStreetStatus('error') }, 5000)
    const tiles = L.tileLayer(streets, {
      tms: true, noWrap: true, updateWhenIdle: true, keepBuffer: 1, maxNativeZoom: 16,
      updateWhenZooming: false, minZoom: 3, bounds: current.bounds.pad(.35), referrerPolicy: 'no-referrer',
    })
      .on('loading', () => { arrived = 0 })
      .on('tileload', () => {
        if (++arrived === 1) setStreetStatus('ready')
      })
      .on('load', () => { if (!arrived) setStreetStatus('error') })
      .addTo(current.map)
    return () => { window.clearTimeout(timeout); tiles.remove() }
  }, [base, useStreets])

  useEffect(() => {
    const current = view.current
    if (!base || !current || detailed) return
    const { map } = current
    const labels = L.layerGroup().addTo(map)
    // Las etiquetas de la copia solo se recalculan al terminar de mover o ampliar el mapa.
    const ordered = [...base.features].sort((a, b) =>
      Number(String(b.id) === province) - Number(String(a.id) === province))
    function renderLabels() {
      labels.clearLayers()
      if (map.getZoom() < 5) return
      const used: { x: number; y: number }[] = []
      const size = map.getSize()
      for (const feature of ordered) {
        const label = feature.properties.label
        if (!label) continue
        const point: L.LatLngTuple = [label[1], label[0]]
        const pixel = map.latLngToContainerPoint(point)
        if (pixel.x < 45 || pixel.x > size.x - 45 || pixel.y < 28 || pixel.y > size.y - 24 ||
          used.some(other => Math.abs(other.x - pixel.x) < 88 && Math.abs(other.y - pixel.y) < 20)) continue
        used.push(pixel)
        L.tooltip({ direction: 'center', permanent: true, className: 'offline-province-label', opacity: 1 })
          .setLatLng(point).setContent(safeLabel(feature.properties.name)).addTo(labels)
      }
    }
    map.on('moveend', renderLabels)
    renderLabels()
    return () => { map.off('moveend', renderLabels); labels.remove() }
  }, [base, detailed, province])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.municipalities.clearLayers()
    current.towns.clear()
    if (!municipal || !municipalEnabled || province !== granadaId) return
    L.geoJSON(municipal, {
      style: { color: '#b1cba7', weight: 1, fillColor: '#466553', fillOpacity: .25 },
      onEachFeature(feature, layer) {
        current.towns.set(String(feature.id), layer as BoundaryLayer)
        layer.bindTooltip(safeLabel(feature.properties.name))
        layer.on('click', () => setTown(String(feature.id)))
      },
    }).addTo(current.municipalities)
  }, [base, province, municipal, municipalEnabled])

  useEffect(() => {
    const current = view.current
    const selected = current?.towns.get(town)
    if (selected) current?.map.fitBounds(selected.getBounds(), { padding: [22, 22], maxZoom: 12, animate: false })
  }, [base, province, municipal, municipalEnabled, town])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.alerts.clearLayers()
    const notice = weather.notice
    if (!alertsEnabled || !notice || Date.parse(notice.ends) <= weather.now || !Array.isArray(notice.polygons)) return
    for (const ring of notice.polygons.filter(validRing)) {
      L.polygon(ring, {
        color: weather.stale ? '#e1e6de' : colors.get(notice.level) ?? '#e1e6de',
        weight: 2, fillOpacity: .22, dashArray: weather.stale ? '5 5' : undefined, className: 'aemet-area',
      }).bindTooltip(safeLabel(notice.title)).addTo(current.alerts)
    }
  }, [base, alertsEnabled, weather.notice, weather.stale, weather.now])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.events.clearLayers()
    if (!eventsEnabled) return
    for (const event of events) {
      if (!event.position) continue
      L.circleMarker(event.position, {
        radius: 6, color: '#163846', weight: 2, fillColor: '#86cdff', fillOpacity: 1, className: 'ign-epicenter',
      }).bindPopup(safeLabel(event.description)).addTo(current.events)
    }
  }, [base, events, eventsEnabled])

  useEffect(() => {
    const current = view.current
    if (!current) return
    current.location.clearLayers()
    if (!position) return
    L.circleMarker(position, {
      radius: 8, color: '#f3ffef', fillColor: '#279d75', fillOpacity: 1, interactive: false,
    }).addTo(current.location)
    current.map.setView(position, Math.max(current.map.getZoom(), 11), { animate: false })
  }, [base, position])

  function jump(id: Region) {
    setProvince('')
    setTown('')
    setRegion(id)
    const current = view.current
    const target = current?.regions[id]
    if (target?.isValid()) current?.map.fitBounds(target, { padding: [18, 18], maxZoom: 12, animate: false })
  }

  function locate() {
    if (position) {
      setPosition(null)
      // Volvemos a un encuadre general antes de permitir otra vez el callejero externo.
      jump('espana')
      setLocationMessage('Ubicación ocultada.')
      return
    }
    if (!navigator.geolocation) {
      setLocationMessage('El navegador no ofrece acceso a la ubicación.')
      return
    }
    // Desactivamos las teselas externas antes de centrar la posición. Las coordenadas se quedan en memoria.
    setStreetEnabled(false)
    setLocationPending(true)
    setLocationMessage('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(result => {
      setLocationPending(false)
      const coords: L.LatLngTuple = [result.coords.latitude, result.coords.longitude]
      if (!view.current?.bounds.pad(.12).contains(coords)) {
        setLocationMessage('Tu ubicación queda fuera del encuadre del mapa.')
        return
      }
      setPosition(coords)
      setLocationMessage('Ubicación mostrada en esta sesión.')
    }, () => {
      setLocationPending(false)
      setLocationMessage('No se pudo obtener tu ubicación. Puedes elegir una provincia.')
    }, { timeout: 8000, maximumAge: 0 })
  }

  function showOnMap(action: (map: L.Map) => void) {
    if (!view.current) return
    action(view.current.map)
    element.current?.scrollIntoView({ block: 'nearest' })
  }

  const rings = Array.isArray(weather.notice?.polygons) ? weather.notice.polygons.filter(validRing) : []
  const expired = Boolean(weather.notice && Date.parse(weather.notice.ends) <= weather.now)

  return <div className="map-page">
    <section className="map-explorer" aria-label="Explorar España">
      <div className="map-stage">
        <div ref={element} className="granada-map spain-map" hidden={!base} role="region" aria-label="Mapa interactivo de España" />
        {base ? <div className="map-place">
          <span><MapPin size={15} aria-hidden="true" /> {placeName}</span>
          <small role="status">{detailed ? 'Callejero IGN' : useStreets && streetStatus === 'loading' ? 'Cargando callejero…' : 'Mapa guardado'}</small>
        </div> : <p className="map-placeholder" role="status">{baseError ? 'No se pudo abrir la cartografía.' : 'Cargando cartografía de España…'}</p>}
        {base && <div className="map-stage-actions">
          <button type="button" className="button" onClick={() => jump('espana')}><RotateCcw size={17} aria-hidden="true" /> Ver España</button>
          <button type="button" className="button" onClick={locate} disabled={locationPending}>
            <Crosshair size={17} aria-hidden="true" /> {position ? 'Ocultar ubicación' : 'Mi ubicación'}
          </button>
        </div>}
      </div>
      {locationMessage && <p className="map-feedback" role="status">{locationMessage}</p>}
      <div className="map-credit">
        <a href={source}>Obra derivada de BDLJE Continua · IGN</a> <span>·</span> <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        {detailed && <> <span>·</span> <a href="https://www.ign.es/web/es/ign/portal/ide-area-nodo-ide-ign">IGN Base Gris</a></>}
      </div>
      <div className="tool-section map-dock">
        <div className="map-dock-title"><Layers3 size={19} aria-hidden="true" /><h2>Explorar y filtrar</h2></div>
        <div className="map-jumps" role="group" aria-label="Encuadre del mapa">
          {regions.map(item => <button key={item.id} type="button" disabled={!base} aria-pressed={!province && region === item.id}
            onClick={() => jump(item.id)}>{item.name}</button>)}
        </div>
        <div className="map-actions">
          <label>Provincia o ciudad autónoma
            <select value={province} disabled={!base} onChange={event => {
              const id = event.target.value
              if (!id) jump(region)
              else { setProvince(id); setRegion(regionOf(id)); setTown('') }
            }}>
              <option value="">Elegir un lugar</option>
              {provinceOptions.map(feature => <option key={feature.id} value={feature.id}>{feature.properties.name}</option>)}
            </select>
          </label>
        </div>
        {province === granadaId && <div className="map-actions">
          <button type="button" aria-pressed={municipalEnabled} onClick={() => { setMunicipalEnabled(value => !value); setTown('') }}>Municipios de Granada</button>
          {municipalEnabled && municipal && <label>Municipio de Granada
            <select value={town} onChange={event => setTown(event.target.value)}>
              <option value="">Elegir un municipio</option>
              {townOptions.map(feature => <option key={feature.id} value={feature.id}>{feature.properties.name}</option>)}
            </select>
          </label>}
          {municipalEnabled && !municipal && <p role="status">{municipalError ? 'No se pudo abrir la capa municipal.' : 'Cargando municipios…'}</p>}
        </div>}
        <div className="map-layers" role="group" aria-label="Capas del mapa">
          <label><input type="checkbox" checked={alertsEnabled} onChange={event => setAlertsEnabled(event.target.checked)} /> Avisos AEMET</label>
          <label><input type="checkbox" checked={eventsEnabled} onChange={event => setEventsEnabled(event.target.checked)} /> Sismos IGN</label>
          <label><input type="checkbox" checked={useStreets} disabled={!online || !!position || locationPending} onChange={event => setStreetEnabled(event.target.checked)} /> Callejero IGN (en línea)</label>
        </div>
        {useStreets && streetStatus === 'error' && <p role="status">El callejero no está disponible. Mostramos el mapa guardado.</p>}
        <details className="map-information">
          <summary>Datos y uso sin conexión</summary>
          <p>Puntos azules: epicentros del IGN. Contorno destacado: zona del aviso seleccionado. Trazo discontinuo: consulta anterior.</p>
          <p>La ubicación solo se usa en esta pantalla. El callejero externo se desactiva al mostrarla.</p>
          {base && <p>Obra derivada de BDLJE Continua CC BY 4.0 ign.es. Límites simplificados. Copia del <MapDate value={base.sourceDate} />.</p>}
        </details>
      </div>
    </section>

    {(alertsEnabled || eventsEnabled) && <section className="tool-section map-list" aria-labelledby="map-data">
      <h2 id="map-data">Datos del mapa</h2>
      {alertsEnabled && eventsEnabled && <div className="map-list-switch" role="group" aria-label="Datos del mapa">
        <button type="button" aria-pressed={activeList === 'avisos'} onClick={() => setList('avisos')}>Avisos</button>
        <button type="button" aria-pressed={activeList === 'sismos'} onClick={() => setList('sismos')}>Sismos</button>
      </div>}
      {!online && <p>Sin conexión. Las consultas guardadas pueden haber cambiado.</p>}
      {alertsEnabled && <div hidden={activeList !== 'avisos'}>
        <h3>Avisos de España · AEMET</h3>
        {weather.index && <p>{weather.stale ? 'Copia de la última consulta, sin confirmar.' : 'Consulta de AEMET.'} <MapDate value={weather.index.consulted} /></p>}
        {!weather.index && <p>{online && weather.status === 'loading' ? 'Consultando AEMET…' : 'Sin consulta de AEMET disponible.'}</p>}
        {online && weather.status === 'error' && <p>No se pudo actualizar el canal nacional.</p>}
        {weather.index && <label>Buscar aviso por zona o fenómeno
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(8) }} placeholder="Por ejemplo, lluvias o Granada" />
        </label>}
        {weather.index && matches.length === 0 && <p>{query.trim() ? 'No hay coincidencias en la consulta mostrada.' : 'El canal consultado no incluye avisos.'}</p>}
        {matches.length > 0 && <ul className="national-alerts">{matches.slice(0, limit).map(entry => <li key={entry.url}>
          <button type="button" aria-pressed={entry.url === weather.selectedUrl}
            onClick={() => weather.select(entry.url === weather.selectedUrl ? null : entry.url)}>{entry.title}</button>
          {selectedEntry?.url === entry.url && <div className="national-detail">
            {entry.summary && <p>{entry.summary}</p>}
            {weather.notice ? <>
              {weather.notice.instruction && <p>{weather.notice.instruction}</p>}
              <p>Vigencia publicada: <MapDate value={weather.notice.starts} /> a <MapDate value={weather.notice.ends} /> (hora peninsular).</p>
              {expired ? <p>El periodo de vigencia publicado ha terminado.</p> : rings.length > 0 ?
                <button type="button" disabled={!base} onClick={() => showOnMap(map => map.fitBounds(L.latLngBounds(rings.flat()), { padding: [18, 18], maxZoom: 12, animate: false }))}>Ver zona en el mapa</button>
                : <p>El aviso no incluye una geometría utilizable.</p>}
            </> : <p role="status">{!online ? 'Este detalle no está guardado en el dispositivo.' :
              weather.detailStatus === 'error' ? 'No se pudo cargar el detalle.' : 'Cargando el detalle oficial…'}</p>}
            <p><a href={entry.url}>Mensaje CAP de AEMET</a></p>
          </div>}
        </li>)}</ul>}
        {matches.length > limit && <button type="button" onClick={() => setLimit(value => value + 8)}>Mostrar más avisos ({matches.length - limit})</button>}
        {online && <button type="button" disabled={weather.status === 'loading'} onClick={weather.refresh}>Actualizar avisos</button>}
        <p><a href={nationalOfficialPage}>Consultar todos los avisos en AEMET</a></p>
      </div>}

      {eventsEnabled && <div hidden={activeList !== 'sismos'}>
        <h3>Epicentros recientes · IGN</h3>
        {seismic.report ? <p>{!online || seismic.status !== 'ready' ? 'Copia guardada del IGN.' : 'Consulta del IGN.'} <MapDate value={seismic.report.consulted} /></p>
          : <p>{online && seismic.status === 'loading' ? 'Consultando el IGN…' : 'Sin consulta del IGN disponible.'}</p>}
        {base && seismic.report && <p>Hasta 50 registros del canal en el encuadre de España y su entorno. Los datos pueden revisarse.</p>}
        {base && seismic.report && events.length === 0 && <p>La consulta mostrada no contiene epicentros en este encuadre.</p>}
        {events.length > 0 && <details><summary>Ver lista de epicentros ({events.length})</summary>
          <ul>{events.map(event => <li key={event.id}>
            <p>{event.description}</p>
            <button type="button" onClick={() => { if (event.position) showOnMap(map => map.setView(event.position!, 10, { animate: false })) }}>Ver epicentro {event.id}</button>
            <p><a href={event.url}>Ficha oficial del IGN</a></p>
          </li>)}</ul>
        </details>}
      </div>}
    </section>}
  </div>
}
