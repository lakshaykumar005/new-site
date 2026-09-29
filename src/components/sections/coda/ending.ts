import { GLYPHS, STAFF_SPACE_UNITS, type Glyph } from "@/components/notation/glyphs";
import type { NoteEvent, Score } from "@/lib/music/compose";
import { CODA_GLYPHS } from "./glyphs";

/**
 * The last bar of the theme, engraved the way a piano score ends: two
 * staves tied by a brace, the melody's final note held above, the rolled
 * closing chord below with its wavy arpeggio line, "pp" dying away under
 * a long hairpin, and a final double barline with a fermata over it.
 *
 * Pure geometry in real pixels (the ending measures its container and
 * lays itself out 1:1, so hairlines stay hairlines on every screen).
 */

export type StaffName = "treble" | "bass";

export interface EndingHead {
  /** events that sound this notehead (the melody may double a chord tone) */
  ids: string[];
  staff: StaffName;
  step: number;
  x: number;
  y: number;
  ledgers: number[];
  dotX: number;
  dotY: number;
  melody: boolean;
  /** struck as part of the rolled chord (under the arpeggio line) */
  rolled: boolean;
}

export interface EndingStem {
  staff: StaffName;
  x: number;
  y1: number;
  y2: number;
  /**
   * How much of the stem (a fraction, from its top) lies above the first
   * note of the roll on its staff: when the chord is heard, that part grows
   * upward with the roll. 0 when nothing on this staff is rolled.
   */
  grow: number;
}

/** The wavy arpeggio line, and the span it covers (px, y down). */
export interface EndingRoll {
  transform: string;
  top: number;
  bottom: number;
}

export interface EndingLayout {
  width: number;
  height: number;
  s: number;
  trebleTop: number;
  bassTop: number;
  bassBottom: number;
  /** x where the system (and its staff lines) begins, and where the lines end */
  sysX: number;
  lineEnd: number;
  brace: string;
  gClef: string;
  fClef: string;
  heads: EndingHead[];
  headW: number;
  stems: EndingStem[];
  arpeggio: EndingRoll | null;
  /** two overlapped p's */
  dynamic: [string, string];
  hairpin: { x1: number; x2: number; y: number; open: number };
  bar: { thinX: number; thickX: number; thin: number; thick: number };
  fermata: string;
  /** the bar number printed above the start of the system, as scores do */
  barNumber: { text: string; x: number; y: number; size: number };
}

/** The notes that close a score: everything sounding in its last bar. */
export function finalChord(score: Score): NoteEvent[] {
  const last = score.bars[score.bars.length - 1];
  if (!last) return [];
  return score.events.filter((e) => e.beat >= last.start - 1e-6);
}

const k = (s: number) => s / STAFF_SPACE_UNITS;

/** transform that draws glyph `g` with its bbox centred on (cx, cy) */
function centred(g: Glyph, cx: number, cy: number, sx: number, sy = sx): string {
  const gx = (g.bounds[0] + g.bounds[2]) / 2;
  const gy = (g.bounds[1] + g.bounds[3]) / 2;
  return `translate(${cx} ${cy}) scale(${sx} ${-sy}) translate(${-gx} ${-gy})`;
}

/**
 * Staff space for a drawing this wide: roomy on desktop, still generous on
 * a phone. Exactly the CSS rule `clamp(8px, 2cqw, 11px)` that sizes the
 * drawing's box (see .ending in coda.module.css), unrounded, so the
 * viewBox and the box always agree and the drawing is never rescaled.
 */
export function spaceFor(width: number): number {
  return Math.min(11, Math.max(8, width / 50));
}

/**
 * Noto Music registers its F clef lower than its G clef: at y = 0 on the
 * bottom line its dots (glyph y 754.5 and 534.5) straddle a point 0.42 of a
 * space below the F line. Raised by this much, the dots sit either side of
 * the F line, the knob on it, and the top of the curl touches the top line.
 */
const F_CLEF_RAISE = (3 * STAFF_SPACE_UNITS - (754.5 + 534.5) / 2) / STAFF_SPACE_UNITS;

