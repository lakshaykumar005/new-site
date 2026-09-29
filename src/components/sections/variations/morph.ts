"use client";

import { flagTransform } from "@/components/notation/layout";
import type { VariationId } from "@/lib/music/compose";
import type { Engraved, Engraving, Pose } from "./engrave";

/**
 * The morph: one engraved staff turning into another.
 *
 * Every note is filed by the letter it spells, so when the variation
 * changes each note has somewhere to go: it glides from its old x/y to
 * its new one, its stem shortens through nothing and grows out the
 * other side if it must flip, its flags and dot and ledger lines fade
 * in or out, the barlines slide, the time signature crossfades, and her
 * letter travels under its note. All of it is interpolated between two
 * layouts computed once — nothing is laid out per frame — and written
 * straight to the SVG.
 *
 * A morph can be retargeted mid-flight (a quick hand on the dial): the
 * notes simply set off again from wherever they are.
 */

type Ease = (t: number) => number;

/** cubic-bezier(x1, y1, x2, y2), evaluated the way CSS does. */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const C = (a1: number) => 3 * a1;
  const at = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (Math.abs(s) < 1e-6) break;
      const err = at(t, x1, x2) - x;
      if (Math.abs(err) < 1e-6) break;
      t -= err / s;
    }
    if (t < 0 || t > 1 || Math.abs(at(t, x1, x2) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (at(t, x1, x2) < x) lo = t;
        else hi = t;
      }
    }
    return at(t, y1, y2);
  };
}

/** the site's curves (globals.css) */
const SPRING = bezier(0.34, 1.56, 0.64, 1);
const OUT = bezier(0.22, 1, 0.36, 1);

/** How each variation arrives: the lullaby drifts in, the allegro hurries. */
const TIMING: Record<VariationId, { dur: number; stagger: number }> = {
  theme: { dur: 680, stagger: 24 },
  retrograde: { dur: 720, stagger: 26 },
  inversion: { dur: 680, stagger: 24 },
  waltz: { dur: 680, stagger: 24 },
  lullaby: { dur: 980, stagger: 34 },
  allegro: { dur: 440, stagger: 14 },
};

/** Everything about a note that moves, as numbers. */
interface NoteState {
  x: number;
  y: number;
  stemDx: number;
  stemDy: number;
  dotDx: number;
  dotDy: number;
  ledgerHalf: number;
  dot: number;
  flag1: number;
  flag2: number;
  black: number;
  half: number;
  whole: number;
  /** aligned with Engraving.ledgerSteps[letter] */
  ledgers: number[];
}

const GEOMETRY = ["x", "y", "stemDx", "stemDy", "dotDx", "dotDy", "ledgerHalf"] as const;
const FADES = ["dot", "flag1", "flag2", "black", "half", "whole"] as const;

interface BarState {
  x: number;
  o: number;
}

interface SheetState {
  notes: NoteState[];
  bars: BarState[];
  finalX: number;
  staffEnd: number;
  /** aligned with Engraving.times */
  times: number[];
  mirror: number;
}

interface NoteEls {
  g: SVGGElement;
  stem: SVGLineElement | null;
  flags: (SVGPathElement | null)[];
  heads: { black: SVGPathElement | null; half: SVGPathElement | null; whole: SVGPathElement | null };
  dot: SVGCircleElement | null;
  ledgers: (SVGLineElement | null)[];
  letter: SVGTextElement | null;
}

