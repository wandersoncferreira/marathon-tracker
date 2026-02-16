import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/marathon-tracker/', // GitHub Pages subfolder
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable source maps in production (avoids 404 errors)
  },
  server: {
    port: 3000,
  },
})
