import { useEffect, useRef } from "react";
import type { Place } from "../types";
import { PlaceRowCard } from "./PlaceRowCard";

/*
 * Карточка(и) выбранного места над таббаром. При одном месте — обычная карточка
 * на всю ширину. При нескольких местах в одной точке — горизонтальная карусель:
 * активная карточка в фокусе, следующая выглядывает справа чуть меньше своего
 * размера; при свайпе уходящая карточка сжимается и блюрится по мере ухода от
 * центра. Зона скролла растянута до реальных краёв экрана (не контейнера с
 * отступами), чтобы соседняя карточка выглядывала у самого края.
 */
export function PlaceCardCarousel({
  places,
  onSelect,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || places.length < 2) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-carousel-card]"));

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);
        const progress = Math.min(distance / containerRect.width, 1);
        const scale = 1 - progress * 0.1;
        card.style.transform = `scale(${scale})`;
        card.style.filter = progress > 0.03 ? `blur(${(progress * 5).toFixed(1)}px)` : "";
      }
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      container.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [places.length]);

  if (places.length === 1) {
    return (
      <div className="px-4">
        <PlaceRowCard place={places[0]} onClick={() => onSelect(places[0])} />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
    >
      <div
        className="flex"
        style={{
          width: "max-content",
          // Карточка шириной 85vw получает по 7.5vw с краёв трека, поэтому
          // первая и последняя карточки тоже могут защёлкнуться ровно по центру.
          paddingInline: "7.5vw",
        }}
      >
        {places.map((place, index) => (
          <div
            key={place.id}
            data-carousel-card
            className="shrink-0 snap-center snap-always [transition:filter_75ms_linear] [transform-origin:center]"
            style={{
              width: "85vw",
              // Раньше между карточками было 12px. Сдвигаем каждую следующую
              // на 16px ближе: итоговое перекрытие составляет 4px.
              marginLeft: index === 0 ? 0 : -4,
            }}
          >
            <PlaceRowCard place={place} onClick={() => onSelect(place)} />
          </div>
        ))}
      </div>
    </div>
  );
}
