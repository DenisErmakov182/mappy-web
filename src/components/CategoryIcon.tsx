import type { PlaceCategory } from "../types";
import food from "../assets/categories/food.png";
import shopping from "../assets/categories/shopping.png";
import nature from "../assets/categories/nature.png";
import monuments from "../assets/categories/monuments.png";
import fun from "../assets/categories/fun.png";
import culture from "../assets/categories/culture.png";
import sports from "../assets/categories/sports.png";

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
