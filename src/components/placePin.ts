import type { Friend, Place } from "../types";
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

/*
 * Пин места как raw-DOM элемент маркера MapLibre. Вынесен из MapView, потому что
 * его переиспользует публичная страница шеринга: там нужен ровно тот же пин, но
 * без поиска, фильтров, кластеров и кнопки добавления места. Логика группировки
 * и сам жизненный цикл карты остались в MapView — сюда переехала только графика.
 */

const categoryIcons: Record<string, string> = { food, shopping, nature, monuments, fun, culture, sports };

// Пину достаточно того, что видно на нём самом. Такая структурная сигнатура
// позволяет строить пин и из полноценного Place, и из места, открытого по
// публичной ссылке, — у второго нет ни id, ни статуса, ни заметки.
export type PinPlace = Pick<Place, "title" | "rating" | "categories"> & { owner?: Friend };

// Географическая координата маркера совпадает с остриём пина. Эти размеры
// описывают видимую область вокруг острия и используются только для определения
// момента, когда соседние пины начинают касаться друг друга на экране.
export const PIN_BOUNDS_FROM_TIP = {
  left: -27,
  right: 42,
  top: -58,
  bottom: 30,
};

const FRIEND_PIN_TOP_FROM_TIP = -72;

export function pinBoundsFromTip(places: PinPlace[]) {
  return {
    ...PIN_BOUNDS_FROM_TIP,
    top: places.some((place) => place.owner) ? FRIEND_PIN_TOP_FROM_TIP : PIN_BOUNDS_FROM_TIP.top,
  };
}

function appendOwnerAvatar(
  element: HTMLElement,
  place: PinPlace,
  { left = 11, top = 0, size = 40, zIndex = 1 }: { left?: number; top?: number; size?: number; zIndex?: number } = {},
) {
  if (!place.owner) return;
  const avatar = document.createElement("span");
  avatar.title = place.owner.name;
  avatar.style.cssText = `position:absolute;left:${left}px;top:${top}px;z-index:${zIndex};box-sizing:border-box;width:${size}px;height:${size}px;border:2px solid #f3f4f6;border-radius:999px;background:#f9fafb;overflow:hidden;pointer-events:none;`;
  if (place.owner.avatarUrl) {
    const image = document.createElement("img");
    image.src = place.owner.avatarUrl;
    image.alt = place.owner.name;
    image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    avatar.appendChild(image);
  }
  element.appendChild(avatar);
}

/*
 * Пин по макету 1489:15526. Бейджи оценки/категории лежат ЗА пином (z-index ниже).
 * Без onSelect пин остаётся декоративным: так он и нужен на публичной странице,
 * где по нему нечего открывать.
 */
export function buildPinElement(place: PinPlace, onSelect?: () => void): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "position:relative;width:0;height:0;overflow:visible;";

  const bounds = pinBoundsFromTip([place]);
  const topOffset = PIN_BOUNDS_FROM_TIP.top - bounds.top;

  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", place.owner ? `${place.title}, место ${place.owner.name}` : place.title);
  el.style.cssText = `position:absolute;left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right - bounds.left}px;height:${bounds.bottom - bounds.top}px;background:none;border:none;padding:0;cursor:${onSelect ? "pointer" : "default"};overflow:visible;`;
  root.appendChild(el);

  const shadow = document.createElement("img");
  shadow.src = placedPinShadow;
  shadow.alt = "";
  shadow.style.cssText = `position:absolute;left:0;top:${25 + topOffset}px;z-index:0;width:67px;height:62.67px;object-fit:contain;pointer-events:none;`;
  el.appendChild(shadow);

  // Нет оценки — нет бейджа. rating === 0 в схеме означает «не оценено», а не
  // «ноль звёзд», рисовать его нельзя нигде, включая пин на карте.
  if (place.rating > 0) {
    const { bg, text } = ratingChipColors(place.rating);
    const rating = document.createElement("span");
    rating.textContent = String(place.rating);
    rating.style.cssText = `position:absolute;left:0;top:${7 + topOffset}px;z-index:2;height:26px;min-width:26px;padding:0 8px;border-radius:999px;background:${bg};color:${text};font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;`;
    el.appendChild(rating);
  }

  const mainCategory = place.categories[0];
  if (mainCategory) {
    // Без бейджа оценки категории некуда «прислоняться» — сдвигаем на его
    // место, а не оставляем пустой отступ слева.
    const tag = document.createElement("span");
    const tagLeft = place.rating > 0 ? 28 : 0;
    tag.style.cssText = `position:absolute;left:${tagLeft}px;top:${14 + topOffset}px;z-index:2;height:28px;padding:4px 8px;border-radius:999px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;`;
    const icon = document.createElement("img");
    icon.src = categoryIcons[mainCategory];
    icon.style.cssText = "width:24px;height:20px;object-fit:contain;";
    tag.appendChild(icon);
    el.appendChild(tag);
  }

  const pin = document.createElement("img");
  pin.src = mainPin;
  pin.style.cssText = `position:absolute;left:7px;top:${9 + topOffset}px;z-index:3;width:40px;height:49px;object-fit:contain;`;
  el.appendChild(pin);

  appendOwnerAvatar(el, place);

  if (onSelect) el.addEventListener("click", onSelect);
  return root;
}

/* Кластер: пин + бейдж с числом мест сзади */
export function buildClusterElement(places: PinPlace[], onSelect: () => void): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "position:relative;width:0;height:0;overflow:visible;";

  const bounds = pinBoundsFromTip(places);
  const topOffset = PIN_BOUNDS_FROM_TIP.top - bounds.top;

  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${places.length} мест`);
  el.style.cssText = `position:absolute;left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right - bounds.left}px;height:${bounds.bottom - bounds.top}px;background:none;border:none;padding:0;cursor:pointer;overflow:visible;`;
  root.appendChild(el);

  const shadow = document.createElement("img");
  shadow.src = placedPinShadow;
  shadow.alt = "";
  shadow.style.cssText = `position:absolute;left:0;top:${25 + topOffset}px;z-index:0;width:67px;height:62.67px;object-fit:contain;pointer-events:none;`;
  el.appendChild(shadow);

  const badge = document.createElement("span");
  badge.textContent = String(places.length);
  badge.style.cssText = `position:absolute;left:34px;top:${8 + topOffset}px;z-index:2;height:26px;min-width:26px;padding:0 8px;border-radius:999px;background:#fff;color:var(--mappy-pink);font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.10);`;
  el.appendChild(badge);

  const pin = document.createElement("img");
  pin.src = mainPin;
  pin.style.cssText = `position:absolute;left:7px;top:${9 + topOffset}px;z-index:3;width:40px;height:49px;object-fit:contain;`;
  el.appendChild(pin);

  const owners = [...new Map(places.filter((place) => place.owner).map((place) => [place.owner!.id, place])).values()];
  owners.slice(0, 2).forEach((place, index) =>
    appendOwnerAvatar(el, place, {
      left: 11 + index * 22,
      top: index * 4,
      size: index === 0 ? 40 : 32,
      zIndex: 1,
    }),
  );

  el.addEventListener("click", onSelect);
  return root;
}
