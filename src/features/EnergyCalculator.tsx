import { useState } from 'react'

function numberFrom(raw: string, min = 0, max = Infinity) {
  const number = Number(raw)
  return raw !== '' && Number.isFinite(number) && number >= min && number <= max ? number : null
}

export default function EnergyCalculator({ hidden }: { hidden: boolean }) {
  // Conservamos lo escrito como texto: vaciar un campo no equivale a introducir cero.
  const [unit, setUnit] = useState<'Wh' | 'mAh'>('Wh')
  const [wh, setWh] = useState('100')
  const [mah, setMah] = useState('20000')
  const [volts, setVolts] = useState('3.7')
  const [watts, setWatts] = useState('10')
  const [count, setCount] = useState('1')
  const [efficiency, setEfficiency] = useState('80')
  const [hours, setHours] = useState('1')

  const capacity = numberFrom(unit === 'Wh' ? wh : mah)
  const voltage = unit === 'mAh' ? numberFrom(volts, Number.MIN_VALUE) : null
  const devices = numberFrom(count, 1, 100)
  const power = numberFrom(watts)
  const percent = numberFrom(efficiency, 1, 100)
  const duration = numberFrom(hours)

  // Los mAh se convierten a Ah al dividir entre 1000. Al multiplicar Ah por V obtenemos Wh.
  const nominal = capacity === null ? null : unit === 'Wh' ? capacity
    : voltage === null ? null : capacity / 1000 * voltage
  const usable = nominal === null || percent === null ? null : nominal * (percent / 100)
  const totalPower = power === null || devices === null || !Number.isInteger(devices) ? null : power * devices
  const planned = totalPower === null || duration === null ? null : totalPower * duration
  const autonomy = usable !== null && totalPower ? usable / totalPower : null
  const valid = nominal !== null && usable !== null && planned !== null &&
    Number.isFinite(nominal) && Number.isFinite(usable) && Number.isFinite(planned) &&
    (autonomy === null || Number.isFinite(autonomy))

  return <section className="tool-section" hidden={hidden} aria-label="Calculadora de energía">
    <p>Estima la duración de una batería con un consumo constante.</p>
    <div className="tool-fields">
      <label>Unidad de capacidad
        <select value={unit} onChange={event => setUnit(event.target.value as 'Wh' | 'mAh')}>
          <option value="Wh">Wh</option><option value="mAh">mAh y voltaje</option>
        </select>
      </label>
      {unit === 'Wh' ? <label>Capacidad nominal (Wh)
        <input type="number" min="0" step="any" value={wh} onChange={event => setWh(event.target.value)} />
      </label> : <>
        <label>Capacidad nominal (mAh)
          <input type="number" min="0" step="any" value={mah} onChange={event => setMah(event.target.value)} />
        </label>
        <label>Voltaje nominal de la batería (V)
          <input type="number" min="0" step="any" value={volts} onChange={event => setVolts(event.target.value)} />
        </label>
      </>}
      <label>Consumo por dispositivo (W)
        <input type="number" min="0" step="any" value={watts} onChange={event => setWatts(event.target.value)} />
      </label>
      <label>Número de dispositivos
        <input type="number" min="1" max="100" value={count} onChange={event => setCount(event.target.value)} />
      </label>
      <label>Eficiencia estimada (%)
        <input type="number" min="1" max="100" step="any" value={efficiency} onChange={event => setEfficiency(event.target.value)} />
      </label>
      <label>Tiempo de uso previsto (horas)
        <input type="number" min="0" step="any" value={hours} onChange={event => setHours(event.target.value)} />
      </label>
    </div>
    <div className="result" role="status">{valid ? <p>
      Capacidad nominal: <strong>{nominal.toFixed(1)} Wh</strong>. Energía aprovechable aproximada: <strong>{usable.toFixed(1)} Wh</strong>.
      {' '}Autonomía: <strong>{autonomy === null ? 'introduce un consumo mayor que cero' : autonomy.toFixed(1) + ' horas'}</strong>.
      {' '}Consumo previsto: <strong>{planned.toFixed(1)} Wh</strong>.
    </p> : <p>Completa los campos con valores válidos para ver el resultado.</p>}</div>
    <p>La duración real depende de la batería, temperatura, inversor y consumo variable. No uses esta cifra para equipos de soporte vital.</p>
  </section>
}
