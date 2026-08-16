import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import deleteIcon from "../assets/icons/swipe-delete.svg";
import editIcon from "../assets/icons/swipe-edit.svg";
import shareIcon from "../assets/icons/swipe-share.svg";
import type { Place } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { FriendAvatarOnPhoto } from "./FriendAvatar";
import { RatingChip } from "./primitives";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

const ACTION_WIDTH = 80;
const ACTIONS_WIDTH = ACTION_WIDTH * 3;
const SWIPE_THRESHOLD = ACTION_WIDTH;

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
  deleteLabel = "Удалить",
  deleteIcon: deleteIconOverride,
  deleteBackground,
}: {
  place: Place;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onShare: () => void;
  /** Подпись последнего действия свайпа — «Удалить» по умолчанию. Экран внутри
      папки переопределяет на «Убрать»: место остаётся в «Сохранённом», меняется
      только принадлежность к папке, поэтому «Удалить» было бы неточным. */
  deleteLabel?: string;
  deleteIcon?: string;
  deleteBackground?: string;
}) {
  const [offset, setOffset] = useState(isOpen ? -ACTIONS_WIDTH : 0);
  const [dragging, setDragging] = useState(false);
  const [showOpenShadow, setShowOpenShadow] = useState(isOpen);
  const isFriendPlace = Boolean(place.owner);
  const createdAt = formatPlaceDate(place.createdAt);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (dragging) return;
    if (isFriendPlace) {
      setShowOpenShadow(false);
      setOffset(0);
      return;
    }
    if (!isOpen) setShowOpenShadow(false);
    setOffset(isOpen ? -ACTIONS_WIDTH : 0);
  }, [dragging, isFriendPlace, isOpen]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isFriendPlace) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
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
      setShowOpenShadow(shouldOpen && alreadyFullyOpen);
      setOffset(shouldOpen ? -ACTIONS_WIDTH : 0);
      if (shouldOpen) onOpen();
      else onClose();
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
      {!isFriendPlace && (
        <div className="absolute inset-y-0 right-0 flex w-[240px]">
          <SwipeAction
            right={0}
            zIndex={1}
            label="Поделиться"
            background="var(--mappy-surface-canvas)"
            icon={shareIcon}
            onClick={() => runAction(onShare)}
          />
          <SwipeAction
            right={ACTION_WIDTH}
            zIndex={2}
            label="Редактировать"
            background="var(--mappy-surface-primary)"
            icon={editIcon}
            shadow="8px 2px 30.4px #e9e9e9"
            onClick={() => runAction(onEdit)}
          />
          <SwipeAction
            right={ACTION_WIDTH * 2}
            zIndex={3}
            label={deleteLabel}
            background={deleteBackground ?? "#e7000b"}
            icon={deleteIconOverride ?? deleteIcon}
            shadow="8px 2px 30.4px #e9e9e9"
            onClick={() => runAction(onDelete)}
          />
        </div>
      )}

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
            className="relative h-[132px] min-w-0 flex-1 overflow-hidden rounded-[20px]"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            {place.photos?.[0] ? (
              <img src={place.photos[0].url} alt="" className="h-full w-full object-cover" />
            ) : (
              <PhotoPlaceholder compact />
            )}
            {place.owner && (
              <FriendAvatarOnPhoto person={place.owner} />
            )}
          </div>

          <div className="flex h-[132px] min-w-0 flex-1 flex-col items-start justify-between overflow-hidden pt-1">
            <div className="flex w-full min-w-0 flex-col gap-1 overflow-hidden">
              <div className="w-full min-w-0 overflow-hidden pl-1">
                <p
                  className="block max-h-[36px] w-[160px] max-w-full overflow-hidden text-ellipsis text-[16px] font-semibold leading-[18px] tracking-[-0.6px] [overflow-wrap:anywhere] [word-break:break-word]"
                  style={{
                    color: "var(--mappy-text-primary)",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                  }}
                >
                  {place.title}
                </p>
              </div>
              <p
                className="w-full min-w-0 truncate px-1 text-[12px] font-medium leading-[16px]"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                {place.address}
              </p>
              {createdAt && (
                <p className="w-full min-w-0 truncate px-1 text-[12px] font-medium leading-[16px]" style={{ color: "#99a1af" }}>
                  {createdAt}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {place.rating > 0 && (
                <span className="[&>span]:rounded-[10px]">
                  <RatingChip rating={place.rating} />
                </span>
              )}
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
  label,
  background,
  icon,
  shadow,
  onClick,
}: {
  right: number;
  zIndex: number;
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
      }}
      onClick={onClick}
      aria-label={label}
    >
      <img src={icon} alt="" className="h-6 w-6" />
    </button>
  );
}
