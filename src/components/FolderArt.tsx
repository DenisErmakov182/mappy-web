import type { ReactNode } from "react";
import folderShape from "../assets/illustrations/folder-shape.svg";
import folderPocket from "../assets/illustrations/folder-pocket.svg";
import photoPlaceholder from "../assets/illustrations/photo-placeholder.webp";

/*
 * Общая графика папки — узлы 2357:12326 («Folder Vector», подложка) и
 * 2357:12325 («Карман», полный силуэт: язычок + тело + карман). Внешняя
 * тень самой папки в экспорт не входила (владелец нарочно не стал печь её,
 * чтобы не мешала обрезке) — запечена вручную прямо в folder-shape.svg как
 * SVG-фильтр, см. комментарий у SHAPE_VIEWBOX_W ниже.
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
 * Натуральная высота кармана в системе координат самого экспорта (не
 * BASE_H): 195×120.957 — на ~2px выше подложки, там запечён небольшой запас
 * под скруглением скоса внизу. Ставится в точку (0, 0) в системе 195×118 —
 * язычок начинается сразу от верхнего края рамки, без отступа.
 */
const POCKET_H = 120.957;
/*
 * Подложка (folder-shape.svg) — свой отдельный случай: viewBox шире и выше
 * самой фигуры (235×150 вместо 195×119), там запечена внешняя тень как
 * настоящий SVG-фильтр (feMorphology+feOffset+feGaussianBlur, те же два
 * прохода, что раньше жили в CSS filter: drop-shadow). Причина переезда —
 * подозрение на баг WebKit: CSS filter на fluid-масштабируемом SVG <img>
 * иногда растрирует всю картинку целиком в заниженном разрешении вместо
 * честного вектора («низ папки пиксельный», найдено владельцем на реальном
 * iPhone). Карман (folder-pocket.svg) с самого начала жил так же — тень
 * внутри SVG, не в CSS — и с этим багом не сталкивался.
 *
 * Фигура папки занимает [0,195]×[0,119] ВНУТРИ вьюбокса [-20,0]–[215,150] —
 * поэтому картинку нельзя просто растянуть на 100% ширины/высоты карточки,
 * как раньше: тогда съедутся пропорции (запас под тень займёт часть места
 * самой фигуры). left/width пересчитаны так, чтобы область [0,195] встала
 * ровно на прежнее место (весь SHAPE_W размах), а запас [-20,0] и [195,215]
 * ушёл за пределы карточки видимым бликом тени (overflow не обрезает,
 * родитель без overflow-hidden).
 */
const SHAPE_VIEWBOX_W = 235;
const SHAPE_VIEWBOX_H = 150;
const SHAPE_LEFT_OFFSET = -20;
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
          left: px(SHAPE_LEFT_OFFSET),
          top: 0,
          width: px(SHAPE_VIEWBOX_W),
          height: py(SHAPE_VIEWBOX_H),
          maxWidth: "none",
        }}
      />

      {/* Контактная тень (узел 2374:12427 пустая / 2364:12389 заполненная) —
          раньше рисовалась только у заполненной папки, но владелец
          20.08.2026 добавил этот слой и в Property 1=Default (пустая, без
          фото) с теми же координатами — теперь безусловно, для любой
          папки. Идёт ПЕРЕД фото и ПОД карманом — блюр (12.147px в макете)
          частично перекрывается карманом снизу, видимый ободок остаётся
          мягким затемнением над линией кармана.
          Цвет РАЗНЫЙ по состоянию — не одна и та же переменная: пустая
          #c70036 (brand/700), заполненная #4d0218 (brand/950, темнее).
          У заполненной тень прячется под фото и должна читаться как тень;
          у пустой она единственный видимый акцент внизу — светлее, чтобы
          не выглядеть грязным пятном без фото поверх. */}
      <span
        className="pointer-events-none absolute block"
        style={{
          left: px(14),
          top: py(54),
          width: px(165),
          height: py(41),
          backgroundColor: photos.length > 0 ? "#4d0218" : "#c70036",
          filter: "blur(12px)",
        }}
      />

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

      {/* Заливка кармана + внутренняя тень (узел 2372:12425 «Background») —
          обычный CSS, не часть folder-pocket.svg. Раньше жила внутри SVG со
          своим фильтром (feComposite operator="arithmetic" — редкий примитив,
          вероятный источник пиксельного низа папки на реальном устройстве,
          найдено владельцем на стенде уже после переезда на растры).
          box-shadow — фиксированные px, та же причина, что везде в файле:
          проценты недопустимы для blur/spread. */}
      <span
        className="pointer-events-none absolute block"
        style={{
          left: 0,
          top: py(55),
          width: "100%",
          height: py(64),
          backgroundColor: "var(--mappy-pink)",
          borderBottomLeftRadius: "var(--mappy-radius-lg)",
          borderBottomRightRadius: "var(--mappy-radius-lg)",
          boxShadow: "inset 0 -4.964px 16.967px -1.928px #c10007",
        }}
      />

      {/* Карман — полный силуэт папки, обрезан clip-path до своей нижней
          половины (зона кармана). Заливка вынесена выше в CSS; здесь
          остались только пунктирная обводка и декоративная полоска —
          запечены SVG-фильтрами в самом файле (проще и легче, чем заливка,
          пиксельности на них не находилось). */}
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
