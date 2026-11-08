import type { FormEvent } from 'react'
import type { Household } from '../storage/household'

export default function FamilyPlan({ data, update }: { data: Household; update: (next: Household) => void }) {
  const contacts = data.contacts ?? []

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    update({ ...data, plan: String(fields.get('plan')).trim() })
  }

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const name = String(fields.get('name')).trim()
    const phone = String(fields.get('phone')).trim()
    if (!name || !/\d/.test(phone)) return
    update({ ...data, contacts: [...contacts, { id: crypto.randomUUID(), name, phone }] })
    form.reset()
  }

  return <details className="family-plan">
    <summary>Plan familiar y contactos</summary>
    <p>El plan y los contactos se guardan en este dispositivo.</p>
    <form onSubmit={savePlan}>
      <label>Plan familiar
        <textarea name="plan" maxLength={2000} rows={4} defaultValue={data.plan ?? ''}
          placeholder="Por ejemplo, dónde reuniros y a quién avisar" />
      </label>
      <button type="submit">Guardar plan</button>
    </form>
    <h3>Contactos guardados</h3>
    {contacts.length === 0 ? <p>Aún no hay contactos guardados.</p> : <ul className="contact-list">
      {contacts.map(contact => <li key={contact.id}>
        <strong>{contact.name}</strong>
        <a href={'tel:' + contact.phone.replace(/[^\d+]/g, '')}>{contact.phone}</a>
        <button type="button" aria-label={'Quitar contacto ' + contact.name}
          onClick={() => update({ ...data, contacts: contacts.filter(entry => entry.id !== contact.id) })}>Quitar</button>
      </li>)}
    </ul>}
    <form onSubmit={addContact}>
      <div className="tool-fields">
        <label>Nombre del contacto<input name="name" required maxLength={70} /></label>
        <label>Teléfono<input name="phone" type="tel" required maxLength={25} pattern="[+0-9 ().\-]*[0-9][+0-9 ().\-]*" /></label>
      </div>
      <button type="submit">Añadir contacto</button>
    </form>
  </details>
}
