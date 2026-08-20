import { useEffect, useMemo, useState } from "react";
import type { Place, PlaceFilters } from "../types";
import { placeMatchesFilters } from "../types";
import { fetchFolderPlaces, removePlaceFromFolder, renameFolder, deleteFolder } from "../lib/api";
import { NotesList } from "./NotesList";
import { BackIcon } from "./FriendsScreen";
import { FilterIcon, SearchIcon, Sheet, CloseButton } from "./primitives";
import { ActionSheet } from "./ActionSheet";
import { FolderNameSheet } from "./FolderNameSheet";
import { IconButton } from "./design-system/01-atoms/controls/IconButton";
import { Icon } from "./design-system/00-foundations/Icon";
import removeFromFolderIcon from "../assets/icons/swipe-remove-folder.svg";

/*
 * Подтверждение удаления папки (узел не задан отдельно владельцем — по его
 * словесному ТЗ 20.08.2026: дропдаун «…» → «Удалить» → этот шит → реальное
 * удаление). Места внутри папки НЕ удаляются — только явка папки как
 * подборки, каскад в БД уносит лишь связку folder_places (см. комментарий у
 * DELETE /folders/:id в mappy-api/src/routes/folders.ts). Подпись это
 * прямо проговаривает, чтобы не пугать человека.
 */
function FolderDeleteConfirmSheet({
  folderTitle,
  deleting,
  onConfirm,
  onClose,
}: {
  folderTitle: string;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 pb-4">
        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="flex flex-col gap-1">
            <h3
              className="text-[22px] leading-7 font-semibold tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Удалить папку «{folderTitle}»?
            </h3>
            <p className="text-[14px] leading-[18px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Места внутри папки никуда не денутся — они останутся в «Сохранённом» и на карте.
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="h-14 flex-1 rounded-[14px] text-[16px] font-medium disabled:opacity-70"
            style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-secondary)" }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-14 flex-1 rounded-[14px] text-[16px] font-medium text-white disabled:opacity-70"
            style={{ backgroundColor: "#fb2c36" }}
          >
            {deleting ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

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
  onFolderRenamed,
  onFolderDeleted,
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
  /** Папку переименовали — родитель обновляет список папок и заголовок этого
   *  экрана (folderTitle приходит сверху, сам компонент его не хранит). */
  onFolderRenamed: (title: string) => void;
  /** Папку удалили — родитель обновляет список папок и уводит с этого экрана
   *  (сам компонент не решает, куда — это App.tsx через onBack). */
  onFolderDeleted: () => void;
  filters: PlaceFilters;
  hasActiveFilters: boolean;
  onFilterTap: () => void;
}) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const saveRename = async (title: string) => {
    setRenaming(true);
    try {
      await renameFolder(folderId, title);
      onFolderRenamed(title);
      setShowRename(false);
    } catch {
      // Оставляем шит открытым с уже введённым текстом — сеть подвела,
      // а не «название нельзя такое», человек может просто повторить.
    } finally {
      setRenaming(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteFolder(folderId);
      onFolderDeleted();
    } catch {
      // Папку уже могли удалить на другом устройстве, или сеть подвела —
      // шит остаётся открытым, человек видит «Удаляем…» пропало и пробует ещё раз.
      setDeleting(false);
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
            <IconButton
              size="xs"
              tone="ghost"
              icon={<Icon name="dots-vertical" />}
              aria-label="Действия с папкой"
              onClick={() => setShowMenu(true)}
            />
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

      {showMenu && (
        <ActionSheet
          actions={[
            { label: "Редактировать название", onClick: () => { setShowMenu(false); setShowRename(true); } },
            { label: "Удалить", color: "#ff3b30", onClick: () => { setShowMenu(false); setShowDeleteConfirm(true); } },
          ]}
          onCancel={() => setShowMenu(false)}
        />
      )}

      {showRename && (
        <FolderNameSheet
          title="Переименовать папку"
          confirmLabel={renaming ? "Сохраняем…" : "Сохранить"}
          initialValue={folderTitle}
          onConfirm={saveRename}
          onClose={() => !renaming && setShowRename(false)}
        />
      )}

      {showDeleteConfirm && (
        <FolderDeleteConfirmSheet
          folderTitle={folderTitle}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => !deleting && setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
