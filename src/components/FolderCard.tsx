import { FolderArt, folderArtPx as px, folderArtPy as py } from "./FolderArt";

/*
 * Карточка папки — графика вынесена в общий FolderArt.tsx (используется и
 * здесь, и в FolderNameSheet.tsx, узел 2289:41953 подтвердил ту же 195×139
 * геометрию в обоих местах, см. комментарий в FolderArt.tsx). Здесь остаётся
 * только обёртка-кнопка (тянется по ширине колонки сетки) и передний текст —
 * название и счётчик поверх кармана.
 */
export function FolderCard({
  title,
  placesCount,
  coverPhotos,
  onClick,
}: {
  title: string;
  placesCount: number;
  /** До трёх обложек; null — место без фотографии, на его слот идёт заглушка. */
  coverPhotos: (string | null)[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block w-full text-left"
      aria-label={`Папка «${title}», мест: ${placesCount}`}
    >
      <FolderArt coverPhotos={coverPhotos}>
        <span
          className="pointer-events-none absolute block truncate font-semibold text-white"
          style={{
            left: px(9),
            top: py(59),
            right: px(9),
            fontSize: "16px",
            lineHeight: "18px",
            letterSpacing: "-0.6px",
          }}
        >
          {title}
        </span>
        {/* top py(81), не py(77): явный отступ 4px от низа бокса названия
            (77) — по прямому указанию владельца, не по боксам из Figma
            (там боксы названия/счётчика примыкают впритык). */}
        <span
          className="pointer-events-none absolute block"
          style={{
            left: px(10),
            top: py(81),
            fontSize: "16px",
            lineHeight: "18px",
            letterSpacing: "-0.6px",
            color: "rgba(3,7,18,0.2)",
          }}
        >
          {placesCount}
        </span>
      </FolderArt>
    </button>
  );
}
