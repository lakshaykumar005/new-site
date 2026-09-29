import type { ToneMap } from "./engrave";

/**
 * Micrography: the portrait's engraved lines are lines of text.
 *
 * Each line is a ribbon of ink whose width follows the tone, the way a
 * banknote portrait is cut, bending gently around her features — and each
 * ribbon is a line of words, taken in reading order from a stream of
 * sentences. Every letter sits in a box as tall as the ribbon where it
 * stands, so the letters swell in the hair and shrink to a thread in the
 * light, exactly where the engraved line would.
 *
 *   ink words   the light and middle tones: on the plate the letters would be
 *               lost inside a ribbon of ~90% ink, so the plate prints the
 *               ribbon alone and the glass prints the letters
 *   cut words   shadows, hair, features: the letters are cut out of the
 *               ribbon to bare paper, on the plate and under the glass
 *
 * A whole word is one or the other (with hysteresis along the line), and the
 * ribbon's alpha is solved for each so both print exactly the old
 * engraving's shade: from arm's length it is the engraving, and nothing
 * turns blotchy where the words change.
 *
 * Under the glass (`legible`) every letter is re-set at a readable size; the
 * engraved line is redrawn around it to print the same shade — a solid rule
 * under ink words that swells with the shadow, and a ribbon rising out of
 * it to hold the cut words.
 *
 * `layoutMicro` places every glyph once; `drawMicro` prints any range of
 * lines, or any small window at any magnification (for the glass). It reads
 * the scale and origin from the context's current transform.
 */

export interface HiddenLine {
  text: string;
  /** where it starts, as fractions of the portrait (across, down) */
  u: number;
  v: number;
}

export interface Micro {
  W: number;
  H: number;
  lines: number;
  spacing: number;
  /** the legible letter size in portrait px (the glass scales it to ~10.5px) */
  size: number;
  /** centreline samples: step, count per line, y, tone and polarity */
  dx: number;
  nx: number;
  cy: Float32Array;
  ct: Float32Array;
  cp: Uint8Array;
  /** distance along the line to the nearest change between ink and cut words */
  ce: Float32Array;
  x: Float32Array;
  y: Float32Array;
  rot: Float32Array;
  tone: Float32Array;
  /** 1 = the letter is cut from its ribbon */
  neg: Uint8Array;
  chars: string[];
  /** first glyph of each line, and one past the last */
  lineStart: Int32Array;
  lineEnd: Int32Array;
  words: number;
}

/** The canvas font string for the site's mono face, resolved from next/font. */
export function monoFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-dm-mono").trim();
  return v || "ui-monospace, monospace";
}

export async function ensureFont(family: string) {
  try {
    await document.fonts.load(`500 16px ${family}`);
  } catch {
    /* fall back silently */
  }
}

// ── The engraver's constants ──────────────────────────────────────────────
// Lengths are in line pitches unless noted. Tuned against the old line
// engraving (engrave.ts) patch by patch: both polarities print its tone
// curve to within ~2%.

const ADV = 0.6; // DM Mono advance, × font size
const CAP = 0.7; // DM Mono cap height, × font size
const INK_IN_CAPBOX = 0.277; // DM Mono 500 capitals: ink per cap-height box
const WEIGHT = 500;

const AMP = 1.3; // how far the lines bend around the form
const DX = 0.5; // centreline sampling step, portrait px
const TH = 0.03; // below this tone: bare paper

const TK = 0.8; // target ink coverage = TK·t (+ TDEEP in the deepest shadow)
const TDEEP = 0.12;
const W_K = 0.88; // ribbon width = W_K·t, clamped to [W_MIN, W_MAX] …
const W_MIN = 0.09; // … the hairline
const W_MAX = 0.93;
const W_DEEP = 1.04; // … swelling to this in the deepest shadow
const R_P_MIN = 0.3; // palest ribbon behind ink letters
const CAP_P = 0.72; // cap height of an ink letter, × ribbon width
const CAP_N = 0.4; // cap height of a cut letter, × ribbon width
const A_LO = 0.55; // ink letters' alpha at the faintest
const T_B = 0.52; // words are cut above this tone …
const D_B = 0.07; // … with this much hysteresis along the line
const FLOOR = 0.78; // legible letter size: sets the advance
const TRACK = 0.04; // letter spacing, × advance

