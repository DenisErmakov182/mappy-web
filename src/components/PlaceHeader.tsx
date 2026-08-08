import { formatPlaceDate } from "../lib/formatDate";
import { RatingChip, Tag } from "./primitives";
import mapIcon from "../assets/icons/tab-map.webp";

/*
 * Блок «название → адрес с кнопкой «На карте» → рейтинг/дата/системное имя»
 * по узлу Figma 2189:39328 («Header»). Раньше это была своя копия разметки в
 * PlaceDetail (карточка владельца) и отдельная, устаревшая версия в
 * SharedPlaceScreen (публичная страница шеринга) — из-за этого они разошлись:
 * переверстка карточки в этапе 62 не попала на страницу шеринга. Один общий
 * компонент — гарантия, что они не разойдутся снова.
 */
export function PlaceHeader({
  title,
  address,
  rating,
  createdAt,
  systemName,
  onShowMap,
}: {
  title: string;
  address: string;
  rating: number;
  createdAt?: string;
  /** Название, предложенное подсказкой поиска при создании — сноска, если владелец переименовал место. */
  systemName?: string;
  onShowMap: () => void;
}) {
  const formattedDate = formatPlaceDate(createdAt);
  // Сноска не имеет смысла, если её и так видно в заголовке — показываем,
  // только когда владелец правда отредактировал название.
  const showSystemNameTag =
    systemName && systemName.trim().toLowerCase() !== title.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-2 px-1">
      {/*
        Заголовок занимает до трёх строк, по узлу Figma 2113:2653: там высота
        95px при line-height 32px. Держим `max-height` вместо фиксированной
        высоты, чтобы короткое название не оставляло под собой пустоту.
        Перенос по любому месту нужен для длинных слов — иначе одно слово
        шире колонки не переносится и вылезает.
      */}
      <h1
        className="block max-h-[96px] overflow-hidden text-ellipsis text-[28px] font-semibold leading-8 tracking-[-0.6px] [overflow-wrap:anywhere] [word-break:break-word]"
        style={{
          color: "var(--mappy-text-primary)",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
        }}
      >
        {title}
      </h1>

      <div className="flex min-w-0 items-start gap-2">
        <span
          className="min-w-0 flex-1 truncate pt-[5px] text-[20px] leading-6"
          style={{ color: "var(--mappy-text-secondary)" }}
        >
          {address}
        </span>
        <button
          type="button"
          onClick={onShowMap}
          className="flex h-[34px] shrink-0 items-center gap-1 rounded-[12px] pl-2 pr-2"
          style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
        >
          <img src={mapIcon} alt="" className="h-4 w-4 shrink-0 object-contain" />
          <span className="text-[14px] leading-[18px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
            На карте
          </span>
        </button>
      </div>

      {(rating > 0 || formattedDate || showSystemNameTag) && (
        <div className="flex flex-wrap items-center gap-1">
          {rating > 0 && (
            <span className="[&>span]:h-[26px] [&>span]:rounded-[10px]">
              <RatingChip rating={rating} />
            </span>
          )}
          {formattedDate && <Tag>{formattedDate}</Tag>}
          {showSystemNameTag && <Tag>{systemName}</Tag>}
        </div>
      )}
    </div>
  );
}
