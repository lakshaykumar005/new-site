import { GLYPHS, STAFF_SPACE_UNITS } from "@/components/notation/glyphs";
import { layoutScore } from "@/components/notation/layout";
import { normalizeWord, noteOfLetter } from "@/lib/music/cipher";
import type { Score } from "@/lib/music/compose";
import { letterOfDn } from "@/lib/music/theory";

/**
 * Geometry of the title: the name set in Cormorant Garamond italic, and the
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
 * Cormorant Garamond Italic at the title's settings (wght 500, −0.01em
 * tracking), measured in the browser at 1000px. Per glyph, in em:
 * [advance (tracking included), ink left, ink right, ink top, ink bottom].
 * Ink x is relative to the glyph's origin; ink bottom is its descent.
 */
const METRICS: Record<string, readonly [number, number, number, number, number]> = {
  a: [0.427, 0.013, 0.422, 0.41, 0.013],
  b: [0.429, 0.04, 0.431, 0.727, 0.013],
  c: [0.336, 0.025, 0.341, 0.399, 0.013],
  d: [0.436, 0.017, 0.462, 0.727, 0.013],
  e: [0.337, 0.021, 0.338, 0.399, 0.012],
  f: [0.254, -0.113, 0.401, 0.726, 0.275],
  g: [0.372, -0.049, 0.393, 0.394, 0.281],
  h: [0.438, 0.035, 0.435, 0.727, 0.009],
  i: [0.237, 0.022, 0.226, 0.601, 0.009],
  j: [0.232, -0.095, 0.231, 0.601, 0.275],
  k: [0.405, 0.035, 0.419, 0.727, 0.009],
  l: [0.23, 0.049, 0.236, 0.727, 0.009],
  m: [0.669, 0.018, 0.665, 0.399, 0.009],
  n: [0.458, 0.018, 0.454, 0.399, 0.009],
  o: [0.391, 0.021, 0.383, 0.399, 0.014],
  p: [0.396, -0.066, 0.392, 0.465, 0.276],
  q: [0.407, 0.016, 0.396, 0.41, 0.276],
  r: [0.335, 0.016, 0.353, 0.395, 0.008],
  s: [0.296, 0.005, 0.29, 0.396, 0.011],
  t: [0.287, 0.047, 0.303, 0.458, 0.012],
  u: [0.458, 0.017, 0.45, 0.395, 0.013],
  v: [0.427, 0.02, 0.406, 0.396, 0.013],
  w: [0.611, 0.02, 0.59, 0.396, 0.013],
  x: [0.414, -0.006, 0.422, 0.395, 0.01],
  y: [0.436, -0.066, 0.411, 0.396, 0.281],
  z: [0.334, -0.01, 0.358, 0.398, 0.008],
  A: [0.592, -0.038, 0.57, 0.639, 0],
  B: [0.524, 0.009, 0.498, 0.628, 0.004],
  C: [0.576, 0.054, 0.59, 0.636, 0.013],
  D: [0.61, 0.009, 0.616, 0.627, 0.004],
  E: [0.509, 0.015, 0.518, 0.625, 0],
  F: [0.474, 0.011, 0.516, 0.625, 0],
  G: [0.621, 0.05, 0.607, 0.636, 0.012],
  H: [0.662, 0.009, 0.703, 0.625, 0],
  I: [0.307, 0.019, 0.34, 0.625, 0],
  J: [0.282, -0.03, 0.33, 0.625, 0.194],
  K: [0.594, 0.009, 0.634, 0.625, 0],
  L: [0.489, 0.01, 0.482, 0.625, 0],
  M: [0.725, 0.013, 0.769, 0.625, 0],
  N: [0.642, 0.005, 0.696, 0.625, 0.015],
  O: [0.642, 0.051, 0.647, 0.636, 0.012],
  P: [0.502, 0.011, 0.528, 0.628, 0],
  Q: [0.642, 0.051, 0.692, 0.636, 0.197],
  R: [0.61, 0.012, 0.599, 0.628, 0],
  S: [0.455, 0.041, 0.456, 0.636, 0.012],
  T: [0.543, 0.074, 0.608, 0.653, 0],
  U: [0.609, 0.082, 0.681, 0.625, 0.013],
  V: [0.585, 0.075, 0.668, 0.625, 0.003],
  W: [0.816, 0.074, 0.899, 0.625, 0.003],
  X: [0.569, -0.023, 0.625, 0.625, 0],
  Y: [0.521, 0.069, 0.605, 0.625, 0],
  Z: [0.54, 0.011, 0.576, 0.657, 0.002],
  "-": [0.295, 0.027, 0.284, 0.26, -0.166],
  "'": [0.122, 0.068, 0.194, 0.641, -0.299],
  "’": [0.176, 0.081, 0.219, 0.634, -0.371],
  ".": [0.19, 0.024, 0.117, 0.082, 0.01],
  " ": [0.224, 0, 0, 0, 0],
};

const UNKNOWN = [0.4, 0.02, 0.39, 0.4, 0.01] as const;

/** Baseline of a `.t-title` line, from the top of its 0.92em line box. */
export const BASELINE = 0.822;
export const LINE = 0.92;

/**
 * An italic letter leans; the note beneath it should sit under the
 * letter's body, not under its upright advance box. Each glyph's ink
 * centre is slid back along the slant to the middle of the x-height.
 */
const SLANT = 0.24;
const SLANT_REF = 0.198;

/** SVG units per em of the name. */
export const U = 100;

/** Staff space, in ems of the name: the staff stands a little taller than the x-height. */
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
