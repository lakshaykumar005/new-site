import { GLYPHS, STAFF_SPACE_UNITS } from "@/components/notation/glyphs";
import { layoutScore, type LaidNote } from "@/components/notation/layout";
import type { NoteEvent, Score } from "@/lib/music/compose";

/**
 * Engraves a melody onto as many systems (lines of staff) as it needs,
 * the way a printed page does: whole bars only, a clef at the start of
 * every system, the time signature on the first.
 *
 * The breaks are an engraver's, not a word processor's: the fewest
 * systems the music needs, the bars shared out between them so that no
 * line is crammed while the next is nearly empty, and the final bar
 * never left alone on a line of its own.
 *
 * "engraved" — a finished page. Every system but the last is justified
 * to both margins; the last keeps the page's spacing, and each staff
 * stops at its last barline.
 * "manuscript" — ruled paper still being written on. The music keeps its
 * natural spacing, the lines are balanced like text, and the paper's
 * ruling runs on to the margin after the written staff ends.
 *
 * Each note's own geometry (pitch, stem, flag, dot, ledgers) comes from
 * `layoutScore`, so these notes are drawn exactly like every ScoreLine
 * on the site. Only the horizontal placement is done here, so it can be
 * animated: every note and barline gets a stable key and a position.
 */

const EPS = 1e-6;

/** Natural room a note asks for, in staff spaces (mirrors layout.ts). */
function slot(dur: number): number {
  return 1.9 + 1.55 * Math.sqrt(Math.max(0.25, dur));
}
/** Room a barline asks for, in staff spaces (mirrors layout.ts). */
const BAR_SLOT = 1.6;
const CLEF_X = 0.3;
const CLEF_SPACES = (GLYPHS.gClef.bounds[2] - GLYPHS.gClef.bounds[0]) / STAFF_SPACE_UNITS;
/** width of the thin barline, and how far the thick final one reaches right of its x */
const THIN = 0.12;
const FINAL_REACH = 0.1;
/** space between systems, in staff spaces */
const GAP = 1.6;
/** a justified line looser than this is a line set badly */
const LOOSE = 1.25;

/** Where the music may start on a system, in staff spaces. */
const header = (time: boolean) => CLEF_X + CLEF_SPACES + 1.1 + (time ? 2.4 : 0);
/** Room for music on a system `lineSpaces` wide, in staff spaces. */
const capacity = (lineSpaces: number, time: boolean) => lineSpaces - 0.8 - header(time) - 1.2;

export interface PlacedNote {
  key: string;
  ev: NoteEvent;
  /** vertical geometry, relative to the system's top; use `x` for the horizontal */
  laid: LaidNote;
  system: number;
  /** notehead centre */
  x: number;
}

export interface PlacedBar {
  key: string;
  system: number;
  /** left edge of the thin line (single) or the barline's anchor (final, as in ScoreLine) */
  x: number;
  kind: "single" | "final";
}

export interface PlacedSystem {
  index: number;
  /** top of this system's box */
  y: number;
  time: boolean;
  lineStart: number;
  lineEnd: number;
  /** where the written staff ends (its closing barline); the ruling carries on to `lineEnd` */
  inkEnd: number;
  clefX: number;
  timeX: number;
  /** where the first note of the system is written */
  contentX: number;
  /** how far the notes were spread to fill the line (1 = natural spacing) */
  stretch: number;
  startBeat: number;
  endBeat: number;
  /** beat → x through the note onsets and the closing barline */
  anchors: [number, number][];
}

export interface Engraving {
  width: number;
  s: number;
  /** staff top and bottom lines, and the letters' baseline, inside a system's box */
  top: number;
  bottom: number;
  labelY: number;
  /** height of one system's box, and the distance from one system to the next */
  box: number;
  pitch: number;
  height: number;
  time: [string, string];
  systems: PlacedSystem[];
  notes: PlacedNote[];
  bars: PlacedBar[];
  beatToPos: (beat: number) => { system: number; x: number };
}

export interface EngraveOptions {
  width: number;
  /** staff space in px */
  s: number;
  /** a stable key per melody note (same order as score.melody) */
  keys?: readonly string[];
  staff: "manuscript" | "engraved";
  /** ("engraved") justify the last system too once it is at least this full (0–1) */
  justifyLast?: number;
  /** ("engraved") centre a lone, unjustified system */
  center?: boolean;
  /** space between systems, in staff spaces */
  gap?: number;
}

