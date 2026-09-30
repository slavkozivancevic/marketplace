import type { DepartmentWithImages } from "../db/categories";

/**
 * Fewest catalogue images worth arranging into the hero mosaic. Below this the
 * home page falls back to a single centred column.
 *
 * This lives in a plain module rather than next to `<DepartmentMosaic>`,
 * because that component is `"use client"` and EVERY export of a client module
 * reaches a Server Component as a client-reference proxy, not as its value. A
 * server-side `total >= MOSAIC_MIN_IMAGES` imported from there compares a
 * number against an object: always false, no type error, no runtime error -
 * the hero just silently lost its images.
 */
export const MOSAIC_MIN_IMAGES = 6;

export function countDepartmentImages(
  departments: readonly DepartmentWithImages[],
): number {
  return departments.reduce((n, d) => n + d.productImages.length, 0);
}
