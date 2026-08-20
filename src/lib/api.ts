import type { Photo, Place, PlaceCategory, VisitStatus } from "../types";
import { downscaleImage } from "./image";
import {
  READ_ONLY_STAGING_MESSAGE,
  isAllowedReadOnlyStagingRequest,
} from "./staging";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TOKEN_KEY = "mappy_token";
const USER_KEY = "mappy_user";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface ApiUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: "http" | "network" | "timeout" | "staging";
  /** Сколько секунд ждать до повтора. Приходит с 429 от лимита запросов кода. */
  readonly retryAfterSec: number | null;
  /** Машиночитаемый код ошибки от сервера, если он его прислал. Нужен там, где
   *  на отказ надо не показать текст, а сменить шаг — например `CONSENT_REQUIRED`. */
  readonly code: string | null;

  constructor(
    message: string,
    status: number | null,
    kind: "http" | "network" | "timeout" | "staging",
    retryAfterSec: number | null = null,
    code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.kind = kind;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Возвращает паузу в секундах, если сервер ограничил частоту запросов кода. */
export function rateLimitRetryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  return error.retryAfterSec;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // В редких сломанных/ограниченных PWA-сессиях WebKit может временно
    // запретить хранилище. Текущая сессия продолжит работать из React state.
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Нечего очищать, если WebKit не дал доступ к хранилищу.
  }
}

function tokenUserId(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { userId?: unknown };
    return typeof parsed.userId === "string" ? parsed.userId : null;
  } catch {
    return null;
  }
}

export function persistUser(user: ApiUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Кэш профиля ускоряет запуск, но не является источником истины.
  }
}

export function getSessionUser(token: string): ApiUser | null {
  const userId = tokenUserId(token);
  if (!userId) return null;

  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as ApiUser;
      if (cached?.id === userId) return cached;
    }
  } catch {
    // Повреждённый или недоступный кэш не должен блокировать запуск.
  }

  // Старые установки ещё не имеют кэша профиля. JWT нужен здесь только для
  // мгновенного отображения оболочки; все серверные действия всё равно
  // проходят штатную проверку подписи JWT на API.
  return {
    id: userId,
    email: "",
    username: null,
    firstName: null,
    lastName: null,
    name: null,
    avatarUrl: null,
  };
}

export function isReadOnlyStagingError(error: unknown): boolean {
  return error instanceof ApiError && error.kind === "staging";
}

export function isAuthenticationError(error: unknown): boolean {
  // Отказ стенда приходит с 403, но сессия при этом полностью валидна —
  // без этой проверки просмотр на staging выкидывал бы из аккаунта.
  if (isReadOnlyStagingError(error)) return false;
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (!isAllowedReadOnlyStagingRequest(method, path)) {
    throw new ApiError(READ_ONLY_STAGING_MESSAGE, 403, "staging");
  }

  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `Ошибка ${res.status}`;
      let kind: "http" | "staging" = "http";
      let retryAfterSec: number | null = null;
      let code: string | null = null;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
        if (typeof data?.code === "string") code = data.code;
        // Сервер отказал как стенд — например, при попытке регистрации,
        // которую клиентский белый список пропускает как обычный вход.
        if (data?.code === "STAGING_READ_ONLY") kind = "staging";
        if (typeof data?.retryAfterSec === "number") retryAfterSec = data.retryAfterSec;
      } catch {
        // тело не JSON — оставляем дефолтное сообщение
      }
      if (retryAfterSec === null) {
        const header = Number(res.headers.get("Retry-After"));
        if (Number.isFinite(header) && header > 0) retryAfterSec = header;
      }
      throw new ApiError(message, res.status, kind, retryAfterSec, code);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError("Сервер не ответил вовремя", null, "timeout");
    }
    throw new ApiError(
      error instanceof Error && error.message ? error.message : "Нет соединения с сервером",
      null,
      "network",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function requestCode(email: string) {
  return request<{ ok: true }>("/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Отказ сервера создать аккаунт без принятых документов. */
export function isConsentRequiredError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "CONSENT_REQUIRED";
}

export interface ConsentVersions {
  terms: string;
  privacy: string;
  /** Заявление пользователя о совершеннолетии. Отдельно от принятия документов:
   *  это утверждение о факте, а не согласие с текстом, и склеивать их нельзя. */
  ageConfirmed: true;
}

export function verifyCode(email: string, code: string, consent?: ConsentVersions) {
  return request<{ token: string; isNew: boolean; user: ApiUser }>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code, ...(consent ? { consent } : {}) }),
  });
}

export function completeProfile(firstName: string, lastName: string, username: string) {
  return request<ApiUser>("/auth/profile", {
    method: "POST",
    body: JSON.stringify({ firstName, lastName, username }),
  });
}

export function getMe() {
  return request<ApiUser>("/auth/me", {}, 8_000);
}

