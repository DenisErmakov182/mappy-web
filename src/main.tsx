import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppRecoveryScreen.tsx'
import { ComponentsPreviewPage } from './components/ComponentsPreviewPage.tsx'
import { registerPwaUpdateHandling } from './lib/pwaUpdate.ts'
import { disablePwaForReadOnlyStaging, isReadOnlyStaging } from './lib/staging.ts'

// Каталог библиотеки компонентов — без роутера (в mappy-web его нет),
// просто проверка пути. Защита в два уровня (см. ComponentsPreviewPage.tsx
// для второго): первый — этот флаг, роут вообще не монтируется, если сборка
// не dev-режима и не включён VITE_ENABLE_COMPONENTS_PREVIEW. В проде эта
// переменная никогда не выставляется — там роута физически нет. На стенде
// включена, но саму страницу дополнительно закрывает секретный ключ.
const isComponentsPreviewRoute =
  window.location.pathname === '/components-preview' &&
  (import.meta.env.DEV || import.meta.env.VITE_ENABLE_COMPONENTS_PREVIEW === 'true')

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
    {isComponentsPreviewRoute ? (
      <ComponentsPreviewPage />
    ) : (
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    )}
  </StrictMode>,
)

declare global {
  interface Window {
    __MAPPY_MARK_BOOTED__?: () => void
  }
}
