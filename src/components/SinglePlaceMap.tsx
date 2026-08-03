import { useEffect, useRef, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloseButton } from "./primitives";
import { MapAddressChip } from "./MapAddressChip";
import { buildPinElement, type PinPlace } from "./placePin";

/*
 * Лёгкий вид карты с одним пином — то, что открывается по кнопке «Посмотреть на
 * карте» на публичной странице места. Это не MapView: здесь нет поиска, фильтров,
 * кластеров, центрального пина и кнопки добавления места, потому что показывать
 * их человеку без аккаунта незачем. Общее с приложением — только сам пин
 * (`placePin.ts`) и тайлы OpenFreeMap.
 *
 * Экрана в Figma для этого вида нет: по п.13 бэклога он собирается по аналогии
 * с существующей картой, а не рисуется заново.
 */

const SINGLE_PLACE_ZOOM = 15;

export function SinglePlaceMap({
  place,
  onClose,
  footer,
}: {
  place: PinPlace & { latitude: number; longitude: number; address: string };
  onClose: () => void;
  /** Та же кнопка сохранения, что и на странице места: карта — не тупик, с неё
   *  тоже можно завести аккаунт и забрать место себе. */
  footer?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef(place);
  placeRef.current = place;

  useEffect(() => {
    if (!containerRef.current) return;

    const { latitude, longitude } = placeRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [longitude, latitude],
      zoom: SINGLE_PLACE_ZOOM,
      attributionControl: false,
    });

    // Как и в MapView: корневой элемент маркера нулевого размера стоит ровно в
    // географической точке, а графика пина размещена вокруг неё так, что остриё
    // совпадает с координатой. Клика нет — открывать по пину нечего, место уже
    // показано на странице целиком.
    const marker = new maplibregl.Marker({ element: buildPinElement(placeRef.current), anchor: "center" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      marker.remove();
      map.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div ref={containerRef} className="h-full w-full" />

      {/*
        Адрес плашкой сверху, а не пузырьком над пином — по той же причине, что
        и на основной карте (макет 1893:39146): плотная застройка перекрывает
        пузырёк соседними подписями. Плашка идёт под строкой с крестиком:
        по центру на одной высоте с ним она бы наехала на крестик при длинном
        адресе на узком экране.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+11px)]">
        <div className="pointer-events-auto flex w-full justify-start">
          <CloseButton onClick={onClose} size={36} backgroundColor="#fff" />
        </div>
        <MapAddressChip address={place.address} />
      </div>

      {footer && (
        <>
          <div className="blur-edge-bottom" />
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {footer}
          </div>
        </>
      )}
    </div>
  );
}
