/**
 * Pitch arithmetic on white keys only. The cipher can only ever
 * produce A–G, so the whole site lives in C major / A minor and a
 * pitch is simply a "diatonic number": how many white keys above C0.
 *
 *   dn = octave * 7 + index(C D E F G A B)      C4 = 28, A4 = 33
 */

export type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export const DIATONIC: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

const SEMITONE: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function dnOf(letter: NoteLetter, octave: number): number {
  return octave * 7 + DIATONIC.indexOf(letter);
}

export function letterOfDn(dn: number): NoteLetter {
  return DIATONIC[((dn % 7) + 7) % 7];
}

export function octaveOfDn(dn: number): number {
  return Math.floor(dn / 7);
}

export function midiOfDn(dn: number): number {
  return 12 * (octaveOfDn(dn) + 1) + SEMITONE[letterOfDn(dn)];
}

export function freqOfMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** "A4", "F5" */
export function nameOfDn(dn: number): string {
  return `${letterOfDn(dn)}${octaveOfDn(dn)}`;
}

/** The treble staff's bottom line is E4. Step 0 = E4, 8 = F5 (top line). */
export const TREBLE_BOTTOM_DN = dnOf("E", 4);

export function trebleStep(dn: number): number {
  return dn - TREBLE_BOTTOM_DN;
}

/** Degree of a letter inside C major (C = 0 … B = 6). */
export function degreeOf(letter: NoteLetter): number {
  return DIATONIC.indexOf(letter);
}

/** The three pitch classes (degrees) of the diatonic triad on `root`. */
export function triadDegrees(root: number): [number, number, number] {
  return [root % 7, (root + 2) % 7, (root + 4) % 7];
}

/** Triad quality in C major: C F G major, D E A minor, B diminished. */
export function triadQuality(root: number): "major" | "minor" | "diminished" {
  const r = ((root % 7) + 7) % 7;
  if (r === 0 || r === 3 || r === 4) return "major";
  if (r === 6) return "diminished";
  return "minor";
}

/** Chord symbol for a diatonic root degree: "Am", "F", "B°". */
export function chordName(root: number): string {
  const r = ((root % 7) + 7) % 7;
  const q = triadQuality(r);
  return DIATONIC[r] + (q === "minor" ? "m" : q === "diminished" ? "°" : "");
}
