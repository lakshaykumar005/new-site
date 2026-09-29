import { dnOf, type NoteLetter } from "./theory";

/**
 * The composers' cipher (the French method Ravel's generation used for
 * HAYDN): A–G are already notes; after G the alphabet wraps around to A
 * again, seven letters to a row.
 *
 *   A B C D E F G
 *   H I J K L M N
 *   O P Q R S T U
 *   V W X Y Z
 */

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Column headings of the cipher table: the note each column becomes. */
export const NOTE_COLUMNS: readonly NoteLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

export const CIPHER_ROWS: readonly string[] = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ"];

/** Strip accents so "Élodie" still spells E-L-O-D-I-E. */
export function normalizeWord(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function noteOfLetter(ch: string): NoteLetter | null {
  const i = ALPHABET.indexOf(normalizeWord(ch).toUpperCase());
  return i < 0 ? null : NOTE_COLUMNS[i % 7];
}

/**
 * Where each cipher note sits in the theme: A4 up to G5, every one of
 * them inside the treble staff, no ledger lines needed.
 */
export function themeDnOf(note: NoteLetter): number {
  return note === "A" || note === "B" ? dnOf(note, 4) : dnOf(note, 5);
}

export interface SpelledNote {
  /** the letter as written (case kept) */
  char: string;
  /** position among the letters of the word (non-letters skipped) */
  index: number;
  note: NoteLetter;
  dn: number;
}

/** A word, letter by letter, as notes. Non-letters are skipped. */
export function spell(word: string): SpelledNote[] {
  const out: SpelledNote[] = [];
  for (const raw of Array.from(word)) {
    const base = normalizeWord(raw);
    const note = noteOfLetter(base);
    if (!note) continue;
    out.push({ char: raw, index: out.length, note, dn: themeDnOf(note) });
  }
  return out;
}

/** Row (0–3) and column (0–6) of a letter in the cipher table. */
export function cipherCell(ch: string): { row: number; col: number } | null {
  const i = ALPHABET.indexOf(normalizeWord(ch).toUpperCase());
  if (i < 0) return null;
  return { row: Math.floor(i / 7), col: i % 7 };
}
