import { layoutScore } from "@/components/notation/layout";
import { variationsCopy, type VariationCopy } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { compose, VARIATION_ORDER, type Score, type VariationId } from "@/lib/music/compose";

/**
 * The six systems of the page, and how big to engrave them.
 *
 * A printed page keeps one staff size (one rastral) for every system,
 * so the space is chosen once for the whole page: as large as the
 * widest line allows at the measured column width, never larger than
 * a comfortable reading size. Every line is then justified to both
 * margins, the way engravers set a page.
 *
 * When a variation won't fit on one line at a legible size (a long
 * name, a narrow phone) it is broken in two at a barline, the way an
 * engraver breaks a system: the clef is repeated, the time signature
 * is not, and the first line ends on a plain barline.
 */

/** The note that carries the beat in a metronome mark. */
export type BeatUnit = "half" | "quarter" | "eighth";

/** One engraved line: a whole variation, or one half of a broken one. */
export interface Staff {
  score: Score;
  /** where this line starts in the piece, in beats */
  offset: number;
  /** only a system's first line carries the time signature */
  time: boolean;
  /** the music carries on to the next line: end on a plain barline, not the final double bar */
  continues: boolean;
  /** how many staff spaces wide it is before justification */
  span: number;
  /** height of the engraved line in staff spaces (plus 2px), from its pitch range */
  heightInSpaces: number;
}

export interface MusicSystem {
  id: VariationId;
  score: Score;
  copy: VariationCopy;
  /** the variation on one line */
  whole: Staff;
  /** the metronome mark: the note that gets the beat, how many a minute, and its length in score beats */
  tempo: { unit: BeatUnit; perMinute: number; pulse: number };
}

/** Largest staff space, in px (a 48px staff on a desktop page). */
export const SPACE_MAX = 12;

/** Smallest staff space a variation is printed at on one line; any smaller and it is broken in two. */
export const SPACE_MIN = 6;

/** Column width assumed before the page has been measured (a phone). */
export const DEFAULT_WIDTH = 350;

const EPS = 1e-6;

/** How many staff spaces a line needs to fit without stretching. */
function spanOf(score: Score, time: boolean): number {
  const width = 1000;
  let lo = 1;
  let hi = 100;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    // layoutScore only ever shrinks the space it is given, and only when the line would overflow
    if (layoutScore(score, { width, space: mid, time, letters: true }).s >= mid - 1e-9) lo = mid;
    else hi = mid;
  }
  return width / lo;
}

function staffOf(score: Score, offset: number, time: boolean, continues: boolean): Staff {
  const probe = layoutScore(score, { width: 1000, space: 10, time, letters: true });
  return {
    score,
    offset,
    time,
    continues,
    span: spanOf(score, time),
    heightInSpaces: (probe.height - 2) / probe.s,
  };
}

/** The bars of a score from one beat up to another, moved to start at beat 0. */
function slice(score: Score, from: number, to: number): Score {
  const inside = (beat: number) => beat > from - EPS && beat < to - EPS;
  const move = <T extends { beat: number }>(e: T): T => ({ ...e, beat: e.beat - from });
  const melody = score.melody.filter((e) => inside(e.beat)).map(move);
  const first = score.melody.findIndex((e) => inside(e.beat));
  return {
    ...score,
    notes: first < 0 ? [] : score.notes.slice(first, first + melody.length),
    pickup: from < EPS ? score.pickup : 0,
    length: to - from,
    bars: score.bars.filter((b) => inside(b.start)).map((b) => ({ ...b, start: b.start - from, end: b.end - from })),
    events: score.events.filter((e) => inside(e.beat)).map(move),
    melody,
  };
}

/** Break a variation in two at the barline that leaves the longer line shortest. */
function breakInTwo(score: Score): [Staff, Staff] | null {
  let best: [Staff, Staff] | null = null;
  // never after the upbeat alone: the first line keeps at least one full bar
  for (const bar of score.bars.slice(1)) {
    const a = staffOf(slice(score, 0, bar.start), 0, true, true);
    const b = staffOf(slice(score, bar.start, score.length), bar.start, false, false);
    if (!best || Math.max(a.span, b.span) < Math.max(best[0].span, best[1].span)) best = [a, b];
  }
  return best;
}

/**
 * compose() keeps the quarter as its beat and stretches or squeezes the
 * written values instead (the lullaby's are doubled, the allegro's
 * halved), so the mark counts the note that carries the pulse: the
 * lullaby's half note, the allegro's eighth. Then the numbers tell the
 * same story as the captions — 88, half the speed, twice as fast.
 */
function tempoOf(score: Score): MusicSystem["tempo"] {
  const scale = score.barBeats / 3;
  const [unit, pulse]: [BeatUnit, number] = scale > 1.5 ? ["half", 2] : scale < 0.75 ? ["eighth", 0.5] : ["quarter", 1];
  return { unit, pulse, perMinute: Math.round(score.bpm / pulse) };
}

export const SYSTEMS: MusicSystem[] = VARIATION_ORDER.map((id) => {
  const score = compose(HER_NAME, id);
  return {
    id,
    score,
    copy: variationsCopy.items[id],
    whole: staffOf(score, 0, true, false),
    tempo: tempoOf(score),
  };
});

/** The page's width in staff spaces with every variation on one line (a hair wider, for rounding). */
export const PAGE_SPAN = Math.max(...SYSTEMS.map((s) => s.whole.span)) * 1.0005;

// worked out only for a column that needs them (most never do)
const broken = new Map<VariationId, [Staff, Staff] | null>();
function halvesOf(system: MusicSystem): [Staff, Staff] | null {
  if (!broken.has(system.id)) broken.set(system.id, breakInTwo(system.score));
  return broken.get(system.id) ?? null;
}

export interface Page {
  /** the one staff space for every line on the page, in px */
  space: number;
  /** each system's lines: one, or two when it is broken */
  lines: Staff[][];
}

/** Set the page for a column width: break what must be broken, then size the staff to the widest line. */
export function engrave(width: number): Page {
  const lines = SYSTEMS.map((s) => (s.whole.span * SPACE_MIN > width && halvesOf(s)) || [s.whole]);
  const span = Math.max(...lines.flat().map((l) => l.span)) * 1.0005;
  return { space: Math.min(SPACE_MAX, width / span), lines };
}
