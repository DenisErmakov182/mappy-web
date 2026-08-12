import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Тот же хелпер, что в gp-test-dev — для единообразия между проектами. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
