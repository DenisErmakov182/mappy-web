import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloseButton, RouteIcon } from "./primitives";
import { MapAddressChip } from "./MapAddressChip";
import { buildPinElement, type PinPlace } from "./placePin";
import { MAX_WALKING_DISTANCE_METERS, distanceMeters, getLastKnownLocation, rememberLocation } from "../lib/geo";
import { fetchWalkingRoute, reverseGeocode } from "../lib/api";
import { Button } from "./design-system/01-atoms/controls/Button";
import { IconButton } from "./design-system/01-atoms/controls/IconButton";
import { Icon } from "./design-system/00-foundations/Icon";
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
const ROUTE_HALO_LAYER_ID = "walking-route-halo";
const ROUTE_LINE_LAYER_ID = "walking-route-line";

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
  | {
      status: "ready";
      distanceMeters: number | null;
      durationSeconds: number | null;
      originAddress: string | null;
      /** Момент, когда маршрут построен — время выхода в паре «HH:MM–HH:MM» это оно, а не отдельный запрос. */
      departedAt: number;
    }
  | { status: "error" }
  | { status: "tooFar" };

/** «14:35» — часы:минуты локального времени, для пары «время выхода–прибытия». */
function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Значение и единица расстояния раздельно — та же логика округления, что и в
 * formatDistance (lib/geo.ts), но не единой строкой: в группе цифр 2235:31211
 * число и подпись на разных строках разным размером шрифта, склеенную строку
 * не разбить обратно чисто.
 */
