import { useEffect, useRef, useState } from "react";

/*
 * Заглавные фото места как карусель отдельных карточек. Каждый снимок — свой
 * блок со скруглением и тенью на всю ширину; листаются свайпом по одному,
 * соседняя карточка полностью за краем. Нативный scroll-snap, как у карусели
 * мест на карте (см. PlaceCardCarousel).
 *
 * Под фото — сегментная полоса (как в сторис): по сегменту на снимок, активный
 * подсвечен. Нет фото — один пустой сегмент и карточка-заглушка.
 * Макет: Figma Place Detail, node 1868:38725 / ProgressBarContainer 1868:38717.
 */

const SEGMENT_ACTIVE = "#ff637e";
const CARD = "aspect-square w-full shrink-0 snap-center snap-always overflow-hidden rounded-[28px] shadow-[8px_2px_30.4px_#e9e9e9]";

export function PhotoSwiper({ photoUrls }: { photoUrls: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || photoUrls.length < 2) return;

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
  }, [photoUrls.length]);

  // Карточка-заглушка и один серый сегмент, если фото ещё нет.
  const segmentCount = Math.max(photoUrls.length, 1);

  return (
    <div className="flex w-full shrink-0 flex-col items-center gap-4">
      {photoUrls.length === 0 ? (
        <div className={CARD} style={{ backgroundColor: "var(--mappy-surface-secondary)" }} />
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
          {photoUrls.map((url, index) => (
            <div key={`${url}-${index}`} data-photo-card className={CARD}>
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

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