interface Els {
  notes: NoteEls[];
  bars: SVGRectElement[];
  final: SVGGElement | null;
  lines: SVGLineElement[];
  times: SVGGElement[];
  mirror: SVGGElement | null;
  mirrorClip: SVGRectElement | null;
  playhead: SVGLineElement | null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function noteState(p: Pose, steps: number[]): NoteState {
  return {
    x: p.x,
    y: p.y,
    stemDx: p.stemDx,
    stemDy: p.stemDy,
    dotDx: p.dotDx,
    dotDy: p.dotDy,
    ledgerHalf: p.ledgerHalf,
    dot: p.dot ? 1 : 0,
    flag1: p.flags >= 1 ? 1 : 0,
    flag2: p.flags >= 2 ? 1 : 0,
    black: p.head === "black" ? 1 : 0,
    half: p.head === "half" ? 1 : 0,
    whole: p.head === "whole" ? 1 : 0,
    ledgers: steps.map((st) => (p.ledgers.includes(st) ? 1 : 0)),
  };
}

function sheetState(e: Engraving, sheet: Engraved): SheetState {
  return {
    notes: sheet.poses.map((p, i) => noteState(p, e.ledgerSteps[i] ?? [])),
    bars: Array.from({ length: e.maxBars }, (_, k) =>
      k < sheet.bars.length ? { x: sheet.bars[k], o: 1 } : { x: sheet.finalX - 0.72 * e.frame.s, o: 0 }
    ),
    finalX: sheet.finalX,
    staffEnd: sheet.staffEnd,
    times: e.times.map((t) => (t === sheet.time ? 1 : 0)),
    mirror: sheet.id === "inversion" ? 1 : 0,
  };
}

function cloneState(s: SheetState): SheetState {
  return {
    ...s,
    notes: s.notes.map((n) => ({ ...n, ledgers: [...n.ledgers] })),
    bars: s.bars.map((b) => ({ ...b })),
    times: [...s.times],
  };
}

export class Morpher {
  private engraving: Engraving | null = null;
  private els: Els | null = null;
  private from: SheetState | null = null;
  private to: SheetState | null = null;
  private cur: SheetState | null = null;
  private fromSheet: Engraved | null = null;
  private toSheet: Engraved | null = null;
  private t0 = 0;
  private dur = 0;
  private stagger = 0;
  /** each note's place in the queue: the ones that end up leftmost set off first */
  private rank: number[] = [];
  /** the height of the arc each note takes on its way (signed: negative rises), 0 for a straight glide */
  private lift: number[] = [];
  /** how far each letter is off its line right now (it hops when its note arcs) */
  private hop: number[] = [];
  /** overall progress, 0–1, for the things that move as one */
  private p = 1;
  private raf = 0;
  private beat: number | null = null;
  private fade: Animation | null = null;

  get index(): number {
    return this.toSheet?.index ?? 0;
  }

  /** Take hold of the SVG and print a variation at rest (the one it was showing, unless told otherwise). */
  bind(root: SVGSVGElement | null, engraving: Engraving, index = this.index) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.fade?.cancel();
    this.fade = null;
    this.engraving = engraving;
    this.els = root ? collect(root, engraving) : null;
    const sheet = engraving.sheets[index] ?? engraving.sheets[0];
    const state = sheetState(engraving, sheet);
    this.from = cloneState(state);
    this.to = state;
    this.cur = cloneState(state);
    this.fromSheet = sheet;
    this.toSheet = sheet;
    this.p = 1;
    this.hop = [];
    this.write();
    this.writePlayhead();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.fade?.cancel();
    this.els = null;
  }

