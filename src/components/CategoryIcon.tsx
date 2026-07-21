import type { PlaceCategory } from "../types";
import food from "../assets/categories/food.webp";
import shopping from "../assets/categories/shopping.webp";
import nature from "../assets/categories/nature.webp";
import monuments from "../assets/categories/monuments.webp";
import fun from "../assets/categories/fun.webp";
import culture from "../assets/categories/culture.webp";
import sports from "../assets/categories/sports.webp";

const icons: Record<PlaceCategory, string> = {
  food,
  shopping,
  nature,
  monuments,
  fun,
  culture,
  sports,
};

export function CategoryIcon({ category, size = 24 }: { category: PlaceCategory; size?: number }) {
  return (
    <img
      src={icons[category]}
      alt=""
      style={{ width: size, height: (size * 20) / 24 }}
      className="object-contain shrink-0"
    />
  );
}
