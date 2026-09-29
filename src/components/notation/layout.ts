import type { NoteEvent, Score } from "@/lib/music/compose";
import { trebleStep } from "@/lib/music/theory";
import { GLYPHS, STAFF_SPACE_UNITS } from "./glyphs";

/**
 * Engraves a melody onto one treble staff: note spacing grows with
 * the square root of duration (as engravers space music), stems follow
 * the middle-line rule, eighths get flags, dotted values get dots,
 * and anything off the staff gets ledger lines.
 *
 * Pure geometry — `ScoreLine` draws it, sections can reuse it for
 * bespoke animation (see the title page).
 */

export type HeadKind = "black" | "half" | "whole";

export interface LaidNote {
  ev: NoteEvent;
  /** notehead centre */
  x: number;
  y: number;
  step: number;
  head: HeadKind;
  stem: "up" | "down" | null;
  /** stem x and its far end */
  stemX: number;
  stemEnd: number;
  flags: 0 | 1 | 2;
  dot: boolean;
  dotX: number;
  dotY: number;
  ledgers: number[];
  headW: number;
}

export interface LaidBar {
  x: number;
  kind: "single" | "final";
}

export interface ScoreLayout {
  width: number;
  height: number;
  /** staff space in px */
  s: number;
  /** y of the top and bottom staff lines */
  top: number;
  bottom: number;
  left: number;
  right: number;
  clef: { x: number } | null;
  time: { x: number; top: string; bottom: string } | null;
  notes: LaidNote[];
  bars: LaidBar[];
  /** baseline of the letter row under the staff */
  labelY: number;
  beatToX: (beat: number) => number;
}

export interface LayoutOptions {
  width: number;
  /** staff space; shrinks automatically if the line would overflow */
  space?: number;
  clef?: boolean;
  time?: boolean;
  /** reserve a row for letters under the staff */
  letters?: boolean;
  /** extra room at the sides */
  inset?: number;
}

const HEAD_BLACK_W = GLYPHS.noteheadBlack.bounds[2] - GLYPHS.noteheadBlack.bounds[0];
const HEAD_WHOLE_W = GLYPHS.wholeNote.bounds[2] - GLYPHS.wholeNote.bounds[0];
const CLEF_W = GLYPHS.gClef.bounds[2] - GLYPHS.gClef.bounds[0];

function headKind(dur: number): HeadKind {
  if (dur >= 5.5) return "whole";
  if (dur >= 2) return "half";
  return "black";
}

function isDotted(dur: number): boolean {
  const eps = 1e-6;
  return [0.75, 1.5, 3].some((d) => Math.abs(dur - d) < eps);
}

function flagCount(dur: number): 0 | 1 | 2 {
  if (dur >= 1 - 1e-6) return 0;
  if (dur >= 0.5 - 1e-6) return 1;
  return 2;
}

/** Natural horizontal room a note asks for, in staff spaces. */
function slot(dur: number): number {
  return 1.9 + 1.55 * Math.sqrt(Math.max(0.25, dur));
}

type Item = { kind: "note"; ev: NoteEvent } | { kind: "bar"; beat: number; final: boolean };

