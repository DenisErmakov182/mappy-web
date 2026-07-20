import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppRecoveryScreen.tsx'

// Проверяем обновление при каждом запуске. Service Worker хранит только
// хешированные ассеты и никогда не подменяет сетевую навигацию к HTML.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch(() => undefined)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

window.__MAPPY_MARK_BOOTED__?.()

declare global {
  interface Window {
    __MAPPY_MARK_BOOTED__?: () => void
  }
}
