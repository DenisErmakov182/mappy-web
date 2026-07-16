import { useState } from "react";
import { allCategories, categoryLabel, type PlaceCategory } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { Sheet, CloseButton, CtaButton } from "./primitives";

/*
 * Лист «Категории» по макету 1489:16484: чипы с 3D-иконками, CTA «Добавить точку».
 */
export function CategoriesSheet({
  selected,
  onApply,
  onClose,
}: {
  selected: Set<PlaceCategory>;
  onApply: (categories: Set<PlaceCategory>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Set<PlaceCategory>>(new Set(selected));

  const toggle = (category: PlaceCategory) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-2">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[24px] font-semibold leading-[28px]" style={{ color: "var(--mappy-text-primary)" }}>
            Категории
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {allCategories.map((category) => {
            const isSelected = draft.has(category);
            return (
              <button
                key={category}
                onClick={() => toggle(category)}
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

        <CtaButton
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Добавить точку
        </CtaButton>
      </div>
    </Sheet>
  );
}
