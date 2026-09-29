import type { BoxModel } from "./model";

/**
 * The drawing, laid out in CSS pixels for the width it actually has
 * (no viewBox scaling, so hairlines stay hairlines). Two plates:
 *
 *   compact (phones, and phones on their side): the strip runs edge to
 *   edge; the handle hangs below it at the right, the "Let it play"
 *   control to its left, centred on the handle's axle.
 *
 *   wide (≥ 768px and tall enough to show it whole): the strip ends in
 *   conventional break lines and the handle stands to the right of it.
 *
 * Heights depend only on the mode and the number of pitch rows, so the
 * page can reserve the space before anything is measured.
 */

export type Mode = "compact" | "wide";

export interface Pt {
  x: number;
  y: number;
}

export interface Tooth {
  /** row centre */
  y: number;
  /** root (where it leaves the plate) and tip (the read line) */
  x0: number;
  x1: number;
  w: number;
}

export interface Numeral {
  n: 1 | 2 | 3;
  x: number;
  y: number;
  /** where the leader lands on the part */
  to: Pt;
  /** sideways bow of the leader, as a fraction of its length */
  bow: number;
}

export interface Geo {
  mode: Mode;
  W: number;
  H: number;
  gutter: number;

  /** centre x and baseline of her name */
  name: { x: number; y: number; size: number };

  /** the strip, in figure coordinates */
  strip: { x0: number; x1: number; y0: number; y1: number };
  /** row centres, relative to the strip's top edge */
  rowY: number[];
  rowPitch: number;
  holeR: number;
  beatW: number;
  /** the read line: the comb's tips (figure x) */
  xr: number;
  tape: { loopW: number; copies: number; lead: number };

  /** printed note names down the strip's left edge */
  index: { x0: number; x1: number; size: number };

  comb: {
    teeth: Tooth[];
    top: number;
    bottom: number;
    /** the root line (where the teeth leave the plate) at the plate's top and bottom */
    rootTop: number;
    rootBottom: number;
    /** the plate's width, measured across */
    plate: number;
    screws: Pt[];
  };
  bed: { x0: number; y0: number; x1: number; y1: number };

  wheel: {
    c: Pt;
    r: number;
    teeth: number;
    m: number;
    outer: number;
    root: number;
    rimInner: number;
    hub: number;
    arm: number;
    knob: number;
    /** degrees: puts a tooth on the line of centres at beat 0 */
    phase: number;
  };
  pinion: {
    c: Pt;
    r: number;
    teeth: number;
    m: number;
    roller: number;
    phase: number;
  };

  /** break lines at the ends of the strip (wide only) */
  breaks: boolean;
  /** the outline of the paper, as a polygon (figure coords) */
  paper: Pt[];

  controls: { x: number; y: number; w: number };
  numerals: Numeral[];
}

const TAU = Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The "Let it play" pill's width (DM Mono is 0.6em a character, so this
 * is exact): 180.6px normally, 168px below 360px, where it is set a
 * little tighter (see `.controls` in MusicBox.module.css).
 */
const PILL = 181;
const PILL_NARROW = 168;
const NARROW = 360;
/** Clear space between the pill and the handle's grab circle. */
const PILL_CLEAR = 12;
/** The handle's grab circle reaches this far past its teeth. */
export const GRIP = 8;
/** The smallest module the phone's hand-wheel is allowed (90px across). */
const M_FLOOR = 2.5;

interface Plate {
  gutter: number;
  nameSize: number;
  nameY: number;
  top: number;
  rowBudget: number;
  rowMin: number;
  rowMax: number;
  padTop: number;
  padBottom: number;
  beatW: number;
  comb: { lMin: number; lMax: number; plate: number; over: number; bedOver: number; toothK: number };
  wheel: { m: number; teeth: number; pinion: number; rim: number; hub: number; armK: number; knob: number };
  /**
   * Room under the strip: for the handle, the pill and a two-line note
   * (a two-line count, or the touch hint), or the three-line pointer hint.
   * Below 375px the CSS adds a line more (the column is narrower there).
   */
  below: number;
  belowFine: number;
}

