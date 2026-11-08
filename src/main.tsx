import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import './styles/global.css'

// React toma el control del nodo raíz definido en index.html. StrictMode ayuda a detectar efectos incorrectos en desarrollo.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
