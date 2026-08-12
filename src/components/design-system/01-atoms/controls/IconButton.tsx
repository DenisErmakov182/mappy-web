import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../../lib/utils";

/*
 * Атом IconButton — по Figma-компоненту `IconButton` (791:17982),
 * варианты Size=xs/s/m/l × Tone=Default/Ghost/Positive.
 *
 * В самом макете во всех примерах иконка — крестик (M/x и т.п.), но это
 * только демо-заполнение состояний в Figma, не значит, что компонент
 * только для закрытия: сюда передаётся любая иконка через `icon`.
 *
 * `Pressed` из Figma намеренно не стал отдельным пропом — у веб-кнопки
 * есть родной :active, реализовано через active: в самих классах, а не
 * JS-стейтом. `Muted` = задизейбленное состояние → нативный атрибут
 * disabled, не только визуальная имитация (правило библиотеки, п. 8).
 *
 * Цвет фона/рамки по состояниям — из официальных переменных Figma
 * (see get_variable_defs, 12.08.2026). Цвет иконки на tone=default/ghost —
 * наш собственный осознанный выбор (Figma использует готовые растровые
 * иконки без единого правила перекраски), согласован с уже существующим
 * `CloseButton` в primitives.tsx.
 */

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none",
  {
    variants: {
      size: {
        xs: "size-5 [&_svg]:size-3", // 20px, иконка 12px
        s: "size-[26px] [&_svg]:size-4", // 26px, иконка 16px
        m: "size-7 [&_svg]:size-5", // 28px, иконка 20px
        l: "size-8 [&_svg]:size-6", // 32px, иконка 24px
      },
      tone: {
        default:
          "rounded-full bg-surface-secondary text-icon-secondary active:bg-surface-tertiary disabled:bg-surface-primary disabled:text-icon-disabled",
        ghost:
          "rounded-[length:var(--mappy-radius-xs)] bg-transparent text-icon-tertiary active:bg-surface-tertiary disabled:bg-transparent disabled:text-icon-disabled",
        positive:
          "rounded-full bg-surface-success text-icon-success active:bg-surface-success-secondary active:text-icon-on-inverse disabled:bg-surface-success-tertiary disabled:text-icon-success",
      },
    },
    defaultVariants: { size: "m", tone: "default" },
  },
);

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size">,
    VariantProps<typeof iconButtonVariants> {
  icon: ReactNode;
  /** Обязателен: у кнопки нет текста, без aria-label она невидима для скринридера. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, size, tone, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(iconButtonVariants({ size, tone }), className)} {...props}>
      {icon}
    </button>
  ),
);
IconButton.displayName = "IconButton";