function splitDistance(meters: number): { value: string; unit: string } {
  if (meters < 1000) return { value: String(Math.round(meters / 10) * 10), unit: "м" };
  return { value: (meters / 1000).toFixed(1).replace(".", ","), unit: "км" };
}

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

  // «✕» на сводке маршрута (2235:31216) — не закрывает карту (это уже делает
  // «Назад» сверху), а возвращает именно к состоянию «до маршрута»: убирает
  // линию, маркер «Вы здесь» и саму сводку, оставляя только пин места — как
  // на идле-макете 2190:8705.
  function clearRoute() {
    const map = mapInstanceRef.current;
    if (map) {
      // Оба слоя убрать раньше источника — MapLibre не даёт удалить источник,
      // пока на него ссылается хоть один слой.
      if (map.getLayer(ROUTE_LINE_LAYER_ID)) map.removeLayer(ROUTE_LINE_LAYER_ID);
      if (map.getLayer(ROUTE_HALO_LAYER_ID)) map.removeLayer(ROUTE_HALO_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    }
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    setRouteState({ status: "idle" });
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
        // Два слоя на одном источнике — узел Figma 2239:9121: сплошная белая
        // подложка шире (16px) под пунктирным розовым штрихом (8px, dash 16/
        // gap 16 — те же числа, что в исходном SVG, `line-dasharray` в
        // MapLibre задаётся в множителях line-width, 16/8 = 2, отсюда [2, 2]).
        // Слой-подложка добавлен первым — рисуется снизу, поверх него штрих.
        map.addLayer({
          id: ROUTE_HALO_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 16 },
        });
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ff2056", "line-width": 8, "line-dasharray": [2, 2] },
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
        departedAt: Date.now(),
      });
    } catch {
      setRouteState({ status: "error" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div ref={containerRef} className="h-full w-full" />

      {/* Привычный градиентный блюр сверху (как на основной карте) — под пином и
          застройкой карты плашка «Назад»/адрес иначе читалась бы хуже. Узел
          BottomFadeGradient используется в макете и сверху, и снизу (2235:30905). */}
      <div className="blur-edge-top" />

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

      {interactiveRoute && <div className="blur-edge-bottom" />}

      {interactiveRoute ? (
        // Плавающая белая карточка — «Submit Button Container», актуальные
        // узлы 2235:30905 (до маршрута) / 2235:31063 (после, с иконками
        // обновить/закрыть). Уточнение 14.08.2026: в этой версии макета
        // карточка НЕ на всю ширину и НЕ впритык к низу экрана (как было в
        // самой первой версии, 2190:8705/2228:27643) — отступ 16px со всех
        // сторон, скругление по всем четырём углам, не только сверху.
        <div className="absolute inset-x-[length:var(--mappy-spacing-md)] bottom-[calc(var(--mappy-spacing-md)+env(safe-area-inset-bottom))] z-20 flex flex-col gap-[length:var(--mappy-spacing-lg)] rounded-[length:var(--mappy-radius-lg)] bg-white p-[length:var(--mappy-spacing-md)]">
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
              {/* Финальный макет 2235:31063/2235:31199 (заменил промежуточный
                  вариант с текстовой кнопкой «Обновить маршрут»): слева —
                  иконка-кнопка «обновить» (пересчитать маршрут ещё раз, та же
                  handleBuildRoute), по центру три группы цифр, справа —
                  иконка-кнопка «✕» (clearRoute — вернуться к состоянию до
                  маршрута, не закрыть карту целиком, для этого есть «Назад»
                  сверху). Время выхода отдельно не показываем — только
                  прибытие, по решению владельца. */}
              <div className="flex w-full items-center justify-between">
                <IconButton
                  icon={<Icon name="refresh" />}
                  size="xl"
                  tone="surface"
                  aria-label="Обновить маршрут"
                  onClick={() => void handleBuildRoute()}
                />
                <div className="flex items-start gap-[length:var(--mappy-spacing-xs)] tracking-densed">
                  {routeState.durationSeconds != null && (
                    <div className="flex w-[62px] flex-col items-center">
                      <p className="text-header font-semibold text-text-secondary">
                        {Math.max(1, Math.round(routeState.durationSeconds / 60))}
                      </p>
                      <p className="text-body-2 text-text-tertiary">мин</p>
                    </div>
                  )}
                  {routeState.durationSeconds != null && (
                    <div className="flex flex-col items-center">
                      <p className="text-header font-semibold text-text-secondary">
                        {formatClockTime(routeState.departedAt + routeState.durationSeconds * 1000)}
                      </p>
                      <p className="text-body-2 text-text-tertiary">Прибытие</p>
                    </div>
                  )}
                  {routeState.distanceMeters != null && (
                    <div className="flex w-[62px] flex-col items-center">
                      <p className="text-header font-semibold text-text-secondary">
                        {splitDistance(routeState.distanceMeters).value}
                      </p>
                      <p className="text-body-2 text-text-tertiary">{splitDistance(routeState.distanceMeters).unit}</p>
                    </div>
                  )}
                </div>
                <IconButton icon={<Icon name="x" />} size="xl" tone="surface" aria-label="Закрыть маршрут" onClick={clearRoute} />
              </div>
              <div className="flex w-full items-end gap-[length:var(--mappy-spacing-xs)] px-[length:var(--mappy-spacing-2xs)]">
                <div className="flex min-w-0 max-w-[40%] shrink-0 flex-col gap-[length:var(--mappy-spacing-2xs)] tracking-densed">
                  <p className="text-body-2 text-text-tertiary">Вы здесь</p>
                  <p className="truncate text-body font-medium text-text-secondary">
                    {routeState.originAddress ?? "Текущее место"}
                  </p>
                </div>
                {/* Пунктирная линия между адресами — чисто декоративная отсылка
                    к самому маршруту, не несёт данных. mx-1 (4px) — иначе
                    вплотную прижимается к соседнему тексту адреса. */}
                <div className="mx-1 mb-2 h-px min-w-[16px] flex-1 border-t-2 border-dashed border-surface-tertiary" />
                <div className="flex min-w-0 max-w-[40%] shrink-0 flex-col items-end gap-[length:var(--mappy-spacing-2xs)] tracking-densed">
                  <p className="text-body-2 text-text-tertiary">Назначение</p>
                  <p className="truncate text-body font-medium text-text-secondary">{place.address}</p>
                </div>
              </div>
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
