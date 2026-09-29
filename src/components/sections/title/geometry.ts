import { GLYPHS, STAFF_SPACE_UNITS } from "@/components/notation/glyphs";
import { layoutScore } from "@/components/notation/layout";
import { normalizeWord, noteOfLetter } from "@/lib/music/cipher";
import type { Score } from "@/lib/music/compose";
import { letterOfDn } from "@/lib/music/theory";

/**
 * Geometry of the title: the name set in Bodoni Moda italic, and the
 * staff engraved beneath it with one note under the centre of each
 * letter.
 *
 * Everything is measured in ems of the name's font size, so the CSS can
 * fit the whole thing to the column from the very first paint
 * (`font-size: 100cqi / K`) and it stays true at every width without
 * any JavaScript. Once the real font has loaded the page re-measures the
 * letters and hands the measured advances back in here.
 */

/**
 * Bodoni Moda Italic at the title's settings (wght 500, opsz 96, −0.01em
 * tracking), measured in the browser at 1000px. Per glyph, in em:
 * [advance (tracking included), ink left, ink right, ink top, ink bottom].
 * Ink x is relative to the glyph's origin; ink bottom is its descent.
 */
const METRICS: Record<string, readonly [number, number, number, number, number]> = {
  a: [0.537, 0.028, 0.53, 0.47, 0.01],
  b: [0.488, 0.027, 0.462, 0.75, 0.01],
  c: [0.439, 0.029, 0.44, 0.47, 0.01],
  d: [0.543, 0.028, 0.566, 0.75, 0.01],
  e: [0.457, 0.026, 0.436, 0.47, 0.01],
  f: [0.343, -0.207, 0.513, 0.76, 0.26],
  g: [0.582, -0.051, 0.584, 0.47, 0.26],
  h: [0.552, 0.013, 0.54, 0.75, 0.01],
  i: [0.283, 0.034, 0.304, 0.756, 0.01],
  j: [0.252, -0.219, 0.295, 0.76, 0.26],
  k: [0.494, 0.013, 0.5, 0.75, 0.01],
  l: [0.28, 0.024, 0.3, 0.75, 0.01],
  m: [0.809, 0.022, 0.792, 0.47, 0.01],
  n: [0.566, 0.019, 0.543, 0.47, 0.01],
  o: [0.483, 0.029, 0.46, 0.47, 0.01],
  p: [0.542, -0.105, 0.497, 0.47, 0.25],
  q: [0.494, 0.024, 0.489, 0.47, 0.25],
  r: [0.442, 0.017, 0.413, 0.47, 0],
  s: [0.408, 0.013, 0.394, 0.47, 0.01],
  t: [0.318, 0.045, 0.332, 0.56, 0.01],
  u: [0.559, 0.028, 0.535, 0.46, 0.01],
  v: [0.502, 0.019, 0.473, 0.47, 0.01],
  w: [0.722, 0.015, 0.704, 0.47, 0.01],
  x: [0.511, -0.038, 0.538, 0.47, 0.01],
  y: [0.514, -0.059, 0.552, 0.47, 0.26],
  z: [0.405, -0.051, 0.399, 0.47, 0.01],
  A: [0.728, -0.046, 0.668, 0.765, 0],
  B: [0.631, -0.046, 0.646, 0.75, 0],
  C: [0.662, 0.054, 0.737, 0.76, 0.01],
  D: [0.702, -0.036, 0.713, 0.75, 0],
  E: [0.575, -0.046, 0.661, 0.75, 0],
  F: [0.554, -0.046, 0.65, 0.75, 0],
  G: [0.732, 0.054, 0.743, 0.76, 0.01],
  H: [0.726, -0.041, 0.831, 0.75, 0],
  I: [0.356, -0.041, 0.461, 0.75, 0],
  J: [0.446, -0.032, 0.552, 0.75, 0.031],
  K: [0.686, -0.041, 0.757, 0.75, 0],
  L: [0.564, -0.046, 0.545, 0.75, 0],
  M: [0.841, -0.026, 0.921, 0.75, 0.01],
  N: [0.712, -0.036, 0.818, 0.75, 0.01],
  O: [0.715, 0.054, 0.726, 0.76, 0.01],
  P: [0.613, -0.041, 0.653, 0.75, 0],
  Q: [0.711, 0.054, 0.726, 0.76, 0.25],
  R: [0.719, -0.039, 0.69, 0.75, 0.006],
  S: [0.556, -0.021, 0.602, 0.76, 0.015],
  T: [0.626, 0.074, 0.736, 0.75, 0],
  U: [0.681, 0.079, 0.786, 0.75, 0.015],
  V: [0.723, 0.119, 0.833, 0.75, 0.013],
  W: [0.99, 0.119, 1.1, 0.75, 0.01],
  X: [0.729, -0.051, 0.8, 0.75, 0],
  Y: [0.722, 0.119, 0.833, 0.75, 0],
  Z: [0.555, -0.051, 0.63, 0.75, 0],
  "-": [0.35, 0.083, 0.323, 0.276, -0.274],
  "'": [0.205, 0.139, 0.26, 0.76, -0.478],
  "’": [0.225, 0.113, 0.317, 0.787, -0.506],
  ".": [0.206, 0.014, 0.151, 0.127, 0.01],
  " ": [0.24, 0, 0, 0, 0],
};

