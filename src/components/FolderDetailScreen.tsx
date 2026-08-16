import { useEffect, useMemo, useState } from "react";
import type { Place, PlaceFilters } from "../types";
import { placeMatchesFilters } from "../types";
import { fetchFolderPlaces, removePlaceFromFolder } from "../lib/api";
import { NotesList } from "./NotesList";
import { BackIcon } from "./FriendsScreen";
import { FilterIcon, SearchIcon } from "./primitives";
import removeFromFolderIcon from "../assets/icons/swipe-remove-folder.svg";

// Высота шапки (заголовок 44 + строка поиска 64, узел 2295:33044) — NotesList
// использует её, чтобы сдвинуть список ровно под неё, а не под глобальный
// SearchFilterBar (64px), который здесь не рендерится вовсе.
const HEADER_HEIGHT = "108px";

/*
 * Экран «внутри папки» (узел 2295:28632) — по сути тот же список мест, что
 * и «Сохранённое», под своей шапкой (назад / название папки + счётчик) и
 * локальным поиском+фильтром вместо глобального SearchFilterBar. Свайп места
 * убирает его из папки, а не удаляет — место остаётся в «Сохранённом» и на
 * карте (решение владельца, см. Этап 75 в истории разработки).
 */
export function FolderDetailScreen({
  folderId,
  folderTitle,
  onBack,
  onSelectPlace,
  onEditPlace,
  onSharePlace,
  onGoToMap,
  onPlaceRemoved,
  filters,
  hasActiveFilters,
  onFilterTap,
}: {
  folderId: string;
  folderTitle: string;
  onBack: () => void;
  onSelectPlace: (place: Place) => void;
  onEditPlace: (place: Place) => void;
  onSharePlace: (place: Place) => void;
  onGoToMap: () => void;
  /** Место убрано из папки — родитель обновляет счётчик/обложку в FoldersGrid. */
  onPlaceRemoved: (place: Place) => void;
  filters: PlaceFilters;
  hasActiveFilters: boolean;
  onFilterTap: () => void;
}) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPlaces(null);
    setError(false);
    fetchFolderPlaces(folderId)
      .then((data) => {
        if (!cancelled) setPlaces(data.places);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const visiblePlaces = useMemo(() => {
    if (!places) return [];
    const q = query.trim().toLowerCase();
    return places.filter((place) => {
      if (!placeMatchesFilters(place, filters)) return false;
      if (!q) return true;
      return place.title.toLowerCase().includes(q) || place.address.toLowerCase().includes(q);
    });
  }, [places, filters, query]);

  const removeFromFolder = async (place: Place) => {
    setPlaces((prev) => (prev ? prev.filter((p) => p.id !== place.id) : prev));
    try {
      await removePlaceFromFolder(folderId, place.id);
      onPlaceRemoved(place);
    } catch {
      // Папку могли уже удалить на другом устройстве, или сеть подвела —
      // возвращаем место в список, а не оставляем интерфейс лгать.
      setPlaces((prev) => (prev ? [...prev, place] : prev));
    }
  };

  return (
    <div className="relative h-full" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      {places === null ? null : error ? (
        <div className="flex h-full items-center justify-center px-8 text-center">
          <p className="text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
            Не удалось загрузить папку
          </p>
        </div>
      ) : (
        <NotesList
          places={visiblePlaces}
          onSelectPlace={onSelectPlace}
          onGoToMap={onGoToMap}
          onEditPlace={onEditPlace}
          onDeletePlace={removeFromFolder}
          onSharePlace={onSharePlace}
          headerHeight={HEADER_HEIGHT}
          deleteLabel="Убрать"
          deleteIcon={removeFromFolderIcon}
          deleteBackground="#4a5565"
          emptyTitle="В этой папке пока нет мест"
          emptySubtitle="Сохраните место и добавьте его в эту папку"
        />
      )}

      <div className="blur-edge-top" />

      {/* Шапка: назад + название папки + счётчик, и строка поиска+фильтра —
          слиты в одну карточку с тенью (узел 2295:33044), 8px 2px 30.4px
          #e9e9e9 — та же тень, что уже используется в SwipeablePlaceCard. */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-[var(--mappy-floating-top)]">
        <div
          className="rounded-[28px] bg-white"
          style={{ boxShadow: "8px 2px 30.4px #e9e9e9" }}
        >
          <div className="flex items-center justify-between px-1 pb-1 pt-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад"
              className="-m-2 inline-flex shrink-0 items-center p-2 text-[#99a1af]"
            >
              <BackIcon />
            </button>
            <h1
              className="truncate px-2 text-[20px] font-medium leading-6"
              style={{ color: "var(--mappy-text-primary)" }}
            >
              {folderTitle}{" "}
              <span style={{ color: "var(--mappy-text-tertiary)" }}>{places?.length ?? ""}</span>
            </h1>
            <span className="inline-block h-5 w-5 shrink-0" aria-hidden="true" />
          </div>

          <div className="flex gap-1 p-2">
            <label
              className="flex h-12 flex-1 items-center gap-2.5 rounded-l-[32px] rounded-r-[10px] px-4"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            >
              <SearchIcon
                className="h-6 w-6 shrink-0"
                color={query ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по адресу, названию"
                className="min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:text-[var(--mappy-text-tertiary)]"
                style={{ color: "var(--mappy-text-primary)" }}
              />
            </label>
            <button
              type="button"
              onClick={onFilterTap}
              className="relative flex h-12 items-center justify-center rounded-r-[32px] rounded-l-[10px] px-4"
              style={{ backgroundColor: hasActiveFilters ? "var(--mappy-brand-subtle)" : "rgba(3,7,18,0.04)" }}
              aria-label="Фильтры"
            >
              <FilterIcon className="h-6 w-6" color={hasActiveFilters ? "var(--mappy-pink)" : "#4A5565"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
