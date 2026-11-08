import type { useInternationalNews } from '../hooks/useInternationalNews'
import { esAlertInfo, newsSource } from '../services/internationalNews'

const format = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' })
type News = ReturnType<typeof useInternationalNews>

function DateLabel({ value }: { value: string }) {
  return <time dateTime={value}>{format.format(new Date(value))}</time>
}

export default function InternationalNews({ news, online }: { news: News; online: boolean }) {
  return <div className="international-page">
    <section className="tool-section" aria-labelledby="international-news-title">
      <h2 id="international-news-title">Paz y seguridad · Noticias ONU</h2>
      <p>Titulares en español sobre conflictos y seguridad internacional. Cada publicación enlaza a su fuente.</p>
      <p role="status">
        {!online ? 'Sin conexión. Se muestra la última copia si está disponible.'
          : news.status === 'loading' ? 'Consultando Noticias ONU…'
          : news.status === 'error' ? 'No se pudo consultar Noticias ONU.'
          : news.status === 'ready' ? 'Consulta de Noticias ONU completada.' : 'Consultando Noticias ONU…'}
      </p>
      {news.snapshot ? <>
        {(!online || news.status !== 'ready') && <p><strong>Copia de la última consulta válida.</strong></p>}
        <p>Última consulta: <DateLabel value={news.snapshot.consulted} /> (hora peninsular).</p>
        <ul className="news-list">
          {news.snapshot.items.map(item => <li key={item.id}>
            <a href={item.url}>{item.title}</a>
            <small><DateLabel value={item.published} /> · Noticias ONU</small>
          </li>)}
        </ul>
      </> : <p>Sin publicaciones guardadas.</p>}
      {online && <button type="button" disabled={news.status === 'loading'} onClick={news.refresh}>Actualizar noticias</button>}
      <p><a href={newsSource}>Canal oficial de Paz y Seguridad</a></p>
    </section>

    <section className="tool-section news-settings" aria-labelledby="international-notices">
      <h2 id="international-notices">Avisos de novedades</h2>
      <p>Con los avisos activados, la app consulta el canal cada cinco minutos mientras está visible y conectada. Las novedades son publicaciones del canal.</p>
      <button type="button" aria-pressed={news.enabled} onClick={news.toggle}>Avisos en la app</button>
      {news.enabled && <>
        <p role="status">Avisos en la app activados.</p>
        {news.permission === 'default' && <button type="button" onClick={() => void news.allowDevice()}>Permitir notificaciones del dispositivo</button>}
        {news.permission === 'granted' && <p>Permiso del dispositivo concedido. Se usa cuando el navegador admite notificaciones de esta aplicación.</p>}
        {news.permission === 'denied' && <p>El dispositivo ha bloqueado las notificaciones. Puedes cambiar el permiso en el navegador.</p>}
        {news.permission === 'unavailable' && <p>Este navegador solo permite mostrar novedades dentro de la app.</p>}
      </>}
      <p>Para alertas de emergencia dirigidas a tu zona en España, consulta <a href={esAlertInfo}>ES-Alert de Protección Civil</a>.</p>
    </section>
  </div>
}
