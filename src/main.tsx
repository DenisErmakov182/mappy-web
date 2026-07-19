import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

let reloadingForUpdate = false

// WebKit в iOS иногда активирует новый Service Worker, но оставляет открытую
// вкладку под управлением старого. Перезагружаем страницу сразу после смены
// контроллера, чтобы HTML и JS всегда были из одной версии сборки.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return
    reloadingForUpdate = true
    window.location.reload()
  })
}

// Проверяем обновление не только по внутреннему расписанию браузера, но и при
// каждом запуске приложения. Это особенно важно для Yandex Browser на iOS,
// который может долго держать навигацию в старом precache.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch(() => undefined)
  },
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
