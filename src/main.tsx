import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Молча обновляет уже открытую страницу, как только на сервере появляется
// новый билд — без этого service worker обновлялся в фоне, но открытая
// вкладка/PWA продолжала работать на старом закэшированном JS бесконечно.
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
