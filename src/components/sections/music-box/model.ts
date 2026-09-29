import { HER_NAME } from "@/content/site";
import { noteOfLetter } from "@/lib/music/cipher";
import { compose, type NoteEvent } from "@/lib/music/compose";
import { nameOfDn } from "@/lib/music/theory";

/**
 * Everything the paper strip needs, derived once from the theme:
 * which rows it has (one per distinct pitch, highest at the top),
 * where each hole is punched, and how long the loop of paper is.
 */

export interface Hole {
  /** index into `events` */
  i: number;
  /** onset, in beats from the start of the loop */
  beat: number;
  /** row index (0 = highest pitch) */
  row: number;
  ev: NoteEvent;
}

export interface Row {
  dn: number;
  /** "F5" */
  label: string;
}

export interface NameLetter {
  ch: string;
  /** position among the letters of the name, or null for spaces, hyphens… */
  index: number | null;
}

export interface BoxModel {
  holes: Hole[];
  rows: Row[];
  /** beats of paper in one loop: the piece, rounded up to whole bars */
  loop: number;
  bpm: number;
  barBeats: number;
  /** beats of the loop that carry a bar line */
  barLines: number[];
  /** where the two ends of the paper are glued into a loop */
  seam: number;
  letters: NameLetter[];
}

function buildModel(word: string): BoxModel {
  const score = compose(word, "theme");
  const events = score.events;

  const pitches = [...new Set(events.map((e) => e.dn))].sort((a, b) => b - a);
  const rowOf = new Map(pitches.map((dn, r) => [dn, r]));
  const rows = pitches.map((dn) => ({ dn, label: nameOfDn(dn) }));

  const bar = score.barBeats || 3;
  // a whole number of bars, so the metre survives the join
  const loop = Math.max(bar, Math.ceil(score.length / bar - 1e-9) * bar);

  const holes = events.map((ev, i) => ({ i, beat: ev.beat, row: rowOf.get(ev.dn) ?? 0, ev }));

  const barLines: number[] = [];
  const first = ((score.pickup % bar) + bar) % bar;
  for (let b = first; b < loop - 1e-9; b += bar) barLines.push(b);

  // the splice sits in the middle of the silence between the last onset and the loop's end
  const last = events.length ? events[events.length - 1].beat : 0;
  const seam = (last + loop) / 2;

  const letters: NameLetter[] = [];
  let n = 0;
  for (const ch of Array.from(word)) {
    letters.push({ ch, index: noteOfLetter(ch) ? n++ : null });
  }

  return { holes, rows, loop, bpm: score.bpm, barBeats: bar, barLines, seam, letters };
}

export const MODEL: BoxModel = buildModel(HER_NAME);
