// Клиентская половина read-only режима тестового стенда.
//
// Настоящая защита живёт на API (`mappy-api/src/lib/staging.ts`) — здесь только
// то, что экономит пользователю бессмысленный поход в сеть и позволяет показать
// понятное объяснение вместо ошибки.
//
// Режим включается build-переменной, а не адресом страницы: домены twc1.net
// выдаёт Timeweb, они уже менялись, и защита, привязанная к hostname, при
// пересоздании приложения молча выключилась бы. Переменная ломается громко.

const READ_ONLY_STAGING = import.meta.env.VITE_READ_ONLY_STAGING === "true";

export const READ_ONLY_STAGING_MESSAGE =
  "Тестовый стенд доступен только для просмотра";

// Тот же список, что и на сервере. Сигнатуры функций специально совпадают:
// раньше клиент принимал (path, method), а сервер (method, url) — оба аргумента
// строки, и перепутанный порядок компилятор бы не поймал.
const ALLOWED_WRITE_ROUTES = new Set([
  "POST /auth/request-code",
  "POST /auth/verify-code",
]);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0];
  return withoutQuery.length > 1 && withoutQuery.endsWith("/")
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

export function isReadOnlyStaging(): boolean {
  return READ_ONLY_STAGING;
}

export function isAllowedReadOnlyStagingRequest(
  method: string,
  path: string,
): boolean {
  if (!READ_ONLY_STAGING) return true;

  const normalizedMethod = method.toUpperCase();
  if (READ_METHODS.has(normalizedMethod)) return true;

  return ALLOWED_WRITE_ROUTES.has(`${normalizedMethod} ${normalizePath(path)}`);
}

export async function disablePwaForReadOnlyStaging(): Promise<void> {
  if (!READ_ONLY_STAGING) return;

  const jobs: Promise<unknown>[] = [];

  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      jobs.push(...registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Best effort: staging must still open even if browser cleanup fails.
  }

  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const cacheNames = await caches.keys();
      jobs.push(...cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch {
    // Best effort: staging must still open even if browser cleanup fails.
  }

  await Promise.allSettled(jobs);
}