const PLATES: Record<Mode, Plate> = {
  compact: {
    gutter: 20,
    nameSize: 23,
    nameY: 34,
    top: 60,
    rowBudget: 166,
    rowMin: 13,
    rowMax: 22,
    padTop: 11,
    padBottom: 13,
    beatW: 46,
    comb: { lMin: 30, lMax: 64, plate: 16, over: 12, bedOver: 19, toothK: 0.36 },
    wheel: { m: 3, teeth: 34, pinion: 13, rim: 5, hub: 8.5, armK: 0.7, knob: 10 },
    below: 140,
    belowFine: 150,
  },
  wide: {
    gutter: 48,
    nameSize: 31,
    nameY: 44,
    top: 78,
    rowBudget: 224,
    rowMin: 16,
    rowMax: 28,
    padTop: 15,
    padBottom: 17,
    beatW: 60,
    comb: { lMin: 44, lMax: 98, plate: 22, over: 15, bedOver: 24, toothK: 0.35 },
    wheel: { m: 3.6, teeth: 46, pinion: 17, rim: 7, hub: 12.5, armK: 0.72, knob: 14 },
    // the pill sits 20px under the bed plate; the note beside it keeps its
    // first line on the pill's centre and may run to two lines
    below: 108,
    belowFine: 108,
  },
};

function rowPitchOf(p: Plate, n: number) {
  return clamp(Math.round(p.rowBudget / Math.max(1, n)), p.rowMin, p.rowMax);
}

function stripBottom(p: Plate, n: number) {
  return p.top + p.padTop + n * rowPitchOf(p, n) + p.padBottom;
}

/** Figure height for a mode — known before anything is measured. */
export function figureHeight(mode: Mode, model: BoxModel, finePointer = false): number {
  const p = PLATES[mode];
  return Math.round(stripBottom(p, model.rows.length) + (finePointer ? p.belowFine : p.below));
}

/**
 * @param gutter the page's side gutter, when it differs from the plate's
 *   own (a phone on its side gets the compact plate and the wider gutter)
 */
