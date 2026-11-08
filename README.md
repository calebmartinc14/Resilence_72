# Resilience 72

**Preparado para las primeras 72 horas.**

Resilience 72 es una aplicación web de preparación ciudadana para ayudar a particulares y familias a organizarse ante emergencias. El proyecto empieza en España, con atención a Andalucía y Granada. Su objetivo es ofrecer preparación local, información oficial con procedencia visible y funciones esenciales que sigan disponibles sin conexión.

## Estado

Fase 3 — aplicación instalable y copia local de la interfaz. El kit, el plan, los contactos, las guías y las calculadoras están disponibles después de preparar la copia con Internet. Los avisos oficiales quedan para la Fase 4.

## Arquitectura

- **Cliente:** React y TypeScript, empaquetados con Vite. La interfaz y las herramientas locales no dependen de un servidor para sus cálculos.
- **Estilos:** CSS organizado por capas/archivos; `src/styles/global.css` contiene los tokens visuales y el diseño inicial. Los módulos se separarán a medida que crezca cada funcionalidad.
- **Persistencia local:** IndexedDB para el checklist, el plan familiar y los contactos. Evitar guardar información personal que no sea necesaria.
- **Offline:** Service Worker y Cache API para la interfaz y las guías incluidas en la compilación. IndexedDB conserva los datos del hogar. Las respuestas de futuras APIs quedan fuera de la caché de la aplicación.
- **Servicios oficiales:** adaptadores por fuente en `src/services/`. AEMET y otras fuentes se integrarán solo después de verificar su documentación y condiciones. Si una credencial debe mantenerse secreta, se añadirá un backend Node/Express como proxy; ninguna clave privada irá en el cliente.
- **Mapas:** Leaflet solo cuando haya una fuente geográfica útil y licencias compatibles. La cartografía offline requiere evaluar proveedor, atribución, tamaño de descarga y condiciones de uso antes de implementarla.
- **Pruebas:** Vitest para lógica y componentes; Playwright para recorridos y navegador sin conexión, incorporados en las fases donde existan funcionalidades que probar.

No se añade backend, sistema de mapas, biblioteca de estado ni framework de componentes en esta fase: aún no resuelven una necesidad implementada.

## Estructura prevista

```text
src/
  app/                 composición y rutas de la aplicación
  components/          componentes reutilizables
  pages/               pantallas (dashboard inicial en pages/App.tsx)
  features/            preparación, alertas, guías, energía y mapa
  hooks/               hooks de interfaz y estado de navegador
  services/            adaptadores de APIs oficiales
  storage/             acceso a IndexedDB y migraciones
  types/               tipos compartidos
  utils/               cálculos y funciones puras
  data/                contenidos estáticos revisados y atribuidos
  styles/              tokens y estilos globales/de componentes
public/                manifest, iconos y recursos estáticos offline
```

Los directorios se crearán cuando reciban código, evitando carpetas vacías como estructura ceremonial.

## Dependencias

Dependencias de ejecución/desarrollo iniciales: React, React DOM, TypeScript, Vite, `@vitejs/plugin-react` y Lucide React para iconos. La PWA y la persistencia usan las APIs del navegador. Playwright ejecuta las pruebas de navegación y uso sin red. Las versiones iniciales se resuelven al instalar; el lockfile debe quedar versionado para reproducibilidad.

## Requisitos e instalación

- Node.js 20.19+ o 22.12+.
- npm incluido con Node.

```bash
npm install
npm run dev
```

Abrir la URL local mostrada por Vite. Para compilar y servir la compilación localmente:

```bash
npm run build
npm run preview
```

No hay variables de entorno en Fase 1. Si se añaden integraciones que requieran secretos, se documentarán en `.env.example` y se mantendrán exclusivamente en el backend.

## Primeras pantallas

1. **Centro de control:** estado de conexión, espacio de alertas verificadas, meteorología, resumen de preparación y accesos a herramientas. Cada dato debe mostrar fuente/actualización o indicar que no está disponible.
2. **Preparación del hogar:** tamaño y necesidades del hogar, checklist local y estado de cada elemento.
3. **Guías offline:** instrucciones breves, revisadas, atribuidas a fuentes oficiales y con fecha de revisión.
4. **Autonomía energética:** estimaciones transparentes con pérdidas y limitaciones explicadas.
5. **Mapa:** solo capas verificables y fuentes cuya licencia y uso offline estén confirmados.

## Plan Fase 1 — fundamentos

1. Revisar el repositorio y proteger los cambios existentes (repositorio inicial vacío).
2. Definir estructura escalable y reglas permanentes (`AGENTS.md`).
3. Configurar React, TypeScript y Vite con chequeo estricto.
4. Establecer tokens y componentes visuales base; construir el dashboard responsive.
5. Verificar compilación y revisar estados móvil/desktop. No presentar el estado de alertas como operativo sin una fuente.

## Instalación y funcionamiento sin conexión

1. Sirve el contenido de `dist/` por HTTPS o usa `npm run preview` en localhost. El servidor de desarrollo no registra el Service Worker.
2. Abre la portada con Internet y espera a que diga «Lista para usar sin conexión». El panel muestra cuándo se guardó la copia.
3. Usa la opción de instalación del navegador si está disponible. Corta la red y vuelve a abrir la aplicación o recarga la página. Comprueba el kit, el plan familiar, los contactos, las guías y las calculadoras.
4. Al reconectar, se comprueba si existe una versión nueva. Cuando esté preparada, cierra todas las ventanas de la aplicación y ábrela otra vez para activarla. El kit y el plan permanecen en IndexedDB.

El despliegue publica todos los archivos de `dist/` juntos. Sirve `sw.js` con `Cache-Control: no-cache` y conserva la caché de larga duración para los archivos con hash de `assets/`. Cada versión conserva su propia copia de la interfaz hasta que se activa la nueva. La primera visita necesita Internet y borrar los datos del sitio elimina la copia local y el plan. La fecha de la copia se refiere a la aplicación y sus guías.

## Seguridad y contenido

Los contactos y el plan familiar permanecerán en el dispositivo salvo consentimiento explícito para cualquier transmisión futura. Los datos oficiales mostrarán fuente, hora de publicación/consulta y antigüedad. La aplicación no inventará avisos, refugios, rutas, niveles de riesgo ni recomendaciones. Ante peligro inmediato, se debe contactar con el 112 cuando sea posible.

## Funcionalidades locales

La portada muestra el progreso del kit. En móvil, la barra inferior da acceso a Inicio, Mi kit, Guías, Energía y Avisos. Cada pantalla tiene un enlace directo y admite los botones de navegación del navegador.

El kit se puede editar y filtrar por estado. El tamaño del hogar y la reserva de agua se guardan junto a la lista en IndexedDB. Si se borran los datos del sitio, también se borra el plan. La calculadora energética admite Wh o mAh con voltaje. La biblioteca incluye ocho guías que se pueden buscar por tema y descargar en un archivo de texto.

Para comprobar la navegación, la descarga, la persistencia y la apertura sin red:

```bash
npx playwright install chromium
npm run test:e2e
```
