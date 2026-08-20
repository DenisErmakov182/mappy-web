import { useEffect, useRef, useState } from "react";
import type { Photo } from "../types";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/*
 * Заглавные фото места как карусель отдельных карточек. Каждый снимок — свой
 * блок со скруглением и тенью на всю ширину; листаются свайпом по одному,
 * соседняя карточка полностью за краем. Нативный scroll-snap, как у карусели
 * мест на карте (см. PlaceCardCarousel).
 *
 * Под фото — сегментная полоса (как в сторис): по сегменту на снимок, активный
 * подсвечен. Полоса появляется только когда фото два и больше — при одном
 * листать нечего, а при нуле карточка-заглушка и так одна.
 * Макет: Figma Place Detail, node 1868:38725 / ProgressBarContainer 1868:38717.
 */

const SEGMENT_ACTIVE = "var(--mappy-brand-secondary)";
const CARD = "aspect-square w-full shrink-0 snap-center snap-always overflow-hidden rounded-[length:var(--mappy-radius-xl)] shadow-[var(--mappy-shadow-card)]";

export function PhotoSwiper({ photos }: { photos: Photo[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || photos.length < 2) return;

    const update = () => {
      const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-photo-card]"));
      const center = container.getBoundingClientRect().left + container.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      setActive(best);
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    return () => container.removeEventListener("scroll", update);
  }, [photos.length]);

  // Полоса нужна только при нескольких фото: одно — листать нечего.
  const showSegments = photos.length >= 2;

  return (
    <div className="flex w-full shrink-0 flex-col items-center gap-4">
      {photos.length === 0 ? (
        <div className={CARD} style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
          <PhotoPlaceholder />
        </div>
      ) : (
        // Скролл-контейнер вырывается во всю ширину экрана (родитель — px-4) и
        // задаёт отступы сам: 16px по бокам — инсет карточки, вертикальные —
        // место под мягкую тень (blur ~30px), которую overflow-x иначе режет
        // сверху и снизу. Отрицательные -my-8 возвращают раскладку, чтобы этот
        // вертикальный запас не добавлял пустоты вокруг свайпера.
        // Карточка = ширина контента контейнера, поэтому ровно с инсетом 16px.
        <div
          ref={scrollRef}
          className="-mx-4 -my-8 flex w-screen max-w-[calc(100%+32px)] snap-x snap-mandatory gap-8 overflow-x-auto scroll-smooth px-4 py-8 [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, index) => (
            <div key={`${photo.url}-${index}`} data-photo-card className={`${CARD} relative`}>
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              {photo.caption && (
                <div
                  className="absolute inset-x-4 bottom-4 rounded-[16px] px-4 py-3 text-[14px] leading-5"
                  style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "var(--mappy-text-primary)" }}
                >
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSegments && (
        <div className="flex w-[89%] items-center gap-1">
          {photos.map((_, index) => (
            <span
              key={index}
              className="h-2 min-w-px flex-1 rounded-full"
              style={{
                backgroundColor: index === active ? SEGMENT_ACTIVE : "var(--mappy-surface-secondary)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
