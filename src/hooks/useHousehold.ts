import { useEffect, useRef, useState } from 'react'
import { initialData, loadHousehold, saveHousehold, type Household } from '../storage/household'

// Expone la misma información del hogar a la portada y a los formularios del kit.
export function useHousehold() {
  const [data, setData] = useState<Household>(initialData)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Cargando datos locales…')
  const saveVersion = useRef(0)

  useEffect(() => {
    // La lectura es asíncrona. Ignoramos una respuesta que llega después de desmontar la pantalla.
    let active = true
    loadHousehold().then(value => {
      if (!active) return
      setData(value)
      setReady(true)
      setMessage('Datos locales cargados')
    }).catch(() => {
      if (active) setMessage('No se pudo abrir el almacenamiento local. Comprueba los permisos del navegador.')
    })
    return () => { active = false }
  }, [])

  function update(next: Household) {
    setData(next)
    setMessage('Guardando…')
    // Solo el último guardado puede cambiar el mensaje que ve la persona usuaria.
    const version = ++saveVersion.current
    saveHousehold(next).then(() => {
      if (saveVersion.current === version) setMessage('Datos guardados en este dispositivo')
    }).catch(() => {
      if (saveVersion.current === version) setMessage('No se pudieron guardar los cambios.')
    })
  }

  return { data, ready, message, update }
}
