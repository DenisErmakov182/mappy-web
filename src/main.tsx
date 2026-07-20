import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppRecoveryScreen.tsx'

const configureIosStandaloneViewport = () => {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    navigatorWithStandalone.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  if (!isIos || !isStandalone) return

  const updateViewportHeight = () => {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches
    const screenLongSide = Math.max(window.screen.width, window.screen.height)
    const screenShortSide = Math.min(window.screen.width, window.screen.height)
    const screenHeight = isPortrait ? screenLongSide : screenShortSide

    document.documentElement.style.setProperty(
      '--mappy-standalone-height',
      `${Math.max(window.innerHeight, screenHeight)}px`,
    )
  }

  document.documentElement.classList.add('ios-standalone')
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
  window.addEventListener('orientationchange', updateViewportHeight)
}

configureIosStandaloneViewport()

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

declare global {
  interface Window {
    __MAPPY_MARK_BOOTED__?: () => void
  }
}
