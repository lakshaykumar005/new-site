/**
 * Line engraving, the way banknote portraits are cut: parallel lines
 * of ink that swell where the picture is dark, thin to nothing in the
 * highlights, and bend slightly around the form. A second, diagonal
 * set of lines cross-hatches only the deepest shadows.
 *
 * Input is a tone map prepared by scripts/photos.py:
 *   R = darkness (0 paper … 255 ink), G = form (drives the bending).
 */

export interface ToneMap {
  w: number;
  h: number;
  tone: Float32Array;
  form: Float32Array;
}

export async function loadToneMap(src: string): Promise<ToneMap> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const n = c.width * c.height;
  const tone = new Float32Array(n);
  const form = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    tone[i] = data[i * 4] / 255;
    form[i] = data[i * 4 + 1] / 255;
  }
  return { w: c.width, h: c.height, tone, form };
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

export interface EngraveOptions {
  /** number of engraved lines from top to bottom */
  lines: number;
  ink: string;
}

type Pt = [number, number];

function fillRun(ctx: CanvasRenderingContext2D, top: Pt[], bottom: Pt[]) {
  if (top.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
  for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** Engraves the whole portrait into ctx, in CSS pixels (W × H). */
export function engrave(ctx: CanvasRenderingContext2D, map: ToneMap, W: number, H: number, opts: EngraveOptions) {
  const spacing = H / opts.lines;
  const wmax = spacing * 0.8;
  const amp = spacing * 1.1;
  const minW = spacing * 0.055;
  const step = Math.max(0.9, W / 360);
  const tone = (x: number, y: number) => bilinear(map.tone, map.w, map.h, x / W, y / H);
  const form = (x: number, y: number) => bilinear(map.form, map.w, map.h, x / W, y / H);

  ctx.fillStyle = opts.ink;

  // the main, horizontal lines
  for (let i = 0; i < opts.lines; i++) {
    const y0 = (i + 0.5) * spacing;
    let top: Pt[] = [];
    let bottom: Pt[] = [];
    for (let x = 0; x <= W + 0.01; x += step) {
      const yl = y0 + amp * (form(x, y0) - 0.5);
      const w = wmax * tone(x, yl);
      if (w > minW) {
        top.push([x, yl - w / 2]);
        bottom.push([x, yl + w / 2]);
      } else if (top.length) {
        fillRun(ctx, top, bottom);
        top = [];
        bottom = [];
      }
    }
    fillRun(ctx, top, bottom);
  }

  // cross-hatching, only where it's darkest
  const angle = (-38 * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const cx = W / 2;
  const cy = H / 2;
  const diag = Math.hypot(W, H);
  const hs = spacing * 1.25;
  for (let k = -diag / 2; k < diag / 2; k += hs) {
    let top: Pt[] = [];
    let bottom: Pt[] = [];
    for (let s = -diag / 2; s < diag / 2; s += step) {
      const px = cx + dx * s + nx * k;
      const py = cy + dy * s + ny * k;
      const inside = px >= 0 && px <= W && py >= 0 && py <= H;
      const t = inside ? tone(px, py) : 0;
      const w = t > 0.74 ? ((t - 0.74) / 0.26) * wmax * 0.6 : 0;
      if (w > minW * 2) {
        top.push([px - (nx * w) / 2, py - (ny * w) / 2]);
        bottom.push([px + (nx * w) / 2, py + (ny * w) / 2]);
      } else if (top.length) {
        fillRun(ctx, top, bottom);
        top = [];
        bottom = [];
      }
    }
    fillRun(ctx, top, bottom);
  }
}
