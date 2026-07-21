import { useState } from "react";
import type { Place } from "../types";
import { categoryLabel } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip, CloseButton } from "./primitives";
import { ActionSheet } from "./ActionSheet";

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
  const [savingCopy, setSavingCopy] = useState(false);
  const createdAt = formatPlaceDate(place.createdAt);

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
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-white">
      <div className="flex min-h-full flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+34px)] pt-[calc(env(safe-area-inset-top)+11px)]">
        <div className="flex h-7 shrink-0 items-center justify-between">
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

        <div
          className="h-[253px] w-full shrink-0 overflow-hidden rounded-[28px] bg-white shadow-[8px_2px_30.4px_#e9e9e9]"
          style={{ backgroundColor: place.photoUrls[0] ? undefined : "var(--mappy-surface-secondary)" }}
        >
          {place.photoUrls[0] && <img src={place.photoUrls[0]} alt="" className="h-full w-full object-cover" />}
        </div>

        <div className="mt-3 flex w-full flex-col gap-6">
          <div className="flex flex-col gap-2 px-1">
            <h1
              className="truncate text-[28px] font-semibold leading-8 tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-primary)" }}
            >
              {place.title}
            </h1>
            <div className="flex min-w-0 items-center gap-2">
              <span className="[&>span]:h-[26px] [&>span]:rounded-[10px]">
                <RatingChip rating={place.rating} />
              </span>
              <span
                className="min-w-0 truncate text-[20px] leading-6"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                {place.address}
              </span>
            </div>
            {createdAt && (
              <p className="text-[16px] font-medium leading-[18px] tracking-[-0.6px]" style={{ color: "#99a1af" }}>
                {createdAt}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-4">
            {place.photoUrls.length > 0 && (
              <div className="-mr-4 flex gap-1 overflow-x-auto pr-4 [&::-webkit-scrollbar]:hidden">
                {place.photoUrls.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt=""
                    className="h-[120px] w-[120px] shrink-0 rounded-[10px] object-cover"
                  />
                ))}
              </div>
            )}

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

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 h-[148px] bg-gradient-to-b from-white/0 to-[#f3f4f6] backdrop-blur-[10px]" />

      {showActions && <ActionSheet actions={actions} onCancel={() => setShowActions(false)} />}
    </div>
  );
}
