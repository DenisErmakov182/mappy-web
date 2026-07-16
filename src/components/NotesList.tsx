import type { Place } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip } from "./primitives";
import pinMap from "../assets/illustrations/pin-map.png";

/*
 * Заметки: список карточек (фото слева 180x120) либо пустое состояние
 * с иллюстрацией пина на карте по макету 1489:17755.
 */
export function NotesList({
  places,
  onSelectPlace,
  onGoToMap,
}: {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onGoToMap: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      {places.length === 0 ? (
        <div className="flex flex-col items-center text-center px-8 pt-[28vh]">
          <img src={pinMap} alt="" className="w-[110px] mb-4" />
          <p className="text-[20px] font-semibold leading-tight mb-2" style={{ color: "var(--mappy-text-primary)" }}>
            Вы еще не добавили мест
            <br />с такими параметрами
          </p>
          <p className="text-[14px] mb-4" style={{ color: "var(--mappy-text-secondary)" }}>
            Может они не стоили того, чтоб их запоминать
          </p>
          <button
            onClick={onGoToMap}
            className="px-4 py-2.5 rounded-[12px] text-[15px] font-medium"
            style={{ backgroundColor: "var(--mappy-brand-subtle)", color: "var(--mappy-pink)" }}
          >
            Предлагаем найти новые!
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-[110px]">
          {places.map((place) => (
            <button
              key={place.id}
              onClick={() => onSelectPlace(place)}
              className="flex gap-2 items-start text-left bg-white rounded-[28px] p-2"
            >
              <div
                className="w-[168px] h-[122px] rounded-[20px] overflow-hidden shrink-0"
                style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
              >
                {place.photoUrls[0] && (
                  <img src={place.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex flex-col justify-between self-stretch flex-1 min-w-0 pt-1">
                <div className="px-1">
                  <p
                    className="text-[16px] font-semibold leading-[20px] line-clamp-2"
                    style={{ color: "var(--mappy-text-primary)" }}
                  >
                    {place.title}
                  </p>
                  <p className="text-[13px] mt-1" style={{ color: "var(--mappy-text-secondary)" }}>
                    {place.address}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <RatingChip rating={place.rating} />
                  {place.categories[0] && (
                    <span
                      className="inline-flex h-[28px] items-center justify-center px-2 rounded-[10px]"
                      style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
                    >
                      <CategoryIcon category={place.categories[0]} size={22} />
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
