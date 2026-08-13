import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../../../lib/utils";

/*
 * Атом Toggle — по Figma-компоненту `Toggle` (1796:38297), State=Default/Active.
 * «Переключатель бинарной настройки, которая применяется сразу, без
 * подтверждения» (описание компонента в Figma).
 *
 * Ровно та же разметка, что уже была в PrivacyToggle (AddPlaceSheet.tsx) —
 * знак switch, круглый бегунок, — но обобщённая (aria-label и checked/onChange
 * пробрасываются, а не зашиты на «Личная заметка») и на токенах вместо hex
 * (#ff637e → surface-brand, #f3f4f6 → surface-secondary, #99a1af → icon-fourth,
 * все совпали с уже существующими переменными библиотеки — не пришлось
 * заводить новых). PrivacyToggle не мигрирован на этот атом — см. ADR-013.
 *
 * Disabled — своё решение, не из Figma: в компоненте `Toggle` в самой
 * Figma-библиотеке нет варианта Muted/Disabled (только Default/Active).
 * Добавлено на будущее ради согласованности с остальными атомами
 * (правило библиотеки, п. 8 — Muted всегда через нативный disabled), опоры
 * на конкретный дизайн-токен под это состояние нет.
 */

const trackVariants = cva(
  "relative h-[28px] w-[53px] shrink-0 overflow-hidden rounded-[length:var(--mappy-radius-2xl)] transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      active: {
        true: "bg-surface-brand",
        false: "bg-surface-secondary",
      },
    },
    defaultVariants: { active: false },
  },
);

const knobVariants = cva(
  "absolute top-[3px] size-[22px] rounded-[length:var(--mappy-radius-2xl)] transition-[left,background-color]",
  {
    variants: {
      active: {
        true: "left-[28px] bg-surface-primary",
        false: "left-[3px] bg-icon-fourth",
      },
    },
    defaultVariants: { active: false },
  },
);

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Обязателен: у переключателя нет текста, без aria-label он невидим для скринридера. */
  "aria-label": string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked, onChange, disabled, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(trackVariants({ active: checked }), className)}
      {...props}
    >
      <span className={knobVariants({ active: checked })} />
    </button>
  ),
);
Toggle.displayName = "Toggle";
