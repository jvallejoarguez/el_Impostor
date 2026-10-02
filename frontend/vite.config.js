import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    admin: fileURLToPath(new URL('./admin-panel/index.html', import.meta.url)),
  } } },
  server: {
    port: 3000,
    proxy: {
      '/admin-panel/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/rooms': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