interface Group {
  start: number;
  end: number;
  notes: number[];
  /** index among all bars: its barline is keyed by it */
  n: number;
  /** natural width in staff spaces */
  w: number;
  final: boolean;
}

/** The melody cut at every barline, each bar with its natural width. */
function barsOf(score: Score): Group[] {
  const melody = score.melody;
  const cuts = score.bars.map((b) => b.start).filter((b) => b > EPS);
  const edges = [0, ...cuts, score.length];
  const all: Group[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    all.push({ start: edges[i], end: edges[i + 1], notes: [], n: i, w: 0, final: false });
  }
  melody.forEach((ev, i) => {
    const g = all.find((gr) => ev.beat >= gr.start - EPS && ev.beat < gr.end - EPS) ?? all[all.length - 1];
    g?.notes.push(i);
  });
  const groups = all.filter((g) => g.notes.length > 0);
  for (const g of groups) g.w = g.notes.reduce((w, i) => w + slot(melody[i].dur), 0);
  const last = groups[groups.length - 1];
  if (last) last.final = true;
  return groups;
}

/** Natural width of bars set side by side on one system, in staff spaces. */
const run = (gs: readonly Group[]) => gs.reduce((w, g, i) => w + g.w + (i ? BAR_SLOT : 0), 0);

/** The fewest systems the bars need: fill each line in turn. */
function greedy(groups: readonly Group[], room: (si: number) => number): Group[][] {
  const packed: Group[][] = [];
  let cur: Group[] = [];
  let used = 0;
  for (const g of groups) {
    const w = g.w + (cur.length ? BAR_SLOT : 0);
    if (cur.length && used + w > room(packed.length) + EPS) {
      packed.push(cur);
      cur = [g];
      used = g.w;
    } else {
      cur.push(g);
      used += w;
    }
  }
  if (cur.length || packed.length === 0) packed.push(cur);
  return packed;
}

/** Every way to cut `m` bars into `n` consecutive lines (as the index each line starts at). */
function cutsOf(m: number, n: number, from = 0): number[][] {
  if (n === 1) return [[]];
  const out: number[][] = [];
  for (let c = from + 1; c <= m - (n - 1); c++) {
    for (const rest of cutsOf(m, n - 1, c)) out.push([c, ...rest]);
  }
  return out;
}

/**
 * Shares the bars out over the fewest systems they need. A manuscript is
 * balanced like text (the longest line as short as it can be); a page
 * to be justified keeps its lines as full as it can, so none is set
 * loose. Either way the final bar is never stranded on a line of its own.
 */
function arrange(
  groups: readonly Group[],
  room: (si: number) => number,
  lineSpaces: number,
  ragged: boolean
): Group[][] {
  const packed = greedy(groups, room);
  const n = packed.length;
  const m = groups.length;
  if (n < 2) return packed;
  const options = cutsOf(m, n);
  if (options.length > 4000) return packed;

  let best = packed;
  let bestCost = Infinity;
  for (const cuts of options) {
    const edges = [0, ...cuts, m];
    const lines = edges.slice(0, -1).map((a, i) => groups.slice(a, edges[i + 1]));
    let cost = 0;
    let fits = true;
    lines.forEach((gs, si) => {
      const w = run(gs);
      // a single bar wider than the line has nowhere better to go
      if (w > room(si) + EPS && gs.length > 1) fits = false;
      if (ragged) cost = Math.max(cost, (header(si === 0) + 0.6 + w) / lineSpaces);
      else if (si < lines.length - 1) cost += (Math.max(1, (room(si) + 1.3) / Math.max(w, EPS)) - 1) ** 2;
    });
    if (!fits) continue;
    const last = lines[n - 1];
    if (last.length === 1 && last[0].final && lines[n - 2].length > 1) cost += 100;
    if (cost < bestCost - EPS) {
      bestCost = cost;
      best = lines;
    }
  }
  return best;
}

/** How many staff spaces wide a line must be to hold the whole melody (time signature included). */
export function oneLineSpan(score: Score): number {
  return run(barsOf(score)) + 0.8 + header(true) + 1.2;
}

