import { useMemo } from "react";
import type { Folder } from "../lib/api";
import { FolderCard } from "./FolderCard";
import { FolderArt, folderArtPx as px, folderArtPy as py } from "./FolderArt";
import stickerCafe from "../assets/photos/sticker-cafe.webp";
import stickerMuseum from "../assets/photos/sticker-museum.webp";
import stickerRestaurant from "../assets/photos/sticker-restaurant.webp";

const EMPTY_STATE_PHOTOS = [stickerCafe, stickerMuseum, stickerRestaurant];

/*
 * Декоративная иллюстрация пустого состояния (узел 2289:42933) — тот же
 * FolderArt, что у FolderCard/FolderNameSheet, просто в фиксированной
 * ширине 141px (вместо fluid-колонки сетки) и с поворотом -12.35deg на
 * обёртке, как в макете. Название — рыба из макета, не настоящие данные:
 * иллюстрация ничего не показывает про реальные папки пользователя.
 */
function EmptyStateIllustration() {
  return (
    <div style={{ transform: "rotate(-12.35deg)", width: 141 }} className="shrink-0">
      <FolderArt coverPhotos={EMPTY_STATE_PHOTOS}>
        <span
          className="pointer-events-none absolute block truncate font-semibold text-white"
          style={{ left: px(9), top: py(80), right: px(9), fontSize: "12px", lineHeight: "14px" }}
        >
          Рестораны
        </span>
      </FolderArt>
    </div>
  );
}

/*
 * Вкладка «Папки» — узлы 2289:42911 (пусто) / 2293:28526 (одна папка,
 * кнопка добавления встаёт вторым тайлом сетки) / скриншот с двумя
 * папками (кнопка уезжает отдельной строкой ниже сетки). Три разных
 * состояния кнопки «Добавить папку», не два — оба подтверждены отдельными
 * узлами Figma, не додуманы.
 */

function AddFolderTile({ onClick, fillsGridCell }: { onClick: () => void; fillsGridCell: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-[28px] border-[1.5px] border-dashed p-[10px] text-center text-[16px] font-medium"
      style={{
        borderColor: "rgba(3,7,18,0.04)",
        backgroundColor: "var(--mappy-surface-secondary)",
        color: "var(--mappy-text-secondary)",
        // Одна папка: тайл встаёт вторым в сетке, той же высоты, что карточка
        // (aspect-ratio 195/139, узел 2293:28526). Две и больше: отдельная
        // строка на всю ширину, обычная высота кнопки (узел со скриншота).
        aspectRatio: fillsGridCell ? "195 / 139" : undefined,
        height: fillsGridCell ? undefined : 56,
      }}
    >
      Добавить папку
    </button>
  );
}

export function FoldersGrid({
  folders,
  query = "",
  onOpenFolder,
  onCreateFolder,
}: {
  folders: Folder[];
  query?: string;
  onOpenFolder: (folder: Folder) => void;
  onCreateFolder: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.title.toLowerCase().includes(q));
  }, [folders, query]);

  return (
    <div className="h-full overflow-y-auto pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      <div className="px-4 pt-[var(--mappy-floating-top)]">
        <div style={{ paddingTop: "calc(var(--mappy-search-bar-height) + var(--mappy-content-gap))" }}>
          {folders.length === 0 ? (
            <div className="flex items-center gap-3 overflow-hidden rounded-[28px] bg-white p-4">
            <div className="flex-1">
              <p className="text-[20px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
                Папки
              </p>
              <p className="mt-1 text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
                Создавайте подборки из мест
              </p>
              <button
                type="button"
                onClick={onCreateFolder}
                className="mt-4 rounded-[12px] px-4 py-2.5 text-[15px] font-medium"
                style={{ backgroundColor: "var(--mappy-brand-subtle)", color: "var(--mappy-pink)" }}
              >
                Добавить папку
              </button>
            </div>
            <EmptyStateIllustration />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
            {filtered.map((folder) => (
              <FolderCard
                key={folder.id}
                title={folder.title}
                placesCount={folder.placesCount}
                coverPhotos={folder.coverPhotos}
                onClick={() => onOpenFolder(folder)}
              />
            ))}
            {/* Ровно одна папка (без учёта фильтра поиском — кнопка не должна
                прыгать между размерами, пока человек печатает) — тайл в сетке. */}
            {folders.length === 1 && <AddFolderTile onClick={onCreateFolder} fillsGridCell />}
            </div>
          )}

          {folders.length >= 2 && (
            <div className="mt-2">
              <AddFolderTile onClick={onCreateFolder} fillsGridCell={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
