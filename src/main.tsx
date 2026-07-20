import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppRecoveryScreen.tsx'

// Проверяем обновление при каждом запуске. Новый Service Worker устанавливается
// в фоне, но больше не перехватывает уже открытую iOS PWA: он активируется после
// полного закрытия старого окна и применяется при следующем естественном запуске.
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
