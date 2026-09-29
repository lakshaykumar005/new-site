import type { ToneMap } from "./engrave";

/**
 * Micrography: the portrait's engraved lines are lines of text.
 *
 * Each line runs left to right, bending gently around her features, and
 * is filled with tiny capitals taken in reading order from a stream of
 * sentences. How dark a letter is printed (and, in the shadows, how
 * heavily) comes from the tone map — so from arm's length the words
 * are only shading, and under the glass they can be read.
 *
 * `layoutMicro` places every glyph once; `drawMicro` prints any range of
 * lines, or any small window at any magnification (for the glass).
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
  /** font size in portrait px */
  size: number;
  /** glyph advance in portrait px */
  adv: number;
  x: Float32Array;
  y: Float32Array;
  tone: Float32Array;
  chars: string[];
  /** first glyph of each line, and one past the last */
  lineStart: Int32Array;
  lineEnd: Int32Array;
  words: number;
}

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

const THRESHOLD = 0.02;

export function layoutMicro(
  map: ToneMap,
  W: number,
  H: number,
  opts: { lines: number; stream: string; hidden: HiddenLine[]; family: string }
): Micro {
  const spacing = H / opts.lines;
  const size = spacing * 1.02;
  const amp = spacing * 1.1;

  const measure = document.createElement("canvas").getContext("2d");
  let adv = size * 0.6;
  if (measure) {
    measure.font = `500 ${size}px ${opts.family}`;
    adv = measure.measureText("MMMMMMMMMM").width / 10 || adv;
  }

  const tone = (x: number, y: number) => bilinear(map.tone, map.w, map.h, x / W, y / H);
  const form = (x: number, y: number) => bilinear(map.form, map.w, map.h, x / W, y / H);

  // where each hidden sentence starts: line index and glyph column
  const hidden = opts.hidden.map((h) => ({
    line: Math.round(h.v * opts.lines - 0.5),
    col: Math.round((h.u * W) / adv),
    text: h.text.toUpperCase(),
  }));

  const stream = opts.stream.toUpperCase();
  let cursor = 0;
  const cols = Math.floor(W / adv);

  const xs: number[] = [];
  const ys: number[] = [];
  const ts: number[] = [];
  const cs: string[] = [];
  const lineStart = new Int32Array(opts.lines);
  const lineEnd = new Int32Array(opts.lines);

  for (let i = 0; i < opts.lines; i++) {
    lineStart[i] = xs.length;
    const y0 = (i + 0.5) * spacing;
    const here = hidden.find((h) => h.line === i);
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * adv;
      const y = y0 + amp * (form(x, y0) - 0.5);
      const t = tone(x, y);
      let ch: string;
      if (here && c >= here.col && c < here.col + here.text.length) {
        ch = here.text[c - here.col];
      } else {
        if (t < THRESHOLD) continue;
        ch = stream[cursor % stream.length];
        cursor++;
      }
      if (ch === " ") {
        if (t < THRESHOLD) continue;
      }
      xs.push(x);
      ys.push(y);
      ts.push(Math.max(t, here && c >= here.col && c < here.col + here.text.length ? 0.32 : 0));
      cs.push(ch);
    }
    lineEnd[i] = xs.length;
  }

  const words = Math.round(cursor / 6);

  return {
    W,
    H,
    lines: opts.lines,
    spacing,
    size,
    adv,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    tone: Float32Array.from(ts),
    chars: cs,
    lineStart,
    lineEnd,
    words,
  };
}

const INK = [28, 27, 43];
const BUCKETS = 14;

export interface DrawOptions {
  family: string;
  /** only these lines (for printing progressively) */
  fromLine?: number;
  toLine?: number;
  /** only glyphs inside this window, in portrait px (for the glass) */
  window?: { x: number; y: number; w: number; h: number };
  /** under the glass: even-sized letters, every word legible */
  legible?: boolean;
}

/** Tone → how much ink a letter carries (0 = a whisper, 1 = cut deep). */
function inkOf(t: number): number {
  const a = Math.min(1, Math.max(0, (t - 0.08) / 0.72));
  return Math.pow(a, 0.95);
}

/** Prints glyphs in portrait px; set the context's transform for scale. */
export function drawMicro(ctx: CanvasRenderingContext2D, m: Micro, opts: DrawOptions) {
  const from = Math.max(0, opts.fromLine ?? 0);
  const to = Math.min(m.lines, opts.toLine ?? m.lines);
  const win = opts.window;
  const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

  for (let i = from; i < to; i++) {
    if (win) {
      const ly = (i + 0.5) * m.spacing;
      if (ly < win.y - m.spacing * 2 || ly > win.y + win.h + m.spacing * 2) continue;
    }
    for (let g = m.lineStart[i]; g < m.lineEnd[i]; g++) {
      if (win && (m.x[g] < win.x - m.adv || m.x[g] > win.x + win.w + m.adv)) continue;
      const b = Math.round(inkOf(m.tone[g]) * (BUCKETS - 1));
      buckets[b].push(g);
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let b = 0; b < BUCKETS; b++) {
    const list = buckets[b];
    if (!list.length) continue;
    const a = b / (BUCKETS - 1);
    // like an engraved line, a letter swells in the shadows and thins in the light
    const size = opts.legible ? m.size * 0.92 : m.size * (0.5 + 0.64 * a);
    const alpha = opts.legible ? 0.34 + 0.66 * a : 0.2 + 0.8 * a;
    const colour = `rgba(${INK[0]},${INK[1]},${INK[2]},${alpha.toFixed(3)})`;
    ctx.font = `500 ${size.toFixed(2)}px ${opts.family}`;
    ctx.fillStyle = colour;
    for (const g of list) ctx.fillText(m.chars[g], m.x[g], m.y[g]);
    const heavy = opts.legible ? a > 0.7 : a > 0.5;
    if (heavy) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = m.size * (a - (opts.legible ? 0.7 : 0.5)) * (opts.legible ? 0.18 : 0.42);
      for (const g of list) ctx.strokeText(m.chars[g], m.x[g], m.y[g]);
    }
  }
}
