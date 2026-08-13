import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloseButton, RouteIcon } from "./primitives";
import { MapAddressChip } from "./MapAddressChip";
import { buildPinElement, type PinPlace } from "./placePin";
import {
  MAX_WALKING_DISTANCE_METERS,
  distanceMeters,
  formatDurationSeconds,
  getLastKnownLocation,
  rememberLocation,
} from "../lib/geo";
import { fetchWalkingRoute, reverseGeocode } from "../lib/api";
import { Button } from "./design-system/01-atoms/controls/Button";
import originPinShape from "../assets/icons/origin-pin.svg";
import originPersonIllustration from "../assets/icons/origin-person.png";

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

// Масштабировано от исходных пропорций узла Figma `Person Icon` (2230:30664,
// пин-капля 64×79 с иллюстрацией человека 48×48 на left:8/top:9) вниз до
// ширины основного пина места (mainPin — тоже 40×49) — это не совпадение
// размеров случайно, а осознанный выбор: маркер «Вы здесь» не должен
// перетягивать внимание с самого места.
const ORIGIN_MARKER_WIDTH = 40;
const ORIGIN_MARKER_SCALE = ORIGIN_MARKER_WIDTH / 64;
const ORIGIN_MARKER_HEIGHT = Math.round(79 * ORIGIN_MARKER_SCALE);
const ORIGIN_PERSON_SIZE = Math.round(48 * ORIGIN_MARKER_SCALE);
const ORIGIN_PERSON_LEFT = Math.round(8 * ORIGIN_MARKER_SCALE);
const ORIGIN_PERSON_TOP = Math.round(9 * ORIGIN_MARKER_SCALE);

/*
 * Маркер точки «Вы здесь», откуда строится маршрут — узел Figma
 * `Person Icon` (2230:30664). Появляется только вместе с уже построенным
 * маршрутом (drawRoute/placeOriginMarker вызываются вместе в
 * handleBuildRoute) — просто открыв карту без запроса маршрута, свою
 * позицию не показываем.
 */
function buildOriginMarkerElement(): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = `position:relative;width:${ORIGIN_MARKER_WIDTH}px;height:${ORIGIN_MARKER_HEIGHT}px;`;

  const pin = document.createElement("img");
  pin.src = originPinShape;
  pin.alt = "";
  pin.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;";
  root.appendChild(pin);

  const person = document.createElement("img");
  person.src = originPersonIllustration;
  person.alt = "";
  person.style.cssText = `position:absolute;left:${ORIGIN_PERSON_LEFT}px;top:${ORIGIN_PERSON_TOP}px;width:${ORIGIN_PERSON_SIZE}px;height:${ORIGIN_PERSON_SIZE}px;object-fit:contain;`;
  root.appendChild(person);

  return root;
}

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