export function layoutScore(score: Score, opts: LayoutOptions): ScoreLayout {
  const inset = opts.inset ?? 0;
  const width = opts.width;
  const melody = score.melody;

  const items: Item[] = [];
  for (const bar of score.bars) {
    if (bar.start > 1e-6) items.push({ kind: "bar", beat: bar.start, final: false });
  }
  for (const ev of melody) items.push({ kind: "note", ev });
  items.sort((a, b) => {
    const ba = a.kind === "bar" ? a.beat : a.ev.beat;
    const bb = b.kind === "bar" ? b.beat : b.ev.beat;
    if (Math.abs(ba - bb) > 1e-6) return ba - bb;
    return a.kind === "bar" ? -1 : 1;
  });

  const natural = (s: number) => {
    let w = 0;
    for (const it of items) w += it.kind === "note" ? slot(it.ev.dur) * s : 1.6 * s;
    return w + 1.2 * s;
  };

  let s = opts.space ?? 10;
  const headerW = (sp: number) =>
    (opts.clef !== false ? (CLEF_W / STAFF_SPACE_UNITS) * sp + 1.1 * sp : 0.6 * sp) +
    (opts.time !== false ? 2.4 * sp : 0);

  // shrink until it fits (never below 5px spaces)
  for (let i = 0; i < 8; i++) {
    const avail = width - inset * 2 - headerW(s) - 0.8 * s;
    if (natural(s) <= avail || s <= 5) break;
    s = Math.max(5, s * Math.max(0.7, avail / natural(s)));
  }

  const k = s / STAFF_SPACE_UNITS;
  const headW = HEAD_BLACK_W * k;
  const wholeW = HEAD_WHOLE_W * k;

  // vertical extent of the notes, to size the canvas
  const steps = melody.map((e) => trebleStep(e.dn));
  const maxStep = Math.max(8, ...steps);
  const minStep = Math.min(0, ...steps);

  const stemLen = (step: number) => Math.max(3.5, Math.abs(4 - step) / 2);

  // how far anything reaches above the top line / below the bottom line (in spaces)
  let above = 1.5; // clef top
  let below = 1.7; // clef tail
  for (const step of steps) {
    const up = step < 4;
    const noteAbove = (step - 8) / 2;
    const noteBelow = -step / 2;
    if (up) {
      above = Math.max(above, noteAbove + stemLen(step) + 0.2);
      below = Math.max(below, noteBelow + 0.6);
    } else {
      above = Math.max(above, noteAbove + 0.6);
      below = Math.max(below, noteBelow + stemLen(step) + 0.2);
    }
  }
  above = Math.max(above, (maxStep - 8) / 2 + 0.8);
  below = Math.max(below, -minStep / 2 + 0.8);

  const top = (above + 0.6) * s;
  const bottom = top + 4 * s;
  const labelY = bottom + (below + 1.7) * s;
  const height = (opts.letters ? labelY + 1.1 * s : bottom + (below + 0.6) * s) + 2;

  const left = inset;
  const right = width - inset;

  let x = left + 0.3 * s;
  const clef = opts.clef !== false ? { x } : null;
  if (clef) x += (CLEF_W / STAFF_SPACE_UNITS) * s + 1.1 * s;
  else x += 0.6 * s;
  const time =
    opts.time !== false ? { x: x + 0.9 * s, top: String(score.time[0]), bottom: String(score.time[1]) } : null;
  if (time) x += 2.4 * s;

  const start = x;
  const avail = right - 0.8 * s - start;
  const nat = natural(s);
  const stretch = nat > 0 ? Math.max(1, avail / nat) : 1;

  const notes: LaidNote[] = [];
  const bars: LaidBar[] = [];
  const yOf = (step: number) => bottom - (step * s) / 2;

  let cursor = start + 0.6 * s;
  for (const it of items) {
    if (it.kind === "bar") {
      const w = 1.6 * s * stretch;
      bars.push({ x: cursor + 0.2 * w, kind: "single" });
      cursor += w;
      continue;
    }
    const ev = it.ev;
    const step = trebleStep(ev.dn);
    const head = headKind(ev.dur);
    const w = head === "whole" ? wholeW : headW;
    const cx = cursor + w / 2;
    const cy = yOf(step);
    const stem: LaidNote["stem"] = head === "whole" ? null : step < 4 ? "up" : "down";
    const len = stemLen(step) * s;
    const stemW = 0.12 * s;
    const stemX = stem === "up" ? cx + w / 2 - stemW / 2 : cx - w / 2 + stemW / 2;
    const stemEnd = stem === "up" ? cy - len : cy + len;
    const ledgers: number[] = [];
    for (let l = -2; l >= step; l -= 2) ledgers.push(yOf(l));
    for (let l = 10; l <= step; l += 2) ledgers.push(yOf(l));
    const onLine = step % 2 === 0;
    notes.push({
      ev,
      x: cx,
      y: cy,
      step,
      head,
      stem,
      stemX,
      stemEnd,
      flags: stem ? flagCount(ev.dur) : 0,
      dot: isDotted(ev.dur),
      dotX: cx + w / 2 + 0.5 * s,
      dotY: onLine ? cy - s / 2 : cy,
      ledgers,
      headW: w,
    });
    cursor += slot(ev.dur) * s * stretch;
  }
  const finalX = Math.min(right - 0.9 * s, Math.max(cursor, (notes.at(-1)?.x ?? start) + 2 * s));
  bars.push({ x: finalX, kind: "final" });

  // beat → x, piecewise-linear through the note onsets
  const anchors: [number, number][] = notes.map((n) => [n.ev.beat, n.x]);
  anchors.push([score.length, finalX]);
  const beatToX = (beat: number) => {
    if (anchors.length === 0) return start;
    if (beat <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [b1, x1] = anchors[i];
      if (beat <= b1) {
        const [b0, x0] = anchors[i - 1];
        return x0 + ((x1 - x0) * (beat - b0)) / Math.max(1e-6, b1 - b0);
      }
    }
    return anchors[anchors.length - 1][1];
  };

  return { width, height, s, top, bottom, left, right, clef, time, notes, bars, labelY, beatToX };
}

/** SVG transform that draws a font glyph with its bbox centre at (cx, cy). */
export function glyphAtCentre(
  name: keyof typeof GLYPHS,
  cx: number,
  cy: number,
  s: number,
  flipY = true
): string {
  const g = GLYPHS[name];
  const k = s / STAFF_SPACE_UNITS;
  const gx = (g.bounds[0] + g.bounds[2]) / 2;
  const gy = (g.bounds[1] + g.bounds[3]) / 2;
  return `translate(${cx} ${cy}) scale(${k} ${flipY ? -k : k}) translate(${-gx} ${-gy})`;
}

/** The treble clef, curled around the G line, starting at x. */
export function clefTransform(x: number, bottom: number, s: number): string {
  const g = GLYPHS.gClef;
  const k = s / STAFF_SPACE_UNITS;
  return `translate(${x} ${bottom}) scale(${k} ${-k}) translate(${-g.bounds[0]} 0)`;
}

/** A flag hung from the end of a stem (flipped for stems that point down). */
export function flagTransform(stemX: number, stemEnd: number, s: number, down: boolean, offset = 0): string {
  const g = GLYPHS.eighthFlagUp;
  const k = s / STAFF_SPACE_UNITS;
  const y = stemEnd + (down ? -offset : offset);
  return `translate(${stemX} ${y}) scale(${k} ${down ? k : -k}) translate(0 ${-g.bounds[3]})`;
}