export function layout(W: number, mode: Mode, model: BoxModel, finePointer = true, gutter?: number): Geo {
  const p = PLATES[mode];
  const n = model.rows.length;
  const g = gutter ?? p.gutter;
  const rowPitch = rowPitchOf(p, n);
  const holeR = Math.min(rowPitch * 0.31, 5.6);
  const S0 = p.top;
  const S1 = stripBottom(p, n);
  const beatW = p.beatW;
  const rowY = model.rows.map((_, i) => p.padTop + (i + 0.5) * rowPitch);

  // ── strip extent ────────────────────────────────────────
  const wide = mode === "wide";
  const wm = p.wheel;
  // On the narrowest phones the hand-wheel gives a little, so the pill to
  // its left never runs into it: pill + clearance + grab circle + wheel
  // must fit between the gutters. (The roller's radius doesn't depend on
  // the module, so the paper still travels exactly a beat per 120°.)
  let m = wm.m;
  if (!wide) {
    const pill = W < NARROW ? PILL_NARROW : PILL;
    // C.x = W - g - outer + 4, and g + pill + PILL_CLEAR <= C.x - outer - GRIP
    const maxOuter = (W - 2 * g + 4 - GRIP - PILL_CLEAR - pill) / 2;
    m = clamp(maxOuter / (wm.teeth / 2 + 1), M_FLOOR, wm.m);
  }
  const wheelR = (m * wm.teeth) / 2;
  const wheelOuter = wheelR + m;
  const x0 = 0;
  // wide: leave the right-hand column to the handle
  const x1 = wide ? Math.round(W - (wheelOuter * 2 + 30)) : W;

  // ── read line & comb ────────────────────────────────────
  const c = p.comb;
  const index = wide
    ? { x0: x0 + 9, x1: x0 + 40, size: 9.5 }
    : { x0: x0, x1: x0 + 27, size: 8.25 };
  // the comb's longest tooth, plus its plate, must clear the printed index
  const combReach = c.lMax * 1.15 + c.plate + (wide ? 18 : 12);
  const xr = Math.round(Math.max(wide ? x0 + (x1 - x0) * 0.32 : W * 0.4, index.x1 + combReach));
  const yFirst = S0 + rowY[0];
  const yLast = S0 + rowY[n - 1];
  const lenAt = (y: number) =>
    n <= 1 ? c.lMax : c.lMin + ((c.lMax - c.lMin) * (y - yFirst)) / Math.max(1, yLast - yFirst);
  const toothW = Math.max(3.5, rowPitch * c.toothK);
  const teeth: Tooth[] = rowY.map((ry) => {
    const y = S0 + ry;
    return { y, x0: xr - lenAt(y), x1: xr, w: toothW };
  });
  const combTop = S0 - c.over;
  const combBottom = S1 + c.over;
  const rootTop = xr - lenAt(combTop);
  const rootBottom = xr - lenAt(combBottom);
  // screws sit in the plate where it overhangs the paper, top and bottom
  const screwAt = (y: number): Pt => ({ x: xr - lenAt(y) - c.plate / 2, y });
  const screws: Pt[] = [screwAt(combTop + c.over / 2), screwAt(combBottom - c.over / 2)];
  const bed = {
    x0: rootBottom - c.plate - (wide ? 12 : 9),
    y0: S0 - c.bedOver,
    x1: xr + (wide ? 16 : 12),
    y1: S1 + c.bedOver,
  };

  // ── handle (a toothed hand-wheel) and the pinion it drives ──
  // One turn of the handle is three beats. The pinion's roller rides
  // under the paper's lower edge; its radius is whatever makes the
  // paper travel exactly `beatW` per beat for the gear ratio chosen.
  const pinionR = (m * wm.pinion) / 2;
  const roller = (3 * beatW * wm.pinion) / (TAU * wm.teeth);
  const centres = wheelR + pinionR;

  let C: Pt;
  let P: Pt;
  if (wide) {
    P = { x: x1 - 8, y: S1 + roller };
    const cx = x1 + wheelOuter + 8;
    const dx = cx - P.x;
    const dy = Math.sqrt(Math.max(0, centres * centres - dx * dx));
    C = { x: cx, y: P.y - dy };
  } else {
    // just under the paper — and never so high that the pill, centred on
    // the axle, would come within 14px of the bed plate
    const cy = Math.max(S1 + 6 + wheelOuter, S1 + c.bedOver + 14 + 24);
    const cx = W - g - wheelOuter + 4;
    const dy = cy - (S1 + roller);
    const dx = Math.sqrt(Math.max(0, centres * centres - dy * dy));
    C = { x: cx, y: cy };
    P = { x: cx - dx, y: S1 + roller };
  }

  // gear phases: a wheel tooth and a pinion gap on the line of centres at beat 0
  const beta = (Math.atan2(P.y - C.y, P.x - C.x) * 180) / Math.PI;
  const wheelPhase = beta;
  const pinionPhase = beta + 180 + 180 / wm.pinion;

  const wheel = {
    c: C,
    r: wheelR,
    teeth: wm.teeth,
    m,
    outer: wheelOuter,
    root: wheelR - 1.25 * wm.m,
    rimInner: wheelR - 1.25 * wm.m - wm.rim,
    hub: wm.hub,
    arm: wheelR * wm.armK,
    knob: wm.knob,
    phase: wheelPhase,
  };
  const pinion = { c: P, r: pinionR, teeth: wm.pinion, m, roller, phase: pinionPhase };

  // ── the tape: enough copies of the loop to cover the window ──
  // `lead` copies sit left of the read line; spares on each side let a
  // flash find the hole that is actually passing the comb, and cover the
  // tape being re-anchored at the splice rather than at beat 0.
  const loopW = model.loop * beatW;
  const lead = Math.max(1, Math.ceil((xr - x0) / loopW));
  const copies = lead + 2 + Math.max(1, Math.ceil((x1 - xr) / loopW));

  // ── paper outline (break lines in wide) ─────────────────
  const paper: Pt[] = [];
  const breaks = wide;
  if (breaks) {
    const steps = 18;
    const amp = 3.2;
    const wave = (t: number) => Math.sin(t * Math.PI * 2.5) * amp;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paper.push({ x: x1 - 5 + wave(t), y: S0 + (S1 - S0) * t });
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      paper.push({ x: x0 + 5 + wave(t + 0.2), y: S0 + (S1 - S0) * t });
    }
  } else {
    paper.push({ x: x0, y: S0 }, { x: x1, y: S0 }, { x: x1, y: S1 }, { x: x0, y: S1 });
  }

  // ── controls ────────────────────────────────────────────
  // Seated off the bed plate, not the paper. Wide: a row under the strip
  // whose note may run on towards the handle (its first line keeps to the
  // pill's centre, below the pinion). Compact: the pill on the handle's
  // axle line, its note beneath, clear of the numeral by the wheel.
  const controls = wide
    ? { x: x0 + 10, y: bed.y1 + 20, w: Math.max(260, Math.round(C.x - wheelOuter - 24 - (x0 + 10))) }
    : { x: g, y: C.y - 24, w: Math.max(150, Math.round(C.x - wheelOuter - g - 26)) };

  // ── reference numerals ──────────────────────────────────
  const plateMid = rootTop - c.plate / 2;
  const plateLeft = rootTop - c.plate;
  const numerals: Numeral[] = wide
    ? [
        {
          n: 1,
          x: C.x + wheelOuter * 0.62,
          y: C.y - wheelOuter - 30,
          to: {
            x: C.x + Math.cos(-1.05) * (wheelR - 1),
            y: C.y + Math.sin(-1.05) * (wheelR - 1),
          },
          bow: 0.18,
        },
        { n: 2, x: Math.max(24, plateLeft - 96), y: S0 - 40, to: { x: plateMid - 5, y: combTop + 3 }, bow: -0.2 },
        {
          n: 3,
          x: Math.round(xr + (x1 - xr) * 0.58),
          y: S0 - 44,
          to: { x: Math.round(xr + (x1 - xr) * 0.58) + 26, y: S0 + p.padTop * 0.45 },
          bow: 0.2,
        },
      ]
    : [
        {
          n: 1,
          x: C.x - wheelOuter - 10,
          y: C.y + wheelOuter - 6,
          to: {
            x: C.x + Math.cos(2.55) * (wheelR - 1),
            y: C.y + Math.sin(2.55) * (wheelR - 1),
          },
          bow: -0.25,
        },
        { n: 2, x: g + 12, y: S0 - 32, to: { x: plateMid - 4, y: combTop + 3 }, bow: -0.22 },
        {
          n: 3,
          x: Math.round(W * 0.8),
          y: S0 - 34,
          to: { x: Math.round(W * 0.8) - 22, y: S0 + p.padTop * 0.45 },
          bow: -0.22,
        },
      ];

  const H = figureHeight(mode, model, finePointer);

  return {
    mode,
    W,
    H,
    gutter: g,
    name: { x: xr, y: p.nameY, size: p.nameSize },
    strip: { x0, x1, y0: S0, y1: S1 },
    rowY,
    rowPitch,
    holeR,
    beatW,
    xr,
    tape: { loopW, copies, lead },
    index,
    comb: { teeth, top: combTop, bottom: combBottom, rootTop, rootBottom, plate: c.plate, screws },
    bed,
    wheel,
    pinion,
    breaks,
    paper,
    controls,
    numerals,
  };
}
