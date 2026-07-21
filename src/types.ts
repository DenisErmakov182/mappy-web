export type VisitStatus = "been" | "planning";

export const visitStatusLabel: Record<VisitStatus, string> = {
  been: "Был",
  planning: "Планирую",
};

export type PlaceCategory =
  | "food"
  | "shopping"
  | "nature"
  | "monuments"
  | "fun"
  | "culture"
  | "sports";

export const categoryLabel: Record<PlaceCategory, string> = {
  food: "Еда и напитки",
  shopping: "Шопинг",
  nature: "Природа",
  monuments: "Достопримечательности",
  fun: "Развлечения",
  culture: "Культура",
  sports: "Спорт и активный отдых",
};

export const allCategories: PlaceCategory[] = [
  "food",
  "shopping",
  "nature",
  "monuments",
  "fun",
  "culture",
  "sports",
];

// Цвета чипа оценки из дизайн-системы (surface/text): 5-4 — success, 3 — warning, 2-1 — danger
export function ratingChipColors(rating: number): { bg: string; text: string } {
  if (rating >= 4) return { bg: "#dcfce7", text: "#00a63e" };
  if (rating === 3) return { bg: "#fef9c2", text: "#d08700" };
  return { bg: "#ffe2e2", text: "#fb2c36" };
}

export interface Place {
  id: string;
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

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

export interface PlaceFilters {
  categories: Set<PlaceCategory>;
  ratings: Set<number>;
  statuses: Set<VisitStatus>;
}

export function emptyFilters(): PlaceFilters {
  return { categories: new Set(), ratings: new Set(), statuses: new Set() };
}

export function cloneFilters(f: PlaceFilters): PlaceFilters {
  return {
    categories: new Set(f.categories),
    ratings: new Set(f.ratings),
    statuses: new Set(f.statuses),
  };
}

export function filtersAreEmpty(filters: PlaceFilters): boolean {
  return (
    filters.categories.size === 0 &&
    filters.ratings.size === 0 &&
    filters.statuses.size === 0
  );
}

export function placeMatchesFilters(place: Place, filters: PlaceFilters): boolean {
  if (filters.categories.size > 0 && !place.categories.some((c) => filters.categories.has(c))) {
    return false;
  }
  if (filters.ratings.size > 0 && !filters.ratings.has(place.rating)) {
    return false;
  }
  if (filters.statuses.size > 0 && !filters.statuses.has(place.status)) {
    return false;
  }
  return true;
}
