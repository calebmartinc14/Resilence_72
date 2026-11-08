# Instrucciones de desarrollo — Resilience 72

## Objetivo

Construir una aplicación de preparación ciudadana, fiable, accesible y útil sin conexión para las primeras 72 horas de una emergencia. Priorizar España y Andalucía/Granada al inicio, con arquitectura ampliable.

## Convenciones

- React + TypeScript estricto + Vite. Mantener el código sencillo y evitar dependencias sin una necesidad concreta.
- Interfaz en español, responsive, legible y calmada. Mantener contraste, foco visible y controles accesibles por teclado.
- Separar pantallas, componentes, funcionalidades, servicios, almacenamiento, tipos, utilidades, datos y estilos según crezca el proyecto.
- Mantener datos personales en el dispositivo. No añadir seguimiento ni transmitir contactos/planes sin consentimiento explícito.
- No inventar datos reales, fuentes, endpoints, niveles de alerta, refugios o rutas. Etiquetar datos de demostración como tales.
- Todo dato externo debe conservar procedencia y marcas temporales. Distinguir “sin datos/sin consultar” de “sin alertas”. No presentar caché antigua como estado actual.
- Mantener secretos en el backend y fuera del repositorio. Usar variables de entorno y actualizar `.env.example` si se necesitan.
- Valorar licencias y atribución antes de descargar cartografía o contenidos.
- No sobrescribir cambios existentes sin inspeccionarlos. Mantener documentación y lockfile al día.

## Comprobaciones

- Ejecutar `npm run build` tras cambios de aplicación.
- Añadir pruebas Vitest/Playwright al introducir lógica o recorridos relevantes y ejecutarlas antes de cerrar esa fase.
- No afirmar que el modo offline funciona hasta comprobarlo con la aplicación servida, cachés pobladas y red desconectada.
- Revisar funcionamiento responsive y accesibilidad de teclado en las pantallas afectadas.

## Fases

1. Fundamentos y dashboard.
2. Checklist, calculadoras, guías y persistencia IndexedDB.
3. PWA, caché offline, recuperación y pruebas sin red.
4. Fuentes oficiales verificadas e integraciones/backend necesarios.
5. Mapa, cartografía y autonomía.
6. Revisión de producción, pruebas, accesibilidad, seguridad y despliegue.

Completar y revisar la fase activa antes de avanzar a la siguiente. Registrar en `README.md` las decisiones y limitaciones relevantes.
