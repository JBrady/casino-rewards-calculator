import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Explicitly configure PostCSS
  css: {
    postcss: './postcss.config.cjs'
  }
})
