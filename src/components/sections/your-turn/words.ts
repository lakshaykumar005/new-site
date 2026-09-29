import { noteOfLetter, normalizeWord, themeDnOf } from "@/lib/music/cipher";
import { midiOfDn } from "@/lib/music/theory";

/** The word as the music reads it: an accent typed as two code points stays one letter. */
export function tidy(s: string): string {
  return s.normalize("NFC");
}

/** Does this character become a note? (Exactly the letters `spell()` keeps.) */
export function sounds(ch: string): boolean {
  return noteOfLetter(normalizeWord(ch)) !== null;
}

/** The pitch a single letter plays in the theme. */
export function midiOfChar(ch: string): number | null {
  const note = noteOfLetter(normalizeWord(ch));
  return note ? midiOfDn(themeDnOf(note)) : null;
}

/**
 * Keeps every character's identity across an edit. Whatever the edit
 * left untouched at the start and at the end keeps its key; everything
 * in between is new. Returns the keys for `next` and the indices (in
 * `next`) of the characters that were inserted.
 */
export function rekey(
  prev: readonly string[],
  prevKeys: readonly number[],
  next: readonly string[],
  fresh: () => number
): { keys: number[]; inserted: number[] } {
  const max = Math.min(prev.length, next.length);
  let head = 0;
  while (head < max && prev[head] === next[head]) head++;
  let tail = 0;
  while (tail < max - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;

  const keys = prevKeys.slice(0, head);
  const inserted: number[] = [];
  for (let i = head; i < next.length - tail; i++) {
    keys.push(fresh());
    inserted.push(i);
  }
  keys.push(...prevKeys.slice(prev.length - tail));
  return { keys, inserted };
}

/** A stable key for each melody note of `chars` (the letters, in order). */
export function noteKeys(chars: readonly string[], keys: readonly number[]): string[] {
  const out: string[] = [];
  chars.forEach((ch, i) => {
    if (sounds(ch)) out.push(`k${keys[i] ?? `x${i}`}`);
  });
  return out;
}
