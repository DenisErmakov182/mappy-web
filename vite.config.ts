import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // Не смешиваем старый HTML/JS с новым app shell внутри уже открытого
        // standalone-окна. После закрытия всех старых клиентов ожидающий SW
        // активируется штатно и следующий запуск получает цельную сборку.
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['favicon.ico', 'favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Mappy',
        short_name: 'Mappy',
        description: 'Сохраняй интересные места в поездках',
        theme_color: '#FFFFFF',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/app-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
