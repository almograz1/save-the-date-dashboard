import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/save-the-date-dashboard/',
  server: {
    port: 5173,
    open: true
  }
})
