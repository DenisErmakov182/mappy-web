# Mappy (PWA)

Веб-версия Mappy — карта интересных мест в поездках. React + Vite + Tailwind + MapLibre GL JS, устанавливается как PWA.

## Локальный запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # продакшен-сборка в dist/
npm run preview    # локальный просмотр собранной версии
```

## Деплой

Продакшен — **Timeweb App Platform** (не Cloudflare — этот раздел раньше был ошибочным, проект переехал на российскую инфраструктуру по требованиям 152-ФЗ, см. `mappy-docs/04 Решения/ADR-003 Timeweb и 152-ФЗ.md`).

- Репозиторий подключён к Timeweb App Platform, автодеплой на push в `main`.
- Framework: Vite / React, Node.js 22.
- Build command: `npm run build`, output: `dist`.
- Переменная окружения `VITE_API_URL` указывает на прод-API (`https://api.mymappy.ru`).
- Публичный домен `app.mymappy.ru` подключён через Yandex Cloud CDN (гасит HTTP/3, кэширует статику).

Подробности и история решений — `mappy-docs/02 Архитектура/` и `mappy-docs/04 Решения/`.

## Первая заливка на GitHub

```bash
git remote add origin git@github.com:<username>/mappy-web.git
git branch -M main
git push -u origin main
```
