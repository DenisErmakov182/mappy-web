import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const legacyJavaScriptAliases = [
  'assets/index-4N89Sz3Y.js',
  'assets/index-NZUrSpI8.js',
  'assets/index-DHJXj6y_.js',
  'assets/index-DU4zl9vG.js',
]

const legacyCssAliases = [
  'assets/index-DAV-TdII.css',
  'assets/index-2PvzGSot.css',
  'assets/index-BZl3ly6z.css',
]

const buildRevision =
  process.env.GITHUB_SHA ?? process.env.COMMIT_SHA ?? process.env.SOURCE_VERSION ?? Date.now().toString(36)

/**
 * Timeweb can keep an older index.html on one CDN edge after App Platform has
 * already removed that build's hashed assets. Keep aliases for the shells we
 * have observed in production so those pages load the current coherent bundle
 * instead of receiving the SPA HTML fallback as JavaScript/CSS.
 */
function legacyShellAliases(): Plugin {
  return {
    name: 'mappy-legacy-shell-aliases',
    apply: 'build',
    generateBundle(_outputOptions, bundle) {
      let entryCode: string | undefined
      let cssSource: string | Uint8Array | undefined

      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.isEntry) entryCode = item.code
        if (item.type === 'asset' && item.fileName.endsWith('.css')) cssSource = item.source
      }

      if (!entryCode || !cssSource) {
        throw new Error('Mappy build did not produce the expected entry JavaScript and CSS')
      }

      for (const fileName of legacyJavaScriptAliases) {
        this.emitFile({ type: 'asset', fileName, source: entryCode })
      }
      for (const fileName of legacyCssAliases) {
        this.emitFile({ type: 'asset', fileName, source: cssSource })
      }
    },
  }
}

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    legacyShellAliases(),
    VitePWA({
      // The application decides when the waiting worker may activate and
      // reload. autoUpdate could reload while a place form is being edited.
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        // HTML и его ассеты обновляются одной атомарной precache-ревизией. Старый
        // worker продолжает отдавать цельную старую сборку, новый — цельную новую.
        // Новый worker ждёт команды приложения, поэтому открытая форма может
        // безопасно отложить активацию до сохранения или закрытия.
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        manifestTransforms: [
          async (entries) => ({
            // Stable URLs are intentional, but Workbox otherwise writes
            // `revision: null` for Vite output and never refreshes them. Tie all
            // unversioned precache entries to the concrete deploy revision.
            manifest: entries.map((entry) =>
              entry.revision === null ? { ...entry, revision: buildRevision } : entry,
            ),
            warnings: [],
          }),
        ],
        // Алиасы нужны только старым CDN-страницам. В precache достаточно одного
        // стабильного app.js/index.css, иначе одинаковый код хранится несколько раз.
        globIgnores: [...legacyJavaScriptAliases.map((path) => `**/${path}`), ...legacyCssAliases.map((path) => `**/${path}`)],
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
  build: {
    rolldownOptions: {
      output: {
        // App Platform удаляет предыдущий dist при каждом деплое. Стабильные
        // имена не дают старому index.html ссылаться на физически исчезнувший файл.
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
