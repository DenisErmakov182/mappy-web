import type { Place } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip } from "./primitives";

/*
 * Карточка места по макету 1489:15401: белая, radius 28, фото слева 196x132 (radius 20),
 * справа название/адрес и снизу чип оценки + тег категории.
 */
export function PlaceRowCard({ place, onClick }: { place: Place; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2 p-2 bg-white rounded-[28px] w-full text-left shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
    >
      <div
        className="w-[168px] h-[122px] rounded-[20px] overflow-hidden shrink-0"
        style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
      >
        {place.photoUrls[0] && (
          <img src={place.photoUrls[0]} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex flex-col justify-between self-stretch flex-1 min-w-0 pt-1 pb-0">
        <div className="flex flex-col gap-1 px-1">
          <p className="text-[16px] font-semibold leading-[18px] truncate" style={{ color: "var(--mappy-text-primary)" }}>
            {place.title}
          </p>
          <p className="text-[12px] font-medium" style={{ color: "var(--mappy-text-secondary)" }}>
            {place.address}
          </p>
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
