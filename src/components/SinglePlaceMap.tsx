import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloseButton } from "./primitives";
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
}: {
  place: PinPlace & { latitude: number; longitude: number };
  onClose: () => void;
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
      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+11px)] z-10">
        <CloseButton onClick={onClose} size={36} backgroundColor="#fff" />
      </div>
    </div>
  );
}
