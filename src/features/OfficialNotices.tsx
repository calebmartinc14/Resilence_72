import WeatherNotices from './WeatherNotices'
import SeismicReports from './SeismicReports'

export default function OfficialNotices({ online }: { online: boolean }) {
  return <>
    <WeatherNotices online={online} />
    <SeismicReports online={online} />
    <details className="tool-section official-panel">
      <summary>Otras fuentes oficiales</summary>
      <ul>
        <li><a href="https://ran-vmap.proteccioncivil.es/">Mapa de avisos de Protección Civil · RAN</a></li>
        <li><a href="https://nap.dgt.es/es/dataset/incidencias-de-trafico-srti-en-formato-lod-datex-ii">Incidencias de tráfico · DGT</a></li>
      </ul>
    </details>
  </>
}