export function engrave(score: Score, o: EngraveOptions): Engraving {
  const s = o.s;
  const width = Math.max(1, o.width);
  const melody = score.melody;
  const keys = o.keys && o.keys.length === melody.length ? o.keys : melody.map((m) => m.id);
  const ragged = o.staff === "manuscript";

  // one generous line, only for each note's own (horizontal-free) geometry
  const base = layoutScore(score, { width: 1e6, space: s, clef: true, time: true, letters: true });
  const laid = new Map(base.notes.map((n) => [n.ev.id, n]));
  const { top, bottom, labelY } = base;
  const box = base.height;
  const pitch = box + (o.gap ?? GAP) * s;

  // ── systems: whole bars, shared out ────────────────────────
  const lineSpaces = width / s;
  const packed = arrange(barsOf(score), (si) => capacity(lineSpaces, si === 0), lineSpaces, ragged);
  const lastIndex = packed.length - 1;

  // ── spacing: how far each line is spread ──────────────────
  const reachOf = (si: number) => (si === lastIndex ? FINAL_REACH : THIN) * s;
  const firstX = (si: number) => (header(si === 0) + 0.6) * s;
  const natural = packed.map((gs) => run(gs) * s);
  const span = packed.map((_, si) => width - reachOf(si) - firstX(si));
  const stretch = packed.map((gs, si) => {
    if (ragged || gs.length === 0 || natural[si] <= 0) return 1;
    const full = Math.max(1, span[si] / natural[si]);
    if (si < lastIndex || natural[si] >= (o.justifyLast ?? Infinity) * span[si]) return full;
    return 0; // the last line: decided below
  });
  if (stretch[lastIndex] === 0) {
    // the last line keeps the spacing of the lines above it (or its own, alone)
    const above = stretch.slice(0, lastIndex);
    const page = above.length ? above.reduce((a, b) => a + b, 0) / above.length : 1;
    const full = Math.max(1, span[lastIndex] / natural[lastIndex]);
    stretch[lastIndex] = Math.min(page, full);
    // within a hair of the margin: finish it at the margin
    if (natural[lastIndex] * stretch[lastIndex] >= 0.94 * span[lastIndex]) stretch[lastIndex] = full;
  }

  // ── placement ─────────────────────────────────────────────
  const systems: PlacedSystem[] = [];
  const notes: PlacedNote[] = [];
  const bars: PlacedBar[] = [];

  packed.forEach((gs, si) => {
    const last = si === lastIndex;
    const time = si === 0;
    const start = header(time) * s;
    const kind: PlacedBar["kind"] = last ? "final" : "single";
    const reach = reachOf(si);
    const k = stretch[si];
    const justified = gs.length > 0 && natural[si] * k >= span[si] - 0.5;

    let cursor = firstX(si);
    const anchors: [number, number][] = [];
    gs.forEach((g, gi) => {
      if (gi) {
        const w = BAR_SLOT * s * k;
        bars.push({ key: `bar${g.n}`, system: si, x: cursor + 0.2 * w, kind: "single" });
        cursor += w;
      }
      for (const i of g.notes) {
        const ev = melody[i];
        const L = laid.get(ev.id);
        if (!L) continue;
        const x = cursor + L.headW / 2;
        notes.push({ key: keys[i], ev, laid: L, system: si, x });
        anchors.push([ev.beat, x]);
        cursor += slot(ev.dur) * s * k;
      }
    });

    let lineEnd = width;
    let inkEnd = start;
    if (gs.length) {
      const lastX = anchors.length ? anchors[anchors.length - 1][1] : start;
      const endX = justified ? width - reach : Math.min(width - reach, Math.max(cursor, lastX + 2 * s));
      // a system's closing barline is the barline before the next system's first bar
      const next = packed[si + 1]?.[0];
      bars.push({ key: last ? "final" : `bar${next?.n ?? si}`, system: si, x: endX, kind });
      // the playhead comes to rest on the thin line of the closing barline
      anchors.push([gs[gs.length - 1].end, kind === "final" ? endX - 0.66 * s : endX + 0.06 * s]);
      inkEnd = Math.min(width, endX + reach);
      if (!ragged) lineEnd = inkEnd;
    }

    systems.push({
      index: si,
      y: si * pitch,
      time,
      lineStart: 0,
      lineEnd,
      inkEnd,
      clefX: CLEF_X * s,
      timeX: (CLEF_X + CLEF_SPACES + 1.1 + 0.9) * s,
      contentX: firstX(si),
      stretch: k,
      startBeat: gs[0]?.start ?? 0,
      endBeat: gs[gs.length - 1]?.end ?? 0,
      anchors,
    });
  });

  // a lone short line, centred on the page
  const lone = systems.length === 1 ? systems[0] : null;
  if (o.center && lone && !ragged && lone.lineEnd < width - 0.5) {
    const dx = (width - lone.lineEnd) / 2;
    lone.lineStart += dx;
    lone.lineEnd += dx;
    lone.inkEnd += dx;
    lone.clefX += dx;
    lone.timeX += dx;
    lone.contentX += dx;
    lone.anchors = lone.anchors.map(([b, x]) => [b, x + dx]);
    for (const n of notes) n.x += dx;
    for (const b of bars) b.x += dx;
  }

  const beatToPos = (beat: number) => {
    let si = systems.findIndex((sy) => beat < sy.endBeat - EPS);
    if (si < 0) si = systems.length - 1;
    const a = systems[si].anchors;
    if (a.length === 0) return { system: si, x: systems[si].lineStart };
    if (beat <= a[0][0]) return { system: si, x: a[0][1] };
    for (let i = 1; i < a.length; i++) {
      const [b1, x1] = a[i];
      if (beat <= b1) {
        const [b0, x0] = a[i - 1];
        return { system: si, x: x0 + ((x1 - x0) * (beat - b0)) / Math.max(EPS, b1 - b0) };
      }
    }
    return { system: si, x: a[a.length - 1][1] };
  };

  return {
    width,
    s,
    top,
    bottom,
    labelY,
    box,
    pitch,
    height: systems.length * pitch - (pitch - box),
    time: [String(score.time[0]), String(score.time[1])],
    systems,
    notes,
    bars,
    beatToPos,
  };
}

