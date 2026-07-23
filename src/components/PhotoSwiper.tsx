import { useEffect, useRef, useState } from "react";

/*
 * Заглавное фото места, листаемое как карусель по всем снимкам. Раньше в шапке
 * показывалось только первое фото, а остальные жили маленькими миниатюрами.
 * Теперь каждый снимок раскрывается в том же крупном формате и пролистывается
 * свайпом — тем же нативным scroll-snap, что и карусель мест на карте
 * (см. PlaceCardCarousel).
 *
 * Под фото — сегментная полоса (как в сторис): по сегменту на снимок, активный
 * подсвечен. Нет фото — один пустой сегмент и место под заглушку.
 * Макет: Figma Place Detail, node 1868:38725 / ProgressBarContainer 1868:38717.
 */

const SEGMENT_ACTIVE = "#ff637e";

export function PhotoSwiper({ photoUrls }: { photoUrls: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || photoUrls.length < 2) return;

    const update = () => {
      const width = container.clientWidth;
      if (width === 0) return;
      const index = Math.round(container.scrollLeft / width);
      setActive(Math.max(0, Math.min(photoUrls.length - 1, index)));
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    return () => container.removeEventListener("scroll", update);
  }, [photoUrls.length]);

  // Пустой блок под заглушку и один серый сегмент, если фото ещё нет.
  const segmentCount = Math.max(photoUrls.length, 1);

  return (
    <div className="flex w-full shrink-0 flex-col items-center gap-4">
      <div
        ref={scrollRef}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[28px] shadow-[8px_2px_30.4px_#e9e9e9] [&::-webkit-scrollbar]:hidden"
        style={{ backgroundColor: photoUrls[0] ? "#fff" : "var(--mappy-surface-secondary)" }}
      >
        {photoUrls.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={url}
            alt=""
            className="h-full w-full shrink-0 snap-center snap-always object-cover"
          />
        ))}
      </div>

      <div className="flex w-[89%] items-center gap-1">
        {Array.from({ length: segmentCount }, (_, index) => (
          <span
            key={index}
            className="h-2 min-w-px flex-1 rounded-full"
            style={{
              backgroundColor: index === active && photoUrls.length > 0 ? SEGMENT_ACTIVE : "var(--mappy-surface-secondary)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
