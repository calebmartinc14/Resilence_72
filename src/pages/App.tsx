import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BatteryCharging, BookOpen, CircleAlert, ClipboardCheck, House, Shield, Wifi, WifiOff } from 'lucide-react'
import LocalTools from '../features/LocalTools'
import { useHousehold } from '../hooks/useHousehold'
import { useOffline } from '../hooks/useOffline'

const pages = {
  inicio: { label: 'Inicio', title: 'Prepárate a tu ritmo', icon: House },
  preparacion: { label: 'Mi kit', title: 'Mi kit de 72 horas', icon: ClipboardCheck },
  guias: { label: 'Guías', title: 'Guías de emergencia', icon: BookOpen },
  autonomia: { label: 'Energía', title: 'Autonomía energética', icon: BatteryCharging },
  alertas: { label: 'Avisos', title: 'Avisos oficiales', icon: CircleAlert },
}

type Page = keyof typeof pages

function getPage(): Page {
  const hash = window.location.hash.slice(1)
  return Object.hasOwn(pages, hash) ? hash as Page : 'inicio'
}

export default function App() {
  const [page, setPage] = useState(getPage)
  const [online, setOnline] = useState(navigator.onLine)
  const household = useHousehold()
  const { status: offline, updateWaiting } = useOffline()
  const title = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(page)
  const total = household.data.items.length
  const available = household.data.items.filter(item => item.status === 'disponible').length

  useEffect(() => {
    const updatePage = () => setPage(getPage())
    const updateNetwork = () => setOnline(navigator.onLine)
    window.addEventListener('hashchange', updatePage)
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)
    return () => {
      window.removeEventListener('hashchange', updatePage)
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
    }
  }, [])

  useEffect(() => {
    document.title = page === 'inicio' ? 'Resilience 72' : pages[page].title + ' · Resilience 72'
    if (previousPage.current !== page) {
      window.scrollTo(0, 0)
      title.current?.focus({ preventScroll: true })
      previousPage.current = page
    }
  }, [page])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido" onClick={event => {
        event.preventDefault()
        title.current?.focus()
      }}>Saltar al contenido</a>
      <header className="app-header">
        <a className="brand" href="#inicio"><span className="brand-mark"><Shield size={22} aria-hidden="true" /></span>Resilience <strong>72</strong></a>
        <div className="connection" role="status">
          {online ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          {online ? 'Con conexión' : 'Sin conexión'}
        </div>
      </header>

      <nav className="main-nav" aria-label="Navegación principal">
        {(Object.entries(pages) as [Page, typeof pages[Page]][]).map(([id, { label, icon: Icon }]) => (
          <a key={id} href={'#' + id} aria-current={page === id ? 'page' : undefined}>
            <Icon size={21} aria-hidden="true" /><span>{label}</span>
          </a>
        ))}
      </nav>

      <main className="main-content" id="contenido">
        <header className="page-heading">
          <p className="eyebrow">{page === 'inicio' ? 'Preparación ciudadana · 72 horas' : 'Resilience 72'}</p>
          <h1 ref={title} tabIndex={-1}>{pages[page].title}</h1>
          {page === 'inicio' && <p>Organiza lo esencial para los primeros tres días de una emergencia.</p>}
        </header>

        {page === 'inicio' && <>
          <section className="hero-card" aria-labelledby="kit-title">
            <div className="hero-icon"><ClipboardCheck size={24} aria-hidden="true" /></div>
            <h2 id="kit-title">Tu kit de emergencia</h2>
            {household.ready ? <>
              <p>{total ? available + ' de ' + total + ' elementos disponibles' : 'Tu lista está vacía. Añade lo que necesite tu hogar.'}</p>
              {total > 0 && <progress aria-label="Elementos disponibles en tu kit" value={available} max={total} />}
            </> : <p>{household.message}</p>}
            <a className="button button-primary" href="#preparacion">{available > 0 ? 'Continuar mi lista' : 'Abrir mi lista'} <ArrowRight size={18} aria-hidden="true" /></a>
          </section>

          <details className="offline-card tool-section">
            <summary>
              {offline.state === 'ready' ? 'Lista para usar sin conexión'
                : offline.state === 'preparing' ? 'Preparando el acceso sin conexión…'
                : 'Acceso sin conexión no preparado'}
            </summary>
            {offline.state === 'ready'
              ? <p>Kit, plan familiar, contactos, guías y calculadoras disponibles. Copia de la aplicación guardada el <time dateTime={offline.since}>{new Date(offline.since).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</time>.</p>
              : <p>Abre la versión publicada con Internet y espera a que aparezca el mensaje de que está lista.</p>}
            <p>Para instalarla, busca «Instalar» en el menú del navegador. En Safari para iPhone, usa Compartir → Añadir a pantalla de inicio.</p>
          </details>

          <section className="quick-tools" aria-labelledby="tools-title">
            <h2 id="tools-title">Accesos rápidos</h2>
            <div className="quick-grid">
              <a className="quick-link" href="#guias"><BookOpen aria-hidden="true" /><span><strong>Guías de emergencia</strong><small>Consulta qué hacer</small></span><ArrowRight size={18} aria-hidden="true" /></a>
              <a className="quick-link" href="#autonomia"><BatteryCharging aria-hidden="true" /><span><strong>Calculadora de energía</strong><small>Estima cuánto dura tu batería</small></span><ArrowRight size={18} aria-hidden="true" /></a>
              <a className="quick-link" href="#alertas"><CircleAlert aria-hidden="true" /><span><strong>Avisos oficiales</strong><small>Sin datos de alertas en la aplicación</small></span><ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </section>
        </>}

        <LocalTools page={page} household={household} />

        {updateWaiting && <p className="update-notice" role="status">Hay una actualización preparada. Cierra todas las ventanas de Resilience 72 y vuelve a abrirla para aplicarla.</p>}

        {page === 'alertas' && <section className="tool-section">
          <h2>Sin datos de alertas</h2>
          <p>{!online && 'Estás sin conexión. '}Todavía no hay fuentes conectadas a la aplicación. Última consulta: sin consultar.</p>
        </section>}

        {(page === 'inicio' || page === 'guias' || page === 'alertas') && (
          <aside className="emergency" aria-label="Teléfono de emergencias">
            <span>Ante una emergencia inmediata</span><a className="button" href="tel:112">Llamar al 112</a>
          </aside>
        )}
      </main>
    </div>
  )
}
