"use client";

import { CIPHER_ROWS, NOTE_COLUMNS, cipherCell, normalizeWord } from "@/lib/music/cipher";
import type { NoteLetter } from "@/lib/music/theory";

/**
 * The plate lights up by hand, not by re-rendering: every sounding thing
 * has a vermillion twin sitting on top of it at opacity 0, and a flash is
 * a short Web Animation on that twin. Flashing the same thing again
 * restarts it cleanly, however fast the taps come.
 */

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** ms between the letters of a column when its note is struck: top to bottom */
const CASCADE = 60;

const running = new WeakMap<Element, Animation>();

function flash(el: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  running.get(el)?.cancel();
  running.set(el, (el as HTMLElement).animate(frames, options));
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Ink turns vermillion at once, holds, then fades back. */
const HOLD_FADE: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: 0.28, easing: EASE_OUT },
  { opacity: 0 },
];

/** A vermillion stamp: lands a little small, springs to size, lifts away. */
const STAMP: Keyframe[] = [
  { opacity: 1, transform: "scale(0.72)", easing: EASE_SPRING },
  { opacity: 1, transform: "scale(1)", offset: 0.2 },
  { opacity: 1, transform: "scale(1)", offset: 0.34, easing: EASE_OUT },
  { opacity: 0, transform: "scale(1)" },
];

/** The punched letter keeps pace with the stamp, but never moves. */
const STAMP_LETTER: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: 0.34, easing: EASE_OUT },
  { opacity: 0 },
];

/** The ring a sounding note leaves behind (same as the engraved lines). */
const RING: Keyframe[] = [
  { opacity: 0.85, transform: "scale(0.55)" },
  { opacity: 0, transform: "scale(2)" },
];

const WASH: Keyframe[] = [
  { opacity: 0.9 },
  { opacity: 0.9, offset: 0.22, easing: EASE_OUT },
  { opacity: 0 },
];

/** A note name lifts, like a key being struck, and settles. */
const LIFT: Keyframe[] = [
  { transform: "translateY(0)", easing: EASE_OUT },
  { transform: "translateY(-3px)", offset: 0.22, easing: EASE_SPRING },
  { transform: "translateY(0)" },
];

const DRAW: Keyframe[] = [
  { opacity: 1, transform: "scaleY(0)", easing: EASE_OUT },
  { opacity: 1, transform: "scaleY(1)", offset: 0.3 },
  { opacity: 1, transform: "scaleY(1)", offset: 0.46, easing: EASE_OUT },
  { opacity: 0, transform: "scaleY(1)" },
];

/** Every letter in a column of the table, top to bottom: B, I, P, W. */
export function lettersOfColumn(col: number): string[] {
  return CIPHER_ROWS.map((row) => row[col]).filter((l): l is string => !!l);
}

function stamp(root: ParentNode, upper: string, still: boolean, delay = 0) {
  flash(root.querySelector(`[data-disc="${upper}"]`), still ? STAMP_LETTER : STAMP, { duration: 950, delay });
  flash(root.querySelector(`[data-key-hot="${upper}"]`), STAMP_LETTER, { duration: 950, delay });
}

function washUp(root: ParentNode, col: number, row: number) {
  const wash = root.querySelector<HTMLElement>(`[data-wash="${col}"]`);
  if (!wash) return;
  wash.style.setProperty("--r", String(row));
  flash(wash, WASH, { duration: 1100 });
}

/** The note itself: its name over the column, and its whole note on the staff. */
function sound(root: ParentNode, col: number, still: boolean, delay = 0) {
  flash(root.querySelector(`[data-head-hot="${col}"]`), HOLD_FADE, { duration: 1000, delay });
  if (!still) flash(root.querySelector(`[data-head="${col}"]`), LIFT, { duration: 620, delay });
  flash(root.querySelector(`[data-staff-hot="${col}"]`), HOLD_FADE, { duration: 1000, delay });
  if (!still) flash(root.querySelector(`[data-staff-ring="${col}"]`), RING, { duration: 760, easing: EASE_OUT, delay });
}

/**
 * Light one letter: its cell, the wash up its column, the column's note
 * name and its note on the staff — and, when it came from the derivation
 * (or the spell-through), that pair as well.
 */
export function lightLetter(root: ParentNode, letter: string, pair?: number) {
  const upper = normalizeWord(letter).toUpperCase();
  const at = cipherCell(upper);
  if (!at) return;
  const still = reducedMotion();
  stamp(root, upper, still);
  washUp(root, at.col, at.row);
  sound(root, at.col, still);
  if (pair !== undefined) lightPair(root, pair, still);
}

/**
 * Strike a note and every letter that becomes it answers at once — the
 * stamp runs down the column (B, I, P, W), which is the whole cipher in
 * one gesture: seven notes are enough for twenty-six letters.
 */
export function lightColumn(root: ParentNode, col: number) {
  const still = reducedMotion();
  const letters = lettersOfColumn(col);
  letters.forEach((l, r) => stamp(root, l, still, still ? 0 : r * CASCADE));
  washUp(root, col, letters.length - 1);
  sound(root, col, still);
}

/** A note sounding with no letter behind it (a tone of the closing chord). */
export function lightNote(root: ParentNode, note: NoteLetter, delay = 0) {
  const col = NOTE_COLUMNS.indexOf(note);
  if (col < 0) return;
  sound(root, col, reducedMotion(), delay);
}

function lightPair(root: ParentNode, i: number, still: boolean) {
  // nothing to light until the derivation has been revealed
  if (!root.querySelector("[data-derivation][data-in]")) return;
  flash(root.querySelector(`[data-pair-letter="${i}"]`), HOLD_FADE, { duration: 1000 });
  if (!still) flash(root.querySelector(`[data-pair="${i}"] [data-lift]`), LIFT, { duration: 620 });
  flash(root.querySelector(`[data-pair-shaft="${i}"]`), still ? HOLD_FADE : DRAW, { duration: 1000 });
  flash(root.querySelector(`[data-pair-head="${i}"]`), HOLD_FADE, { duration: 1000, delay: still ? 0 : 120 });
  flash(root.querySelector(`[data-pair-note="${i}"]`), HOLD_FADE, { duration: 1000, delay: still ? 0 : 150 });
}
