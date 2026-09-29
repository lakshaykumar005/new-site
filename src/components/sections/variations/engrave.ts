import { GLYPHS, STAFF_SPACE_UNITS } from "@/components/notation/glyphs";
import { layoutScore, type HeadKind, type ScoreLayout } from "@/components/notation/layout";
import { variationsCopy, type VariationCopy } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { compose, VARIATION_ORDER, type Score, type VariationId } from "@/lib/music/compose";

/**
 * The six variations, engraved for one staff.
 *
 * The kaleidoscope shows one staff and turns it into each variation
 * in turn, so all six are engraved at the same size on the same frame
 * (one clef, one staff, one letter row), and every note is filed by the
 * letter it spells: letter 3 of the theme and letter 3 of the retrograde
 * are the same note in two positions, and the morph glides between them.
 */

/** The note that carries the beat in a metronome mark. */
export type BeatUnit = "half" | "quarter" | "eighth";

export interface Tempo {
  unit: BeatUnit;
  perMinute: number;
  /** its length in score beats */
  pulse: number;
}

export interface Variation {
  id: VariationId;
  index: number;
  score: Score;
  copy: VariationCopy;
  tempo: Tempo;
  /** written time signature, "3/4" */
  time: string;
}

/** Largest staff space, in px (a 48px staff). */
export const SPACE_MAX = 12;
/** Width assumed before the plate has been measured (a phone). */
export const DEFAULT_WIDTH = 350;

/**
 * compose() keeps the quarter as its beat and stretches or squeezes the
 * written values instead, so the mark counts the note that carries the
 * pulse: the lullaby's half note, the allegro's eighth.
 */
function tempoOf(score: Score): Tempo {
  const scale = score.barBeats / 3;
  const [unit, pulse]: [BeatUnit, number] = scale > 1.5 ? ["half", 2] : scale < 0.75 ? ["eighth", 0.5] : ["quarter", 1];
  return { unit, pulse, perMinute: Math.round(score.bpm / pulse) };
}

export const VARIATIONS: readonly Variation[] = VARIATION_ORDER.map((id, index) => {
  const score = compose(HER_NAME, id);
  return { id, index, score, copy: variationsCopy.items[id], tempo: tempoOf(score), time: score.time.join("/") };
});

export const COUNT = VARIATIONS.length;

/** How many letters the name spells — every variation has one note per letter. */
export const LETTERS = VARIATIONS[0].score.melody.length;

/** One note, as it sits on the shared frame. Everything but x, y is relative to the notehead's centre. */
export interface Pose {
  x: number;
  y: number;
  head: HeadKind;
  /** stem end relative to the centre: negative = up, 0 = no stem */
  stemDy: number;
  /** stem x relative to the centre (its side) */
  stemDx: number;
  flags: 0 | 1 | 2;
  dot: boolean;
  dotDx: number;
  dotDy: number;
  /** ledger lines, as staff steps (even numbers off the staff) */
  ledgers: number[];
  /** half the width of a ledger line */
  ledgerHalf: number;
  headW: number;
}

/** One variation, engraved onto the shared frame. */
export interface Engraved {
  id: VariationId;
  index: number;
  score: Score;
  time: string;
  /** poses by letter index */
  poses: Pose[];
  /** the plain barlines, left to right */
  bars: number[];
  /** x of the final double bar */
  finalX: number;
  /** where the staff lines end (flush with the final bar) */
  staffEnd: number;
  /** where the music begins, after the clef and time signature */
  musicStart: number;
  beatToX: (beat: number) => number;
}

export interface Frame {
  width: number;
  height: number;
  /** staff space in px */
  s: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  clefX: number;
  timeX: number;
  /** baseline of the letter row */
  labelY: number;
}

export interface Engraving {
  frame: Frame;
  sheets: Engraved[];
  /** every ledger step any note ever needs, per letter */
  ledgerSteps: number[][];
  /** the most barlines any variation has */
  maxBars: number;
  /** every distinct time signature */
  times: string[];
}

const STEM_W = 0.12;

function stepOfY(l: ScoreLayout, y: number): number {
  return Math.round(((l.bottom - y) * 2) / l.s);
}