  /** Morph to a variation — or, under reduced motion, swap with a short crossfade. */
  goTo(index: number, reduced = false) {
    const e = this.engraving;
    if (!e || !this.cur || !this.toSheet) return;
    const sheet = e.sheets[index];
    if (!sheet || sheet === this.toSheet) return;
    const target = sheetState(e, sheet);

    if (reduced) {
      this.snapTo(sheet, target, true);
      return;
    }

    // set off from wherever the notes are now
    this.from = cloneState(this.cur);
    this.fromSheet = this.toSheet;
    this.to = target;
    this.toSheet = sheet;
    const timing = TIMING[sheet.id];
    const s = e.frame.s;
    const n = this.from.notes.length;
    const dx = this.from.notes.map((a, i) => target.notes[i].x - a.x);

    // Does the line turn round (the retrograde, or leaving it)? Count the pairs that swap places.
    let pairs = 0;
    let swaps = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs++;
        if ((this.from.notes[i].x - this.from.notes[j].x) * (target.notes[i].x - target.notes[j].x) < 0) swaps++;
      }
    }
    const reversal = pairs > 0 && swaps / pairs > 0.3;

    this.dur = timing.dur;
    this.rank = new Array(n).fill(0);
    if (reversal) {
      // an hourglass: the notes with farthest to go set off first, all nearly together, and every
      // note travelling right rises over the ones coming left, so the letters pass rather than collide
      this.stagger = 9;
      const order = dx.map((d, i) => [Math.abs(d), i] as const).sort((a, b) => b[0] - a[0]);
      order.forEach(([, i], r) => (this.rank[i] = r));
      this.lift = dx.map((d) => (Math.abs(d) < 0.5 * s ? 0 : -Math.sign(d) * Math.min(1.5 * s, 0.55 * s + Math.abs(d) * 0.05)));
    } else {
      // a ripple: the notes that end up leftmost set off first; a long glide takes a slight arc
      this.stagger = timing.stagger;
      const order = target.notes.map((b, i) => [b.x, i] as const).sort((a, b) => a[0] - b[0]);
      order.forEach(([, i], r) => (this.rank[i] = r));
      this.lift = dx.map((d) => (Math.abs(d) > 3 * s ? -Math.sign(d) * 0.55 * s : 0));
    }
    this.hop = new Array(n).fill(0);
    this.t0 = performance.now();
    this.p = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  /** The playhead: the piece's beat, or null when nothing plays. */
  setBeat(beat: number | null) {
    this.beat = beat;
    this.writePlayhead();
  }

  private snapTo(sheet: Engraved, target: SheetState, crossfade: boolean) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const apply = () => {
      this.from = cloneState(target);
      this.to = target;
      this.cur = cloneState(target);
      this.fromSheet = sheet;
      this.toSheet = sheet;
      this.p = 1;
      this.hop = [];
      this.write();
      this.writePlayhead();
    };
    const music = this.els?.notes[0]?.g.ownerSVGElement?.querySelector<SVGGElement>("[data-music]");
    if (!crossfade || !music || typeof music.animate !== "function") {
      apply();
      return;
    }
    this.fade?.cancel();
    this.fade = music.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: "linear", fill: "forwards" });
    this.fade.onfinish = () => {
      apply();
      this.fade = music.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, easing: "linear" });
      this.fade.onfinish = () => {
        this.fade = null;
      };
    };
  }

  private frame = () => {
    this.raf = 0;
    const { from, to, cur, engraving } = this;
    if (!from || !to || !cur || !engraving) return;
    const t = performance.now() - this.t0;
    let done = true;

    for (let i = 0; i < cur.notes.length; i++) {
      const a = from.notes[i];
      const b = to.notes[i];
      const c = cur.notes[i];
      const p = clamp01((t - this.stagger * (this.rank[i] ?? 0)) / this.dur);
      if (p < 1) done = false;
      const g = SPRING(p);
      const o = OUT(p);
      for (const k of GEOMETRY) c[k] = lerp(a[k], b[k], g);
      for (const k of FADES) c[k] = clamp01(lerp(a[k], b[k], o));
      for (let j = 0; j < c.ledgers.length; j++) c.ledgers[j] = clamp01(lerp(a.ledgers[j], b.ledgers[j], o));
      // the arc, and the letter's hop under it
      const arc = (this.lift[i] ?? 0) * Math.sin(Math.PI * p);
      c.y += arc;
      this.hop[i] = arc * 0.45;
    }

    const p0 = clamp01(t / this.dur);
    if (p0 < 1) done = false;
    this.p = p0;
    const g0 = SPRING(p0);
    const o0 = OUT(p0);
    for (let k = 0; k < cur.bars.length; k++) {
      cur.bars[k].x = lerp(from.bars[k].x, to.bars[k].x, g0);
      cur.bars[k].o = clamp01(lerp(from.bars[k].o, to.bars[k].o, o0));
    }
    cur.finalX = lerp(from.finalX, to.finalX, g0);
    cur.staffEnd = lerp(from.staffEnd, to.staffEnd, g0);
    for (let k = 0; k < cur.times.length; k++) cur.times[k] = clamp01(lerp(from.times[k], to.times[k], o0));
    cur.mirror = clamp01(lerp(from.mirror, to.mirror, o0));

    this.write();
    this.writePlayhead();
    if (!done) this.raf = requestAnimationFrame(this.frame);
    else this.p = 1;
  };

  private write() {
    const { els, cur, engraving } = this;
    if (!els || !cur || !engraving) return;
    const s = engraving.frame.s;
    const f2 = (v: number) => v.toFixed(2);

    cur.notes.forEach((n, i) => {
      const el = els.notes[i];
      if (!el) return;
      el.g.setAttribute("transform", `translate(${f2(n.x)} ${f2(n.y)})`);
      const len = Math.abs(n.stemDy);
      if (el.stem) {
        const start = len < 0.3 * s ? 0 : Math.sign(n.stemDy) * 0.15 * s;
        el.stem.setAttribute("x1", f2(n.stemDx));
        el.stem.setAttribute("x2", f2(n.stemDx));
        el.stem.setAttribute("y1", f2(start));
        el.stem.setAttribute("y2", f2(n.stemDy));
        el.stem.setAttribute("opacity", len < 0.3 * s ? "0" : "1");
      }
      const down = n.stemDy > 0;
      const flagRoom = clamp01(len / (2.2 * s));
      el.flags.forEach((fl, k) => {
        if (!fl) return;
        const o = (k === 0 ? n.flag1 : n.flag2) * flagRoom;
        fl.setAttribute("opacity", f2(o));
        if (o > 0) fl.setAttribute("transform", flagTransform(n.stemDx - 0.06 * s, n.stemDy, s, down, k * 0.8 * s));
      });
      el.heads.black?.setAttribute("opacity", f2(n.black));
      el.heads.half?.setAttribute("opacity", f2(n.half));
      el.heads.whole?.setAttribute("opacity", f2(n.whole));
      if (el.dot) {
        el.dot.setAttribute("cx", f2(n.dotDx));
        el.dot.setAttribute("cy", f2(n.dotDy));
        el.dot.setAttribute("opacity", f2(n.dot));
      }
      el.ledgers.forEach((ld, j) => {
        if (!ld) return;
        ld.setAttribute("x1", f2(n.x - n.ledgerHalf));
        ld.setAttribute("x2", f2(n.x + n.ledgerHalf));
        ld.setAttribute("opacity", f2(n.ledgers[j] ?? 0));
      });
      el.letter?.setAttribute("transform", `translate(${f2(n.x)} ${f2(this.hop[i] ?? 0)})`);
    });

    cur.bars.forEach((b, k) => {
      const el = els.bars[k];
      if (!el) return;
      el.setAttribute("x", f2(b.x));
      el.setAttribute("opacity", f2(b.o));
    });
    els.final?.setAttribute("transform", `translate(${f2(cur.finalX)} 0)`);
    for (const line of els.lines) line.setAttribute("x2", f2(cur.staffEnd));
    cur.times.forEach((o, k) => els.times[k]?.setAttribute("opacity", f2(o)));
    if (els.mirror) {
      els.mirror.setAttribute("opacity", f2(cur.mirror));
      if (els.mirrorClip) {
        const sheet = cur.mirror > 0 && this.toSheet?.id === "inversion" ? this.toSheet : this.fromSheet;
        const x0 = sheet?.musicStart ?? 0;
        const x1 = cur.finalX - 0.9 * s;
        els.mirrorClip.setAttribute("x", f2(x0));
        els.mirrorClip.setAttribute("width", f2(Math.max(0, (x1 - x0) * cur.mirror)));
      }
    }
  }

  private writePlayhead() {
    const { els, fromSheet, toSheet } = this;
    if (!els?.playhead || !fromSheet || !toSheet) return;
    if (this.beat === null) {
      els.playhead.setAttribute("opacity", "0");
      return;
    }
    // during a morph the playhead is handed from one layout to the other at the same fraction
    const f = toSheet.score.length > 0 ? clamp01(this.beat / toSheet.score.length) : 0;
    const xa = fromSheet.beatToX(f * fromSheet.score.length);
    const xb = toSheet.beatToX(f * toSheet.score.length);
    const x = lerp(xa, xb, SPRING(this.p));
    els.playhead.setAttribute("transform", `translate(${x.toFixed(2)} 0)`);
    els.playhead.setAttribute("opacity", "1");
  }
}

