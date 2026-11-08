const euPreparedness = 'https://civil-protection-knowledge-network.europa.eu/preparedness-0/guidelines-population-preparedness'
const esAlert = 'https://www.proteccioncivil.es/coordinacion/redes/ran/public-warning-system'
const swedishPreparedness = 'https://www.mcf.se/en/advice-for-individuals/home-preparedness--prepping-for-at-least-a-week/basics-of-home-emergency-preparedness/'

// El contenido y sus fuentes forman parte de la aplicación y se pueden leer sin red.
export const guides = [
  {
    id: 'nacional', title: 'Emergencia nacional · 72 horas',
    text: 'Si recibes un aviso de ES-Alert, léelo entero y sigue las instrucciones para tu zona. Confirma si se trata de un simulacro. Ante peligro inmediato, llama al 112 cuando sea posible.',
    source: 'Protección Civil · ES-Alert', url: esAlert,
    sections: [
      { title: 'Qué hacer', items: [
        'Consulta los canales oficiales y usa una radio a pilas si fallan Internet o la electricidad.',
        'Sigue el plan familiar: avisa a las personas a tu cargo y revisa cómo os comunicaréis si os separáis.',
        'Si las autoridades ordenan evacuar o permanecer en casa, sigue las instrucciones y el itinerario que indiquen.',
      ] },
      { title: 'Qué tener para tres días', items: [
        'Agua potable y alimentos que puedas conservar y consumir sin cocinar.',
        'Medicación habitual y botiquín, artículos de higiene y lo necesario para bebés, mascotas o personas dependientes.',
        'Linterna, radio, pilas, cargador, batería externa y una copia en papel de los contactos y del plan.',
        'Documentos esenciales y una bolsa que puedas llevar si hay que salir.',
      ] },
    ],
    reference: { label: 'Unión Europea · Preparación de la población', url: euPreparedness },
  },
  {
    id: 'conflicto', title: 'Conflicto armado · Preparación prolongada',
    text: 'Organiza primero las 72 horas y amplía las reservas según tu hogar. Una semana es una referencia de planificación civil de la agencia sueca MCF. En España, sigue las indicaciones de las autoridades y de ES-Alert.',
    source: 'MCF · Preparación del hogar en crisis o guerra', url: swedishPreparedness,
    sections: [
      { title: 'Qué hacer', items: [
        'Acuerda un punto de encuentro y una persona de contacto. Conserva el plan y los teléfonos en papel.',
        'Infórmate por canales oficiales y radio. Antes de compartir un mensaje, comprueba quién lo publicó y cuándo.',
        'Durante un incidente, sigue las instrucciones de protección o evacuación para tu zona. Si no puedes comunicarte, usa el plan acordado cuando sea seguro hacerlo.',
      ] },
      { title: 'Qué preparar para más días', items: [
        'Amplía el agua, los alimentos habituales no perecederos y la higiene. Rota las reservas según sus fechas de consumo.',
        'Planifica la medicación habitual y el respaldo de los equipos esenciales con los profesionales que te atienden.',
        'Revisa pilas, iluminación, radio y baterías. Conserva documentos y algo de efectivo en un lugar accesible.',
        'Incluye abrigo y las necesidades específicas de tu hogar, incluidas las de mascotas o personas a tu cargo.',
      ] },
    ],
    reference: { label: 'Protección Civil · Avisos oficiales en España', url: esAlert },
  },
  { id: 'luz', title: 'Corte eléctrico', text: 'Mantén cerrados el frigorífico y el congelador. Usa linternas. Si utilizas un generador, mantenlo en el exterior, alejado de puertas y ventanas; nunca uses una cocina de gas para calentar la vivienda.', source: 'FEMA', url: 'https://www.ready.gov/sites/default/files/2025-02/fema_full-suite-hazard-info-sheets.pdf' },
  { id: 'agua', title: 'Interrupción del agua', text: 'Usa agua embotellada o de una fuente segura y sigue las indicaciones de las autoridades sanitarias. Si sospechas contaminación química, hervir el agua no la hace segura.', source: 'CDC', url: 'https://www.cdc.gov/water-emergency/about/' },
  { id: 'inundacion', title: 'Inundaciones', text: 'No cruces zonas inundadas ni a pie ni en vehículo. Busca una zona elevada y sigue las indicaciones de las autoridades.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/-/protecci%C3%B3n-civil-y-emergencias-alerta-por-precipitaciones-y-tormentas-intensas-en-el-este-y-sur-peninsular' },
  { id: 'incendio', title: 'Incendios forestales', text: 'Si descubres un incendio, avisa al 112 y sigue las instrucciones de las autoridades. Aléjate del fuego por zonas sin vegetación, carreteras o caminos.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/documents/20121/69872/Medidas-de-autoproteccion.Ante-los-riesgos-prevencion.pdf/1d2b28f5-fd97-840d-790a-9d07f871b841' },
  { id: 'calor', title: 'Ola de calor', text: 'Permanece en lugares frescos o a la sombra, bebe agua y evita el esfuerzo físico y la exposición prolongada al sol en las horas de más calor.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/documents/20121/69872/Medidas-de-autoproteccion.Ante-los-riesgos-prevencion.pdf/1d2b28f5-fd97-840d-790a-9d07f871b841' },
  { id: 'frio', title: 'Ola de frío', text: 'Abrígate con ropa adecuada y calzado cerrado, mantén la hidratación y evita cambios frecuentes entre lugares calientes y el exterior.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/documents/20121/0/06-Fenomenos%20metereologicos.pdf/1295223b-96b3-ae95-d8ec-d7e296d9bb05' },
  { id: 'terremoto', title: 'Terremoto', text: 'Si estás dentro, permanece en el interior y protégete bajo un mueble resistente, lejos de ventanas y muebles que puedan caer. Si debes evacuar, usa las escaleras, no el ascensor.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/documents/20121/69872/Medidas-de-autoproteccion.Ante-los-riesgos-prevencion.pdf/1d2b28f5-fd97-840d-790a-9d07f871b841' },
  { id: 'comunicaciones', title: 'Problemas de comunicaciones', text: 'Sigue la información oficial por radio u otros medios disponibles. Evita difundir rumores y limita el uso del teléfono para no saturar las líneas de emergencia.', source: 'Protección Civil y Emergencias', url: 'https://www.proteccioncivil.es/documents/20121/92558/Recomendaciones-para-situaciones-de-emergencia-colectiva.pdf/5db920a1-63e3-44ad-6403-18d934a06795' },
] as const
export type Guide = (typeof guides)[number]

// Generamos la descarga en el navegador a partir del contenido ya disponible.
export function downloadGuides() {
  const body = guides.map(guide => {
    const lines: string[] = [guide.title, guide.text]
    if ('sections' in guide) {
      for (const section of guide.sections) lines.push(section.title, ...section.items.map(item => '• ' + item))
    }
    lines.push('Fuente: ' + guide.source + ' — ' + guide.url)
    if ('reference' in guide) lines.push(guide.reference.label + ' — ' + guide.reference.url)
    return lines.join('\n')
  }).join('\n\n')
  const content = 'RESILIENCE 72 — GUÍAS DE EMERGENCIA\nAnte peligro inmediato llama al 112 cuando sea posible.\nRevisadas el 8 de noviembre de 2026.\n\n' + body
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'resilience72-guias.txt'
  link.click()
  // Damos tiempo a que empiece la descarga antes de liberar la URL temporal.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
