import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "../types";
import { ratingChipColors } from "../types";
import mainPin from "../assets/icons/main-pin.webp";
import placedPinShadow from "../assets/icons/placed-pin-shadow.webp";
import food from "../assets/categories/food.webp";
import shopping from "../assets/categories/shopping.webp";
import nature from "../assets/categories/nature.webp";
import monuments from "../assets/categories/monuments.webp";
import fun from "../assets/categories/fun.webp";
import culture from "../assets/categories/culture.webp";
import sports from "../assets/categories/sports.webp";

const categoryIcons: Record<string, string> = { food, shopping, nature, monuments, fun, culture, sports };

// Географическая координата маркера совпадает с остриём пина. Эти размеры
// описывают видимую область вокруг острия и используются только для определения
// момента, когда соседние пины начинают касаться друг друга на экране.
const PIN_BOUNDS_FROM_TIP = {
  left: -27,
  right: 42,
  top: -58,
  bottom: 29,
};

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

/*
 * Пин по макету 1489:15526. Бейджи оценки/категории лежат ЗА пином (z-index ниже).
 */
function buildPinElement(place: Place, onSelect: () => void): HTMLElement {
  const el = document.createElement("button");
  el.style.cssText = "position:relative;width:69px;height:76px;background:none;border:none;padding:0;cursor:pointer;";

  const shadow = document.createElement("img");
  shadow.src = placedPinShadow;
  shadow.alt = "";
  shadow.style.cssText = "position:absolute;left:0;top:25px;z-index:0;width:67px;height:62.67px;object-fit:contain;pointer-events:none;";
  el.appendChild(shadow);

  const { bg, text } = ratingChipColors(place.rating);
  const rating = document.createElement("span");
  rating.textContent = String(place.rating);
  rating.style.cssText = `position:absolute;left:0;top:7px;z-index:1;height:26px;min-width:26px;padding:0 8px;border-radius:999px;background:${bg};color:${text};font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;`;
  el.appendChild(rating);

  const mainCategory = place.categories[0];
  if (mainCategory) {
    const tag = document.createElement("span");
    tag.style.cssText = "position:absolute;left:28px;top:14px;z-index:1;height:28px;padding:4px 8px;border-radius:999px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;";
    const icon = document.createElement("img");
    icon.src = categoryIcons[mainCategory];
    icon.style.cssText = "width:24px;height:20px;object-fit:contain;";
    tag.appendChild(icon);
    el.appendChild(tag);
  }

  const pin = document.createElement("img");
  pin.src = mainPin;
  pin.style.cssText = "position:absolute;left:7px;top:9px;z-index:2;width:40px;height:49px;object-fit:contain;";
  el.appendChild(pin);

  el.addEventListener("click", onSelect);
  return el;
}

/* Кластер: пин + бейдж с числом мест сзади */
function buildClusterElement(count: number, onSelect: () => void): HTMLElement {
  const el = document.createElement("button");
  el.style.cssText = "position:relative;width:69px;height:76px;background:none;border:none;padding:0;cursor:pointer;";

  const shadow = document.createElement("img");
  shadow.src = placedPinShadow;
  shadow.alt = "";
  shadow.style.cssText = "position:absolute;left:0;top:25px;z-index:0;width:67px;height:62.67px;object-fit:contain;pointer-events:none;";
  el.appendChild(shadow);

  const badge = document.createElement("span");
  badge.textContent = String(count);
  badge.style.cssText = "position:absolute;left:34px;top:8px;z-index:1;height:26px;min-width:26px;padding:0 8px;border-radius:999px;background:#fff;color:var(--mappy-pink);font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.10);";
  el.appendChild(badge);

  const pin = document.createElement("img");
  pin.src = mainPin;
  pin.style.cssText = "position:absolute;left:7px;top:9px;z-index:2;width:40px;height:49px;object-fit:contain;";
  el.appendChild(pin);

  el.addEventListener("click", onSelect);
  return el;
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

function distanceMeters(first: Place, second: Place): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/*
 * Объединяем только записи одного адреса. Географический порог не даёт
 * случайно склеить одинаковые названия улиц и домов в разных городах.
 * В отличие от экранного расстояния состав группы не зависит от масштаба карты.
 */
function groupPlacesByAddress(places: Place[]): Place[][] {
  const groups: Place[][] = [];

  for (const place of places) {
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
    .map((group) => [...group].sort((first, second) => first.id.localeCompare(second.id)))
    .sort((first, second) => first[0].id.localeCompare(second[0].id));
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

function markerBounds(point: maplibregl.Point): ScreenBounds {
  return {
    left: point.x + PIN_BOUNDS_FROM_TIP.left,
    right: point.x + PIN_BOUNDS_FROM_TIP.right,
    top: point.y + PIN_BOUNDS_FROM_TIP.top,
    bottom: point.y + PIN_BOUNDS_FROM_TIP.bottom,
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
  if (places.length > 1) return `cluster:${places.length}`;
  const place = places[0];
  return `single:${place.rating}:${place.categories[0] ?? ""}`;
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
  const bounds = points.map(markerBounds);
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

    // Кластер всегда остаётся на реальной координате первого стабильного
    // участника. При объединении/разделении этот пин не прыгает в среднюю точку.
    const anchor = addressGroups[indexes[0]][0];

    return {
      places: clusterPlaces,
      anchor: { latitude: anchor.latitude, longitude: anchor.longitude },
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
            : buildClusterElement(group.length, () => callbacksRef.current.onSelectPlace(selection.places));
        // Внутри элемента остриё PNG находится в точке (27, 58).
        // Якорь top-left с обратным offset совмещает именно остриё с координатой
        // карты без зависимости от размеров прозрачной области и масштаба.
        const marker = new maplibregl.Marker({ element: el, anchor: "top-left", offset: [-27, -58] })
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
      const c = map.getCenter();
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
    mapRef.current.easeTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, duration: 800 });
  }, [flyTo]);

  return <div ref={containerRef} className="w-full h-full" />;
}