export function deleteAccount() {
  return request<{ ok: true }>("/auth/me", { method: "DELETE" });
}

async function getAvatarUploadUrl(contentType: "image/webp" | "image/jpeg" | "image/png") {
  return request<{ uploadUrl: string; publicUrl: string }>("/auth/avatar-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

export async function uploadAvatar(file: File): Promise<ApiUser> {
  const contentType = file.type as "image/webp" | "image/jpeg" | "image/png";
  const { uploadUrl, publicUrl } = await getAvatarUploadUrl(contentType);
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    // Cache-Control должен совпадать со значением, подписанным на бэкенде
    // (IMMUTABLE_CACHE_CONTROL в mappy-api/src/lib/s3.ts) — но не потому,
    // что иначе развалится подпись (в X-Amz-SignedHeaders этого presigned
    // URL только host, проверено вручную). Без заголовка PUT пройдёт
    // штатно, просто S3 молча сохранит файл без кэширования — рассинхрон
    // не упадёт с ошибкой, а тихо сведёт правку на нет.
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error("Не удалось загрузить фотографию");

  return request<ApiUser>("/auth/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ avatarUrl: publicUrl }),
  });
}

export interface PlaceInput {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  categories: PlaceCategory[];
  note: string;
  isPrivate: boolean;
  status: VisitStatus;
  photos: Photo[];
  systemName?: string;
  /**
   * Папки, в которых лежит место. Едут вместе с местом, а не отдельным
   * запросом: в форме добавления папки выбирают до того, как место создано.
   * Семантика — замена всего набора, пустой массив вынимает из всех папок.
   */
  folderIds: string[];
}

export function fetchPlaces() {
  return request<Place[]>("/places");
}
export function createPlace(input: PlaceInput) {
  return request<Place>("/places", { method: "POST", body: JSON.stringify(input) });
}
export function updatePlace(id: string, input: PlaceInput) {
  return request<Place>(`/places/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deletePlace(id: string) {
  return request<{ ok: true }>(`/places/${id}`, { method: "DELETE" });
}

/**
 * Папка — пользовательская подборка мест. Приватна владельцу: у друзей и на
 * публичной странице шеринга папок нет.
 */
export interface Folder {
  id: string;
  title: string;
  createdAt: string;
  placesCount: number;
  /**
   * До трёх обложек для карточки папки. `null` на месте элемента — это место
   * без фотографии: слот занят, но рисовать надо заглушку, а не пропускать его,
   * иначе папка из трёх мест выглядела бы как папка из двух.
   */
  coverPhotos: (string | null)[];
}

export function fetchFolders() {
  return request<Folder[]>("/folders");
}
export function createFolder(title: string) {
  return request<Folder>("/folders", { method: "POST", body: JSON.stringify({ title }) });
}
export function fetchFolderPlaces(id: string) {
  return request<{ id: string; title: string; places: Place[] }>(`/folders/${id}/places`);
}
/** Вынуть место из папки. Само место остаётся в «Сохранённом» и на карте. */
export function removePlaceFromFolder(folderId: string, placeId: string) {
  return request<{ ok: true }>(`/folders/${folderId}/places/${placeId}`, { method: "DELETE" });
}
export function renameFolder(id: string, title: string) {
  return request<Folder>(`/folders/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}
/** Удалить папку. Места внутри НЕ удаляются — каскад в схеме уносит только
 *  связку folder_places, сами места остаются в «Сохранённом» и на карте. */
export function deleteFolder(id: string) {
  return request<{ ok: true }>(`/folders/${id}`, { method: "DELETE" });
}

/**
 * Публичная ссылка на своё место. Повторный вызов не плодит ссылки: сервер
 * переиспользует уже выданную живую (`POST /places/:id/share`). Чужое место
 * расшарить нельзя — там 404, ссылку выдаёт только владелец.
 */
export function createPlaceShare(placeId: string) {
  return request<{ token: string; expiresAt: string }>(`/places/${placeId}/share`, {
    method: "POST",
  });
}

/**
 * Место, открытое по публичной ссылке. Полей меньше, чем у `Place`, и это не
 * упрощение клиента: сервер отдаёт только белый список. Личной заметки,
 * приватности, статуса «был/планирую», внутреннего id и чего-либо о владельце
 * здесь нет и быть не должно.
 */
export interface SharedPlace {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  categories: PlaceCategory[];
  photos: Photo[];
  systemName?: string;
  createdAt: string;
}

/** Просмотр места по ссылке. Единственный запрос приложения, которому не нужен вход. */
export function fetchSharedPlace(token: string) {
  return request<{ place: SharedPlace }>(`/share/${encodeURIComponent(token)}`).then(
    (result) => result.place,
  );
}

/**
 * Сохранить расшаренное место себе. Тело не отправляем намеренно: копию
 * собирает сервер из своей строки, клиент не может подменить содержимое.
 * Владельцу своей же ссылки вернётся его существующее место, а не дубликат.
 */
export function saveSharedPlace(token: string) {
  return request<Place>(`/share/${encodeURIComponent(token)}/save`, { method: "POST" });
}

export function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return request<{ address: string }>(`/geocode/reverse?${params}`).then((result) => result.address);
}

export interface WalkingRoute {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distanceMeters: number | null;
  durationSeconds: number | null;
}

/** Пеший маршрут от точки до точки (линия по дорогам, не по прямой) — рисуется на SinglePlaceMap. */
export function fetchWalkingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  return request<WalkingRoute>(`/route/walking?${params}`, {}, 12_000);
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
  /** Название точки (магазин, кафе…), если оно есть — подставляется в поле «Название». */
  name?: string;
}