const UNKNOWN = [0.5, 0.02, 0.48, 0.47, 0.01] as const;

/** Baseline of a `.t-title` line, from the top of its 0.92em line box. */
export const BASELINE = 0.822;
export const LINE = 0.92;

/**
 * An italic letter leans; the note beneath it should sit under the
 * letter's body, not under its upright advance box. Each glyph's ink
 * centre is slid back along the slant to the middle of the x-height.
 */
const SLANT = 0.24;
const SLANT_REF = 0.235;

/** SVG units per em of the name. */
export const U = 100;

/** Staff space, in ems of the name: the staff stands a little shorter than the x-height. */
const SPACE_EM = 0.11;

export interface TitleGlyph {
  ch: string;
  /** left edge of the advance box, em from the start of the name */
  left: number;
  adv: number;
  /** where the note goes, em from the start of the name */
  centre: number;
  /** index into `notes`, or null for anything that isn't a letter */
  note: number | null;
}

export interface TitleNote {
  id: string;
  /** index of the letter among the letters of the name */
  letter: number;
  glyph: number;
  name: string;
  midi: number;
  x: number;
  y: number;
  head: "noteheadBlack" | "noteheadHalf" | "wholeNote";
  stem: "up" | "down" | null;
  stemX: number;
  stemY1: number;
  stemY2: number;
  flags: 0 | 1 | 2;
  dot: boolean;
  dotX: number;
  dotY: number;
  ledgers: number[];
  headW: number;
  /** how far the notehead falls from under its letter, in SVG units */
  drop: number;
}

export interface TitleBar {
  x: number;
  /** the note whose landing draws this barline */
  after: number;
  final: boolean;
}

export interface TitleGeometry {
  glyphs: TitleGlyph[];
  /** name width (em) */
  E: number;
  /** how far the staff reaches past the name on each side (em) */
  ext: number;
  /** staff width = E + 2·ext (em) — the thing that is fitted to the column */
  K: number;
  /** tallest descender in the name (em) */
  descent: number;
  // SVG space (U units per em; y = 0 on the name's baseline)
  width: number;
  height: number;
  s: number;
  top: number;
  bottom: number;
  staffLeft: number;
  staffRight: number;
  clefX: number;
  notes: TitleNote[];
  bars: TitleBar[];
}

function metricsOf(ch: string) {
  return METRICS[ch] ?? METRICS[normalizeWord(ch)] ?? UNKNOWN;
}

const HEAD_W = (GLYPHS.noteheadBlack.bounds[2] - GLYPHS.noteheadBlack.bounds[0]) / STAFF_SPACE_UNITS;
const HEAD_H = (GLYPHS.noteheadBlack.bounds[3] - GLYPHS.noteheadBlack.bounds[1]) / STAFF_SPACE_UNITS;
const CLEF_W = (GLYPHS.gClef.bounds[2] - GLYPHS.gClef.bounds[0]) / STAFF_SPACE_UNITS;
/** staff start → clef, clef → first notehead (staff spaces) */
const CLEF_PAD = 0.25;
const CLEF_GAP = 1.6;

/**
 * @param measured optional advances (em) measured from the rendered letters;
 *   they replace the table's once the real font is on screen.
 */
