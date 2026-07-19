import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import deleteIcon from "../assets/icons/swipe-delete.svg";
import editIcon from "../assets/icons/swipe-edit.svg";
import shareIcon from "../assets/icons/swipe-share.svg";
import type { Place } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { RatingChip } from "./primitives";

const ACTION_WIDTH = 80;
const ACTIONS_WIDTH = ACTION_WIDTH * 3;
const SWIPE_THRESHOLD = ACTION_WIDTH;

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  horizontal: boolean;
  cancelled: boolean;
};

export function SwipeablePlaceCard({
  place,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onDelete,
  onEdit,
  onShare,
}: {
  place: Place;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
}) {
  const [offset, setOffset] = useState(isOpen ? -ACTIONS_WIDTH : 0);
  const [dragging, setDragging] = useState(false);
  const [showOpenShadow, setShowOpenShadow] = useState(isOpen);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const shadowDelay = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shadowDelay.current !== null) window.clearTimeout(shadowDelay.current);
    };
  }, []);

  useEffect(() => {
    if (dragging) return;
    if (!isOpen) {
      if (shadowDelay.current !== null) window.clearTimeout(shadowDelay.current);
      shadowDelay.current = null;
      setShowOpenShadow(false);
    }
    setOffset(isOpen ? -ACTIONS_WIDTH : 0);
  }, [dragging, isOpen]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (shadowDelay.current !== null) window.clearTimeout(shadowDelay.current);
    shadowDelay.current = null;
    setShowOpenShadow(false);
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: isOpen ? -ACTIONS_WIDTH : 0,
      horizontal: false,
      cancelled: false,
    };
    suppressClick.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || current.cancelled) return;

    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (!current.horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        current.cancelled = true;
        return;
      }
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      current.horizontal = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    suppressClick.current = true;
    setOffset(Math.max(-ACTIONS_WIDTH, Math.min(0, current.startOffset + dx)));
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;

    if (current.horizontal) {
      const shouldOpen = offset <= -SWIPE_THRESHOLD;
      const alreadyFullyOpen = offset <= -ACTIONS_WIDTH + 1;
      setShowOpenShadow(false);
      setOffset(shouldOpen ? -ACTIONS_WIDTH : 0);
      if (shouldOpen) onOpen();
      else onClose();

      if (shouldOpen && alreadyFullyOpen) {
        shadowDelay.current = window.setTimeout(() => {
          setShowOpenShadow(true);
          shadowDelay.current = null;
        }, 360);
      }
    }

    gesture.current = null;
    setDragging(false);
  };

  const runAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="relative h-[148px] w-full overflow-hidden rounded-[28px] bg-white [touch-action:pan-y]">
      <div className="absolute inset-y-0 right-0 flex w-[240px]">
        <SwipeAction
          right={0}
          zIndex={1}
          animationDelay={0}
          animate={isOpen && !dragging && !showOpenShadow}
          label="Поделиться"
          background="var(--mappy-surface-canvas)"
          icon={shareIcon}
          onClick={() => runAction(onShare)}
        />
        <SwipeAction
          right={ACTION_WIDTH}
          zIndex={2}
          animationDelay={70}
          animate={isOpen && !dragging && !showOpenShadow}
          label="Редактировать"
          background="var(--mappy-surface-primary)"
          icon={editIcon}
          shadow="8px 2px 30.4px #e9e9e9"
          onClick={() => runAction(onEdit)}
        />
        <SwipeAction
          right={ACTION_WIDTH * 2}
          zIndex={3}
          animationDelay={140}
          animate={isOpen && !dragging && !showOpenShadow}
          label="Удалить"
          background="#e7000b"
          icon={deleteIcon}
          shadow="8px 2px 30.4px #e9e9e9"
          onClick={() => runAction(onDelete)}
        />
      </div>

      <div
        className="absolute inset-0 z-10 rounded-[28px]"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging ? "none" : "transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          boxShadow: showOpenShadow ? "8px 2px 30.4px #d6030d" : "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onTransitionEnd={(event) => {
          if (
            event.propertyName === "transform" &&
            offset === -ACTIONS_WIDTH &&
            isOpen &&
            !dragging
          ) {
            if (shadowDelay.current !== null) window.clearTimeout(shadowDelay.current);
            shadowDelay.current = null;
            setShowOpenShadow(true);
          }
        }}
      >
        <button
          type="button"
          className="flex h-full w-full items-start gap-2 rounded-[28px] bg-white p-2 text-left"
          onClick={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              suppressClick.current = false;
              return;
            }
            if (isOpen) onClose();
            else onSelect();
          }}
          aria-label={`Открыть место ${place.title}`}
        >
          <div
            className="h-[132px] w-[46.9%] max-w-[196px] shrink-0 overflow-hidden rounded-[20px]"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            {place.photoUrls[0] && (
              <img src={place.photoUrls[0]} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="flex h-[132px] min-w-0 flex-1 flex-col items-start justify-between pt-1">
            <div className="flex min-w-0 flex-col gap-1 px-1">
              <p
                className="line-clamp-2 text-[16px] font-semibold leading-[18px]"
                style={{ color: "var(--mappy-text-primary)" }}
              >
                {place.title}
              </p>
              <p
                className="line-clamp-2 text-[12px] font-medium leading-[15px]"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                {place.address}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <span className="[&>span]:rounded-[10px]">
                <RatingChip rating={place.rating} />
              </span>
              {place.categories[0] && (
                <span
                  className="inline-flex h-[28px] items-center justify-center rounded-[10px] px-2"
                  style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
                >
                  <CategoryIcon category={place.categories[0]} size={24} />
                </span>
              )}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function SwipeAction({
  right,
  zIndex,
  animationDelay,
  animate,
  label,
  background,
  icon,
  shadow,
  onClick,
}: {
  right: number;
  zIndex: number;
  animationDelay: number;
  animate: boolean;
  label: string;
  background: string;
  icon: string;
  shadow?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="absolute inset-y-0 flex w-[144px] items-center justify-end rounded-r-[28px] px-8"
      style={{
        right,
        zIndex,
        backgroundColor: background,
        boxShadow: shadow,
        transformOrigin: "center",
        animation: animate
          ? `swipe-action-rubber 220ms cubic-bezier(0.34, 1.56, 0.64, 1) ${animationDelay}ms both`
          : "none",
      }}
      onClick={onClick}
      aria-label={label}
    >
      <img src={icon} alt="" className="h-6 w-6" />
    </button>
  );
}
