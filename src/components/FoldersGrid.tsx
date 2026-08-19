import { useMemo } from "react";
import type { Folder } from "../lib/api";
import { FolderCard } from "./FolderCard";
import folderBack from "../assets/illustrations/folder-back.svg";
import stickerCafe from "../assets/photos/sticker-cafe.webp";
import stickerMuseum from "../assets/photos/sticker-museum.webp";
import stickerRestaurant from "../assets/photos/sticker-restaurant.webp";

/*
 * Декоративная иллюстрация пустого состояния (узел 2289:42933) — та же
 * графика, что у FolderCard (folder-back.svg + три стикера-заглушки), но
 * не отдельная картинка: в макете это буквально Folder-компонент, целиком
 * повёрнутый на -12.35deg, в масштабе ~0.72 от базовых 195×139.
 * Название/счётчик — рыба из макета («Рестораны»/16), не настоящие данные:
 * иллюстрация ничего не показывает про реальные папки пользователя.
 */
function EmptyStateIllustration() {
  return (
    <div style={{ transform: "rotate(-12.35deg)", width: 141, height: 101 }} className="relative shrink-0">
      <img
        src={folderBack}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{ left: -8, top: 10, width: 155, maxWidth: "none" }}
      />
      {[
        { left: 10, top: 25, w: 51, h: 43, rotate: -7.09, src: stickerCafe },
        { left: 45, top: 22, w: 51, h: 43, rotate: 10.69, src: stickerMuseum },
        { left: 72, top: 30, w: 51, h: 43, rotate: 0.34, src: stickerRestaurant },
      ].map((slot, i) => (
        <span
          key={i}
          className="pointer-events-none absolute block overflow-hidden border-white bg-white"
          style={{
            left: slot.left,
            top: slot.top,
            width: slot.w,
            height: slot.h,
            transform: `rotate(${slot.rotate}deg)`,
            borderWidth: 2,
            borderRadius: 7,
          }}
        >
          <img src={slot.src} alt="" className="h-full w-full select-none object-cover" />
        </span>
      ))}
      <span
        className="pointer-events-none absolute block"
        style={{
          left: 0,
          top: 54,
          width: "100%",
          height: 46,
          backgroundColor: "#ff2056",
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          boxShadow: "inset 0 -4px 12px -2px #c10007",
        }}
      />
      <span className="pointer-events-none absolute text-[12px] font-semibold text-white" style={{ left: 7, top: 57 }}>
        Рестораны
      </span>
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
