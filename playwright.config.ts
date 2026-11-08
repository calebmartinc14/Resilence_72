import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:43172' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 43172 --strictPort',
    url: 'http://127.0.0.1:43172',
  },
})
