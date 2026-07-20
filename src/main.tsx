import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Раньше здесь была принудительная window.location.reload() при смене
// Service Worker — это вызывало шторм перезагрузок в standalone-режиме PWA
// на iOS Safari (белый экран / бесконечное мигание). Новая версия теперь
// просто тихо становится активной в фоне (skipWaiting/clientsClaim в
// vite.config.ts), без насильного рестарта текущей сессии — пользователь
// получит её при следующем естественном открытии приложения.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch(() => undefined)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
