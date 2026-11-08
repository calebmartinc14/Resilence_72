import { Shield } from 'lucide-react'

export default function App() {
  return (
    <main className="dashboard">
      <header className="brand"><Shield aria-hidden="true" /> Resilience 72</header>
      <h1>Preparado para las primeras 72 horas.</h1>
      <p>Preparación ciudadana para particulares y familias en España, con atención inicial a Granada.</p>
      <section aria-label="Estado de la información">
        <article><h2>Alertas oficiales</h2><p>Sin datos. Fuentes pendientes de conectar.</p></article>
        <article><h2>Meteorología</h2><p>Sin datos de AEMET. Última consulta: sin consultar.</p></article>
        <article><h2>Preparación del hogar</h2><p>Lista y calculadoras previstas en la siguiente fase.</p></article>
      </section>
    </main>
  )
}
