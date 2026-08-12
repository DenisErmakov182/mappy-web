import { useRef, useState } from "react";
import type { PhotoSlot } from "./AddPlaceSheet";
import { CloseButton, CtaButton, Sheet } from "./primitives";

/*
 * Перестановка загруженных фото местами (макет отсутствует — новая идея
 * владельца 12.08.2026: photos[0] используется как обложка места и в
 * PlaceRowCard, и в SwipeablePlaceCard, а поменять её раньше можно было
 * только удалением и перезаливкой фото в нужном порядке).
 *
 * Drag полноценный, как в iOS Фото: плавающая копия фото следует за пальцем
 * (position: fixed, координаты — впрямую из pointer-события), а сам массив
 * переставляется вживую, как только палец оказывается над другим слотом —
 * не ждём отпускания. Слот под перетаскиваемым фото просто гасится (opacity),
 * а не выезжает transform'ом относительно старой позиции: так не нужно
 * пересчитывать смещение при каждой перестановке индекса.
 *
 * Жест безопасен для родительского Sheet: после переноса граббера в свой
 * неподвижный блок (primitives.tsx) drag внутри контента больше не запускает
 * закрытие листа — это отдельный, не пересекающийся обработчик.
 */
export function ReorderPhotosSheet({
  photos: initialPhotos,
  onApply,
  onClose,
}: {
  photos: PhotoSlot[];
  onApply: (photos: PhotoSlot[]) => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [itemSize, setItemSize] = useState(88);

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    const rect = slotRefs.current[index]?.getBoundingClientRect();
    if (rect) setItemSize(rect.width);
    dragIndexRef.current = index;
    setDraggingIndex(index);
    setPointerPos({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndexRef.current === null) return;
    setPointerPos({ x: e.clientX, y: e.clientY });

    const targetIndex = slotRefs.current.findIndex((el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    });

    if (targetIndex !== -1 && targetIndex !== dragIndexRef.current) {
      const fromIndex = dragIndexRef.current;
      setPhotos((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      dragIndexRef.current = targetIndex;
      setDraggingIndex(targetIndex);
    }
  };

  const endDrag = () => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setPointerPos(null);
  };

  const draggedPhoto = draggingIndex !== null ? photos[draggingIndex] : null;

  return (
    <Sheet onClose={onClose} footer={<CtaButton onClick={() => onApply(photos)}>Готово</CtaButton>}>
      <div className="flex flex-col gap-6 px-5 pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-[20px] leading-6 font-medium tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-primary)" }}
            >
              Порядок фото
            </h3>
            <CloseButton onClick={onClose} />
          </div>
          <p className="text-[16px] leading-[18px] tracking-[-0.6px]" style={{ color: "var(--mappy-text-secondary)" }}>
            Перетащите фото, чтобы поменять местами — первое станет обложкой места.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <div
              key={photo.url}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative aspect-square touch-none select-none cursor-grab active:cursor-grabbing"
            >
              {draggingIndex === i ? (
                // Место, откуда фото временно "унесли" пальцем — тот же стиль
                // пустого слота, что и у "+" в основной сетке добавления фото.
                <div
                  className="h-full w-full rounded-[20px]"
                  style={{
                    border: "1px dashed rgba(3, 7, 18, 0.08)",
                    backgroundColor: "var(--mappy-surface-primary)",
                  }}
                />
              ) : (
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  className="h-full w-full rounded-[20px] object-cover"
                />
              )}
              {i === 0 && draggingIndex !== i && (
                <span
                  className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
                >
                  Обложка
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {draggedPhoto && pointerPos && (
        <img
          src={draggedPhoto.url}
          alt=""
          draggable={false}
          className="pointer-events-none fixed z-[70] rounded-[20px] object-cover shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
          style={{
            width: itemSize,
            height: itemSize,
            left: pointerPos.x - itemSize / 2,
            top: pointerPos.y - itemSize / 2,
          }}
        />
      )}
    </Sheet>
  );
}
