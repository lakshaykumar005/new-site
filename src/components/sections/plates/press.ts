/**
 * The press: the geometry of a print run and the run itself.
 *
 * A plate is inked by a roller passing over it, a sheet is laid on the
 * inked plate and pulled off from one corner, and the print is what
 * comes away on the sheet. Everything here moves by transform, opacity
 * and clip-path only — the layers are painted once and composited.
 */

import type { Grip } from "./layout";

/** the roller overhangs the plate by this much, top and bottom */
export const OVER = 12;

/** the roller's pass, the sheet lying down, the pull */
export const ROLL_MS = 900;
export const LAY_MS = 320;
export const PULL_MS = 1100;
/** breaths between the movements */
const AFTER_ROLL_MS = 120;
const AFTER_LAY_MS = 160;
/** the roller's fade in and out, at either edge of the plate */
const ROLLER_IN_MS = 120;
const ROLLER_OUT_MS = 180;
/** the curl at the pull's front, in the sheet's percent space */
const CURL_W = 5.5;
const EDGE_W = 0.7;

export const PRESS_MS = ROLL_MS + AFTER_ROLL_MS + LAY_MS + AFTER_LAY_MS + PULL_MS;

const FALLBACK: Record<string, string> = {
  "--ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "--ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  "--ease-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

/** The site's easing curves, read from the stylesheet so they stay one thing. */
export function easing(name: "--ease-out" | "--ease-in-out" | "--ease-spring"): string {
  if (typeof document === "undefined") return FALLBACK[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || FALLBACK[name];
}

/* ── the pull's geometry ──────────────────────────────────────────── */

/**
 * The corner the sheet is gripped by, seen from the far corner: the
 * pull's front is the line u + v = c, where u and v are distances from
 * that far corner (in percent of the sheet) and c runs 202 → 0.
 */
interface Anchor {
  ax: number;
  ay: number;
  sx: 1 | -1;
  sy: 1 | -1;
}

function anchorOf(grip: Grip): Anchor {
  const gx = grip.endsWith("r") ? 100 : 0;
  const gy = grip.startsWith("b") ? 100 : 0;
  const ax = 100 - gx;
  const ay = 100 - gy;
  return { ax, ay, sx: gx > ax ? 1 : -1, sy: gy > ay ? 1 : -1 };
}

const pct = (v: number) => `${Math.round(v * 100) / 100}%`;
const pt = (x: number, y: number) => `${pct(x)} ${pct(y)}`;

/** The part of the sheet still lying flat on the plate when the front is at c. */
export function coverPolygon(grip: Grip, c: number): string {
  const k = anchorOf(grip);
  return `polygon(${pt(k.ax, k.ay)}, ${pt(k.ax + k.sx * c, k.ay)}, ${pt(k.ax, k.ay + k.sy * c)})`;
}

/** A band of width w just beyond the front — the sheet curling up as it comes free. */
export function bandPolygon(grip: Grip, c: number, w: number): string {
  const k = anchorOf(grip);
  return `polygon(${pt(k.ax + k.sx * c, k.ay)}, ${pt(k.ax + k.sx * (c + w), k.ay)}, ${pt(k.ax, k.ay + k.sy * (c + w))}, ${pt(
    k.ax,
    k.ay + k.sy * c
  )})`;
}

/** Where the pulled print comes to rest. */
export interface Rest {
  rot: number;
  dx: number;
  dy: number;
}

export const restTransform = (r: Rest) => `rotate(${r.rot}deg) translate(${r.dx}px, ${r.dy}px)`;

/* ── the run ──────────────────────────────────────────────────────── */

export interface PressEls {
  /** the roller (may be missing: the run still prints) */
  roller: Element | null;
  /** the plate's own inked face, under the sheet */
  ink: Element | null;
  sheet: Element;
  cover: Element;
  curl: Element;
  edge: Element;
}

export interface PressOpts {
  /** the plate's width, in px */
  bedW: number;
  /** the roller's diameter, in px */
  rollerW: number;
  grip: Grip;
  rest: Rest;
}

export interface PressRun {
  /** resolves true when the print is pulled, false if the run was cancelled */
  done: Promise<boolean>;
  cancel(): void;
}

function fill(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation {
  return el.animate(frames, { fill: "both", ...opts });
}

/**
 * Print one plate: the roller passes left to right and the plate is
 * inked behind it; the sheet lies down; the sheet is pulled off from
 * `grip`, the curl riding the front, and settles at `rest`.
 */
export function runPress(els: PressEls, opts: PressOpts): PressRun {
  const anims: Animation[] = [];
  if (typeof Element === "undefined" || !("animate" in Element.prototype)) {
    return { done: Promise.resolve(true), cancel() {} };
  }
  const inOut = easing("--ease-in-out");
  const out = easing("--ease-out");
  const { bedW, rollerW: D, grip, rest } = opts;

  // ── the roller's pass ──
  const x0 = -(D + 10);
  const x1 = bedW + 10;
  const span = x1 - x0;
  // the plate is inked under the roller's axis: the front follows its centre
  const pA = (D / 2 + 10) / span;
  const pB = (bedW + D / 2 + 10) / span;

  if (els.roller) {
    anims.push(
      fill(
        els.roller,
        [{ transform: `translate3d(${x0}px, 0, 0)` }, { transform: `translate3d(${x1}px, 0, 0)` }],
        { duration: ROLL_MS, easing: inOut }
      ),
      fill(
        els.roller,
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: ROLLER_IN_MS / ROLL_MS },
          { opacity: 1, offset: 1 },
        ],
        { duration: ROLL_MS, easing: "linear" }
      ),
      fill(els.roller, [{ opacity: 1 }, { opacity: 0 }], { duration: ROLLER_OUT_MS, delay: ROLL_MS, easing: "linear" })
    );
  }
  if (els.ink) {
    anims.push(
      fill(
        els.ink,
        [
          { clipPath: "inset(0 100% 0 0)", opacity: 1, offset: 0 },
          { clipPath: "inset(0 100% 0 0)", opacity: 1, offset: pA },
          { clipPath: "inset(0 0% 0 0)", opacity: 1, offset: pB },
          { clipPath: "inset(0 0% 0 0)", opacity: 1, offset: 1 },
        ],
        { duration: ROLL_MS, easing: inOut }
      )
    );
  }
  // ── the sheet lies down ──
  const layAt = ROLL_MS + AFTER_ROLL_MS;
  anims.push(
    fill(
      els.sheet,
      [
        { opacity: 0, transform: "translate3d(0, -10px, 0)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: LAY_MS, delay: layAt, easing: out }
    )
  );

  // ── the pull ──
  const pullAt = layAt + LAY_MS + AFTER_LAY_MS;
  const pull = { duration: PULL_MS, delay: pullAt, easing: inOut };
  const cover = fill(els.cover, [{ clipPath: coverPolygon(grip, 202) }, { clipPath: coverPolygon(grip, 0) }], pull);
  anims.push(cover);
  // the curl rides the front and thins away as the last corner comes free
  const taper = 0.86;
  const cAt = (p: number) => 202 * (1 - p);
  anims.push(
    fill(
      els.curl,
      [
        { clipPath: bandPolygon(grip, 202, CURL_W), offset: 0 },
        { clipPath: bandPolygon(grip, cAt(taper), CURL_W), offset: taper },
        { clipPath: bandPolygon(grip, 0, 0), offset: 1 },
      ],
      pull
    ),
    fill(
      els.edge,
      [
        { clipPath: bandPolygon(grip, 202, EDGE_W), offset: 0 },
        { clipPath: bandPolygon(grip, cAt(taper), EDGE_W), offset: taper },
        { clipPath: bandPolygon(grip, 0, 0), offset: 1 },
      ],
      pull
    ),
    // the sheet slides and turns as it comes free
    fill(
      els.sheet,
      [
        { transform: "none", offset: 0 },
        { transform: "none", offset: 0.28, easing: out },
        { transform: restTransform(rest), offset: 1 },
      ],
      pull
    )
  );
  // the plate gives up its ink to the sheet
  if (els.ink) anims.push(fill(els.ink, [{ opacity: 1 }, { opacity: 0.12 }], { ...pull, easing: out }));

  let cancelled = false;
  const done = cover.finished.then(
    () => !cancelled,
    () => false
  );
  return {
    done,
    cancel() {
      cancelled = true;
      for (const a of anims) a.cancel();
    },
  };
}

/* ── hand-tinting ─────────────────────────────────────────────────── */

/** the mask is fully opaque to this fraction of its radius, then softens (keep in step with .tint) */
const BLOOM_SOLID = 0.46;
export const BLOOM_MS = 700;
/** ink spreading in damp paper: quick to start, long to settle — but not all at once */
const BLOOM_EASE = "cubic-bezier(0.42, 0.04, 0.26, 1)";

/**
 * Colour blooms into every `[data-tint]` layer inside `print` from one
 * point (client coordinates), at one speed, until each is covered.
 */
export function bloom(print: HTMLElement, origin: { x: number; y: number }): Animation[] {
  const layers = Array.from(print.querySelectorAll<HTMLElement>("[data-tint]"));
  if (!layers.length || !("animate" in Element.prototype)) return [];
  const local = layers.map((el) => {
    const r = el.getBoundingClientRect();
    const lx = origin.x - r.left;
    const ly = origin.y - r.top;
    const far = Math.max(
      Math.hypot(lx, ly),
      Math.hypot(r.width - lx, ly),
      Math.hypot(lx, r.height - ly),
      Math.hypot(r.width - lx, r.height - ly)
    );
    return { el, lx, ly, far };
  });
  const R = Math.ceil(Math.max(...local.map((l) => l.far)) / BLOOM_SOLID) + 2;
  return local.map(({ el, lx, ly }) =>
    el.animate(
      [
        { maskSize: "0px 0px", maskPosition: `${lx}px ${ly}px` },
        { maskSize: `${2 * R}px ${2 * R}px`, maskPosition: `${lx - R}px ${ly - R}px` },
      ],
      { duration: BLOOM_MS, easing: BLOOM_EASE, fill: "forwards" }
    )
  );
}
