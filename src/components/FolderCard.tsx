import folderShape from "../assets/illustrations/folder-shape.svg";
import folderPocket from "../assets/illustrations/folder-pocket.svg";
import photoPlaceholder from "../assets/illustrations/photo-placeholder.webp";

/*
 * Карточка папки по узлам 2357:12326 («Folder Vector» — подложка папки) и
 * 2357:12325 («Карман» — ПОЛНЫЙ силуэт папки целиком: язычок + тело +
 * карман, минус внешняя тень самой папки — владелец нарочно не стал печь
 * её в экспорт, чтобы она не мешала обрезке, добавляем фильтром ниже).
 *
 * Это переезд с ручной пересборки скосов/пунктира в CSS (были баги: box-
 * shadow не принимает проценты, тень Highlight приходилось подбирать на
 * глаз) на готовые растры из Figma — скос-тень кармана и пунктирная
 * обводка внутри folder-pocket.svg запечены настоящими SVG-фильтрами,
 * пиксель-в-пиксель как в макете, без единой строчки самодельного CSS.
 *
 * Собрана слоями: подложка → контактная тень под фото → до трёх фотографий
 * мест → «карман» (folder-pocket.svg, обрезан clip-path только до своей
 * нижней половины — верхняя дублирует подложку и её незачем показывать
 * поверх фото) → текст названия и счётчика.
 *
 * Оба новых SVG — чистые плоские экспорты БЕЗ отступа под растёкшуюся тень,
 * в отличие от старого folder-back.svg (который использует остальные
 * компоненты «Папок» — FoldersGrid/FolderPickerSheet/FolderNameSheet, их не
 * трогаем).
 *
 * folder-shadow.svg («тень-подставка») здесь больше НЕ используется —
 * по метаданным макета это не тень снаружи, а тот же декоративный
 * Rectangle 5177, что и внутри кармана, только по ошибке вынесенный
 * отдельным экспортом. Теперь он уже встроен в folder-pocket.svg —
 * отдельный слой был бы дублем. См. ту же находку и ручной фикс позиции
 * в FolderNameSheet.tsx, где этот дубль-ассет ещё используется отдельно.
 *
 * Все размеры — из макета в системе координат 195×139, а карточка на экране
 * тянется по ширине колонки сетки. Поэтому геометрия задана в процентах от
 * этой базы, а не в пикселях: два столбца на 430px-экране дают папке ~180px,
 * и жёсткие пиксели разъехались бы. BASE_W/BASE_H держат пересчёт в одном
 * месте — если макет поменяется, править только их и px() ниже.
 */
const BASE_W = 195;
const BASE_H = 139;

/** Пиксель макета → доля ширины карточки. */
const px = (value: number) => `${(value / BASE_W) * 100}%`;
/** Пиксель макета → доля высоты карточки. */
const py = (value: number) => `${(value / BASE_H) * 100}%`;

/*
 * Натуральная высота обоих SVG в системе координат самого экспорта (не
 * BASE_H): 195×119 у подложки, 195×120.957 у кармана — на ~2px выше, там
 * запечён небольшой запас под скруглением скоса внизу. Оба ставятся в одну
 * и ту же точку (0, 20) в системе 195×139 — старый top основания силуэта,
 * без поправок на разлив тени (её в файле больше нет).
 */
const SHAPE_H = 119;
const POCKET_H = 120.957;
/*
 * В folder-pocket.svg зона кармана начинается на локальном y=55 из полных
 * 120.957 (сверху — задублированная подложка, её обрезаем). Это инсет
 * clip-path в процентах от СВОЕЙ высоты картинки — не от py(), у clip-path
 * проценты валидны и означают долю бокса элемента, а не карточки.
 */
const POCKET_CLIP_TOP = `${(55 / POCKET_H) * 100}%`;

/*
 * Три слота под фотографии — точные позиции и наклоны из макета. Порядок в
 * массиве = порядок отрисовки: левое фото уходит под центральное, центральное
 * под правое, как в макете.
 */
const PHOTO_SLOTS = [
  { left: 14, top: 47.24, rotate: -7.09 },
  { left: 57.5, top: 44.5, rotate: 10.69 },
  { left: 98.64, top: 55, rotate: 0.34 },
] as const;