export interface FitOptions extends Omit<EngraveOptions, "s" | "keys"> {
  /** the staff space may not go below this, nor above `sMax` */
  sMin: number;
  sMax: number;
  maxSystems: number;
  /** the tallest the engraving may be, in px */
  maxHeight?: number;
}

export interface Fit {
  s: number;
  systems: number;
  height: number;
  /** false when nothing between sMin and sMax meets the limits (`s` is then the fewest systems, largest staff) */
  fits: boolean;
}

/**
 * Chooses a staff size the way an engraver chooses a rastral for a page:
 * the fewest systems first, then the largest staff that still sets the
 * music on that many — within a height, if one is given. A justified
 * page is not set loose just to be a size larger.
 */
export function fitSpace(score: Score, o: FitOptions): Fit {
  const at = (s: number) => engrave(score, { ...o, s });
  const limit = o.maxHeight ?? Infinity;
  const floorTo = (s: number) => Math.floor(s * 100) / 100;

  const largest = (ok: (e: Engraving) => boolean) => {
    if (ok(at(o.sMax))) return o.sMax;
    let a = o.sMin;
    let b = o.sMax;
    for (let i = 0; i < 18; i++) {
      const mid = (a + b) / 2;
      if (ok(at(mid))) a = mid;
      else b = mid;
    }
    return floorTo(a);
  };

  const smallest = at(o.sMin);
  const n = smallest.systems.length;
  if (n > o.maxSystems || smallest.height > limit) {
    const s = largest((e) => e.systems.length <= n);
    const e = at(s);
    return { s, systems: e.systems.length, height: e.height, fits: false };
  }

  let s = largest((e) => e.systems.length <= n && e.height <= limit);
  if (o.staff === "engraved") {
    const loose = (e: Engraving) => Math.max(1, ...e.systems.slice(0, -1).map((sy) => sy.stretch));
    if (loose(at(s)) > LOOSE) {
      for (let t = s - 0.05; t >= Math.max(o.sMin, s * 0.86); t -= 0.05) {
        if (loose(at(t)) <= LOOSE) {
          s = floorTo(t);
          break;
        }
      }
    }
  }
  const e = at(s);
  return { s, systems: e.systems.length, height: e.height, fits: true };
}
