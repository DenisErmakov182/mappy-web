import { useState } from "react";
import type { Place } from "../types";
import { categoryLabel } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip, CloseButton, CtaButton } from "./primitives";
import { ActionSheet } from "./ActionSheet";

/*
 * Просмотр созданного места по макету 1489:17577: фото на весь верх, поверх — кнопки
 * закрыть/меню; белый лист со скруглением наезжает на фото; внизу CTA «Поделиться местом».
 * Кнопка «...» открывает action sheet (1489:17684) с редактированием и удалением.
 */
export function PlaceDetail({
  place,
  onClose,
  onEdit,
  onDelete,
}: {
  place: Place;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="relative h-[252px] shrink-0" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
        {place.photoUrls[0] && (
          <img src={place.photoUrls[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute top-[max(env(safe-area-inset-top),12px)] left-4 right-4 flex justify-between">
          <span className="rounded-full bg-white/80 backdrop-blur">
            <CloseButton onClick={onClose} size={30} />
          </span>
          <button
            onClick={() => setShowActions(true)}
            className="w-[30px] h-[30px] rounded-full bg-white/80 backdrop-blur flex items-center justify-center"
            aria-label="Действия"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="5" cy="12" r="1.8" fill="#4A5565" />
              <circle cx="12" cy="12" r="1.8" fill="#4A5565" />
              <circle cx="19" cy="12" r="1.8" fill="#4A5565" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden bg-white rounded-t-[24px] -mt-6 px-5 pt-6 pb-28">
        <h1 className="text-[24px] font-semibold leading-[28px] mb-2 [overflow-wrap:anywhere]" style={{ color: "var(--mappy-text-primary)" }}>
          {place.title}
        </h1>

        <div className="flex items-start gap-2 min-w-0 mb-5">
          <RatingChip rating={place.rating} />
          <span className="min-w-0 text-[16px] [overflow-wrap:anywhere]" style={{ color: "var(--mappy-text-secondary)" }}>
            {place.address}
          </span>
        </div>

        {place.photoUrls.length > 0 && (
          <div className="flex gap-1 overflow-x-auto -mx-5 px-5 mb-4">
            {place.photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-[120px] h-[120px] rounded-xl object-cover shrink-0"
              />
            ))}
          </div>
        )}

        {place.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {place.categories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 pl-2 pr-3 py-3 rounded-[14px] text-[16px] font-medium"
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
            className="min-w-0 max-w-full rounded-[14px] p-4 text-[16px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere]"
            style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
          >
            {place.note}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-white via-white/90 to-transparent">
        <CtaButton>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mr-1">
            <path d="M20 4L10 14M20 4L14 20L10 14M20 4L4 10L10 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Поделиться местом
        </CtaButton>
      </div>

      {showActions && (
        <ActionSheet
          actions={[
            {
              label: "Редактировать",
              onClick: () => {
                setShowActions(false);
                onEdit();
              },
            },
            {
              label: "Удалить",
              color: "#ff3b30",
              onClick: () => {
                setShowActions(false);
                onDelete();
              },
            },
          ]}
          onCancel={() => setShowActions(false)}
        />
      )}
    </div>
  );
}