const PHOTO_W = 71;
const PHOTO_H = 60;

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
  // Пустая папка показывает голую подложку без фотографий (макет 2293:28526,
  // левая карточка) — слоты не рисуем вовсе, а не рисуем три заглушки: пустая
  // папка и папка из трёх мест без снимков это разные состояния.
  const photos = coverPhotos.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block w-full text-left"
      style={{ aspectRatio: `${BASE_W} / ${BASE_H}` }}
      aria-label={`Папка «${title}», мест: ${placesCount}`}
    >
      {/* Подложка папки с язычком. */}
      <img
        src={folderShape}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{
          left: 0,
          top: py(20),
          width: "100%",
          height: py(SHAPE_H),
          maxWidth: "none",
          // Внешняя тень самой папки — не в экспорте, добавлена фильтром.
          // Фиксированные px, не px(): drop-shadow не принимает проценты
          // для blur (тот же случай, что Highlight/boxShadow были раньше).
          // Повторяет два прохода из старого filter в folder-back.svg —
          // offset/blur разные, оба чёрный 10%.
          filter: "drop-shadow(0 4px 2.5px rgba(0,0,0,0.1)) drop-shadow(0 10px 6.5px rgba(0,0,0,0.1))",
        }}
      />

      {/* Контактная тень под стопкой фото (узел 2353:10508, только у
          заполненной папки, в folder-pocket.svg её нет — она зависит от
          фото, а не от самого кармана). В разметке этот слой идёт ПЕРЕД
          фото и ПОД карманом — блюр (12.147px в макете) частично
          перекрывается карманом снизу, а видимый ободок остаётся мягким
          затемнением над линией кармана, вокруг нижних краёв фото. Радиус
          блюра — фиксированным px, см. причину у drop-shadow выше. */}
      {photos.length > 0 && (
        <span
          className="pointer-events-none absolute block"
          style={{
            left: px(14),
            top: py(75),
            width: px(165),
            height: py(41),
            backgroundColor: "#4d0218",
            filter: "blur(12px)",
          }}
        />
      )}

      {photos.map((photo, index) => {
        const slot = PHOTO_SLOTS[index];
        if (!slot) return null;
        return (
          <span
            key={index}
            className="pointer-events-none absolute block overflow-hidden border-white bg-white"
            style={{
              left: px(slot.left),
              top: py(slot.top),
              width: px(PHOTO_W),
              height: py(PHOTO_H),
              transform: `rotate(${slot.rotate}deg)`,
              // borderWidth — фиксированный px, не px(): border-width не
              // принимает проценты (как blur/spread у box-shadow и filter
              // выше в этом файле) — с процентом рамка молча схлопывалась в
              // 0 и оставался только border-color, без видимой толщины.
              // borderRadius проценты принимает нормально, его не трогаем.
              borderWidth: "2.8px",
              borderRadius: px(10.038),
            }}
          >
            <img
              src={photo ?? photoPlaceholder}
              alt=""
              className="h-full w-full select-none object-cover"
            />
          </span>
        );
      })}

      {/* Карман — полный силуэт папки, обрезан clip-path до своей нижней
          половины (зона кармана). Внутри уже готовые скос-тень, пунктирная
          обводка и декоративная полоска — все запечены SVG-фильтрами в
          самом файле, см. комментарий над BASE_W. */}
      <img
        src={folderPocket}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{
          left: 0,
          top: py(20),
          width: "100%",
          height: py(POCKET_H),
          maxWidth: "none",
          clipPath: `inset(${POCKET_CLIP_TOP} 0 0 0)`,
        }}
      />

      <span
        className="pointer-events-none absolute block truncate font-semibold text-white"
        style={{
          left: px(9),
          top: py(80),
          right: px(9),
          fontSize: "16px",
          lineHeight: "18px",
          letterSpacing: "-0.6px",
        }}
      >
        {title}
      </span>
      <span
        className="pointer-events-none absolute block"
        style={{
          left: px(10),
          top: py(98),
          fontSize: "16px",
          lineHeight: "18px",
          letterSpacing: "-0.6px",
          color: "rgba(3,7,18,0.2)",
        }}
      >
        {placesCount}
      </span>
    </button>
  );
}