/** Engrave all six for a width: one staff size (the largest the widest allows), one frame. */
export function engrave(width: number): Engraving {
  const opts = { width, clef: true, time: true, letters: true };
  // the size the widest variation can be printed at is the size for all
  let s = SPACE_MAX;
  for (const v of VARIATIONS) s = Math.min(s, layoutScore(v.score, { ...opts, space: SPACE_MAX }).s);
  let layouts = VARIATIONS.map((v) => layoutScore(v.score, { ...opts, space: s }));
  const s2 = Math.min(...layouts.map((l) => l.s));
  if (s2 < s - 1e-6) {
    s = s2;
    layouts = VARIATIONS.map((v) => layoutScore(v.score, { ...opts, space: s }));
  }

  // one frame tall enough for every variation: the staff sits where the
  // tallest reach above it demands, the letters where the deepest below
  const top = Math.max(...layouts.map((l) => l.top));
  const shifts = layouts.map((l) => top - l.top);
  const labelY = Math.max(...layouts.map((l, i) => l.labelY + shifts[i]));
  const height = labelY + 1.2 * s + 2;
  const first = layouts[0];
  const frame: Frame = {
    width,
    height,
    s,
    top,
    bottom: top + 4 * s,
    left: first.left,
    right: first.right,
    clefX: first.clef?.x ?? first.left,
    timeX: first.time?.x ?? first.left,
    labelY,
  };

  const ledgerSteps: Set<number>[] = Array.from({ length: LETTERS }, () => new Set<number>());
  const sheets: Engraved[] = layouts.map((l, i) => {
    const v = VARIATIONS[i];
    const dy = shifts[i];
    const poses: Pose[] = new Array(LETTERS);
    for (const n of l.notes) {
      const letter = n.ev.letter ?? 0;
      const ledgers = n.ledgers.map((y) => stepOfY(l, y));
      for (const st of ledgers) ledgerSteps[letter]?.add(st);
      const stemW = STEM_W * s;
      poses[letter] = {
        x: n.x,
        y: n.y + dy,
        head: n.head,
        stemDy: n.stem ? n.stemEnd - n.y : 0,
        stemDx: n.stem === "up" ? n.headW / 2 - stemW / 2 : -n.headW / 2 + stemW / 2,
        flags: n.flags,
        dot: n.dot,
        dotDx: n.dotX - n.x,
        dotDy: n.dotY - n.y,
        ledgers,
        ledgerHalf: n.headW / 2 + 0.42 * s,
        headW: n.headW,
      };
    }
    const bars = l.bars.filter((b) => b.kind === "single").map((b) => b.x);
    const finalX = l.bars.find((b) => b.kind === "final")?.x ?? l.right;
    const firstNote = l.notes[0];
    return {
      id: v.id,
      index: i,
      score: v.score,
      time: v.time,
      poses,
      bars,
      finalX,
      staffEnd: Math.min(l.right, finalX + 0.1 * s),
      musicStart: firstNote ? firstNote.x - firstNote.headW / 2 - 0.5 * s : l.left,
      beatToX: l.beatToX,
    };
  });

  return {
    frame,
    sheets,
    ledgerSteps: ledgerSteps.map((set) => Array.from(set).sort((a, b) => a - b)),
    maxBars: Math.max(...sheets.map((sh) => sh.bars.length)),
    times: Array.from(new Set(sheets.map((sh) => sh.time))),
  };
}

/** y of a staff step on the frame (0 = bottom line, 8 = top line). */
export function stepY(frame: Frame, step: number): number {
  return frame.bottom - (step * frame.s) / 2;
}

export const HEAD_GLYPH: Record<HeadKind, keyof typeof GLYPHS> = {
  black: "noteheadBlack",
  half: "noteheadHalf",
  whole: "wholeNote",
};

export const CLEF_W = ((GLYPHS.gClef.bounds[2] - GLYPHS.gClef.bounds[0]) / STAFF_SPACE_UNITS) as number;

/**
 * The rest of a score from a beat on, moved to start at 0 — what plays
 * when the dial is turned mid-piece and the new variation takes over
 * at the same point.
 */
export function tailOf(score: Score, fromBeat: number): Score {
  const eps = 1e-6;
  if (fromBeat <= eps) return score;
  const keep = <T extends { beat: number }>(e: T) => e.beat >= fromBeat - eps;
  const move = <T extends { beat: number }>(e: T): T => ({ ...e, beat: e.beat - fromBeat });
  return {
    ...score,
    pickup: 0,
    length: Math.max(0, score.length - fromBeat),
    bars: score.bars
      .filter((b) => b.end > fromBeat + eps)
      .map((b) => ({ ...b, start: Math.max(0, b.start - fromBeat), end: b.end - fromBeat })),
    events: score.events.filter(keep).map(move),
    melody: score.melody.filter(keep).map(move),
  };
}