export function suggestAddresses(query: string, origin?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q: query });
  // Без текущей точки карты бэкенд ищет по названию по всему миру и не может
  // предпочесть заведение рядом заведению с тем же именем на другом
  // континенте — см. разбор «Birch» в geocode.ts.
  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lng", String(origin.lng));
  }
  return request<{ suggestions: AddressSuggestion[] }>(`/geocode/suggest?${params}`).then(
    (result) => result.suggestions,
  );
}

async function getPhotoUploadUrl(contentType: string) {
  return request<{ uploadUrl: string; publicUrl: string }>("/places/photo-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

// Ужимаем до 1600px по длинной стороне: этого хватает для карточки и просмотра
// на весь экран телефона, а снимок с камеры (~4000px, 3–5 МБ) превращается в
// ~250–400 КБ. Загрузка идёт напрямую в S3 по presigned-ссылке, минуя API,
// поэтому уменьшать надо здесь, на клиенте.
export async function uploadPhoto(file: File): Promise<string> {
  const prepared = await downscaleImage(file, 1600, "place");
  const { uploadUrl, publicUrl } = await getPhotoUploadUrl(prepared.type);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    // Cache-Control должен совпадать со значением, подписанным на бэкенде
    // (IMMUTABLE_CACHE_CONTROL в mappy-api/src/lib/s3.ts) — но не потому,
    // что иначе развалится подпись (в X-Amz-SignedHeaders этого presigned
    // URL только host, проверено вручную). Без заголовка PUT пройдёт
    // штатно, просто S3 молча сохранит файл без кэширования — рассинхрон
    // не упадёт с ошибкой, а тихо сведёт правку на нет.
    headers: { "Content-Type": prepared.type, "Cache-Control": "public, max-age=31536000, immutable" },
    body: prepared,
  });
  if (!res.ok) throw new Error("Не удалось загрузить фото");
  return publicUrl;
}

export interface ApiFriend {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl?: string | null;
}

export type FriendRelation = "none" | "friend" | "incoming" | "outgoing";

export interface ApiFriendProfile extends ApiFriend {
  relation: FriendRelation;
  requestId?: string | null;
  requestedAt?: string;
}

export interface ApiFriendRequests {
  incoming: ApiFriendProfile[];
  outgoing: ApiFriendProfile[];
}

export function fetchFriends() {
  return request<ApiFriend[]>("/friends");
}
export function fetchFriendPlaces(friendId: string) {
  return request<Place[]>(`/friends/${friendId}/places`);
}
export function searchFriends(query: string) {
  const params = new URLSearchParams({ q: query });
  return request<ApiFriendProfile[]>(`/friends/search?${params}`);
}
export function fetchFriendRequests() {
  return request<ApiFriendRequests>("/friends/requests");
}
export function sendFriendRequest(username: string) {
  return request<ApiFriendProfile>("/friends/requests", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}
export function acceptFriendRequest(requestId: string) {
  return request<ApiFriendProfile>(`/friends/requests/${requestId}/accept`, { method: "POST" });
}
export function cancelFriendRequest(requestId: string) {
  return request<{ ok: true }>(`/friends/requests/${requestId}`, { method: "DELETE" });
}
export function removeFriend(id: string) {
  return request<{ ok: true }>(`/friends/${id}`, { method: "DELETE" });
}

export interface ApiNotification {
  id: string;
  type: "friend_request" | "release";
  createdAt: string;
  read: boolean;
  /** Задано только у type === "friend_request". */
  friendRequest?: { id: string | null; user: ApiFriend };
  /** Задано только у type === "release". */
  release?: { title: string; body: string; version: string | null };
}

export interface ApiNotifications {
  items: ApiNotification[];
  unreadCount: number;
}

// Лента и счётчик приходят одним ответом: бейдж и список нужны одновременно.
export function fetchNotifications() {
  return request<ApiNotifications>("/notifications");
}
export function markNotificationsRead() {
  return request<{ ok: true }>("/notifications/read", { method: "POST" });
}
export function markNotificationRead(id: string) {
  return request<{ ok: true }>(`/notifications/${id}/read`, { method: "POST" });
}
