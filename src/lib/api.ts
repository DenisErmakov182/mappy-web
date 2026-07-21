import type { Place, PlaceCategory, VisitStatus } from "../types";

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
  readonly kind: "http" | "network" | "timeout";

  constructor(
    message: string,
    status: number | null,
    kind: "http" | "network" | "timeout",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
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

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
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
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        // тело не JSON — оставляем дефолтное сообщение
      }
      throw new ApiError(message, res.status, "http");
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

export function verifyCode(email: string, code: string) {
  return request<{ token: string; isNew: boolean; user: ApiUser }>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
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
    headers: { "Content-Type": contentType },
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
  photoUrls: string[];
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

export function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return request<{ address: string }>(`/geocode/reverse?${params}`).then((result) => result.address);
}

async function getPhotoUploadUrl(contentType: string) {
  return request<{ uploadUrl: string; publicUrl: string }>("/places/photo-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

// Загружает файл напрямую в S3 по presigned-ссылке, минуя сервер API.
export async function uploadPhoto(file: File): Promise<string> {
  const contentType = file.type || "image/jpeg";
  const { uploadUrl, publicUrl } = await getPhotoUploadUrl(contentType);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
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
