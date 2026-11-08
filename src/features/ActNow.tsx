import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Droplets, Flame, House, Phone, Radio, Shield, Snowflake, Sun, Waves, ZapOff } from 'lucide-react'
import { guides } from './guides'
import GuideBody from './GuideBody'

const icons = {
  nacional: Radio, conflicto: Shield,
  luz: ZapOff, agua: Droplets, inundacion: Waves, incendio: Flame, calor: Sun,
  frio: Snowflake, terremoto: House, comunicaciones: Radio,
}

export default function ActNow() {
  const [selected, setSelected] = useState<string | null>(null)
  const guide = guides.find(item => item.id === selected)
  const instructions = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (guide) instructions.current?.focus()
  }, [guide])

  return <div className="act-now">
    <aside className="act-emergency" aria-label="Teléfono de emergencias">
      <span><strong>¿Hay peligro inmediato?</strong><small>Llama a emergencias cuando sea posible.</small></span>
      <a className="button" href="tel:112"><Phone size={18} aria-hidden="true" /> Llamar al 112</a>
    </aside>

    <section className="tool-section" aria-label="Instrucciones por situación">
      <h2>Elige lo que está pasando</h2>
      <p>Las instrucciones están incluidas en la copia sin conexión.</p>
      <div className="act-options" role="group" aria-label="Situaciones de emergencia">
        {guides.map(item => {
          const Icon = icons[item.id]
          return <button key={item.id} type="button" aria-pressed={selected === item.id}
            aria-controls="act-guidance" onClick={() => setSelected(item.id)}>
            <Icon size={20} aria-hidden="true" />{item.title}
          </button>
        })}
      </div>
      <div id="act-guidance" className="act-guidance" aria-live="polite">
        {guide && <>
          <h3 ref={instructions} tabIndex={-1}>{guide.title}</h3>
          <GuideBody guide={guide} />
          {guide.id === 'luz' && <a className="button" href="#autonomia">Calcular energía <ArrowRight size={16} aria-hidden="true" /></a>}
          {(guide.id === 'nacional' || guide.id === 'conflicto') &&
            <a className="button" href="#preparacion">Preparar mi kit <ArrowRight size={16} aria-hidden="true" /></a>}
        </>}
      </div>
    </section>

    <div className="act-links">
      <a className="button" href="#mapa">Consultar el mapa <ArrowRight size={16} aria-hidden="true" /></a>
      <a className="button" href="#internacional">Información internacional <ArrowRight size={16} aria-hidden="true" /></a>
      <a className="button" href="#guias"><ArrowLeft size={16} aria-hidden="true" /> Ver todas las guías</a>
    </div>
  </div>
}
