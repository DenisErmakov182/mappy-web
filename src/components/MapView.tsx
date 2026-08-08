import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "../types";
import { distanceMeters } from "../lib/geo";
import { CENTER_PIN_SCREEN_OFFSET_Y } from "./CenterPin";
import { buildClusterElement, buildPinElement, pinBoundsFromTip } from "./placePin";

// После объединения держим кластер ещё 16 px, прежде чем разделить его.
// Это убирает переключение туда-сюда около границы соприкосновения.
const CLUSTER_RELEASE_GAP_PX = 16;

interface Props {
  places: Place[];
  center: { lat: number; lng: number };
  initialZoom?: number;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onSelectPlace: (places: Place[]) => void;
  onMovingChange?: (moving: boolean) => void;
  /* Перелёт камеры (например, к геолокации); ts — чтобы триггерить повторные перелёты в ту же точку */
  flyTo?: { lat: number; lng: number; ts: number } | null;
}

const SAME_ADDRESS_RADIUS_METERS = 150;

function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");
}

/*
 * Объединяем только записи одного адреса. Географический порог не даёт
 * случайно склеить одинаковые названия улиц и домов в разных городах.
 * В отличие от экранного расстояния состав группы не зависит от масштаба карты.
 */
function groupPlacesByAddress(places: Place[]): Place[][] {
  const groups: Place[][] = [];

  const compareByStableAge = (first: Place, second: Place) => {
    const firstCreatedAt = first.createdAt ? Date.parse(first.createdAt) : Number.NaN;
    const secondCreatedAt = second.createdAt ? Date.parse(second.createdAt) : Number.NaN;
    if (Number.isFinite(firstCreatedAt) && Number.isFinite(secondCreatedAt) && firstCreatedAt !== secondCreatedAt) {
      return firstCreatedAt - secondCreatedAt;
    }
    return first.id.localeCompare(second.id);
  };

  // Самая ранняя запись адреса всегда обрабатывается первой и становится его
  // постоянным географическим якорем. Добавление нового места больше не может
  // перенести уже существующий адресный пин в другую точку.
  for (const place of [...places].sort(compareByStableAge)) {
    const address = normalizeAddress(place.address);
    const matchingGroup = address
      ? groups.find(
          (group) =>
            normalizeAddress(group[0].address) === address &&
            distanceMeters(group[0], place) <= SAME_ADDRESS_RADIUS_METERS,
        )
      : undefined;

    if (matchingGroup) matchingGroup.push(place);
    else groups.push([place]);
  }

  return groups
    .map((group) => [...group].sort(compareByStableAge))
    .sort((first, second) => compareByStableAge(first[0], second[0]));
}

type VisibleMarkerGroup = {
  places: Place[];
  anchor: { latitude: number; longitude: number };
};

type MarkerGroupingResult = {
  groups: VisibleMarkerGroup[];
  clusterByAddressGroup: Map<string, string>;
};

type RenderedMarker = {
  marker: maplibregl.Marker;
  selection: { places: Place[] };
  visualSignature: string;
};

type ScreenBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function markerBounds(point: maplibregl.Point, places: Place[]): ScreenBounds {
  const bounds = pinBoundsFromTip(places);
  return {
    left: point.x + bounds.left,
    right: point.x + bounds.right,
    top: point.y + bounds.top,
    bottom: point.y + bounds.bottom,
  };
}

function boundsWithinGap(first: ScreenBounds, second: ScreenBounds, gap: number): boolean {
  return !(
    first.right + gap < second.left ||
    second.right + gap < first.left ||
    first.bottom + gap < second.top ||
    second.bottom + gap < first.top
  );
}

function placesKey(places: Place[]): string {
  return places.map((place) => place.id).sort().join("|");
}

function markerVisualSignature(places: Place[]): string {
  const owners = places.map((place) => `${place.owner?.id ?? "self"}:${place.owner?.avatarUrl ?? ""}`).sort().join("|");
  if (places.length > 1) return `cluster:${places.length}:${owners}`;
  const place = places[0];
  return `single:${place.rating}:${place.categories[0] ?? ""}:${owners}`;
}

/*
 * Сначала сохраняем продуктовую группировку одинаковых адресов. Затем временно
 * объединяем получившиеся пины, если их реальные экранные прямоугольники
 * соприкасаются. Union-find делает группировку транзитивной: если A касается B,
 * а B касается C, пользователь видит один кластер из трёх мест.
 */
