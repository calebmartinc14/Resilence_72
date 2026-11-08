import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, BatteryCharging, BookOpen, CircleAlert, ClipboardCheck, Globe2, HardDriveDownload, House, Map, Shield, Wifi, WifiOff, Wrench } from 'lucide-react'
import LocalTools from '../features/LocalTools'
import ActNow from '../features/ActNow'
import { useHousehold } from '../hooks/useHousehold'
import { useOffline } from '../hooks/useOffline'
import { useInternationalNews } from '../hooks/useInternationalNews'

// Las pantallas con dependencias propias se descargan cuando se visitan. La PWA guarda sus archivos.
const OfficialNotices = lazy(() => import('../features/OfficialNotices'))
const SpainMap = lazy(() => import('../features/SpainMap'))
const InternationalNews = lazy(() => import('../features/InternationalNews'))

const pages = {
  inicio: { label: 'Inicio', title: '¿Qué necesitas hoy?', icon: House },
  preparacion: { label: 'Mi kit', title: 'Mi kit de 72 horas', icon: ClipboardCheck },
  guias: { label: 'Guías', title: 'Guías de emergencia', icon: BookOpen },
  ahora: { label: 'Ahora', title: 'Qué hago ahora', icon: CircleAlert },
  herramientas: { label: 'Herramientas', title: 'Herramientas', icon: Wrench },
  autonomia: { label: 'Energía', title: 'Autonomía energética', icon: BatteryCharging },
  alertas: { label: 'Avisos', title: 'Avisos oficiales', icon: CircleAlert },
  mapa: { label: 'Mapa', title: 'Mapa de España', icon: Map },
  internacional: { label: 'Internacional', title: 'Información internacional', icon: Globe2 },
}

type Page = keyof typeof pages
const navigation = ['inicio', 'preparacion', 'guias', 'mapa', 'herramientas'] as const
const pocketActions = [
  { page: 'ahora', title: 'Qué hago ahora', hint: 'Instrucciones rápidas por situación', icon: BookOpen },
  { page: 'autonomia', title: 'Calcular energía', hint: 'Prueba con una batería, una luz o un router', icon: BatteryCharging },
  { page: 'alertas', title: 'Consultar avisos', hint: 'AEMET e IGN · Fuentes oficiales', icon: CircleAlert },
] as const
const tools = [
  pocketActions[1],
  { page: 'mapa', title: 'Explorar el mapa', hint: 'Provincias, zonas de aviso y sismos', icon: Map },
  pocketActions[2],
  { page: 'internacional', title: 'Información internacional', hint: 'Paz y seguridad · Noticias ONU', icon: Globe2 },
] as const

function ActionList({ actions }: { actions: readonly {
  page: Page
  title: string
  hint: string
  icon: typeof House
}[] }) {
  return <ul className="pocket-actions">
    {actions.map(({ page, title, hint, icon: Icon }) => <li key={page}>
      <a href={'#' + page}>
        <span className="pocket-icon"><Icon size={22} aria-hidden="true" /></span>
        <span><strong>{title}</strong><small>{hint}</small></span>
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </li>)}
  </ul>
}

// Leemos el fragmento de la URL para permitir enlaces directos y los botones Atrás y Adelante.
function getPage(): Page {
  const hash = window.location.hash.slice(1)
  return Object.hasOwn(pages, hash) ? hash as Page : 'inicio'
}