export function layoutEnding(score: Score, width: number, s = spaceFor(width)): EndingLayout {
  const events = finalChord(score);
  const kk = k(s);

  // ── vertical frame ────────────────────────────────────────
  // Every vertical measure is a multiple of the staff space, unrounded, so the
  // drawing is the same number of spaces tall at every width and the box CSS
  // reserves for it before hydration is already exact.
  //
  // The closing fermata is printed a little large: it has the whole piece to hold.
  const fermataK = kk * 1.3;
  const fermataG = GLYPHS.fermata;
  const fermataH = (fermataG.bounds[3] - fermataG.bounds[1]) * fermataK;
  const trebleTop = fermataH + 1.25 * s;
  const trebleBottom = trebleTop + 4 * s;
  const gap = 7 * s;
  const bassTop = trebleBottom + gap;
  const bassBottom = bassTop + 4 * s;

  // ── horizontal frame ─────────────────────────────────────
  const braceW = 1.25 * s;
  const sysX = braceW + 0.35 * s;
  const thick = 0.5 * s;
  const thin = 0.12 * s;
  // the barline sits on the column's right edge, with the letter's signature,
  // Fine. and the da capo; the fermata centred over it hangs a little past
  // (about a space), the way a printer hangs punctuation into the margin
  const lineEnd = width;
  const thickX = lineEnd - thick;
  const thinX = thickX - 0.2 * s - thin;

  // ── staves ───────────────────────────────────────────────
  const trebleStep = (dn: number) => dn - 30; // E4 on the bottom line
  const bassStep = (dn: number) => dn - 18; // G2 on the bottom line
  const yOf = (staff: StaffName, step: number) =>
    (staff === "treble" ? trebleBottom : bassBottom) - (step * s) / 2;

  const clefX = sysX + 0.5 * s;
  const gClef = `translate(${clefX} ${trebleBottom}) scale(${kk} ${-kk}) translate(${-GLYPHS.gClef.bounds[0]} 0)`;
  const fClef = `translate(${clefX} ${bassBottom - F_CLEF_RAISE * s}) scale(${kk} ${-kk}) translate(${-GLYPHS.fClef.bounds[0]} 0)`;
  const clefRight = clefX + (Math.max(GLYPHS.gClef.bounds[2], GLYPHS.fClef.bounds[2]) - 50) * kk;

  // ── the chord ────────────────────────────────────────────
  const headG = GLYPHS.noteheadHalf;
  const headW = (headG.bounds[2] - headG.bounds[0]) * kk;
  const arpW = (CODA_GLYPHS.arpeggiato.bounds[2] - CODA_GLYPHS.arpeggiato.bounds[0]) * kk;
  const accomp = events.filter((e) => e.voice === "accompaniment");
  const hasRoll = accomp.length > 1;
  const arpGap = 0.75 * s;
  const noteLeft = clefRight + 1.2 * s + (hasRoll ? arpW + arpGap : 0);
  const cx = noteLeft + headW / 2;

  const heads: EndingHead[] = [];
  for (const ev of events) {
    // the left hand takes everything up to the D above middle C
    const staff: StaffName = ev.voice === "melody" || ev.dn > 29 ? "treble" : "bass";
    const step = staff === "treble" ? trebleStep(ev.dn) : bassStep(ev.dn);
    const rolled = hasRoll && ev.voice === "accompaniment";
    const same = heads.find((h) => h.staff === staff && h.step === step);
    if (same) {
      same.ids.push(ev.id);
      same.melody ||= ev.voice === "melody";
      same.rolled ||= rolled;
      continue;
    }
    const y = yOf(staff, step);
    const ledgers: number[] = [];
    for (let l = -2; l >= step; l -= 2) ledgers.push(yOf(staff, l));
    for (let l = 10; l <= step; l += 2) ledgers.push(yOf(staff, l));
    heads.push({
      ids: [ev.id],
      staff,
      step,
      x: cx,
      y,
      ledgers,
      dotX: cx + headW / 2 + 0.55 * s,
      dotY: step % 2 === 0 ? y - s / 2 : y,
      melody: ev.voice === "melody",
      rolled,
    });
  }

  // one stem per staff, pointing away from the note farthest from the middle line
  const stems: EndingStem[] = [];
  for (const staff of ["treble", "bass"] as const) {
    const hs = heads.filter((h) => h.staff === staff);
    if (hs.length === 0) continue;
    const lo = Math.min(...hs.map((h) => h.step));
    const hi = Math.max(...hs.map((h) => h.step));
    const down = hi - 4 >= 4 - lo;
    const stemW = 0.12 * s;
    // an octave long, or longer if it has to reach back to the middle line
    const stem = down
      ? { x: cx - headW / 2 + stemW / 2, y1: yOf(staff, hi) + 0.15 * s, y2: yOf(staff, lo) + Math.max(3.5, (lo - 4) / 2) * s }
      : { x: cx + headW / 2 - stemW / 2, y1: yOf(staff, lo) - 0.15 * s, y2: yOf(staff, hi) - Math.max(3.5, (4 - hi) / 2) * s };
    const top = Math.min(stem.y1, stem.y2);
    const bottom = Math.max(stem.y1, stem.y2);
    const rolledHere = hs.filter((h) => h.rolled);
    const firstY = rolledHere.length > 1 ? Math.max(...rolledHere.map((h) => h.y)) : top;
    stems.push({ staff, ...stem, grow: Math.min(1, Math.max(0, (firstY - top) / (bottom - top))) });
  }

  // the roll: a wavy line from the lowest chord tone to the highest
  let arpeggio: EndingRoll | null = null;
  let crossStaff = false;
  const rolled = heads.filter((h) => h.rolled);
  if (rolled.length > 0) {
    crossStaff = new Set(rolled.map((h) => h.staff)).size > 1;
    const ys = rolled.map((h) => h.y);
    const top = Math.min(...ys) - 0.6 * s;
    const bottom = Math.max(...ys) + 0.6 * s;
    const g = CODA_GLYPHS.arpeggiato;
    const sy = (bottom - top) / (g.bounds[3] - g.bounds[1]);
    const ax = noteLeft - arpGap - arpW;
    arpeggio = {
      transform: `translate(${ax} ${bottom}) scale(${kk} ${-sy}) translate(${-g.bounds[0]} ${-g.bounds[1]})`,
      top,
      bottom,
    };
  }

  // "pp" between the staves, under the melody note, then a long hairpin to nothing
  const p = CODA_GLYPHS.piano;
  const dynY = trebleBottom + gap * 0.42;
  const bowl = 490; // centre of the p's bowl, font units
  const pAt = (x: number) =>
    `translate(${x} ${dynY}) scale(${kk} ${-kk}) translate(${-p.bounds[0]} ${-bowl})`;
  // (stepping right when the roll runs down between the staves beside it)
  const ppX = noteLeft + (crossStaff ? 0.3 : -0.35) * s;
  const second = 318 * kk;
  const ppRight = ppX + second + (p.bounds[2] - p.bounds[0]) * kk;
  const hairpin = {
    x1: ppRight + 1.1 * s,
    x2: Math.max(ppRight + 4 * s, thinX - 2.2 * s),
    y: dynY,
    open: 0.5 * s,
  };

  // the fermata: centred over the double bar, clear of the top line
  const fermataCx = (thinX + lineEnd) / 2;
  const fermataCy = trebleTop - 0.9 * s - fermataH / 2;

  // brace: the single-staff glyph, stretched to hold both staves
  const bg = CODA_GLYPHS.brace;
  const braceSy = (bassBottom - trebleTop) / (bg.bounds[3] - bg.bounds[1]);
  const braceSx = braceW / (bg.bounds[2] - bg.bounds[0]);
  const brace = `translate(0 ${bassBottom}) scale(${braceSx} ${-braceSy}) translate(${-bg.bounds[0]} ${-bg.bounds[1]})`;

  const lowest = Math.max(bassBottom + 1.8 * s, ...stems.map((st) => Math.max(st.y1, st.y2)));
  const height = lowest + 0.5 * s;

  return {
    width,
    height,
    s,
    trebleTop,
    bassTop,
    bassBottom,
    sysX,
    lineEnd,
    brace,
    gClef,
    fClef,
    heads,
    headW,
    stems,
    arpeggio,
    dynamic: [pAt(ppX), pAt(ppX + second)],
    hairpin,
    bar: { thinX, thickX, thin, thick },
    fermata: centred(fermataG, fermataCx, fermataCy, fermataK),
    // the pickup is bar 0, so the last bar's number is simply how many full bars there are
    barNumber: { text: String(score.bars.length), x: clefX + 0.15 * s, y: trebleTop - 1.85 * s, size: 1.45 * s },
  };
}
