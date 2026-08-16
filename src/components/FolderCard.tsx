import folderBack from "../assets/illustrations/folder-back.svg";
import folderShadow from "../assets/illustrations/folder-shadow.svg";
import photoPlaceholder from "../assets/illustrations/photo-placeholder.webp";

/*
 * Карточка папки по узлу 2289:43221.
 *
 * Собрана слоями, как в макете, а не одной картинкой: подложка папки (SVG со
 * своей тенью) → до трёх фотографий мест → передний «карман» с названием.
 * Фотографии настоящие — те, что в макете, это просто рыба (подтверждено
 * владельцем 16.08.2026), поэтому сюда приходят реальные обложки из API.
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
      {/* Подложка папки с язычком.
          SVG экспортирован вместе с растёкшейся тенью, поэтому его рамка
          БОЛЬШЕ самой фигуры, и ставить его по координатам фигуры нельзя.
          В макете фигура — 195×119 в точке (0, 20), а инсеты картинки
          [0 -5.22% -17.11% -5.22%] от неё: по бокам тень добавляет по 5.22%
          (отсюда ширина 215.4 и сдвиг влево на 10.18), сверху не добавляет
          ничего — значит top остаётся ровно 20, без поправки. */}
      <img
        src={folderBack}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{ left: px(-10.18), top: py(20), width: px(215.4), maxWidth: "none" }}
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
              // Толщина рамки и радиус тоже масштабируются: на узкой карточке
              // фиксированные 2.8px выглядели бы толще, чем в макете.
              borderWidth: px(2.816),
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

      {/* Передний «карман»: сплошная заливка + внутренняя тень сверху, поверх
          неё пунктирная обводка отдельным слоем — в макете это два разных
          прямоугольника, а не один бордер. */}
      <span
        className="pointer-events-none absolute block"
        style={{
          left: 0,
          top: py(75),
          width: "100%",
          height: py(64),
          backgroundColor: "#ff2056",
          borderBottomLeftRadius: px(19.281),
          borderBottomRightRadius: px(19.281),
          boxShadow: `inset 0 ${px(-4.964)} ${px(16.967)} ${px(-1.928)} #c10007`,
        }}
      />
      <span
        className="pointer-events-none absolute block border-dashed"
        style={{
          left: px(2),
          top: py(77),
          width: px(191),
          height: py(60),
          borderColor: "#c10007",
          borderBottomWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderTopWidth: 0,
          borderBottomLeftRadius: px(18.865),
          borderBottomRightRadius: px(18.865),
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

      {/* Мягкая тень-подставка под папкой. Та же поправка на разлив тени, что
          и у подложки: фигура 176×4 в точке (10, 132), инсеты [-148.93% -3.38%]
          растят картинку до 187.9 в ширину и сильно вверх по вертикали. */}
      <img
        src={folderShadow}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{ left: px(4.05), top: py(126.04), width: px(187.9), maxWidth: "none" }}
      />
    </button>
  );
}