const LENS_SIZE = 0.92; // letter size under the glass, × FLOOR
const LENS_A_LO = 0.82; // faintest ink letter under the glass
const LENS_COMPRESS = 0.55; // how much of the swell survives under the glass
const LENS_CAP_N = 0.7; // cut letters under the glass fill this much of their ribbon
const LENS_CUT_MIN = 0.62; // palest ribbon a cut letter is read against
const RULE_MIN = 0.035; // the rule under ink words: thinnest …
const RULE_MAX = 0.16; // … thickest …
const RULE_GAP = 0.07; // … and its gap below the baseline
const TAPER = 0.9; // the ribbon of a cut word swells out of the rule over this much of a letter

const INK: [number, number, number] = [28, 27, 43];

function bilinear(arr: Float32Array, w: number, h: number, u: number, v: number): number {
  const x = Math.min(Math.max(u * (w - 1), 0), w - 1);
  const y = Math.min(Math.max(v * (h - 1), 0), h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = arr[y0 * w + x0];
  const b = arr[y0 * w + x1];
  const c = arr[y1 * w + x0];
  const d = arr[y1 * w + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const isLetter = (ch: string) => ch !== " ";

/** ink per unit area the line must print at tone t (the old engraving's curve) */
function target(t: number): number {
  return TK * t + TDEEP * smooth(0.7, 1, t);
}

/** ribbon width at tone t, portrait px */
function widthOf(s: number, t: number): number {
  const w = Math.min(W_MAX, Math.max(W_MIN, W_K * t));
  return s * (w + (W_DEEP - W_MAX) * smooth(0.8, 1, t));
}

interface Style {
  /** ribbon width (portrait px) and alpha */
  w: number;
  rib: number;
  /** letter size (portrait px) and ink alpha */
  f: number;
  alpha: number;
}

/**
 * The line at tone t, for ink (neg = false) or cut (neg = true) words. On
 * the plate an ink word's letters would sit inside a ribbon of ~90% ink,
 * invisible, so the plate prints only the ribbon (its alpha solved without
 * them) and the glass prints the letters; cut letters show on both.
 */
function styleOf(s: number, t: number, neg: boolean): Style {
  const w = widthOf(s, t);
  const f = ((neg ? CAP_N : CAP_P) * w) / CAP;
  const D = (target(t) * s) / w; // how dark the box must print
  if (neg) {
    // the cut letters' share of the ribbon's box (tracked-out tiny letters take less)
    const c = (INK_IN_CAPBOX * CAP_N * Math.min(1, f / (s * FLOOR))) / (1 + TRACK);
    return { w, f, rib: clamp01(D / (1 - c)), alpha: 1 };
  }
  return { w, f, rib: Math.min(1, Math.max(R_P_MIN, D)), alpha: lerp(A_LO, 1, smooth(TH, 0.25, t)) };
}

/** letter size under the glass: never below legible, the swell compressed */
function lensSizeOf(f: number, lensF: number): number {
  return f <= lensF ? lensF : lensF + (f - lensF) * LENS_COMPRESS;
}

export function layoutMicro(
  map: ToneMap,
  W: number,
  H: number,
  opts: { lines: number; stream: string; hidden: HiddenLine[]; family: string }
): Micro {
  const N = opts.lines;
  const s = H / N;
  const amp = s * AMP;
  const tone = (x: number, y: number) => bilinear(map.tone, map.w, map.h, x / W, y / H);
  const form = (x: number, y: number) => bilinear(map.form, map.w, map.h, x / W, y / H);

  // every line's centreline, and the tone along it
  const nx = Math.ceil(W / DX) + 1;
  const cy = new Float32Array(N * nx);
  const ct = new Float32Array(N * nx);
  const cp = new Uint8Array(N * nx);
  for (let i = 0; i < N; i++) {
    const y0 = (i + 0.5) * s;
    for (let k = 0; k < nx; k++) {
      const x = k * DX;
      const y = y0 + amp * (form(x, y0) - 0.5);
      cy[i * nx + k] = y;
      ct[i * nx + k] = tone(x, y);
    }
  }
  const at = (arr: Float32Array, i: number, x: number) => {
    const f = x / DX;
    const k = Math.max(0, Math.min(nx - 2, Math.floor(f)));
    const r = Math.min(1, Math.max(0, f - k));
    return arr[i * nx + k] * (1 - r) + arr[i * nx + k + 1] * r;
  };
  const toneOver = (i: number, x0: number, x1: number) => {
    let sum = 0;
    for (let j = 0; j < 5; j++) sum += at(ct, i, x0 + ((j + 0.5) / 5) * (x1 - x0));
    return sum / 5;
  };
  // a letter's advance: its own size, but never below legible, so the glass never overlaps them
  const advOf = (t: number) => ADV * Math.max((CAP_P * widthOf(s, t)) / CAP, s * FLOOR) * (1 + TRACK);

  // hidden sentences start at their spot once the current word is finished
  const hidden = opts.hidden.map((h) => ({
    line: Math.round(h.v * N - 0.5),
    x: h.u * W,
    text: ` · ${h.text.toUpperCase()} · `,
  }));
  const stream = opts.stream.toUpperCase();
  let cursor = 0;

  const xs: number[] = [];
  const ys: number[] = [];
  const rots: number[] = [];
  const advs: number[] = [];
  const ts: number[] = [];
  const cs: string[] = [];
  const segs: number[] = [];
  const lineStart = new Int32Array(N);
  const lineEnd = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    lineStart[i] = xs.length;
    const here = hidden.find((h) => h.line === i);
    let hk = -1;
    let seg = 0;
    let afterGap = true;
    let x = 0;
    while (x < W) {
      if (here && hk < 0 && x >= here.x && !isLetter(stream[cursor % stream.length])) hk = 0;
      const inHidden = !!here && hk >= 0 && hk < here.text.length;
      let t = at(ct, i, x);
      if (t < TH && !inHidden) {
        x += s * 0.25;
        if (!afterGap) seg++;
        afterGap = true;
        continue;
      }
      afterGap = false;
      let a = advOf(t);
      t = toneOver(i, x, x + a);
      a = advOf(t);
      const xm = x + a / 2;
      let ch: string;
      if (inHidden && here) ch = here.text[hk++];
      else ch = stream[cursor++ % stream.length];
      const slope = (at(cy, i, xm + a / 2) - at(cy, i, xm - a / 2)) / a;
      xs.push(xm);
      ys.push(at(cy, i, xm));
      rots.push(Math.atan(slope));
      advs.push(a);
      ts.push(Math.max(t, TH));
      cs.push(ch);
      segs.push(seg);
      x += a;
    }
    lineEnd[i] = xs.length;
  }

  // ink or cut, a whole word at a time, with hysteresis along each run of line
  const neg = new Uint8Array(xs.length);
  for (let i = 0; i < N; i++) {
    const g0 = lineStart[i];
    const g1 = lineEnd[i];
    let state = 0;
    let lastSeg = -1;
    let g = g0;
    while (g < g1) {
      if (!isLetter(cs[g])) {
        g++;
        continue;
      }
      let e = g;
      let sum = 0;
      while (e < g1 && isLetter(cs[e]) && segs[e] === segs[g]) sum += ts[e++];
      const mean = sum / (e - g);
      if (segs[g] !== lastSeg) {
        state = mean > T_B ? 1 : 0;
        lastSeg = segs[g];
      } else if (state === 0 && mean > T_B + D_B) state = 1;
      else if (state === 1 && mean < T_B - D_B) state = 0;
      neg.fill(state, g, e);
      g = e;
    }
    // a space joins a cut word on either side of it, so the ribbon swells in the gap
    for (let q = g0; q < g1; q++) {
      if (isLetter(cs[q])) continue;
      let p = q - 1;
      while (p >= g0 && !isLetter(cs[p])) p--;
      let n = q + 1;
      while (n < g1 && !isLetter(cs[n])) n++;
      const before = p >= g0 && segs[p] === segs[q] ? neg[p] : 0;
      const after = n < g1 && segs[n] === segs[q] ? neg[n] : 0;
      neg[q] = before | after;
    }
    // the ribbon under each letter follows the letter
    for (let q = g0; q < g1; q++) {
      const k0 = Math.max(0, Math.ceil((xs[q] - advs[q] / 2) / DX));
      const k1 = Math.min(nx - 1, Math.floor((xs[q] + advs[q] / 2) / DX));
      cp.fill(neg[q], i * nx + k0, i * nx + k1 + 1);
    }
  }

  // how far each centreline sample is from the nearest ink/cut change (for the glass)
  const ce = new Float32Array(N * nx);
  for (let i = 0; i < N; i++) {
    const o = i * nx;
    let last = -1e9;
    for (let k = 0; k < nx; k++) {
      if (k > 0 && cp[o + k] !== cp[o + k - 1]) last = (k - 0.5) * DX;
      ce[o + k] = k * DX - last;
    }
    last = 1e9;
    for (let k = nx - 1; k >= 0; k--) {
      if (k < nx - 1 && cp[o + k] !== cp[o + k + 1]) last = (k + 0.5) * DX;
      ce[o + k] = Math.min(ce[o + k], last - k * DX);
    }
  }

  return {
    W,
    H,
    lines: N,
    spacing: s,
    size: s * FLOOR,
    dx: DX,
    nx,
    cy,
    ct,
    cp,
    ce,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    rot: Float32Array.from(rots),
    tone: Float32Array.from(ts),
    neg,
    chars: cs,
    lineStart,
    lineEnd,
    words: Math.round(cursor / 6),
  };
}

export interface DrawOptions {
  family: string;
  /** only these lines (for printing progressively) */
  fromLine?: number;
  toLine?: number;
  /** only glyphs inside this window, in portrait px (for the glass) */
  window?: { x: number; y: number; w: number; h: number };
  /** under the glass: letters re-set at a readable size, the line redrawn around them */
  legible?: boolean;
}

let scratch: HTMLCanvasElement | null = null;

/**
 * The ribbons, drawn analytically (exact coverage per device pixel) into a
 * device-pixel rectangle: device = (portrait − origin) × k − (rx, ry).
 */
function ribbons(m: Micro, from: number, to: number, k: number, ox: number, oy: number, rx: number, ry: number, rw: number, rh: number, legible: boolean): ImageData {
  const s = m.spacing;
  const acc = new Float32Array(rw * rh);
  const lensF = m.size * LENS_SIZE;
  for (let i = from; i < to; i++) {
    for (let px = 0; px < rw; px++) {
      const x = ox + (rx + px + 0.5) / k;
      if (x < 0 || x > m.W) continue;
      const fx = x / m.dx;
      const kk = Math.max(0, Math.min(m.nx - 2, Math.floor(fx)));
      const r = fx - kk;
      const j = i * m.nx + kk;
      const t = m.ct[j] * (1 - r) + m.ct[j + 1] * r;
      if (t < TH) continue;
      const yc = m.cy[j] * (1 - r) + m.cy[j + 1] * r;
      const neg = (r < 0.5 ? m.cp[j] : m.cp[j + 1]) === 1;
      const st = styleOf(s, t, neg);
      let w = st.w;
      let a = st.rib;
      let ym = yc;
      if (legible) {
        const capL = CAP * lensSizeOf(st.f, lensF);
        const al = lerp(LENS_A_LO, 1, clamp01((st.alpha - A_LO) / (1 - A_LO)));
        const letters = (INK_IN_CAPBOX * capL * al) / (1 + TRACK);
        const th = Math.min(s * RULE_MAX, Math.max(s * RULE_MIN, target(t) * s - letters));
        const ruleTop = yc + capL / 2 + s * RULE_GAP;
        if (neg) {
          // the ribbon holding cut words rises out of the rule across the word space
          const box = Math.max(w, capL / LENS_CAP_N);
          const c = (INK_IN_CAPBOX * LENS_CAP_N) / (1 + TRACK);
          const full = Math.min(1, Math.max(LENS_CUT_MIN, (target(t) * s) / box / (1 - c)));
          const e = m.ce[j] * (1 - r) + m.ce[j + 1] * r;
          const u = smooth(0, ADV * lensF * TAPER, e);
          a = lerp(1, full, u);
          const top = lerp(ruleTop, yc - box / 2, u);
          const bot = Math.max(yc + box / 2, ruleTop + th);
          w = bot - top;
          ym = (top + bot) / 2;
        } else {
          a = 1;
          w = th;
          ym = ruleTop + th / 2;
        }
      }
      const top = (ym - w / 2 - oy) * k - ry;
      const bot = (ym + w / 2 - oy) * k - ry;
      const pyA = Math.max(0, Math.floor(top));
      const pyB = Math.min(rh - 1, Math.ceil(bot) - 1);
      for (let py = pyA; py <= pyB; py++) {
        const cov = Math.min(py + 1, bot) - Math.max(py, top);
        if (cov <= 0) continue;
        const idx = py * rw + px;
        acc[idx] += (1 - acc[idx]) * cov * a;
      }
    }
  }
  const img = new ImageData(rw, rh);
  const d = img.data;
  for (let p = 0; p < rw * rh; p++) {
    const v = acc[p];
    if (v <= 0) continue;
    d[p * 4] = INK[0];
    d[p * 4 + 1] = INK[1];
    d[p * 4 + 2] = INK[2];
    d[p * 4 + 3] = Math.round(Math.min(1, v) * 255);
  }
  return img;
}

/** Prints lines or a window; set the context's transform for scale (uniform, unrotated). */
export function drawMicro(ctx: CanvasRenderingContext2D, m: Micro, opts: DrawOptions) {
  const s = m.spacing;
  const legible = !!opts.legible;
  const T = ctx.getTransform();
  const k = T.a;
  const ox = -T.e / k;
  const oy = -T.f / k;
  const win = opts.window;
  let from = Math.max(0, opts.fromLine ?? 0);
  let to = Math.min(m.lines, opts.toLine ?? m.lines);
  if (win) {
    from = Math.max(from, Math.floor(win.y / s) - 3);
    to = Math.min(to, Math.ceil((win.y + win.h) / s) + 3);
  }
  if (to <= from) return;

  // the device-pixel rectangle these lines (or this window) can touch
  const reach = s * (AMP / 2 + 1.2);
  const y0 = win ? win.y : from * s - reach;
  const y1 = win ? win.y + win.h : to * s + reach;
  const x0 = win ? win.x : 0;
  const x1 = win ? win.x + win.w : m.W;
  const rx = Math.max(0, Math.floor((x0 - ox) * k));
  const ry = Math.max(0, Math.floor((y0 - oy) * k));
  const rw = Math.min(ctx.canvas.width, Math.ceil((x1 - ox) * k)) - rx;
  const rh = Math.min(ctx.canvas.height, Math.ceil((y1 - oy) * k)) - ry;
  if (rw <= 0 || rh <= 0) return;

  // the glyphs to print, grouped by ink/cut, alpha and size
  const lensF = m.size * LENS_SIZE;
  const groups = new Map<string, number[]>();
  const margin = s * 3;
  for (let i = from; i < to; i++) {
    for (let g = m.lineStart[i]; g < m.lineEnd[i]; g++) {
      if (m.chars[g] === " ") continue;
      if (win && (m.x[g] < win.x - margin || m.x[g] > win.x + win.w + margin)) continue;
      const neg = m.neg[g] === 1;
      if (!neg && !legible) continue; // on the plate, ink letters live inside their ribbon
      const st = styleOf(s, m.tone[g], neg);
      let f = st.f;
      let alpha = st.alpha;
      if (legible) {
        f = lensSizeOf(f, lensF);
        if (!neg) alpha = lerp(LENS_A_LO, 1, clamp01((alpha - A_LO) / (1 - A_LO)));
      }
      const key = `${neg ? 1 : 0}|${Math.round(alpha * 40)}|${Math.round(f * 24)}`;
      const list = groups.get(key);
      if (list) list.push(g);
      else groups.set(key, [g]);
    }
  }
  const print = (c: CanvasRenderingContext2D, negPass: boolean, dx: number, dy: number) => {
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    for (const [key, list] of groups) {
      const [n, a40, f24] = key.split("|").map(Number);
      if ((n === 1) !== negPass) continue;
      const f = f24 / 24;
      if (!negPass) c.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${(a40 / 40).toFixed(3)})`;
      c.font = `${WEIGHT} ${f.toFixed(3)}px ${opts.family}`;
      const base = (CAP * f) / 2;
      for (const g of list) {
        const cos = Math.cos(m.rot[g]);
        const sin = Math.sin(m.rot[g]);
        c.setTransform(cos * k, sin * k, -sin * k, cos * k, (m.x[g] - ox) * k - dx, (m.y[g] - oy) * k - dy);
        c.fillText(m.chars[g], 0, base);
      }
    }
  };

  // ribbons, with the cut letters taken out of them, composited over the page
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width < rw || scratch.height < rh) {
    scratch.width = Math.max(scratch.width, rw);
    scratch.height = Math.max(scratch.height, rh);
  }
  const sc = scratch.getContext("2d");
  if (!sc) return;
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = "source-over";
  sc.clearRect(0, 0, rw, rh);
  sc.putImageData(ribbons(m, from, to, k, ox, oy, rx, ry, rw, rh, legible), 0, 0);
  sc.globalCompositeOperation = "destination-out";
  sc.fillStyle = "#000";
  print(sc, true, rx, ry);
  sc.globalCompositeOperation = "source-over";
  sc.setTransform(1, 0, 0, 1, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, 0, 0, rw, rh, rx, ry, rw, rh);
  ctx.restore();

  // then the ink letters
  ctx.save();
  print(ctx, false, 0, 0);
  ctx.restore();
}
