import type { ReactNode } from "react";
import folderShape from "../assets/illustrations/folder-shape.svg";
import folderPocket from "../assets/illustrations/folder-pocket.svg";
import photoPlaceholder from "../assets/illustrations/photo-placeholder.webp";

/*
 * Общая графика папки — узлы 2357:12326 («Folder Vector», подложка) и
 * 2357:12325 («Карман», полный силуэт: язычок + тело + карман, минус
 * внешняя тень самой папки — владелец нарочно не стал печь её в экспорт,
 * чтобы не мешала обрезке, добавлена фильтром ниже).
 *
 * Вынесена из FolderCard.tsx в отдельный компонент 19.08.2026: узел
 * 2289:41953 (шит «Как назовём папку?») подтвердил, что там та же самая
 * графика в ту же 195×139 натуральную величину — без придуманного раньше
 * масштаба 1.583×, который FolderNameSheet.tsx держал отдельным дублем
 * координат. Теперь оба места используют один слой вёрстки, отличаются
 * только обёрткой (кнопка сетки vs шит) и передним текстом (children —
 * статичные название/счётчик у карточки, живой <input> у шита).
 *
 * Геометрия — в процентах от базы 195×118 (BASE_W/BASE_H), не в пикселях:
 * FolderCard тянется по ширине колонки сетки, и проценты разрешаются
 * относительно контейнера ровно так же что во fluid-обёртке (грид), что в
 * фиксированной (195px div в шите) — поэтому один и тот же px()/py() годится
 * для обоих контекстов.
 *
 * BASE_H перепроверен 20.08.2026 повторным запросом узла 2353:10496: макет
 * изменился со времени первой сверки — рамка стала 118 (была 139), пустого
 * отступа сверху над язычком больше нет (Folder Vector теперь top:0, был
 * top:20). Highlight/текст сдвинулись вместе с этим примерно на 21px вверх
 * (75→54, 80→59, 98→77) — числа ниже уже по новому узлу, не пересчитаны
 * вручную из старых.
 */
const BASE_W = 195;
const BASE_H = 118;

/** Пиксель макета → доля ширины. */
const px = (value: number) => `${(value / BASE_W) * 100}%`;
/** Пиксель макета → доля высоты. */
const py = (value: number) => `${(value / BASE_H) * 100}%`;

/*
 * Натуральная высота обоих SVG в системе координат самого экспорта (не
 * BASE_H): 195×119 у подложки, 195×120.957 у кармана — на ~2px выше, там
 * запечён небольшой запас под скруглением скоса внизу. Оба ставятся в одну
 * и ту же точку (0, 0) в системе 195×118 — язычок начинается сразу от
 * верхнего края рамки, без отступа.
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
 * Три слота под фотографии — точные позиции и наклоны из макета (узел
 * 2353:10496, top пересчитан под новую рамку: было 47.24/44.5/55, минус те
 * же ~21px сдвига, что у Highlight/текста). Порядок в массиве = порядок
 * отрисовки: левое фото уходит под центральное, центральное под правое.
 */
const PHOTO_SLOTS = [
  { left: 14, top: 26.24, rotate: -7.09 },
  { left: 57.5, top: 23.5, rotate: 10.69 },
  { left: 98.64, top: 34, rotate: 0.34 },
] as const;

const PHOTO_W = 71;
const PHOTO_H = 60;

export function FolderArt({
  coverPhotos,
  children,
}: {
  /** До трёх обложек; null — заглушка на этот слот. */
  coverPhotos: (string | null)[];
  /** Передний текст поверх кармана — статичные title/count у FolderCard,
   *  живой <input> у FolderNameSheet. Позиционируется вызывающей стороной. */
  children?: ReactNode;
}) {
  const photos = coverPhotos.slice(0, 3);

  return (
    <div className="relative" style={{ aspectRatio: `${BASE_W} / ${BASE_H}` }}>
      {/* Подложка папки с язычком. */}
      <img
        src={folderShape}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{
          left: 0,
          top: 0,
          width: "100%",
          height: py(SHAPE_H),
          maxWidth: "none",
          // Внешняя тень самой папки — не в экспорте, добавлена фильтром.
          // Фиксированные px, не px(): drop-shadow не принимает проценты
          // для blur (тот же случай, что Highlight/boxShadow были раньше).
          filter: "drop-shadow(0 4px 2.5px rgba(0,0,0,0.1)) drop-shadow(0 10px 6.5px rgba(0,0,0,0.1))",
        }}
      />

      {/* Контактная тень под стопкой фото (узел 2364:12389, только у
          заполненной папки, в folder-pocket.svg её нет — она зависит от
          фото, а не от самого кармана). Идёт ПЕРЕД фото и ПОД карманом —
          блюр (12.147px в макете) частично перекрывается карманом снизу,
          видимый ободок остаётся мягким затемнением над линией кармана. */}
      {photos.length > 0 && (
        <span
          className="pointer-events-none absolute block"
          style={{
            left: px(14),
            top: py(54),
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
              // выше) — с процентом рамка молча схлопывалась в 0.
              borderWidth: "2.8px",
              borderRadius: px(10.038),
            }}
          >
            <img src={photo ?? photoPlaceholder} alt="" className="h-full w-full select-none object-cover" />
          </span>
        );
      })}

      {/* Карман — полный силуэт папки, обрезан clip-path до своей нижней
          половины (зона кармана). Внутри уже готовые скос-тень, пунктирная
          обводка и декоративная полоска — все запечены SVG-фильтрами в
          самом файле. */}
      <img
        src={folderPocket}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{
          left: 0,
          top: 0,
          width: "100%",
          height: py(POCKET_H),
          maxWidth: "none",
          clipPath: `inset(${POCKET_CLIP_TOP} 0 0 0)`,
        }}
      />

      {children}
    </div>
  );
}

/** Реэкспорт для вызывающих сторон, которым нужно позиционировать передний
 *  текст в той же системе координат 195×118 (title/count у FolderCard,
 *  input у FolderNameSheet). */
export { px as folderArtPx, py as folderArtPy };
