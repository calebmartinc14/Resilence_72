import type { Guide } from './guides'

export default function GuideBody({ guide }: { guide: Guide }) {
  return <>
    <p>{guide.text}</p>
    {'sections' in guide && guide.sections.map(section => <div key={section.title} className="guide-section">
      <strong>{section.title}</strong>
      <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
    </div>)}
    <p>Fuente: <a href={guide.url}>{guide.source}</a> · Revisión: 8 de noviembre de 2026.</p>
    {'reference' in guide && <p><a href={guide.reference.url}>{guide.reference.label}</a></p>}
  </>
}
