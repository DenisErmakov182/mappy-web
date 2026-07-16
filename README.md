# Mappy (PWA)

Веб-версия Mappy — карта интересных мест в поездках. React + Vite + Tailwind + MapLibre GL JS, устанавливается как PWA.

## Локальный запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # продакшен-сборка в dist/
npm run preview    # локальный просмотр собранной версии
```

## Деплой на Cloudflare Pages

1. Залить этот репозиторий на GitHub (см. ниже).
2. В Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, выбрать репозиторий.
3. Настройки сборки:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy. Дальше каждый `git push` пересобирает и публикует автоматически.

HTTPS, геолокация и установка на экран Домой работают из коробки на выданном `*.pages.dev` домене (или на своём после привязки).

## Первая заливка на GitHub

```bash
git remote add origin git@github.com:<username>/mappy-web.git
git branch -M main
git push -u origin main
```
