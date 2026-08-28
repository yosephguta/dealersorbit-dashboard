import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxies /api → backend so the browser talks same-origin (no CORS dance).
// In a prod build set VITE_API_BASE to the real API root; the app reads it in src/api.js.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
