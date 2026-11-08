import { useState } from 'react'
import { BatteryCharging } from 'lucide-react'

type Draft = {
  unit: 'Wh' | 'mAh'
  wh: string
  mah: string
  volts: string
  watts: string
  count: string
  efficiency: string
  hours: string
}

const empty: Draft = { unit: 'Wh', wh: '', mah: '', volts: '', watts: '', count: '1', efficiency: '80', hours: '1' }
const examples = {
  externa: {
    label: 'Batería externa',
    assumptions: '10.000 mAh a 3,7 V · Dispositivo de 5 W · Eficiencia del 85 %',
    draft: { ...empty, unit: 'mAh', mah: '10000', volts: '3.7', watts: '5', efficiency: '85' },
  },
  luz: {
    label: 'Luz LED',
    assumptions: 'Batería de 24 Wh · Luz de 3 W durante 4 horas · Eficiencia del 90 %',
    draft: { ...empty, wh: '24', watts: '3', hours: '4', efficiency: '90' },
  },
  router: {
    label: 'Router',
    assumptions: 'Batería de 150 Wh · Router de 12 W durante 8 horas · Eficiencia del 85 %',
    draft: { ...empty, wh: '150', watts: '12', hours: '8', efficiency: '85' },
  },
} satisfies Record<string, { label: string; assumptions: string; draft: Draft }>

type Example = keyof typeof examples
type DraftId = Example | 'propios'

const format = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function numberFrom(raw: string, min = 0, max = Infinity) {
  const number = Number(raw)
  return raw !== '' && Number.isFinite(number) && number >= min && number <= max ? number : null
}

function estimate(draft: Draft) {
  const capacity = numberFrom(draft.unit === 'Wh' ? draft.wh : draft.mah)
  const voltage = draft.unit === 'Wh' ? 1 : numberFrom(draft.volts, Number.MIN_VALUE)
  const devices = numberFrom(draft.count, 1, 100)
  const power = numberFrom(draft.watts)
  const percent = numberFrom(draft.efficiency, 1, 100)
  const duration = numberFrom(draft.hours)
  if (capacity === null || voltage === null || devices === null || !Number.isInteger(devices) ||
    power === null || percent === null || duration === null) return null

  // Los mAh se convierten a Ah al dividir entre 1000. Ah × V da Wh.
  const nominal = draft.unit === 'Wh' ? capacity : capacity / 1000 * voltage
  const usable = nominal * (percent / 100)
  const totalPower = power * devices
  const planned = totalPower * duration
  // Si el consumo es cero, dividir entre él no daría una autonomía útil.
  const autonomy = totalPower > 0 ? usable / totalPower : null
  if (![nominal, usable, planned, autonomy ?? 0].every(Number.isFinite)) return null

  return { nominal, usable, planned, autonomy, margin: usable - planned }
}

export default function EnergyCalculator({ hidden }: { hidden: boolean }) {
  const [mode, setMode] = useState<'ejemplos' | 'propios'>('ejemplos')
  const [example, setExample] = useState<Example>('externa')
  // Cada ejemplo y los datos propios tienen su borrador durante la sesión.
  const [drafts, setDrafts] = useState<Record<DraftId, Draft>>({
    propios: empty, externa: examples.externa.draft, luz: examples.luz.draft, router: examples.router.draft,
  })
  const id = mode === 'propios' ? 'propios' : example
  const draft = drafts[id]
  const result = estimate(draft)

  function update<Key extends keyof Draft>(field: Key, value: Draft[Key]) {
    setDrafts(previous => ({ ...previous, [id]: { ...previous[id], [field]: value } }))
  }

  return <section className="tool-section energy-panel" hidden={hidden} aria-label="Calculadora de energía">
    <div className="energy-switch" role="group" aria-label="Datos de la calculadora">
      <button type="button" aria-pressed={mode === 'ejemplos'} onClick={() => setMode('ejemplos')}>Probar un ejemplo</button>
      <button type="button" aria-pressed={mode === 'propios'} onClick={() => setMode('propios')}>Usar mis datos</button>
    </div>

    {mode === 'ejemplos' ? <div className="energy-example">
      <label>Ejemplo editable
        <select value={example} onChange={event => setExample(event.target.value as Example)}>
          {(Object.keys(examples) as Example[]).map(key => <option key={key} value={key}>{examples[key].label}</option>)}
        </select>
      </label>
      <p><strong>Datos de demostración.</strong> Valores de partida: {examples[example].assumptions}. Puedes cambiar cualquier campo.</p>
    </div> : <p>Usa la capacidad y el voltaje nominal que figuran en la etiqueta de tu batería.</p>}

    <div className="energy-result" role="status">
      <span className="energy-result-label"><BatteryCharging size={18} aria-hidden="true" /> Autonomía estimada</span>
      {result ? <>
        <strong className="energy-total">{result.autonomy === null ? 'Sin estimación' : format.format(result.autonomy) + ' horas'}</strong>
        {result.autonomy === null && <p>Introduce un consumo mayor que cero para calcular la duración.</p>}
        <dl className="energy-breakdown">
          <div><dt>Capacidad nominal</dt><dd>{format.format(result.nominal)} Wh</dd></div>
          <div><dt>Energía aprovechable</dt><dd>{format.format(result.usable)} Wh</dd></div>
          <div><dt>Consumo previsto</dt><dd>{format.format(result.planned)} Wh</dd></div>
          <div><dt>{result.margin < 0 ? 'Energía que falta' : 'Margen estimado'}</dt><dd>{format.format(Math.abs(result.margin))} Wh</dd></div>
        </dl>
      </> : <p>Completa los campos con valores válidos para ver el resultado.</p>}
    </div>

    <div className="tool-fields">
      <label>Unidad de capacidad
        <select value={draft.unit} onChange={event => update('unit', event.target.value as Draft['unit'])}>
          <option value="Wh">Wh</option><option value="mAh">mAh y voltaje</option>
        </select>
      </label>
      {draft.unit === 'Wh' ? <label>Capacidad nominal (Wh)
        <input type="number" min="0" step="any" value={draft.wh} onChange={event => update('wh', event.target.value)} />
      </label> : <>
        <label>Capacidad nominal (mAh)
          <input type="number" min="0" step="any" value={draft.mah} onChange={event => update('mah', event.target.value)} />
        </label>
        <label>Voltaje nominal de la batería (V)
          <input type="number" min="0" step="any" value={draft.volts} onChange={event => update('volts', event.target.value)} />
        </label>
      </>}
      <label>Consumo por dispositivo (W)
        <input type="number" min="0" step="any" value={draft.watts} onChange={event => update('watts', event.target.value)} />
      </label>
      <label>Número de dispositivos
        <input type="number" min="1" max="100" value={draft.count} onChange={event => update('count', event.target.value)} />
      </label>
      <label>Tiempo de uso previsto (horas)
        <input type="number" min="0" step="any" value={draft.hours} onChange={event => update('hours', event.target.value)} />
      </label>
    </div>

    <details className="energy-settings">
      <summary>Ajustar eficiencia ({draft.efficiency || '—'} %)</summary>
      <label>Eficiencia estimada (%)
        <input type="number" min="1" max="100" step="any" value={draft.efficiency} onChange={event => update('efficiency', event.target.value)} />
      </label>
      <p>Parte de la capacidad se pierde al alimentar el dispositivo. La eficiencia indica qué porcentaje estimas que podrás aprovechar.</p>
    </details>
    <p>La duración real depende de la batería, la temperatura y las variaciones de consumo. No uses esta cifra para equipos de soporte vital.</p>
  </section>
}