export function titleGeometry(name: string, score: Score, measured?: readonly number[]): TitleGeometry {
  const chars = Array.from(name);
  const sp = SPACE_EM;
  const s = sp * U;

  // ── the name ─────────────────────────────────────────────
  const glyphs: TitleGlyph[] = [];
  const letterGlyph: number[] = [];
  let x = 0;
  let inkL = Infinity;
  let inkR = -Infinity;
  let descent = 0;
  chars.forEach((ch, gi) => {
    const m = metricsOf(ch);
    const known = m !== UNKNOWN;
    const [tAdv, l, r, top, desc] = m;
    const adv = measured?.[gi] ?? tAdv;
    const k = adv / tAdv;
    const inkMid = known ? ((l + r) / 2) * k : adv / 2;
    const lean = known ? SLANT * ((top - desc) / 2 - SLANT_REF) : 0;
    const isLetter = noteOfLetter(ch) !== null;
    glyphs.push({ ch, left: x, adv, centre: x + inkMid - lean, note: null });
    if (isLetter) letterGlyph.push(gi);
    if (ch.trim()) {
      inkL = Math.min(inkL, x + l * k);
      inkR = Math.max(inkR, x + r * k);
      descent = Math.max(descent, desc);
    }
    x += adv;
  });
  const E = x;
  if (!Number.isFinite(inkL)) {
    inkL = 0;
    inkR = E;
  }

  // ── engraving, borrowed from the foundation ───────────────
  // Lay the melody out as a normal line, then keep every note's own
  // shape (head, stem, flag, dot) and move it under its letter.
  const laid = layoutScore(score, { width: 100000, space: s, clef: false, time: false });

  // The staff sits a little under the baseline, further when letters descend.
  const gap = descent > 0.05 ? descent + 0.1 + sp * 1.35 : 0.3;
  const top = gap * U;
  const bottom = top + 4 * s;
  const yOf = (y: number) => bottom + (y - laid.bottom);

  // Where a notehead lets go of its letter: just under the baseline.
  const release = 0.04 * U + (HEAD_H / 2) * s;

  const notes: TitleNote[] = laid.notes.map((n, k) => {
    const ev = n.ev;
    const letter = ev.letter ?? k;
    const gi = letterGlyph[letter] ?? Math.min(k, glyphs.length - 1);
    const cx = glyphs[gi].centre * U;
    const cy = yOf(n.y);
    const head = n.head === "whole" ? "wholeNote" : n.head === "half" ? "noteheadHalf" : "noteheadBlack";
    return {
      id: ev.id,
      letter,
      glyph: gi,
      name: letterOfDn(ev.dn),
      midi: ev.midi,
      x: cx,
      y: cy,
      head,
      stem: n.stem,
      stemX: cx + (n.stemX - n.x),
      stemY1: n.stem === "up" ? cy - 0.15 * s : cy + 0.15 * s,
      stemY2: yOf(n.stemEnd),
      flags: n.flags,
      dot: n.dot,
      dotX: cx + (n.dotX - n.x),
      dotY: yOf(n.dotY),
      ledgers: n.ledgers.map(yOf),
      headW: n.headW,
      drop: Math.max(0, cy - release),
    };
  });
  notes.forEach((n, k) => {
    glyphs[n.glyph].note = k;
  });

  // ── how far the staff must reach past the name ───────────
  const first = notes[0];
  const last = notes[notes.length - 1];
  const needLeft = first ? -(first.x / U - (HEAD_W / 2 + CLEF_GAP + CLEF_W + CLEF_PAD) * sp) : 0;
  const lastRight = last ? last.x / U + (HEAD_W / 2 + (last.dot ? 0.75 : 0) + 1.6 + 0.6) * sp : 0;
  const needRight = lastRight - E;
  const ext = Math.max(needLeft, needRight, -inkL + 0.02, inkR - E + 0.02, 0.6 * sp);
  const K = E + 2 * ext;

  // shift everything so the SVG starts at the staff's left end
  const dx = ext * U;
  for (const n of notes) {
    n.x += dx;
    n.stemX += dx;
    n.dotX += dx;
  }

  const staffLeft = 0;
  const staffRight = K * U;
  const clefX = staffLeft + CLEF_PAD * s;

  // barlines: between the letters where a new bar begins, and a final double bar
  const bars: TitleBar[] = [];
  for (const bar of score.bars) {
    if (bar.start <= 1e-6) continue;
    const j = score.melody.findIndex((m) => m.beat >= bar.start - 1e-6);
    if (j <= 0) continue;
    const a = notes[j - 1];
    const b = notes[j];
    // halfway between the two notes, nudged clear of a dot
    let bx = (a.x + b.x) / 2;
    if (a.dot) bx = Math.max(bx, a.dotX + 0.9 * s);
    bars.push({ x: Math.min(bx, b.x - b.headW / 2 - 0.7 * s), after: j, final: false });
  }
  if (last) bars.push({ x: staffRight - 0.1 * s, after: notes.length - 1, final: true });

  const height = bottom + 2.2 * s;

  return {
    glyphs,
    E,
    ext,
    K,
    descent,
    width: staffRight,
    height,
    s,
    top,
    bottom,
    staffLeft,
    staffRight,
    clefX,
    notes,
    bars,
  };
}
