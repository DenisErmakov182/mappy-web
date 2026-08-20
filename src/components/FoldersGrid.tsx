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
          style={{ left: px(9), top: py(59), right: px(9), fontSize: "12px", lineHeight: "14px" }}
        >
          Рестораны
        </span>
      </FolderArt>
    </div>
  );
}

/*
 * Вкладка «Папки» — узлы 2289:42911 (пусто) / 2293:28627 (нечётное число
 * папок — кнопка тайлом сетки рядом с последней, 196×118) / 2293:28629
 * (чётное — кнопка отдельной строкой на всю ширину, 398×59, последний ряд
 * уже заполнен обеими колонками). Правило — по чётности folders.length, не
 * по конкретному числу, см. AddFolderTile ниже.
 */

function AddFolderTile({ onClick, fillsGridCell }: { onClick: () => void; fillsGridCell: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center rounded-[var(--mappy-radius-lg)] border-[1.5px] border-dashed p-[10px] text-center text-[16px] font-medium"
      style={{
        // border-radius — токен --mappy-radius-lg (20px), не 28px: перепроверено
        // 20.08.2026 узлами 2293:28627/2293:28629, оба используют
        // var(--radius/lg, 20px). 28px — это --mappy-radius-xl, другой токен,
        // видимо перепутан по аналогии с соседними rounded-[28px] в проекте.
        borderColor: "rgba(3,7,18,0.04)",
        backgroundColor: "var(--mappy-surface-secondary)",
        color: "var(--mappy-text-secondary)",
        lineHeight: "18px",
        letterSpacing: "-0.6px",
        // Нечётный тайл: встаёт вторым в ряду, той же высоты, что карточка
        // (aspect-ratio 195/118 — высота папки перепроверена 20.08.2026,
        // узел 2293:28627). Чётный случай: отдельная строка на всю ширину,
        // обычная высота кнопки (узел 2293:28629).
        aspectRatio: fillsGridCell ? "195 / 118" : undefined,
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
  onFolderRenamed,
  onFolderDeleted,
}: {
  folders: Folder[];
  query?: string;
  onOpenFolder: (folder: Folder) => void;
  onCreateFolder: () => void;
  /** Папку переименовали прямо с карточки в сетке (кнопка «⋮», не заходя внутрь). */
  onFolderRenamed: (folderId: string, title: string) => void;
  /** Папку удалили прямо с карточки в сетке. */
  onFolderDeleted: (folderId: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.title.toLowerCase().includes(q));
  }, [folders, query]);

  return (
    /* overflow-x-hidden обязателен: подложка папки (FolderArt → folder-shape.svg)
       нарочно рисуется шире и левее самой карточки под блик тени (см. комментарий
       у SHAPE_LEFT_OFFSET в FolderArt.tsx) и у крайних колонок вылезает за px-4
       на пару пикселей. Без явного overflow-x браузер сам продвигает его в auto
       вслед за overflow-y (спека CSS), и эти лишние ~2px превращали список в
       по-настоящему горизонтально прокручиваемый — на телефоне ощущалось как
       лёгкий скролл по сторонам при обычной вертикальной прокрутке папок. */
    <div className="h-full overflow-y-auto overflow-x-hidden pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
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
            <div className="grid grid-cols-2 gap-x-2 gap-y-5">
            {/* gap-y больше gap-x нарочно: внешняя тень папки (FolderArt,
                drop-shadow ~10px offset + 6.5px blur) не влезала в 8px
                зазор между рядами — следующий ряд закрывал её собой,
                тень обрывалась ровной линией по верхнему краю нижней
                карточки. 20px даёт тени место дотянуть до конца, не
                трогая горизонтальный зазор между колонками. */}
            {filtered.map((folder) => (
              <FolderCard
                key={folder.id}
                folderId={folder.id}
                title={folder.title}
                placesCount={folder.placesCount}
                coverPhotos={folder.coverPhotos}
                onClick={() => onOpenFolder(folder)}
                onFolderRenamed={(title) => onFolderRenamed(folder.id, title)}
                onFolderDeleted={() => onFolderDeleted(folder.id)}
              />
            ))}
            {/* Последний ряд сетки в 2 колонки — нечётный остаток (1, 3, 5…)
                значит в последнем ряду одна папка, кнопка встаёт тайлом
                рядом с ней (узел 2293:28627, 196×118 — размер ровно с
                грид-ячейку). На числе папок, а не filtered.length — кнопка
                не должна прыгать между размерами, пока человек печатает
                в поиске. */}
            {folders.length % 2 === 1 && <AddFolderTile onClick={onCreateFolder} fillsGridCell />}
            </div>
          )}

          {/* Чётное число папок (2, 4, 6…) — последний ряд заполнен обеими
              колонками, кнопка уезжает отдельной строкой на всю ширину
              (узел 2293:28629, 398×59). folders.length === 0 сюда не
              попадает — эта ветка вообще не рендерится, для пустого
              состояния своя кнопка внутри карточки выше. */}
          {/* mt-5 (20px), не mt-2 (8px) — тот же зазор, что gap-y у сетки
              выше: тень последнего ряда карточек (см. коммент у gap-y-5)
              так же не помещалась в 8px до этой кнопки и обрезалась. */}
          {folders.length > 0 && folders.length % 2 === 0 && (
            <div className="mt-5">
              <AddFolderTile onClick={onCreateFolder} fillsGridCell={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
