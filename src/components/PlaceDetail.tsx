import { useState } from "react";
import type { Place } from "../types";
import { categoryLabel } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { CloseButton } from "./primitives";
import { ActionSheet } from "./ActionSheet";
import { PhotoSwiper } from "./PhotoSwiper";
import { SinglePlaceMap } from "./SinglePlaceMap";
import { OwnerTag } from "./OwnerTag";
import { PlaceHeader } from "./PlaceHeader";
import { distanceMeters, getLastKnownLocation } from "../lib/geo";
import { buildWalkingDirectionsUrl } from "../lib/mapsDeepLink";

/*
 * Открытая карточка по макету 1829:23152. У места друга тот же просмотр,
 * но действия read-only: сохранить независимую копию себе или поделиться.
 */
export function PlaceDetail({
  place,
  onClose,
  onEdit,
  onDelete,
  onSaveCopy,
  onShare,
}: {
  place: Place;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSaveCopy?: () => Promise<void>;
  onShare: () => void | Promise<void>;
}) {
  const [showActions, setShowActions] = useState(false);
  // Карта с одним пином — тот же компонент, что и на публичной странице
  // шеринга, только без нижней кнопки: владельцу нечего себе сохранять.
  const [showMap, setShowMap] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);

  // Последняя известная позиция устройства — та же, что кладёт кнопка «Найти
  // меня» на карте. Может отсутствовать (разрешение не давали) — тогда просто
  // не показываем расстояние, кнопка «Маршрут» от этого не зависит.
  const myLocation = getLastKnownLocation();
  const distanceToPlace = myLocation
    ? distanceMeters(
        { latitude: myLocation.lat, longitude: myLocation.lng },
        { latitude: place.latitude, longitude: place.longitude },
      )
    : null;
  const navigateUrl = buildWalkingDirectionsUrl(place.latitude, place.longitude);

  const share = () => {
    setShowActions(false);
    void onShare();
  };

  const saveCopy = async () => {
    if (!onSaveCopy || savingCopy) return;
    setShowActions(false);
    setSavingCopy(true);
    try {
      await onSaveCopy();
    } finally {
      setSavingCopy(false);
    }
  };

  const actions = place.owner
    ? [
        { label: savingCopy ? "Сохраняем…" : "Сохранить себе", onClick: () => void saveCopy() },
        { label: "Поделиться", onClick: share },
      ]
    : [
        { label: "Поделиться", onClick: share },
        ...(onEdit
          ? [
              {
                label: "Редактировать",
                onClick: () => {
                  setShowActions(false);
                  onEdit();
                },
              },
            ]
          : []),
        ...(onDelete
          ? [
              {
                label: "Удалить",
                color: "#ff3b30",
                onClick: () => {
                  setShowActions(false);
                  onDelete();
                },
              },
            ]
          : []),
      ];

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-white">
      <div className="flex min-h-full flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+34px)] pt-[calc(env(safe-area-inset-top)+11px)]">
        {/*
          `relative z-10` — не украшение. Свайпер фото ниже вытягивает свой
          скролл-контейнер вверх отрицательным `-my-8`, оставляя место мягкой
          тени, и эти 32px пустого padding'а ложатся поверх строки с кнопками:
          до правки у «Закрыть» и «…» нажимались только верхние ~8px. Поднимаем
          строку в порядке отрисовки — попадания снова достаются кнопкам,
          а запас под тень у свайпера остаётся нетронутым.
        */}
        <div className="relative z-10 flex h-7 shrink-0 items-center justify-between">
          <CloseButton onClick={onClose} size={28} backgroundColor="rgba(255,255,255,0.6)" />
          <button
            type="button"
            onClick={() => setShowActions(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60"
            aria-label={place.owner ? `Действия с местом ${place.owner.name}` : "Действия с местом"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5" fill="#1e2939" />
              <circle cx="12" cy="12" r="1.5" fill="#1e2939" />
              <circle cx="19" cy="12" r="1.5" fill="#1e2939" />
            </svg>
          </button>
        </div>

        <PhotoSwiper photos={place.photos ?? []} />

        <div className="mt-3 flex w-full flex-col gap-6">
          <PlaceHeader
            title={place.title}
            address={place.address}
            rating={place.rating}
            createdAt={place.createdAt}
            systemName={place.systemName}
            onShowMap={() => setShowMap(true)}
            distanceMeters={distanceToPlace}
          />

          <div className="flex w-full flex-col gap-4">
            {place.owner && <OwnerTag owner={place.owner} />}

            {place.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {place.categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center justify-center gap-1 rounded-[14px] py-3 pl-2 pr-3 text-[16px] font-medium leading-[18px]"
                    style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
                  >
                    <CategoryIcon category={category} />
                    {categoryLabel[category]}
                  </span>
                ))}
              </div>
            )}

            {place.note && (
              <div
                className="w-full whitespace-pre-wrap rounded-[20px] p-4 text-[16px] leading-5 tracking-[-0.6px] [overflow-wrap:anywhere]"
                style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
              >
                {place.note}
              </div>
            )}
          </div>
        </div>
      </div>

      {showActions && <ActionSheet actions={actions} onCancel={() => setShowActions(false)} />}
    </div>

      {showMap && (
        <SinglePlaceMap
          place={place}
          onClose={() => setShowMap(false)}
          closeVariant="back"
          navigateUrl={navigateUrl}
          interactiveRoute
        />
      )}
    </>
  );
}
