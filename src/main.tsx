import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// WebKit в iOS иногда активирует новый Service Worker, но оставляет открытую
// вкладку под управлением старого. Перезагружаем страницу сразу после смены
// контроллера, чтобы HTML и JS всегда были из одной версии сборки.
//
// Флаг храним в sessionStorage, а не в переменной: window.location.reload()
// полностью пересоздаёт JS-контекст, обычная переменная сбросится в false
// на каждой перезагрузке и не защитит от зацикливания, если controllerchange
// сработает повторно.
const RELOAD_GUARD_KEY = 'mappy_reloading_for_update'
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
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
