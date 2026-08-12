/*
 * Реестр иконок Mappy. Пополняется по одной, по мере реальной надобности —
 * полная библиотека в Figma (2223:27613) на 1600+ иконок, это сторонний
 * набор, а не то, что реально используется в приложении.
 *
 * Все иконки рисуются через currentColor (не фиксированный stroke) —
 * цвет наследуется от текстового цвета компонента-обёртки (например,
 * IconButton уже красит через className text-icon-*), а не задаётся
 * иконкой самой по себе. Это и есть «цвет наследуется от состояния» —
 * правило библиотеки, п. 6.
 */

import type { SVGProps } from "react";

type IconName = "x" | "plus" | "swap";

// Единый viewBox 24×24 и единая strokeWidth для всех иконок реестра — IconButton
// принудительно тянет svg-элемент к одному пиксельному размеру (size-*),
// и при разных исходных viewBox толщина линий масштабируется по-разному
// (крестик с viewBox 16 при таком растяжении визуально жирнее плюса с 24,
// хотя strokeWidth в коде у него меньше). Нашли живьём при сравнении в превью.
const paths: Record<IconName, { viewBox: string; d: string; strokeWidth: number }> = {
  // Figma: M/x (1419:25694) — координаты пересчитаны из исходного viewBox 16
  // (×1.5) под общий 24, форма та же.
  x: { viewBox: "0 0 24 24", d: "M18 6L6 18M6 6L18 18", strokeWidth: 2 },
  // Уже использовался как PlusIcon в AddPlaceSheet — перенесено сюда без изменений.
  plus: { viewBox: "0 0 24 24", d: "M12 5V19M5 12H19", strokeWidth: 2 },
  // Собственная иконка (не из библиотеки 1621 — там это генерик arrows, тут своя форма под кнопку «Поменять местами»).
  swap: {
    viewBox: "0 0 24 24",
    d: "M7 4L3 8M3 8L7 12M3 8H21M17 20L21 16M21 16L17 12M21 16H3",
    strokeWidth: 2,
  },
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const spec = paths[name];
  return (
    <svg viewBox={spec.viewBox} fill="none" aria-hidden="true" {...props}>
      <path
        d={spec.d}
        stroke="currentColor"
        strokeWidth={spec.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