function groupTouchingMarkers(
  map: maplibregl.Map,
  places: Place[],
  previousClusterByAddressGroup: Map<string, string>,
): MarkerGroupingResult {
  const addressGroups = groupPlacesByAddress(places);
  const addressGroupKeys = addressGroups.map(placesKey);
  const points = addressGroups.map((group) => {
    const anchor = group[0];
    return map.project([anchor.longitude, anchor.latitude]);
  });
  const bounds = points.map((point, index) => markerBounds(point, addressGroups[index]));
  const parents = addressGroups.map((_, index) => index);

  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const parent = parents[index];
      parents[index] = root;
      index = parent;
    }
    return root;
  };

  const union = (first: number, second: number) => {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
  };

  for (let first = 0; first < addressGroups.length; first += 1) {
    for (let second = first + 1; second < addressGroups.length; second += 1) {
      const previousFirstCluster = previousClusterByAddressGroup.get(addressGroupKeys[first]);
      const wereInSameCluster =
        previousFirstCluster !== undefined &&
        previousFirstCluster === previousClusterByAddressGroup.get(addressGroupKeys[second]);
      const gap = wereInSameCluster ? CLUSTER_RELEASE_GAP_PX : 0;
      if (boundsWithinGap(bounds[first], bounds[second], gap)) union(first, second);
    }
  }

  const clusters = new Map<number, number[]>();
  addressGroups.forEach((_, index) => {
    const root = find(index);
    const cluster = clusters.get(root);
    if (cluster) cluster.push(index);
    else clusters.set(root, [index]);
  });

  const clusterByAddressGroup = new Map<string, string>();
  const groups = [...clusters.values()].map((indexes) => {
    const clusterPlaces = indexes.flatMap((index) => addressGroups[index]);
    const clusterKey = placesKey(clusterPlaces);
    indexes.forEach((index) => clusterByAddressGroup.set(addressGroupKeys[index], clusterKey));

    const clusterPoint = indexes.reduce(
      (total, index) => ({ x: total.x + points[index].x, y: total.y + points[index].y }),
      { x: 0, y: 0 },
    );
    clusterPoint.x /= indexes.length;
    clusterPoint.y /= indexes.length;
    const anchor = map.unproject([clusterPoint.x, clusterPoint.y]);

    return {
      places: clusterPlaces,
      // Одиночный адрес остаётся на координате своей самой ранней записи.
      // Временный кластер разных адресов располагается в экранном центре группы,
      // а не телепортируется к одному из участников при каждом изменении состава.
      anchor: { latitude: anchor.lat, longitude: anchor.lng },
    };
  });

  return { groups, clusterByAddressGroup };
}

export function MapView({ places, center, initialZoom = 12, onCenterChange, onSelectPlace, onMovingChange, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, RenderedMarker>>(new Map());
  const clusterMembershipRef = useRef<Map<string, string>>(new Map());
  const rebuildRef = useRef<() => void>(() => {});
  const placesRef = useRef(places);
  const callbacksRef = useRef({ onSelectPlace });
  placesRef.current = places;
  callbacksRef.current = { onSelectPlace };

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Бесплатный OSM-стиль без ключей; позже — self-hosted Protomaps под дизайн.
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [center.lng, center.lat],
      zoom: initialZoom,
      attributionControl: false,
    });
    // Пин нарисован на 32px ниже геометрического центра контейнера (см.
    // CenterPin.tsx) — сразу подправляем камеру, чтобы его остриё указывало
    // на исходную center-координату, а не на точку выше неё. jumpTo игнорирует
    // offset (проверено в исходниках maplibre-gl — учитывает его только
    // easeTo/flyTo), поэтому используем easeTo с нулевой длительностью.
    map.easeTo({ center: [center.lng, center.lat], zoom: initialZoom, offset: [0, CENTER_PIN_SCREEN_OFFSET_Y], duration: 0 });
    mapRef.current = map;

    const rebuild = () => {
      const { groups, clusterByAddressGroup } = groupTouchingMarkers(
        map,
        placesRef.current,
        clusterMembershipRef.current,
      );
      clusterMembershipRef.current = clusterByAddressGroup;
      const nextMarkerKeys = new Set<string>();

      groups.forEach(({ places: group, anchor }) => {
        const markerKey = placesKey(group);
        const visualSignature = markerVisualSignature(group);
        const existing = markersRef.current.get(markerKey);
        nextMarkerKeys.add(markerKey);

        if (existing && existing.visualSignature === visualSignature) {
          existing.selection.places = group;
          existing.marker.setLngLat([anchor.longitude, anchor.latitude]);
          return;
        }

        if (existing) {
          existing.marker.remove();
          markersRef.current.delete(markerKey);
        }

        const selection = { places: group };
        // Клик по одиночному пину или по кластеру одинаково открывает карточку(и)
        // выбранных мест — при нескольких местах в одной точке между ними можно
        // свайпнуть в самой карточке, поэтому зум тут не нужен.
        const el =
          group.length === 1
            ? buildPinElement(group[0], () => callbacksRef.current.onSelectPlace(selection.places))
            : buildClusterElement(group, () => callbacksRef.current.onSelectPlace(selection.places));
        // Корневой DOM-элемент имеет нулевой размер и находится ровно в
        // географической координате. Вся графика размещена вокруг него так, что
        // точка (27, 58) визуального элемента — остриё пина — совпадает с (0, 0).
        // Тени и бейджи больше не участвуют в расчёте якоря MapLibre.
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([anchor.longitude, anchor.latitude])
          .addTo(map);

        markersRef.current.set(markerKey, { marker, selection, visualSignature });
      });

      markersRef.current.forEach((renderedMarker, markerKey) => {
        if (nextMarkerKeys.has(markerKey)) return;
        renderedMarker.marker.remove();
        markersRef.current.delete(markerKey);
      });
    };

    map.on("load", rebuild);
    // Относительное расстояние между пинами меняется только с масштабом. После
    // завершения zoom пересчитываем касания и собираем/разбираем кластеры.
    map.on("zoomend", rebuild);
    map.on("movestart", () => onMovingChange?.(true));
    map.on("moveend", () => {
      onMovingChange?.(false);
      // Читаем координату под остриём пина (сдвинутым на CENTER_PIN_SCREEN_OFFSET_Y
      // от геометрического центра контейнера), а не голый map.getCenter().
      const { clientWidth, clientHeight } = map.getContainer();
      const c = map.unproject([clientWidth / 2, clientHeight / 2 + CENTER_PIN_SCREEN_OFFSET_Y]);
      onCenterChange({ lat: c.lat, lng: c.lng });
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    rebuildRef.current = rebuild;
    rebuild();

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      clusterMembershipRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rebuildRef.current();
  }, [places]);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: 14,
      duration: 800,
      offset: [0, CENTER_PIN_SCREEN_OFFSET_Y],
    });
  }, [flyTo]);

  return <div ref={containerRef} className="w-full h-full" />;
}
