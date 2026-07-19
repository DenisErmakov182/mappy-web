import type { Place, PlaceCategory, VisitStatus } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TOKEN_KEY = "mappy_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // тело не JSON — оставляем дефолтное сообщение
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ApiUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  avatarUrl: string | null;
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
  return request<ApiUser>("/auth/me");
}

export interface PlaceInput {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  categories: PlaceCategory[];
  note: string;
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

export function fetchFriends() {
  return request<ApiFriend[]>("/friends");
}
export function addFriendByUsername(username: string) {
  return request<ApiFriend>("/friends", { method: "POST", body: JSON.stringify({ username }) });
}
export function removeFriend(id: string) {
  return request<{ ok: true }>(`/friends/${id}`, { method: "DELETE" });
}
