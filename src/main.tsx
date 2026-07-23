import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppRecoveryScreen.tsx'
import { registerPwaUpdateHandling } from './lib/pwaUpdate.ts'
import { disablePwaForReadOnlyStaging, isReadOnlyStaging } from './lib/staging.ts'

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

// На стенде service worker не нужен: тестовая сборка меняется часто, а
// установленная PWA легко пережила бы её кешем и показала вчерашнюю версию.
if (isReadOnlyStaging()) {
  void disablePwaForReadOnlyStaging()
} else {
  registerPwaUpdateHandling()
}

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
