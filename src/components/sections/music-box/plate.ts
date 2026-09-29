export interface ToneMap {
  w: number;
  h: number;
  tone: Float32Array;
  form: Float32Array;
}

/** R = darkness, G = form (see scripts/plate.py). */
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

/**
 * The music box's plate: her portrait as a line engraving, cut one
 * line at a time. The plate is divided into horizontal bands, one per
 * row of the paper strip (the highest note owns the top band), and each
 * note the box plays cuts the next few lines in its band. Play the song
 * and the song engraves her.
 */

export interface PlateLine {
  /** the line's centre height, in plate px */
  y: number;
  /** how much ink the line carries — the heaviest lines are cut first */
  ink: number;
  /** the ink of the line (a set of filled runs) */
  path: Path2D;
  /** where the ink starts and ends across the line, for the cutting animation */
  x0: number;
  x1: number;
}

export interface Plate {
  W: number;
  H: number;
  spacing: number;
  /** [band] → lines in the order they'll be cut */
  bands: PlateLine[][];
  /** the diagonal cross-hatching, laid in once her portrait is complete */
  hatch: Path2D;
  total: number;
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

/** A small deterministic shuffle, so each band fills in an order that looks cut by hand. */
function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildPlate(map: ToneMap, W: number, H: number, lines: number, bands: number): Plate {
  const spacing = H / lines;
  const wmax = spacing * 0.8;
  const amp = spacing * 1.1;
  const minW = spacing * 0.055;
  const step = Math.max(0.9, W / 340);
  const tone = (x: number, y: number) => bilinear(map.tone, map.w, map.h, x / W, y / H);
  const form = (x: number, y: number) => bilinear(map.form, map.w, map.h, x / W, y / H);

  const all: PlateLine[] = [];
  for (let i = 0; i < lines; i++) {
    const y0 = (i + 0.5) * spacing;
    const path = new Path2D();
    let x0 = Infinity;
    let x1 = -Infinity;
    let ink = 0;
    let top: [number, number][] = [];
    let bottom: [number, number][] = [];
    const flush = () => {
      if (top.length > 1) {
        path.moveTo(top[0][0], top[0][1]);
        for (let k = 1; k < top.length; k++) path.lineTo(top[k][0], top[k][1]);
        for (let k = bottom.length - 1; k >= 0; k--) path.lineTo(bottom[k][0], bottom[k][1]);
        path.closePath();
        x0 = Math.min(x0, top[0][0]);
        x1 = Math.max(x1, top[top.length - 1][0]);
      }
      top = [];
      bottom = [];
    };
    for (let x = 0; x <= W + 0.01; x += step) {
      const yl = y0 + amp * (form(x, y0) - 0.5);
      const w = wmax * tone(x, yl);
      if (w > minW) {
        top.push([x, yl - w / 2]);
        bottom.push([x, yl + w / 2]);
        ink += w * step;
      } else flush();
    }
    flush();
    if (x1 > x0) all.push({ y: y0, ink, path, x0, x1 });
  }

  // one band per row of the strip, top to bottom
  const out: PlateLine[][] = Array.from({ length: bands }, () => []);
  for (const line of all) {
    const b = Math.min(bands - 1, Math.floor((line.y / H) * bands));
    out[b].push(line);
  }

  // cross-hatching in the deepest shadows
  const hatch = new Path2D();
  const angle = (-38 * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const diag = Math.hypot(W, H);
  for (let k = -diag / 2; k < diag / 2; k += spacing * 1.25) {
    let top: [number, number][] = [];
    let bottom: [number, number][] = [];
    const flush = () => {
      if (top.length > 1) {
        hatch.moveTo(top[0][0], top[0][1]);
        for (let q = 1; q < top.length; q++) hatch.lineTo(top[q][0], top[q][1]);
        for (let q = bottom.length - 1; q >= 0; q--) hatch.lineTo(bottom[q][0], bottom[q][1]);
        hatch.closePath();
      }
      top = [];
      bottom = [];
    };
    for (let s = -diag / 2; s < diag / 2; s += step) {
      const px = W / 2 + dx * s + nx * k;
      const py = H / 2 + dy * s + ny * k;
      const t = px >= 0 && px <= W && py >= 0 && py <= H ? tone(px, py) : 0;
      const w = t > 0.74 ? ((t - 0.74) / 0.26) * wmax * 0.6 : 0;
      if (w > minW * 2) {
        top.push([px - (nx * w) / 2, py - (ny * w) / 2]);
        bottom.push([px + (nx * w) / 2, py + (ny * w) / 2]);
      } else flush();
    }
    flush();
  }

  return {
    W,
    H,
    spacing,
    // like an engraver: block in the darks first (hair, eyes, the line of the
    // smile), leave the fine shading for last — with a little hand-made
    // irregularity so neighbouring lines don't march in order
    bands: out.map((b, i) => {
      const jittered = shuffle(b, i + 1).map((line, k) => ({ line, key: line.ink * (0.85 + 0.3 * ((k * 0.618) % 1)) }));
      return jittered.sort((p, q) => q.key - p.key).map((j) => j.line);
    }),
    hatch,
    total: all.length,
  };
}
