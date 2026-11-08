import WeatherNotices from './WeatherNotices'
import SeismicReports from './SeismicReports'

export default function OfficialNotices({ online }: { online: boolean }) {
  return <>
    <WeatherNotices online={online} />
    <p className="national-map-link"><a className="button" href="#mapa">Consultar avisos de toda España en el mapa</a></p>
    <p className="national-map-link"><a className="button" href="#internacional">Información internacional de Noticias ONU</a></p>
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
