import type { Plate, PlatePhoto } from "@/content/photos";
import type { Rest } from "./press";

/**
 * How each plate sits on its page. Everything here is derived from the
 * photographs themselves, so plates can be added, removed or reordered
 * in `src/content/photos.ts` without touching the layout.
 */

/** upright = one portrait-ish photo; wide = one landscape; pair = two or more */
export type PlateKind = "upright" | "wide" | "pair";

/** Which margin the print keeps to on a wide page (the colophon faces in). */
export type PlateSide = "left" | "right";

/** The corner the sheet is pulled off by. */
export type Grip = "tl" | "tr" | "bl" | "br";

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

/**
 * Which corner a sheet is pulled from. A single print is pulled from the
 * corner nearest its colophon. The pair is pulled so that the earlier
 * year comes first and the hairpin is drawn from its point outwards —
 * from the bottom left when the two stand side by side, from the top
 * left when they are stacked.
 */
export function gripOf(kind: PlateKind, side: PlateSide, sideBySide: boolean): Grip {
  if (kind === "pair") return sideBySide ? "bl" : "tl";
  return side === "left" ? "br" : "bl";
}

/**
 * Where a pulled print comes to rest: a slight turn — never the same
 * twice running — and a small slide the way it was pulled.
 */
const TILTS = [1.3, -1.15, 1.05, -1.4, 0.85, -1.25];
export function restOf(index: number, grip: Grip): Rest {
  const rot = TILTS[index % TILTS.length];
  const dx = grip.endsWith("r") ? -3 : 3;
  const dy = grip.startsWith("b") ? -2 : 2;
  return { rot, dx, dy };
}
