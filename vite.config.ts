import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyOfficial } from './server/official.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resilience-official-sources',
      configureServer(server) { server.middlewares.use(proxyOfficial) },
      configurePreviewServer(server) { server.middlewares.use(proxyOfficial) },
    },
  ],
})
