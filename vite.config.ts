import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyOfficial } from './server/official.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      // El servidor de desarrollo y el de vista previa usan el mismo intermediario que producción.
      name: 'resilience-official-sources',
      configureServer(server) { server.middlewares.use(proxyOfficial) },
      configurePreviewServer(server) { server.middlewares.use(proxyOfficial) },
    },
  ],
})
