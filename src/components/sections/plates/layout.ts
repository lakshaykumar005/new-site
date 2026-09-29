import type { Plate, PlatePhoto } from "@/content/photos";

/**
 * How each plate sits on its page. Everything here is derived from the
 * photographs themselves, so plates can be added, removed or reordered
 * in `src/content/photos.ts` without touching the layout.
 */

/** upright = one portrait-ish photo; wide = one landscape; pair = two or more */
export type PlateKind = "upright" | "wide" | "pair";

/** Which margin the plate keeps to on a wide page (captions face inward). */
export type PlateSide = "left" | "right";

export const aspectOf = (p: PlatePhoto) => p.width / p.height;

export function kindOf(plate: Plate): PlateKind {
  if (plate.photos.length > 1) return "pair";
  return aspectOf(plate.photos[0]) >= 1.15 ? "wide" : "upright";
}

export const sideOf = (index: number): PlateSide => (index % 2 === 0 ? "left" : "right");

/**
 * Desktop print heights for upright plates, cycled so that neighbouring
 * plates differ a little in size — a printed book, not a contact sheet.
 */
const UPRIGHT_HEIGHTS = [612, 568, 596];
export const uprightHeight = (index: number) => UPRIGHT_HEIGHTS[index % UPRIGHT_HEIGHTS.length];

/**
 * A pair is printed as a crescendo: each photograph a little taller than
 * the one before. Laid out with flex weights of aspect × GROWTHⁱ, the
 * heights keep exactly this ratio at any width.
 */
export const GROWTH = 1.2;
export const growOf = (photo: PlatePhoto, i: number) => aspectOf(photo) * GROWTH ** i;

/** Plates carry their own numbers, apart from the figures. */
export function plateNumber(n: number): string {
  return String(n);
}
