import type { Place } from "../types";
import { useEffect, useState } from "react";
import pinMap from "../assets/illustrations/pin-map.png";
import { SwipeablePlaceCard } from "./SwipeablePlaceCard";

/*
 * Заметки: список карточек (фото слева 180x120) либо пустое состояние
 * с иллюстрацией пина на карте по макету 1489:17755.
 */
export function NotesList({
  places,
  onSelectPlace,
  onGoToMap,
  onDeletePlace,
  onEditPlace,
  onSharePlace,
}: {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onGoToMap: () => void;
  onDeletePlace: (place: Place) => void;
  onEditPlace: (place: Place) => void;
  onSharePlace: (place: Place) => void;
}) {
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (openPlaceId && !places.some((place) => place.id === openPlaceId)) {
      setOpenPlaceId(null);
    }
  }, [openPlaceId, places]);

  return (
    <div className="absolute inset-0" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      <div className="absolute inset-x-0 bottom-[127px] top-[127px] overflow-y-auto overscroll-contain">
        {places.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
            <img src={pinMap} alt="" className="mb-4 w-[110px]" />
            <p className="mb-2 text-[20px] font-semibold leading-tight" style={{ color: "var(--mappy-text-primary)" }}>
              Вы еще не добавили мест
              <br />с такими параметрами
            </p>
            <p className="mb-4 text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Может они не стоили того, чтоб их запоминать
            </p>
            <button
              onClick={onGoToMap}
              className="rounded-[12px] px-4 py-2.5 text-[15px] font-medium"
              style={{ backgroundColor: "var(--mappy-brand-subtle)", color: "var(--mappy-pink)" }}
            >
              Предлагаем найти новые!
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-3">
            {places.map((place) => (
              <SwipeablePlaceCard
                key={place.id}
                place={place}
                isOpen={openPlaceId === place.id}
                onOpen={() => setOpenPlaceId(place.id)}
                onClose={() => setOpenPlaceId(null)}
                onSelect={() => onSelectPlace(place)}
                onDelete={() => onDeletePlace(place)}
                onEdit={() => onEditPlace(place)}
                onShare={() => onSharePlace(place)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
