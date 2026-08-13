import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../../../lib/utils";

/*
 * Атом Chip — по Figma-компоненту `Chip` (851:14603), State=Default/Selected.
 * «Компактный выбираемый элемент для категорий и фильтров» (описание
 * компонента в Figma). Известное ограничение самого компонента: ось Size
 * содержит только одно значение `m` — на будущее либо добавят размеры в
 * Figma, либо ось уберут; здесь размер не параметризован по той же причине.
 *
 * Уже была ровно такая же логика вручную в FilterSheet.tsx (`chipStyle`) —
 * бинарный чип без промежуточных состояний, тёмный/светлый по selected —
 * и статичным бейджем категории в AddPlaceSheet.tsx. Цвета совпали с уже
 * существующими токенами (#101828 → surface-inverse, #f9fafb → surface-primary,
 * #4a5565 → text-secondary) — не пришлось заводить новых. FilterSheet и
 * категории не мигрированы на этот атом — см. ADR-013.
 */

const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[length:var(--mappy-spacing-2xs)] rounded-[length:var(--mappy-radius-md)] py-[length:var(--mappy-spacing-sm)] pl-[length:var(--mappy-spacing-xs)] pr-[length:var(--mappy-spacing-sm)] text-body font-medium tracking-densed transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-6",
  {
    variants: {
      selected: {
        true: "bg-surface-inverse text-text-inverse",
        false: "bg-surface-primary text-text-secondary",
      },
    },
    defaultVariants: { selected: false },
  },
);

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  selected: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, children, selected, iconLeft, iconRight, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(chipVariants({ selected }), className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  ),
);
Chip.displayName = "Chip";
