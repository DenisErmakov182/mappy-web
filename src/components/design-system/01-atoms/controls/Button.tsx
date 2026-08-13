import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../../lib/utils";

/*
 * Атом Button — по Figma-компоненту `Button` (1419:25008),
 * варианты Style=CTA/Primary/Secondary/Brand-Secondary × Size=S/L.
 *
 * State=Pressed/Disabled из Figma — не JS-стейт: Pressed через нативный
 * :active (реализовано в самих классах), Disabled через нативный атрибут
 * disabled (правило библиотеки, п. 8), а не отдельный визуальный вариант.
 *
 * `Style` в макете называется `style` — здесь это `tone`, чтобы не путать
 * с HTML-атрибутом `style` у самого `<button>` (тот всё равно проброшен
 * через ...props, если понадобится инлайновая переопределение).
 *
 * CTA — единственный стиль с градиентом, а не плоским цветом: default
 * берёт уже существующий `--mappy-gradient-cta` (использовался в старом
 * `CtaButton`), pressed — новый `--mappy-gradient-cta-pressed`, добавленный
 * в index.css именно для этого атома (у старого `CtaButton` состояния
 * нажатия не было вообще).
 *
 * Старый `CtaButton` в primitives.tsx остаётся рядом, не мигрирован —
 * см. ADR-013.
 */

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-[length:var(--mappy-spacing-2xs)] rounded-[length:var(--mappy-radius-md)] text-center font-medium tracking-densed transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none",
  {
    variants: {
      size: {
        l: "h-[var(--mappy-height-control-xl)] w-full px-[length:var(--mappy-spacing-md)] text-body [&_svg]:size-6",
        s: "px-[length:var(--mappy-spacing-sm)] py-[length:var(--mappy-spacing-xs)] text-body-2 [&_svg]:size-4",
      },
      tone: {
        cta: "bg-[image:var(--mappy-gradient-cta)] text-text-inverse active:bg-[image:var(--mappy-gradient-cta-pressed)] disabled:bg-[image:none] disabled:bg-surface-brand-subtle disabled:text-text-brand-subtle",
        primary:
          "bg-surface-brand text-text-inverse active:bg-surface-brand-secondary disabled:bg-surface-brand-subtle disabled:text-text-brand-subtle",
        secondary:
          "bg-surface-secondary text-text-primary active:bg-surface-inverse active:text-text-inverse disabled:bg-surface-primary disabled:text-text-disabled",
        brandSecondary:
          "bg-surface-brand-subtle text-text-brand active:bg-surface-brand active:text-text-inverse disabled:text-text-brand-subtle",
      },
    },
    defaultVariants: { size: "l", tone: "cta" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, iconLeft, iconRight, size, tone, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ size, tone }), className)} {...props}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  ),
);
Button.displayName = "Button";
