import type { Pt } from "./geometry";

/** Path builders for the engraving. Everything returns plain SVG path data. */

const f = (v: number) => (Math.round(v * 100) / 100).toString();
const pt = (x: number, y: number) => `${f(x)} ${f(y)}`;

/**
 * A spur gear centred on (0, 0): straight, slightly tapered flanks that
 * pass through the pitch circle, flat lands at tip and root. Tooth 0
 * points along +x.
 */
export function gearPath(teeth: number, r: number, m: number): string {
  const ra = r + m;
  const rd = r - 1.25 * m;
  const step = (Math.PI * 2) / teeth;
  const tipHalf = step * 0.16;
  const pitchHalf = step * 0.245;
  const rootHalf = step * 0.31;
  const at = (rad: number, a: number) => pt(rad * Math.cos(a), rad * Math.sin(a));
  let d = "";
  for (let j = 0; j < teeth; j++) {
    const a = j * step;
    d += j === 0 ? `M${at(rd, a - rootHalf)}` : `A${f(rd)} ${f(rd)} 0 0 1 ${at(rd, a - rootHalf)}`;
    d += `L${at(r, a - pitchHalf)}L${at(ra, a - tipHalf)}`;
    d += `A${f(ra)} ${f(ra)} 0 0 1 ${at(ra, a + tipHalf)}`;
    d += `L${at(r, a + pitchHalf)}L${at(rd, a + rootHalf)}`;
  }
  d += `A${f(rd)} ${f(rd)} 0 0 1 ${at(rd, Math.PI * 2 - rootHalf)}Z`;
  return d;
}

/** A full circle as a path (for compound paths with holes). */
export function circlePath(cx: number, cy: number, r: number, ccw = false): string {
  const s = ccw ? 0 : 1;
  return `M${pt(cx + r, cy)}A${f(r)} ${f(r)} 0 1 ${s} ${pt(cx - r, cy)}A${f(r)} ${f(r)} 0 1 ${s} ${pt(cx + r, cy)}Z`;
}

/** An arc of a circle between two angles (radians, clockwise on screen). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${pt(cx + r * Math.cos(a0), cy + r * Math.sin(a0))}A${f(r)} ${f(r)} 0 ${large} 1 ${pt(
    cx + r * Math.cos(a1),
    cy + r * Math.sin(a1)
  )}`;
}

/**
 * A curved spoke from hub to rim, centred on (0, 0) at angle `a`,
 * sweeping `sweep` radians by the time it reaches the rim, tapering
 * from `w0` at the hub to `w1` at the rim.
 */
export function spokePath(a: number, r0: number, r1: number, sweep: number, w0: number, w1: number): string {
  const N = 10;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = r0 + (r1 - r0) * t;
    // ease the sweep so the spoke leaves the hub radially and meets the rim at an angle
    const ang = a + sweep * t * t * (1.6 - 0.6 * t);
    const w = (w0 + (w1 - w0) * t) / 2;
    // normal to the centreline, approximated by the local angular direction
    const cx = r * Math.cos(ang);
    const cy = r * Math.sin(ang);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    left.push([cx + nx * w, cy + ny * w]);
    right.push([cx - nx * w, cy - ny * w]);
  }
  const pts = [...left, ...right.reverse()];
  let d = `M${pt(pts[0][0], pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${pt(pts[i][0], pts[i][1])}`;
  return d + "Z";
}

/** A crank arm from (0,0) to (len, 0), tapering, with round bosses at both ends. */
export function armPath(len: number, w0: number, w1: number, boss0: number, boss1: number): string {
  const h0 = Math.min(w0 / 2, boss0 * 0.95);
  const h1 = Math.min(w1 / 2, boss1 * 0.95);
  // where the arm's edges run into the two round bosses
  const s0 = Math.sqrt(boss0 * boss0 - h0 * h0);
  const s1 = Math.sqrt(boss1 * boss1 - h1 * h1);
  return [
    `M${pt(s0, -h0)}`,
    `L${pt(len - s1, -h1)}`,
    `A${f(boss1)} ${f(boss1)} 0 1 1 ${pt(len - s1, h1)}`,
    `L${pt(s0, h0)}`,
    `A${f(boss0)} ${f(boss0)} 0 1 1 ${pt(s0, -h0)}`,
    "Z",
  ].join("");
}

/**
 * Parallel hatch lines at `angleDeg` covering a box, `gap` apart.
 * Clip them with a clipPath to the shape being shaded.
 */
export function hatchPath(x0: number, y0: number, x1: number, y1: number, angleDeg: number, gap: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // unit normal
  const nx = -dy;
  const ny = dx;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const half = Math.hypot(x1 - x0, y1 - y0) / 2 + gap;
  let d = "";
  for (let s = -half; s <= half; s += gap) {
    const px = cx + nx * s;
    const py = cy + ny * s;
    d += `M${pt(px - dx * half, py - dy * half)}L${pt(px + dx * half, py + dy * half)}`;
  }
  return d;
}

/** A leader line: a gentle bow from a numeral to the part it names. */
export function leaderPath(from: Pt, to: Pt, bow: number): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // control point pushed sideways
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  return `M${pt(from.x, from.y)}Q${pt(cx, cy)} ${pt(to.x, to.y)}`;
}

/** Where a leader should leave a numeral's circle of radius r (towards `to`, bowed). */
export function leaderStart(c: Pt, to: Pt, r: number, bow: number): Pt {
  const mx = (c.x + to.x) / 2;
  const my = (c.y + to.y) / 2;
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const qx = mx - dy * bow;
  const qy = my + dx * bow;
  const vx = qx - c.x;
  const vy = qy - c.y;
  const l = Math.hypot(vx, vy) || 1;
  return { x: c.x + (vx / l) * r, y: c.y + (vy / l) * r };
}

/**
 * A direction-of-rotation arrow, as drawn beside a wheel on a patent
 * sheet: an arc (clockwise from a0 to a1, radians) and a slender head.
 */
export function rotationArrow(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  head = 6
): { arc: string; head: string } {
  // stop the arc where the head begins
  const back = head / r;
  const arc = arcPath(cx, cy, r, a0, a1 - back * 0.6);
  const tip = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const tx = -Math.sin(a1);
  const ty = Math.cos(a1);
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const bx = tip.x - tx * head;
  const by = tip.y - ty * head;
  const w = head * 0.34;
  const headD = `M${pt(tip.x, tip.y)}L${pt(bx + nx * w, by + ny * w)}L${pt(bx - nx * w, by - ny * w)}Z`;
  return { arc, head: headD };
}

export function polyPath(points: Pt[], close = true): string {
  if (!points.length) return "";
  let d = `M${pt(points[0].x, points[0].y)}`;
  for (let i = 1; i < points.length; i++) d += `L${pt(points[i].x, points[i].y)}`;
  return close ? d + "Z" : d;
}

export { f as fmt };
