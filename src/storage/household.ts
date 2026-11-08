export type Item = { id: string; name: string; status: 'necesario' | 'pendiente' | 'disponible' }
export type Contact = { id: string; name: string; phone: string }
export type Household = { people: number; litres: number; items: Item[]; plan?: string; contacts?: Contact[] }
const initialNames = ['Agua potable', 'Alimentos no perecederos', 'Medicamentos y botiquín', 'Artículos de higiene', 'Linterna y pilas', 'Radio', 'Batería externa', 'Documentación esencial']
export const initialData: Household = { people: 1, litres: 2, items: initialNames.map((name, i) => ({ id: String(i), name, status: 'necesario' })) }
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('resilience72', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('data')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
  request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña'))
})
export async function loadHousehold(): Promise<Household> {
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly'); const request = tx.objectStore('data').get('household')
    request.onsuccess = () => resolve(request.result ?? initialData)
    request.onerror = () => reject(request.error)
  }) } finally { db.close() }
}
let lastSave: Promise<void> = Promise.resolve()
export function saveHousehold(data: Household): Promise<void> {
  const pending = lastSave.catch(() => {}).then(() => writeHousehold(data))
  lastSave = pending
  return pending
}
async function writeHousehold(data: Household): Promise<void> {
  const db = await open()
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(data, 'household')
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
  }) } finally { db.close() }
}