export default function App() {
  const [page, setPage] = useState(getPage)
  const [online, setOnline] = useState(navigator.onLine)
  const household = useHousehold()
  const { status: offline, updateWaiting } = useOffline()
  const news = useInternationalNews(online, page === 'internacional')
  const title = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(page)
  const total = household.data.items.length
  const available = household.data.items.filter(item => item.status === 'disponible').length
  const activeSection = page === 'autonomia' || page === 'alertas' || page === 'internacional' ? 'herramientas' : page === 'ahora' ? 'guias' : page
  const heading = page === 'preparacion' && (household.data.days ?? 3) > 3
    ? 'Mi kit · ' + household.data.days + ' días' : pages[page].title

  useEffect(() => {
    // Conectamos los eventos del navegador con el estado de React y los retiramos al desmontar.
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
    // Al cambiar de pantalla también cambia el título y el foco pasa a su encabezado.
    document.title = page === 'inicio' ? 'Resilience 72' : heading + ' · Resilience 72'
    if (previousPage.current !== page) {
      window.scrollTo(0, 0)
      title.current?.focus({ preventScroll: true })
      previousPage.current = page
    }
  }, [page, heading])

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
        {navigation.map(id => {
          const { label, icon: Icon } = pages[id]
          return <a key={id} href={'#' + id} aria-current={page === id ? 'page' : activeSection === id ? 'location' : undefined}>
            <Icon size={21} aria-hidden="true" /><span>{label}</span>
          </a>
        })}
      </nav>

      <main className={'main-content' + (page === 'inicio' ? ' pocket-home' : page === 'mapa' ? ' map-content' : '')} id="contenido">
        <header className="page-heading">
          <p className="eyebrow">{page === 'inicio' ? 'Guía de bolsillo · 72 horas' : 'Resilience 72'}</p>
          <h1 ref={title} tabIndex={-1}>{heading}</h1>
          {page === 'inicio' && <p>Prepara tu hogar y encuentra ayuda práctica para las primeras 72 horas.</p>}
        </header>

        {page !== 'internacional' && news.unread > 0 && <aside className="news-notice" aria-label="Novedades internacionales">
          <span role="status">{news.unread === 1 ? 'Una publicación nueva de Noticias ONU' : news.unread + ' publicaciones nuevas de Noticias ONU'}</span>
          <a className="button" href="#internacional" onClick={news.clearUnread}>Ver novedades</a>
        </aside>}

        {page === 'inicio' && <>
          <section className="hero-card pocket-kit" aria-labelledby="kit-title">
            <div className="pocket-kit-label"><ClipboardCheck size={20} aria-hidden="true" /> Tu preparación</div>
            <h2 id="kit-title">Tu kit de emergencia</h2>
            {household.ready ? <>
              <p>{total ? available + ' de ' + total + ' elementos disponibles' : 'Tu lista está vacía. Añade lo que necesite tu hogar.'}</p>
              {total > 0 && <progress aria-label="Elementos disponibles en tu kit" value={available} max={total} />}
            </> : <p>{household.message}</p>}
            <a className="button button-primary" href="#preparacion">{available > 0 ? 'Continuar mi lista' : 'Abrir mi lista'} <ArrowRight size={18} aria-hidden="true" /></a>
          </section>

          <section className="quick-tools" aria-labelledby="tools-title">
            <h2 id="tools-title">A mano</h2>
            <ActionList actions={pocketActions} />
          </section>

          <details className="offline-card tool-section">
            <summary>
              <HardDriveDownload size={18} aria-hidden="true" />
              {offline.state === 'ready' ? 'Copia preparada'
                : offline.state === 'preparing' ? 'Preparando la copia…'
                : 'Copia sin conexión no preparada'}
            </summary>
            {offline.state === 'ready'
              ? <p>Puedes reabrir el kit, el plan familiar, las guías, la calculadora y el mapa base de España sin Internet. Copia guardada el <time dateTime={offline.since}>{new Date(offline.since).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</time>.</p>
              : <p>Abre la versión publicada con Internet y espera a que aparezca el mensaje de que está lista.</p>}
            <p>Para instalarla, busca «Instalar» en el menú del navegador. En Safari para iPhone, usa Compartir → Añadir a pantalla de inicio.</p>
          </details>

        </>}

        {page === 'herramientas' && <ActionList actions={tools} />}
        {page === 'ahora' && <ActNow />}
        {page === 'internacional' && <Suspense fallback={<p role="status">Abriendo la información internacional…</p>}>
          <InternationalNews news={news} online={online} />
        </Suspense>}
        <LocalTools page={page} household={household} />
        {page === 'mapa' && <Suspense fallback={<p role="status">Abriendo el mapa…</p>}><SpainMap online={online} /></Suspense>}

        {updateWaiting && <p className="update-notice" role="status">Hay una actualización preparada. Cierra todas las ventanas de Resilience 72 y vuelve a abrirla para aplicarla.</p>}

        {page === 'alertas' && <Suspense fallback={<p role="status">Abriendo los avisos…</p>}><OfficialNotices online={online} /></Suspense>}

        {(page === 'inicio' || page === 'guias' || page === 'alertas') && (
          <aside className="emergency" aria-label="Teléfono de emergencias">
            <span>Ante una emergencia inmediata</span><a className="button" href="tel:112">Llamar al 112</a>
          </aside>
        )}
      </main>
    </div>
  )
}
