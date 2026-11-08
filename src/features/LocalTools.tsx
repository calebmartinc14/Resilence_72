import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import type { useHousehold } from '../hooks/useHousehold'
import type { Item } from '../storage/household'
import { guides, downloadGuides } from './guides'
import FamilyPlan from './FamilyPlan'
import EnergyCalculator from './EnergyCalculator'

const filters = [
  { value: 'todos', label: 'Todo' },
  { value: 'por-completar', label: 'Por completar' },
  { value: 'disponible', label: 'Disponible' },
] as const

// Quitamos tildes y diferencias de mayúsculas para que «frio» encuentre «Ola de frío».
function searchable(text: string) {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')
}

export default function LocalTools({ page, household }: { page: string; household: ReturnType<typeof useHousehold> }) {
  const { data, ready, message, update } = household
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('todos')
  const [query, setQuery] = useState('')
  const available = data.items.filter(item => item.status === 'disponible').length
  const visibleItems = data.items.filter(item =>
    filter === 'todos' || (filter === 'disponible' ? item.status === 'disponible' : item.status !== 'disponible')
  )
  const search = searchable(query.trim())
  const visibleGuides = guides.filter(guide => searchable(guide.title).includes(search))

  // Ocultar las secciones permite conservar filtros, cálculos y borradores al navegar.
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
            // FormData recoge el formulario y el resto del hogar se conserva con la copia del objeto.
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
    <EnergyCalculator hidden={page !== 'autonomia'} />

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
