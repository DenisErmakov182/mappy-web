// Геометрия координат — общие хелперы, не завязанные на конкретный экран.

interface LatLng {
  latitude: number;
  longitude: number;
}

/** Расстояние по прямой между двумя точками на сфере, в метрах (формула гаверсинуса). */
export function distanceMeters(first: LatLng, second: LatLng): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LAST_LOCATION_KEY = "mappy_last_location";

/**
 * Последняя известная позиция устройства — та же, что кладут экран запроса
 * геолокации при первом запуске и кнопка «Найти меня» на карте (см. App.tsx).
 * Общее хранилище перенесено сюда, чтобы им мог пользоваться не только сам
 * App.tsx, но и карточка места (расстояние/время до точки).
 *
 * Может быть устаревшей, если человек давно не открывал карту вручную —
 * это сознательный компромисс: свежий GPS-фикс на каждое открытие карточки
 * означал бы лишний запрос разрешения и заметную задержку ради строчки текста.
 */
export function getLastKnownLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function rememberLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично
  }
}

/** Сброс при выходе/смене аккаунта — новый человек на устройстве должен сам дать согласие. */
export function forgetLocation() {
  try {
    localStorage.removeItem(LAST_LOCATION_KEY);
  } catch {
    // Состояние всё равно сбросится в памяти текущего запуска.
  }
}

/**
 * Дальше — это уже не «пешком до места», а другой город/поездка: показывать
 * «83 ч · 105 км» на карточке места бессмысленно, а дёргать OpenRouteService
 * за пешим маршрутом на таком расстоянии — тратить дневной лимит впустую
 * (see mappy-api/routes/route.ts, ADR-014). Используется и для тега
 * расстояния на карточке, и как отсечка перед запросом маршрута.
 */
export const MAX_WALKING_DISTANCE_METERS = 100_000;

const WALKING_METERS_PER_MINUTE = 83; // ~5 км/ч, стандартная оценка пешего темпа

/** Расстояние для показа человеку: метры кругляком до 1 км, дальше — км с одним знаком. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} км`;
}

function formatMinutesLabel(minutes: number): string {
  const clamped = Math.max(1, Math.round(minutes));
  if (clamped < 60) return `${clamped} мин`;
  const hours = Math.floor(clamped / 60);
  const restMinutes = clamped % 60;
  return restMinutes === 0 ? `${hours} ч` : `${hours} ч ${restMinutes} мин`;
}

/**
 * Грубая оценка времени пешком — по прямой, без учёта реальных дорог и
 * переходов. Используется там, где точный маршрут ещё не запрашивали
 * (тег на карточке места) — для настоящего времени по дорогам после
 * построения маршрута см. formatDurationSeconds.
 */
export function formatWalkingDuration(meters: number): string {
  return formatMinutesLabel(meters / WALKING_METERS_PER_MINUTE);
}

/** Настоящее время в пути по маршруту (секунды от OpenRouteService), не оценка по прямой. */
export function formatDurationSeconds(seconds: number): string {
  return formatMinutesLabel(seconds / 60);
}