function collect(root: SVGSVGElement, e: Engraving): Els {
  const notes: NoteEls[] = [];
  root.querySelectorAll<SVGGElement>("g[data-note]").forEach((g) => {
    const i = Number(g.dataset.note);
    const steps = e.ledgerSteps[i] ?? [];
    notes[i] = {
      g,
      stem: g.querySelector<SVGLineElement>("[data-stem]"),
      flags: [g.querySelector<SVGPathElement>('[data-flag="1"]'), g.querySelector<SVGPathElement>('[data-flag="2"]')],
      heads: {
        black: g.querySelector<SVGPathElement>('[data-head="black"]'),
        half: g.querySelector<SVGPathElement>('[data-head="half"]'),
        whole: g.querySelector<SVGPathElement>('[data-head="whole"]'),
      },
      dot: g.querySelector<SVGCircleElement>("[data-dot]"),
      ledgers: steps.map((st) => root.querySelector<SVGLineElement>(`[data-ledger="${i}:${st}"]`)),
      letter: root.querySelector<SVGTextElement>(`[data-letter="${i}"]`),
    };
  });
  const bars: SVGRectElement[] = [];
  root.querySelectorAll<SVGRectElement>("[data-bar]").forEach((r) => {
    bars[Number(r.dataset.bar)] = r;
  });
  const times: SVGGElement[] = [];
  root.querySelectorAll<SVGGElement>("[data-time]").forEach((g) => {
    times[Number(g.dataset.time)] = g;
  });
  return {
    notes,
    bars,
    final: root.querySelector<SVGGElement>("[data-final]"),
    lines: Array.from(root.querySelectorAll<SVGLineElement>("[data-staff-line]")),
    times,
    mirror: root.querySelector<SVGGElement>("[data-mirror]"),
    mirrorClip: root.querySelector<SVGRectElement>("[data-mirror-clip]"),
    playhead: root.querySelector<SVGLineElement>("[data-playhead]"),
  };
}
