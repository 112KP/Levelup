import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Levelup/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Levelup',
        short_name: 'Levelup',
        description: 'A personal Levelup workspace.',
        theme_color: '#172026',
        background_color: '#f5f2ea',
        display: 'standalone',
        start_url: '/Levelup/',
        scope: '/Levelup/'
      }
    })
  ]
})
