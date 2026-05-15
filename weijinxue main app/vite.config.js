import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/tatoeba-api': {
        target: 'https://tatoeba.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tatoeba-api/, ''),
      },
    },
  },
})
