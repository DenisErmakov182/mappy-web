import { useMemo, useState } from "react";
import {
  allCategories,
  categoryLabel,
  cloneFilters,
  emptyFilters,
  placeMatchesFilters,
  ratingChipColors,
  type Place,
  type PlaceCategory,
  type PlaceFilters,
  type VisitStatus,
  visitStatusLabel,
} from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { Sheet, CloseButton, CtaButton } from "./primitives";

/*
 * Фильтр по макету 1489:17780: «Сбросить» слева, крестик справа; категории с иконками,
 * цветные чипы оценок 5★..2★, отдельные чипы «Был»/«Планирую», внизу CTA «Показать N мест».
 */
export function FilterSheet({
  filters,
  places,
  onApply,
  onClose,
}: {
  filters: PlaceFilters;
  places: Place[];
  onApply: (filters: PlaceFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PlaceFilters>(cloneFilters(filters));

  const matchCount = useMemo(
    () => places.filter((p) => placeMatchesFilters(p, draft)).length,
    [places, draft],
  );

  const toggleCategory = (category: PlaceCategory) =>
    setDraft((prev) => {
      const next = cloneFilters(prev);
      if (next.categories.has(category)) next.categories.delete(category);
      else next.categories.add(category);
      return next;
    });

  const toggleRating = (rating: number) =>
    setDraft((prev) => {
      const next = cloneFilters(prev);
      if (next.ratings.has(rating)) next.ratings.delete(rating);
      else next.ratings.add(rating);
      return next;
    });

  const toggleStatus = (status: VisitStatus) =>
    setDraft((prev) => {
      const next = cloneFilters(prev);
      if (next.statuses.has(status)) next.statuses.delete(status);
      else next.statuses.add(status);
      return next;
    });

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setDraft(emptyFilters())}
            className="text-[20px] font-medium"
            style={{ color: "#99a1af" }}
          >
            Сбросить
          </button>
          <CloseButton onClick={onClose} />
        </div>

        <section className="mb-6">
          <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--mappy-text-primary)" }}>
            Категории
          </h3>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((category) => {
              const isSelected = draft.categories.has(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-1 pl-2 pr-3 py-3 rounded-[14px] text-[16px] font-medium"
                  style={{
                    backgroundColor: isSelected ? "var(--mappy-brand-subtle)" : "var(--mappy-surface-primary)",
                    color: isSelected ? "var(--mappy-pink)" : "var(--mappy-text-primary)",
                  }}
                >
                  <CategoryIcon category={category} />
                  {categoryLabel[category]}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--mappy-text-primary)" }}>
            Оценка
          </h3>
          <div className="flex gap-2">
            {[5, 4, 3, 2].map((rating) => {
              const { bg, text } = ratingChipColors(rating);
              const isSelected = draft.ratings.has(rating);
              return (
                <button
                  key={rating}
                  onClick={() => toggleRating(rating)}
                  className="flex items-center gap-0.5 h-[40px] px-3 rounded-[12px] text-[16px] font-medium"
                  style={{
                    backgroundColor: bg,
                    color: text,
                    outline: isSelected ? `2px solid ${text}` : "none",
                    outlineOffset: -2,
                    opacity: draft.ratings.size === 0 || isSelected ? 1 : 0.45,
                  }}
                >
                  {rating} <span className="text-[13px]">★</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-7">
          <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--mappy-text-primary)" }}>
            Посещения
          </h3>
          <div className="flex gap-2">
            {(["been", "planning"] as VisitStatus[]).map((status) => {
              const isSelected = draft.statuses.has(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className="h-[44px] px-4 rounded-[14px] text-[16px] font-medium"
                  style={{
                    backgroundColor: isSelected ? "var(--mappy-brand-subtle)" : "var(--mappy-surface-primary)",
                    color: isSelected ? "var(--mappy-pink)" : "var(--mappy-text-primary)",
                  }}
                >
                  {visitStatusLabel[status]}
                </button>
              );
            })}
          </div>
        </section>

        <CtaButton
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          disabled={matchCount === 0}
        >
          {matchCount === 0 ? "Ничего не найдено" : `Показать: ${matchCount} мест`}
        </CtaButton>
      </div>
    </Sheet>
  );
}
