import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloseButton, RouteIcon } from "./primitives";
import { MapAddressChip } from "./MapAddressChip";
import { buildPinElement, type PinPlace } from "./placePin";
import { formatDistance, formatDurationSeconds, getLastKnownLocation, rememberLocation } from "../lib/geo";
import { fetchWalkingRoute } from "../lib/api";

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
const ROUTE_SOURCE_ID = "walking-route";

/*
 * Пилюля «Назад ›», нода 2190:10428: в макете серый фон, текст 14px medium,
 * шеврон вправо. Перекрашена в белый сознательно — на одном экране с кнопкой
 * «Маршрут» (своего узла в Figma не имеет) серый рядом с белым выглядел
 * разнобоем сильнее, чем отход от макета в цвете фона.
 */
function BackPillButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-[10px] p-2"
      style={{ backgroundColor: "#fff" }}
    >
      <span
        className="text-[14px] font-medium leading-[18px] tracking-[-0.6px]"
        style={{ color: "var(--mappy-text-primary)" }}
      >
        Назад
      </span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="#1e2939" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* Общий стиль белой пилюли-кнопки внизу карты — «Маршрут» и её же состояния загрузки/ошибки. */
function RoutePill({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-white text-[16px] font-medium disabled:opacity-70"
      style={{ color: "var(--mappy-text-primary)" }}
    >
      {children}
    </button>
  );
}

type RouteState =
  | { status: "idle" }
  | { status: "locating" | "loading" }
  | { status: "ready"; distanceMeters: number | null; durationSeconds: number | null }
  | { status: "error" };

export function SinglePlaceMap({
  place,
  onClose,
  footer,
  closeVariant = "cross",
  navigateUrl,
  interactiveRoute = false,
}: {
  place: PinPlace & { latitude: number; longitude: number; address: string };
  onClose: () => void;
  /** Та же кнопка сохранения, что и на странице места: карта — не тупик, с неё
   *  тоже можно завести аккаунт и забрать место себе. */
  footer?: ReactNode;
  /**
   * "cross" — прежний крестик слева, как на публичной странице шеринга.
   * "back" — пилюля «Назад ›» справа сверху, нода `2190:10428`, для карты
   * из карточки собственного или чужого места в приложении (`2190:8705`).
   * Владельцу здесь нечего сохранять, поэтому у второго варианта своя
   * семантика — не «закрыть шит», а «вернуться» — хотя оба варианта просто
   * вызывают `onClose`.
   */
  closeVariant?: "cross" | "back";
  /**
   * Ссылка «Маршрут» во внешней карте. При `interactiveRoute` — это резервный
   * вариант на случай ошибки (ORS недоступен/не настроен), а не основная
   * кнопка. Без `interactiveRoute` — единственный способ проложить путь,
   * так и остаётся на публичной странице шеринга: там нет входа, а бесплатный
   * дневной лимит OpenRouteService общий на всё приложение — открывать этот
   * запрос кому угодно без авторизации не стали (см. mappy-api/routes/route.ts).
   */
  navigateUrl?: string;
  /**
   * Рисовать пеший маршрут прямо на этой карте (линией по дорогам, не по
   * прямой) вместо ухода во внешнее приложение. Только для авторизованного
   * контекста — см. комментарий у navigateUrl.
   */
  interactiveRoute?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });

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
    mapInstanceRef.current = map;

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
      mapInstanceRef.current = null;
    };
  }, []);

  // Рисует/обновляет линию маршрута и подгоняет вид карты под неё целиком.
  // Источник и слой живут только пока открыта эта карта — пересоздавать
  // не нужно, `setData` на повторный клик обновит уже добавленный источник.
  function drawRoute(geometry: { type: "LineString"; coordinates: [number, number][] }) {
    const map = mapInstanceRef.current;
    if (!map) return;

    const apply = () => {
      const data: GeoJSON.Feature = { type: "Feature", properties: {}, geometry };
      const existingSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(data);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: ROUTE_SOURCE_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ff2056", "line-width": 4 },
        });
      }

      const bounds = geometry.coordinates.reduce(
        (b, coordinate) => b.extend(coordinate as [number, number]),
        new maplibregl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 64, maxZoom: 17, duration: 600 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }

  async function handleBuildRoute() {
    setRouteState({ status: "locating" });

    // Та же последняя известная позиция, что и на карточке места — если её
    // ещё нет (разрешение на геолокацию не давали или это первый запуск),
    // спрашиваем свежую прямо здесь: человек уже явно попросил маршрут,
    // самое уместное место спросить геолокацию, если раньше не спрашивали.
    let origin = getLastKnownLocation();
    if (!origin) {
      origin = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000 },
        );
      });
      if (origin) rememberLocation(origin.lat, origin.lng);
    }
    if (!origin) {
      setRouteState({ status: "error" });
      return;
    }

    setRouteState({ status: "loading" });
    try {
      const route = await fetchWalkingRoute(origin, { lat: place.latitude, lng: place.longitude });
      drawRoute(route.geometry);
      setRouteState({ status: "ready", distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
    } catch {
      setRouteState({ status: "error" });
    }
  }

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
        {closeVariant === "back" ? (
          <div className="pointer-events-auto flex w-full justify-end">
            <BackPillButton onClick={onClose} />
          </div>
        ) : (
          <div className="pointer-events-auto flex w-full justify-start">
            <CloseButton onClick={onClose} size={36} backgroundColor="#fff" />
          </div>
        )}
        <MapAddressChip address={place.address} />
      </div>

      {(interactiveRoute || navigateUrl || footer) && (
        <>
          <div className="blur-edge-bottom" />
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {interactiveRoute ? (
              <>
                {routeState.status === "idle" && (
                  <RoutePill onClick={() => void handleBuildRoute()}>
                    <RouteIcon className="h-5 w-5 shrink-0" />
                    Маршрут
                  </RoutePill>
                )}
                {(routeState.status === "locating" || routeState.status === "loading") && (
                  <RoutePill disabled>
                    <RouteIcon className="h-5 w-5 shrink-0 animate-pulse" />
                    {routeState.status === "locating" ? "Определяем позицию…" : "Строим маршрут…"}
                  </RoutePill>
                )}
                {routeState.status === "ready" && (
                  <RoutePill onClick={() => void handleBuildRoute()}>
                    <RouteIcon className="h-5 w-5 shrink-0" />
                    {routeState.durationSeconds != null && formatDurationSeconds(routeState.durationSeconds)}
                    {routeState.durationSeconds != null && routeState.distanceMeters != null && " · "}
                    {routeState.distanceMeters != null && formatDistance(routeState.distanceMeters)}
                  </RoutePill>
                )}
                {routeState.status === "error" &&
                  (navigateUrl ? (
                    <a
                      href={navigateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-14 w-full shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-white text-[16px] font-medium"
                      style={{ color: "var(--mappy-text-primary)" }}
                    >
                      <RouteIcon className="h-5 w-5 shrink-0" />
                      Не вышло — открыть во внешней карте
                    </a>
                  ) : (
                    <RoutePill onClick={() => void handleBuildRoute()}>
                      <RouteIcon className="h-5 w-5 shrink-0" />
                      Не вышло — попробовать снова
                    </RoutePill>
                  ))}
              </>
            ) : (
              navigateUrl && (
                <a
                  href={navigateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-14 w-full shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-white text-[16px] font-medium"
                  style={{ color: "var(--mappy-text-primary)" }}
                >
                  <RouteIcon className="h-5 w-5 shrink-0" />
                  Маршрут
                </a>
              )
            )}
            {footer}
          </div>
        </>
      )}
    </div>
  );
}
