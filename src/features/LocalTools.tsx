import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import type { useHousehold } from '../hooks/useHousehold'
import type { Item } from '../storage/household'
import { guides, downloadGuides } from './guides'
import FamilyPlan from './FamilyPlan'

const filters = [
  { value: 'todos', label: 'Todo' },
  { value: 'por-completar', label: 'Por completar' },
  { value: 'disponible', label: 'Disponible' },
] as const

function searchable(text: string) {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')
}

export default function LocalTools({ page, household }: { page: string; household: ReturnType<typeof useHousehold> }) {
  const { data, ready, message, update } = household
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('todos')
  const [query, setQuery] = useState('')
  const [wh, setWh] = useState(100)
  const [capacityUnit, setCapacityUnit] = useState<'Wh' | 'mAh'>('Wh')
  const [mah, setMah] = useState(20000)
  const [volts, setVolts] = useState(3.7)
  const [hours, setHours] = useState(1)
  const [watts, setWatts] = useState(10)
  const [count, setCount] = useState(1)
  const [efficiency, setEfficiency] = useState(80)
  const nominalWh = capacityUnit === 'Wh' ? wh : mah * volts / 1000
  const available = data.items.filter(item => item.status === 'disponible').length
  const visibleItems = data.items.filter(item =>
    filter === 'todos' || (filter === 'disponible' ? item.status === 'disponible' : item.status !== 'disponible')
  )
  const visibleGuides = guides.filter(guide => searchable(guide.title).includes(searchable(query.trim())))

  return <>
    <section className="tool-section" hidden={page !== 'preparacion'} aria-label="Preparación del hogar">
      <p className="kit-progress"><strong>{available} de {data.items.length}</strong> elementos disponibles</p>
      <p className="save-message" role="status">{message}</p>

      {ready && <>
        <details className="household">
          <summary>Configurar hogar y reserva de agua</summary>
          <p>Reserva estimada para 72 horas: <strong>{(data.people * data.litres * 3).toLocaleString('es-ES', { maximumFractionDigits: 1 })} litros</strong>.</p>
          <form onSubmit={event => {
            event.preventDefault()
            const fields = new FormData(event.currentTarget)
            update({ ...data, people: Number(fields.get('people')), litres: Number(fields.get('litres')) })
          }}>
            <div className="tool-fields">
              <label>Personas en el hogar<input name="people" type="number" min="1" max="100" required defaultValue={data.people} /></label>
              <label>Litros por persona y día<input name="litres" type="number" min="0.1" max="100" step="0.1" required defaultValue={data.litres} /></label>
            </div>
            <p>Ajusta la cantidad según el clima, la salud y las necesidades de tu hogar.</p>
            <button type="submit">Guardar hogar</button>
          </form>
        </details>

        <FamilyPlan data={data} update={update} />

        <div className="filters" role="group" aria-label="Filtrar lista">
          {filters.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}>{option.label}</button>)}
        </div>

        {visibleItems.length ? <ul className="check-list">
          {visibleItems.map(item => <li key={item.id}>
            <span className="item-name">{item.name}</span>
            <select aria-label={'Estado de ' + item.name} value={item.status} onChange={event => {
              const status = event.target.value as Item['status']
              update({ ...data, items: data.items.map(entry => entry.id === item.id ? { ...entry, status } : entry) })
            }}>
              <option value="necesario">Necesario</option>
              <option value="pendiente">Pendiente</option>
              <option value="disponible">Disponible</option>
            </select>
            <button type="button" aria-label={'Eliminar ' + item.name} onClick={() =>
              update({ ...data, items: data.items.filter(entry => entry.id !== item.id) })
            }><Trash2 size={19} aria-hidden="true" /></button>
          </li>)}
        </ul> : <p>{filter === 'todos' ? 'Añade el primer elemento de tu kit.' : 'No hay elementos con este filtro.'}</p>}

        <form className="add-item" onSubmit={event => {
          event.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) return
          update({ ...data, items: [...data.items, { id: crypto.randomUUID(), name: trimmed, status: 'necesario' }] })
          setName('')
          setFilter('todos')
        }}>
          <label>Nuevo elemento<input maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo, un cargador" /></label>
          <button className="button-primary" type="submit" disabled={!name.trim()}><Plus size={18} aria-hidden="true" /> Añadir</button>
        </form>
      </>}
    </section>
    <section className="tool-section" hidden={page !== 'autonomia'} aria-label="Calculadora de energía"><p>Estima la duración de una batería con un consumo constante.</p><div className="tool-fields">
      <label>Unidad de capacidad<select value={capacityUnit} onChange={e => setCapacityUnit(e.target.value as 'Wh' | 'mAh')}><option value="Wh">Wh</option><option value="mAh">mAh y voltaje</option></select></label>
      {capacityUnit === 'Wh' ? <label>Capacidad nominal (Wh)<input type="number" min="0" value={wh} onChange={e => setWh(Math.max(0, Number(e.target.value)))} /></label> : <><label>Capacidad nominal (mAh)<input type="number" min="0" value={mah} onChange={e => setMah(Math.max(0, Number(e.target.value)))} /></label><label>Voltaje nominal de la batería (V)<input type="number" min="0" step="0.1" value={volts} onChange={e => setVolts(Math.max(0, Number(e.target.value)))} /></label></>}
      <label>Consumo por dispositivo (W)<input type="number" min="0" value={watts} onChange={e => setWatts(Math.max(0, Number(e.target.value)))} /></label>
      <label>Número de dispositivos<input type="number" min="1" max="100" value={count} onChange={e => setCount(Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))))} /></label>
      <label>Eficiencia estimada (%)<input type="number" min="1" max="100" value={efficiency} onChange={e => setEfficiency(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label>
      <label>Tiempo de uso previsto (horas)<input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(Math.max(0, Number(e.target.value)))} /></label>
    </div><div className="result"><p>Capacidad nominal: <strong>{nominalWh.toFixed(1)} Wh</strong>. Energía aprovechable aproximada: <strong>{(nominalWh * efficiency / 100).toFixed(1)} Wh</strong>. Autonomía: <strong>{watts > 0 ? `${(nominalWh * efficiency / 100 / (watts * count)).toFixed(1)} horas` : 'introduce un consumo mayor que cero'}</strong>. Consumo previsto: <strong>{(watts * count * hours).toFixed(1)} Wh</strong>.</p></div><p>La duración real depende de la batería, temperatura, inversor y consumo variable. No uses esta cifra para equipos de soporte vital.</p></section>

    <section className="tool-section guide-library" hidden={page !== 'guias'} aria-label="Biblioteca de guías">
      <label>Buscar por tema<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Por ejemplo, inundaciones" /></label>
      <p role="status">{visibleGuides.length === 0 ? 'No se encontraron guías.' : visibleGuides.length + (visibleGuides.length === 1 ? ' guía' : ' guías')}</p>
      {visibleGuides.map(guide => <details key={guide.title}>
        <summary>{guide.title}</summary>
        <p>{guide.text}</p>
        <p>Fuente: <a href={guide.url}>{guide.source}</a>. Revisada el 8 de noviembre de 2026.</p>
      </details>)}
      <button className="download-button" type="button" onClick={downloadGuides}><Download size={18} aria-hidden="true" /> Descargar todas las guías</button>
      <p>Guarda una copia en texto para consultarla sin conexión.</p>
    </section>
  </>
}
