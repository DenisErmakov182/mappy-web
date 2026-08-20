import { FolderArt, folderArtPx as px, folderArtPy as py } from "./FolderArt";
import { IconButton } from "./design-system/01-atoms/controls/IconButton";
import { Icon } from "./design-system/00-foundations/Icon";
import { useFolderActions } from "./FolderActions";

/*
 * Карточка папки — графика вынесена в общий FolderArt.tsx (используется и
 * здесь, и в FolderNameSheet.tsx, узел 2289:41953 подтвердил ту же 195×139
 * геометрию в обоих местах, см. комментарий в FolderArt.tsx). Здесь остаётся
 * только обёртка-кнопка (тянется по ширине колонки сетки) и передний текст —
 * название, счётчик и кнопка «⋮» поверх кармана.
 *
 * Кнопка «⋮» (узел 2374:12645, Variant4) — тот же useFolderActions, что и в
 * шапке FolderDetailScreen, просто триггер стоит прямо на карточке. Из-за
 * неё название сузилось с right:px(9) (тянулось до края) до фиксированных
 * px(152) — в макете там теперь место под кнопку.
 *
 * Обёртка — div[role=button], не <button>: настоящий IconButton внутри
 * должен быть кликабелен независимо от клика по карточке (открыть папку), а
 * <button> внутри <button> — невалидный HTML (браузер сам разрывает
 * вложенность, ломая и вёрстку, и обработчики). Клавиатурная доступность
 * восстановлена вручную через onKeyDown (Enter/Space).
 */
export function FolderCard({
  folderId,
  title,
  placesCount,
  coverPhotos,
  onClick,
  onFolderRenamed,
  onFolderDeleted,
}: {
  folderId: string;
  title: string;
  placesCount: number;
  /** До трёх обложек; null — место без фотографии, на его слот идёт заглушка. */
  coverPhotos: (string | null)[];
  onClick: () => void;
  onFolderRenamed: (title: string) => void;
  onFolderDeleted: () => void;
}) {
  const { openMenu, sheets } = useFolderActions({
    folderId,
    folderTitle: title,
    onRenamed: onFolderRenamed,
    onDeleted: onFolderDeleted,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="relative block w-full cursor-pointer text-left"
      aria-label={`Папка «${title}», мест: ${placesCount}`}
    >
      <FolderArt coverPhotos={coverPhotos}>
        <span
          className="pointer-events-none absolute block truncate font-semibold text-white"
          style={{
            left: px(9),
            top: py(59),
            width: px(152),
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

        {/* size="m" (28px, иконка 20px), не "xs" — перепроверено 20.08.2026
            на актуальном узле 2289:41766: там "Medium Close Icon" size-20,
            обёртка p-4+radius-xs = 28px итого. Раньше брал xs по устаревшей
            ссылке (2374:12580 тогда показывала другую иконку и Extra Small
            12px). Позиция тоже с актуального узла: left:167, top:55 (не 171/59).
            Тёмная подложка-кружок (rgba(0,0,0,0.7)) — не из Figma (там фон
            ghost/прозрачный), добавлена по прямому запросу владельца:
            белые точки без подложки терялись на пёстром фоне (фото/красный). */}
        <div className="absolute" style={{ left: px(167), top: py(55) }}>
          <IconButton
            size="m"
            tone="ghost"
            icon={<Icon name="dots-vertical" />}
            aria-label={`Действия с папкой «${title}»`}
            className="rounded-full text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={(e) => {
              e.stopPropagation();
              openMenu();
            }}
          />
        </div>
      </FolderArt>

      {sheets}
    </div>
  );
}
