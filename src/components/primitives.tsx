import { useRef, useState, type ReactNode } from "react";
import { ratingChipColors } from "../types";
import starGold from "../assets/icons/star-gold.png";
import starSoft from "../assets/icons/star-soft.svg";

/* Чип оценки: цифра + звезда на цветном фоне (surface/success|warning|danger) */
export function RatingChip({ rating, size = "m" }: { rating: number; size?: "m" | "l" }) {
  const { bg, text } = ratingChipColors(rating);
  const height = size === "l" ? 32 : 26;
  return (
    <span
      className="inline-flex items-center justify-center gap-0.5 rounded-full px-2 font-medium"
      style={{ backgroundColor: bg, color: text, height, fontSize: size === "l" ? 16 : 15 }}
    >
      {rating}
      <span style={{ fontSize: size === "l" ? 13 : 12 }}>★</span>
    </span>
  );
}

/* Звезда оценки: выбранная — объёмная золотая, пустая — точный ассет из Figma (844:17051). */
export function StarIcon({ filled, size = 60 }: { filled: boolean; size?: number }) {
  if (filled) {
    return <img src={starGold} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={starSoft}
        alt=""
        className="absolute block max-w-none"
        style={{
          left: size * 0.08737,
          top: size * 0.05133,
          width: size * 0.84194,
          height: size * 0.80486,
        }}
      />
    </span>
  );
}

/*
 * Нижний лист: полоска-граббер тянется пальцем/мышью — вниз закрывает лист,
 * вверх раскрывает на максимум.
 */
export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragOffset(e.clientY - dragStart.current);
  };

  const onPointerUp = () => {
    if (dragStart.current === null) return;
    if (dragOffset > 90) {
      onClose();
    } else if (dragOffset < -60) {
      setExpanded(true);
    }
    dragStart.current = null;
    setDragOffset(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={onClose}>
      <div
        ref={sheetRef}
        className="w-full bg-white rounded-t-[24px] overflow-y-auto pb-[max(env(safe-area-inset-bottom),8px)]"
        style={{
          maxHeight: expanded ? "96dvh" : "92dvh",
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragStart.current === null ? "transform 0.2s ease-out, max-height 0.2s ease-out" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex justify-center pt-1.5 pb-3 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="w-12 h-1 rounded-full" style={{ backgroundColor: "rgba(3,7,18,0.12)" }} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({
  onClick,
  size = 26,
  backgroundColor = "var(--mappy-surface-secondary)",
}: {
  onClick: () => void;
  size?: number;
  backgroundColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ backgroundColor, width: size, height: size }}
      aria-label="Закрыть"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="#4A5565" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/* Большая CTA-кнопка с фирменным градиентом */
export function CtaButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cta-gradient w-full h-14 rounded-[14px] flex items-center justify-center gap-1 text-[16px] font-medium shrink-0"
    >
      {children}
    </button>
  );
}
