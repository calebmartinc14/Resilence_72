export type Item = { id: string; name: string; status: 'necesario' | 'pendiente' | 'disponible' }
export type Contact = { id: string; name: string; phone: string }
export type Household = { people: number; litres: number; items: Item[]; plan?: string; contacts?: Contact[] }

const initialNames = ['Agua potable', 'Alimentos no perecederos', 'Medicamentos y botiquín', 'Artículos de higiene',
  'Linterna y pilas', 'Radio', 'Batería externa', 'Documentación esencial']
export const initialData: Household = {
  people: 1,
  litres: 2,
  items: initialNames.map((name, index) => ({ id: String(index), name, status: 'necesario' })),
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('resilience72', 1)
    let blocked = false
    // La tienda se crea en la primera visita. El número de versión se reserva para futuras migraciones.
    request.onupgradeneeded = () => request.result.createObjectStore('data')
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new Error('La base de datos está bloqueada por otra pestaña'))
    }
  })
}

export async function loadHousehold(): Promise<Household> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('data', 'readonly').objectStore('data').get('household')
      request.onsuccess = () => resolve(request.result ?? initialData)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

let lastSave: Promise<void> = Promise.resolve()

// Encadenamos las escrituras de esta pestaña para que un cambio anterior no sobrescriba al siguiente.
export function saveHousehold(data: Household): Promise<void> {
  const pending = lastSave.catch(() => {}).then(() => writeHousehold(data))
  lastSave = pending
  return pending
}

async function writeHousehold(data: Household): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('data', 'readwrite')
      transaction.objectStore('data').put(data, 'household')
      // Solo confirmamos el guardado cuando ha terminado la transacción completa.
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}
