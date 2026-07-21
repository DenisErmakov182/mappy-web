import type { Place } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip } from "./primitives";
import friendAvatarBlur from "../assets/icons/friend-avatar-blur.svg";

function formatPlaceDate(createdAt?: string): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/*
 * Карточка места по макету 1489:15401: белая, radius 28, фото слева 196x132 (radius 20),
 * справа название/адрес и снизу чип оценки + тег категории.
 */
export function PlaceRowCard({ place, onClick }: { place: Place; onClick?: () => void }) {
  const createdAt = formatPlaceDate(place.createdAt);

  return (
    <button
      onClick={onClick}
      className="flex h-[148px] items-start gap-2 p-2 bg-white rounded-[28px] w-full text-left shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
    >
      <div
        className="relative w-[196px] h-[132px] rounded-[20px] overflow-hidden shrink-0"
        style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
      >
        {place.photoUrls[0] && (
          <img src={place.photoUrls[0]} alt="" className="w-full h-full object-cover" />
        )}
        {place.owner && (
          <>
            <img
              src={friendAvatarBlur}
              alt=""
              className="pointer-events-none absolute -left-[32px] -top-[32px] h-[104px] w-[104px] max-w-none"
            />
            <span
              className="absolute left-[5px] top-[5px] z-10 block h-10 w-10 overflow-hidden rounded-full bg-[#f9fafb] backdrop-blur-[10px]"
              title={place.owner.name}
            >
              {place.owner.avatarUrl && (
                <img src={place.owner.avatarUrl} alt={place.owner.name} className="h-full w-full object-cover" />
              )}
            </span>
          </>
        )}
      </div>

      <div className="flex h-[132px] flex-col justify-between flex-1 min-w-0 pt-1">
        <div className="flex min-w-0 flex-col gap-1 px-1">
          <p
            className="h-[36px] w-[160px] max-w-full overflow-hidden text-ellipsis text-[16px] font-semibold leading-[18px] tracking-[-0.6px] [overflow-wrap:anywhere] [text-wrap:balance]"
            style={{
              color: "var(--mappy-text-primary)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {place.title}
          </p>
          <p className="text-[12px] font-medium leading-[16px]" style={{ color: "var(--mappy-text-secondary)" }}>
            {place.address}
          </p>
          {createdAt && (
            <p className="text-[12px] font-medium leading-[16px]" style={{ color: "#99a1af" }}>
              {createdAt}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <RatingChipSquare place={place} />
          {place.categories[0] && (
            <span
              className="inline-flex h-[28px] items-center justify-center px-2 rounded-[10px]"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            >
              <CategoryIcon category={place.categories[0]} size={24} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* В карточке чип оценки прямоугольный (radius 10), в отличие от круглого на пине */
function RatingChipSquare({ place }: { place: Place }) {
  return (
    <span className="[&>span]:rounded-[10px]">
      <RatingChip rating={place.rating} />
    </span>
  );
}