type RouteState =
  | { status: "idle" }
  | { status: "locating" | "loading" }
  | { status: "ready"; distanceMeters: number | null; durationSeconds: number | null; originAddress: string | null }
  | { status: "error" }
  | { status: "tooFar" };

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
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
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
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Ставит/двигает маркер «Вы здесь» — переиспользует уже добавленный
  // маркер на повторный запрос маршрута (setLngLat), а не пересоздаёт его.
  function placeOriginMarker(origin: { lat: number; lng: number }) {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (originMarkerRef.current) {
      originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    } else {
      originMarkerRef.current = new maplibregl.Marker({ element: buildOriginMarkerElement(), anchor: "bottom" })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    }
  }

  // Рисует/обновляет линию маршрута и подгоняет вид карты под неё целиком.
  // Источник и слой живут только пока открыта эта карта — пересоздавать
  // не нужно, `setData` на повторный клик обновит уже добавленный источник.
  function drawRoute(geometry: { type: "LineString"; coordinates: [number, number][] }) {
    const map = mapInstanceRef.current;
    if (!map) return;

    const apply = () => {
      // Не аннотируем явно GeoJSON.Feature: этот тип приходит из глобального
      // неймспейса @types/geojson (транзитивная зависимость maplibre-gl), а
      // tsconfig.app.json держит "types" явным списком без него — сборка на
      // Timeweb (tsc -b, не tsc --noEmit -p .) на такой аннотации падает с
      // TS2503, хотя maplibre-gl использует тот же тип у себя без проблем
      // (skipLibCheck прощает объявления библиотек, но не наш собственный код).
      // Структурно совместимый литерал без аннотации работает одинаково и там,
      // и там.
      const data = { type: "Feature" as const, properties: {}, geometry };
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
          paint: { "line-color": "#ff2056", "line-width": 8 },
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

    // Дальше 100км — не пешая прогулка, а другой город; не тратим на это
    // дневной лимит ORS вообще (см. MAX_WALKING_DISTANCE_METERS).
    const beelineDistance = distanceMeters(
      { latitude: origin.lat, longitude: origin.lng },
      { latitude: place.latitude, longitude: place.longitude },
    );
    if (beelineDistance > MAX_WALKING_DISTANCE_METERS) {
      setRouteState({ status: "tooFar" });
      return;
    }

    setRouteState({ status: "loading" });
    try {
      // Адрес точки «Вы здесь» (2228:27643) — параллельно с самим маршрутом,
      // не последовательно: обе просьбы независимы, ждать вторую после первой
      // означало бы удвоить время до появления карточки без необходимости.
      // Обратный геокодинг не критичен для самого маршрута — если он не
      // ответил, показываем маршрут всё равно, просто без подписи «Вы здесь».
      const [route, originAddress] = await Promise.all([
        fetchWalkingRoute(origin, { lat: place.latitude, lng: place.longitude }),
        reverseGeocode(origin.lat, origin.lng).catch(() => null),
      ]);
      drawRoute(route.geometry);
      placeOriginMarker(origin);
      setRouteState({
        status: "ready",
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        originAddress,
      });
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

      {interactiveRoute ? (
        // Белая карточка с закруглённым верхом — «Submit Button Container»,
        // 2190:8705 (состояние до маршрута) / 2228:27643 (после). Не
        // полупрозрачная плашка с blur-edge-bottom, как в остальных местах
        // этого экрана — здесь по макету именно сплошной белый фон.
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-[length:var(--mappy-spacing-lg)] rounded-t-[length:var(--mappy-radius-lg)] bg-white px-[length:var(--mappy-spacing-md)] pb-[calc(var(--mappy-spacing-xl)+env(safe-area-inset-bottom))] pt-[length:var(--mappy-spacing-md)]">
          {routeState.status === "idle" && (
            <Button tone="cta" onClick={() => void handleBuildRoute()}>
              Маршрут
            </Button>
          )}
          {(routeState.status === "locating" || routeState.status === "loading") && (
            <Button tone="cta" disabled>
              {routeState.status === "locating" ? "Определяем позицию…" : "Строим маршрут…"}
            </Button>
          )}
          {routeState.status === "ready" && (
            <>
              {/* Строка «Вы здесь / N мин / Назначение», 2228:27706 — адрес точки
                  «Вы здесь» получен обратным геокодингом координат старта,
                  может быть null (гео ответило, а геокодер — нет); в этом
                  случае подпись просто не показываем, маршрут всё равно на карте. */}
              <div className="flex w-full items-center justify-between gap-2 px-[length:var(--mappy-spacing-2xs)]">
                <div className="flex min-w-0 flex-1 flex-col gap-[length:var(--mappy-spacing-2xs)] tracking-densed">
                  <p className="text-body-2 text-text-tertiary">Вы здесь</p>
                  <p className="truncate text-body font-medium text-text-secondary">
                    {routeState.originAddress ?? "Текущее место"}
                  </p>
                </div>
                {routeState.durationSeconds != null && (
                  <div className="flex h-[28px] shrink-0 items-center justify-center gap-[length:var(--mappy-spacing-2xs)] rounded-[length:var(--mappy-radius-sm)] bg-surface-secondary px-[length:var(--mappy-spacing-xs)]">
                    <p className="text-body-2 font-medium tracking-densed text-text-secondary">
                      {formatDurationSeconds(routeState.durationSeconds)}
                    </p>
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col items-end gap-[length:var(--mappy-spacing-2xs)] tracking-densed">
                  <p className="text-body-2 text-text-tertiary">Назначение</p>
                  <p className="truncate text-body font-medium text-text-secondary">{place.address}</p>
                </div>
              </div>
              {/* Вторая «Маршрут» (2228:27659 в макете) — здесь сознательно НЕ
                  внешняя ссылка, только внутренние решения: пересчитывает путь
                  от текущей позиции ещё раз (та же handleBuildRoute, что и на
                  первом нажатии). Пригодится, если человек уже идёт и успел
                  сместиться — старое время/расстояние иначе так и останутся
                  висеть на карточке. Тон brandSecondary (бледно-розовый),
                  не cta — по макету вторая кнопка ниже по значимости первой. */}
              <Button tone="brandSecondary" onClick={() => void handleBuildRoute()}>
                Обновить маршрут
              </Button>
            </>
          )}
          {routeState.status === "error" && (
            <Button tone="secondary" onClick={() => void handleBuildRoute()}>
              Не вышло — попробовать снова
            </Button>
          )}
          {routeState.status === "tooFar" && (
            <p className="w-full py-[length:var(--mappy-spacing-sm)] text-center text-body-2 tracking-densed text-text-tertiary">
              Место дальше 100 км — это не пешая прогулка
            </p>
          )}
        </div>
      ) : (
        (navigateUrl || footer) && (
          <>
            <div className="blur-edge-bottom" />
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              {navigateUrl && (
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
              )}
              {footer}
            </div>
          </>
        )
      )}
    </div>
  );
}
