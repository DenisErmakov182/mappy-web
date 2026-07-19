import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "../types";
import { ratingChipColors } from "../types";
import mainPin from "../assets/icons/main-pin.png";
import placedPinShadow from "../assets/icons/placed-pin-shadow.png";
import food from "../assets/categories/food.png";
import shopping from "../assets/categories/shopping.png";
import nature from "../assets/categories/nature.png";
import monuments from "../assets/categories/monuments.png";
import fun from "../assets/categories/fun.png";
import culture from "../assets/categories/culture.png";
import sports from "../assets/categories/sports.png";

const categoryIcons: Record<string, string> = { food, shopping, nature, monuments, fun, culture, sports };

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

  return groups;
}

export function MapView({ places, center, initialZoom = 12, onCenterChange, onSelectPlace, onMovingChange, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
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
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = groupPlacesByAddress(placesRef.current).map((group) => {
        // Список приходит от новых мест к старым. Координата первого места —
        // постоянный якорь группы; усреднение координат сдвигало пин после сохранения.
        const anchor = group[0];
        // Клик по одиночному пину или по кластеру одинаково открывает карточку(и)
        // выбранных мест — при нескольких местах в одной точке между ними можно
        // свайпнуть в самой карточке, поэтому зум тут не нужен.
        const el =
          group.length === 1
            ? buildPinElement(group[0], () => callbacksRef.current.onSelectPlace(group))
            : buildClusterElement(group.length, () => callbacksRef.current.onSelectPlace(group));
        // Внутри элемента остриё PNG находится в точке (27, 58).
        // Якорь top-left с обратным offset совмещает именно остриё с координатой
        // карты без зависимости от размеров прозрачной области и масштаба.
        return new maplibregl.Marker({ element: el, anchor: "top-left", offset: [-27, -58] })
          .setLngLat([anchor.longitude, anchor.latitude])
          .addTo(map);
      });
    };

    map.on("load", rebuild);
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
