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
      includeAssets: [
        'favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Levelup',
        short_name: 'Levelup',
        description: 'A personal Levelup workspace.',
        theme_color: '#172026',
        background_color: '#f5f2ea',
        display: 'standalone',
        start_url: '/Levelup/',
        scope: '/Levelup/',
        icons: [
          {
            src: '/Levelup/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/Levelup/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/Levelup/icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      }
    })
  ]
})
