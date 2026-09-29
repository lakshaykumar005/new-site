"use client";

import { haptic } from "@/lib/device";
import { musicBox } from "@/lib/music/audio";

/**
 * The dial: a ring with six markings that turns under a finger, clicks
 * over detents and settles on the nearest one with a spring.
 *
 * One number describes it — `angle`, the ring's rotation, clockwise,
 * in degrees. Marking i is engraved at i·60° round from the top, so it
 * sits at the top when angle ≡ −i·60°. Every detent crossed gives a
 * tick; the mark under the index is what the staff shows.
 *
 * The loop only runs while the ring is settling; a hand moves it
 * directly. Every frame writes one transform. React never renders
 * the rotation.
 */

export interface DialHooks {
  /** the dial now points at this variation (during a drag: as soon as a detent is crossed) */
  onDetent: (index: number) => void;
  /** a detent clicked past — every one, including those passed on the way to a distant mark */
  onTick?: () => void;
  onGrab?: (on: boolean) => void;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** an angle folded into (−180, 180] */
const fold = (a: number) => mod(a + 180, 360) - 180;

/** A flick carries on for about this long before the spring takes over (s). */
const FLICK = 0.14;
/** A flick can skip at most this many marks. */
const FLICK_MAX = 2;
const V_MAX = 900;
/** A press that moves less than this (px) and lifts within this (ms) is a tap. */
const TAP_PX = 6;
const TAP_MS = 400;

/** The spring: stiff enough to be decisive, a touch under-damped so it lands with a small overshoot. */
const K = 190;
const DAMPING = 2 * Math.sqrt(K) * 0.74;

interface Sample {
  t: number;
  a: number;
}

interface Turn {
  /** the pointer's last angle round the centre, or null for a turn driven by distance (the staff) */
  phi: number | null;
  cx: number;
  cy: number;
  x0: number;
  y0: number;
  t0: number;
  moved: number;
  samples: Sample[];
}

export class DialEngine {
  angle = 0;
  /** degrees per second */
  vel = 0;
  reduced = false;

  private readonly count: number;
  private readonly step: number;
  private readonly hooks: DialHooks;
  /** the detent under the index, unwrapped (…, −1, 0, 1, …) */
  private n = 0;
  /** where the spring is heading (unwrapped), null at rest */
  private target: number | null = null;
  private tween: { from: number; to: number; t0: number; dur: number } | null = null;
  private turn: Turn | null = null;
  private ring: HTMLElement | null = null;
  private raf = 0;
  private last = 0;

  constructor(count: number, hooks: DialHooks) {
    this.count = count;
    this.step = 360 / count;
    this.hooks = hooks;
  }

  bind(ring: HTMLElement | null) {
    this.ring = ring;
    this.write();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ring = null;
  }

  /** the mark under the index */
  get index(): number {
    return mod(this.n, this.count);
  }

  get turning(): boolean {
    return this.turn !== null;
  }

  /** Put the dial at a mark without motion. */
  set(index: number) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.target = null;
    this.tween = null;
    this.vel = 0;
    this.n = index;
    this.angle = -index * this.step;
    this.write();
  }

  /** Turn to the next (+1) or previous (−1) mark; presses in a row add up. */
  stepBy(delta: number) {
    const base = this.target ?? this.n;
    this.spring(base + delta);
  }

  /** Turn to a mark by the shortest way round. */
  select(index: number) {
    const base = this.target ?? this.n;
    let d = mod(index - mod(base, this.count), this.count);
    if (d > this.count / 2) d -= this.count;
    this.spring(base + d);
  }

  // ── a hand on the ring ──────────────────────────────────

  /** A finger comes down on the ring at (px, py); the ring's centre is (cx, cy). */
  pointerDown(px: number, py: number, cx: number, cy: number) {
    this.begin({ phi: this.phiOf(px, py, cx, cy), cx, cy, x0: px, y0: py });
  }

  pointerMove(px: number, py: number) {
    const t = this.turn;
    if (!t || t.phi === null) return;
    const phi = this.phiOf(px, py, t.cx, t.cy);
    const d = fold(phi - t.phi);
    t.phi = phi;
    t.moved = Math.max(t.moved, Math.hypot(px - t.x0, py - t.y0));
    this.turnBy(d);
  }

  pointerUp(px: number, py: number) {
    const t = this.turn;
    if (!t) return;
    if (t.phi !== null && t.moved < TAP_PX && performance.now() - t.t0 < TAP_MS) {
      // a tap: the marking under the finger comes to the top
      const psi = this.phiOf(px, py, t.cx, t.cy) - this.angle;
      const index = mod(Math.round(psi / this.step), this.count);
      this.turn = null;
      this.hooks.onGrab?.(false);
      this.select(index);
      return;
    }
    this.end();
  }

  pointerCancel() {
    if (!this.turn) return;
    this.end();
  }

  // ── a hand on something else that turns it (the staff) ──

  /** A turn driven by distance rather than angle. */
  beginTurn() {
    this.begin({ phi: null, cx: 0, cy: 0, x0: 0, y0: 0 });
  }

  /** Turn the ring by some degrees under a hand. */
  turnBy(deg: number) {
    const t = this.turn;
    if (!t) return;
    const now = performance.now();
    this.setAngle(this.angle + deg);
    t.samples.push({ t: now, a: this.angle });
    while (t.samples.length > 2 && now - t.samples[0].t > 120) t.samples.shift();
  }

  /** The hand lets go: carry the flick, then settle on a mark. */
  endTurn() {
    if (!this.turn) return;
    this.end();
  }

  // ── inside ──────────────────────────────────────────────

  private phiOf(px: number, py: number, cx: number, cy: number): number {
    // clockwise from the top
    return (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
  }

  private begin(t: Omit<Turn, "t0" | "moved" | "samples">) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.target = null;
    this.tween = null;
    this.vel = 0;
    const now = performance.now();
    this.turn = { ...t, t0: now, moved: 0, samples: [{ t: now, a: this.angle }] };
    this.hooks.onGrab?.(true);
  }

  private end() {
    const t = this.turn;
    if (!t) return;
    this.turn = null;
    this.hooks.onGrab?.(false);
    // the flick: how fast the ring was going over the last moments
    const now = performance.now();
    const first = t.samples[0];
    const last = t.samples[t.samples.length - 1];
    let v = 0;
    if (first && last && last.t - first.t > 8 && now - last.t < 90) {
      v = ((last.a - first.a) / (last.t - first.t)) * 1000;
    }
    v = Math.max(-V_MAX, Math.min(V_MAX, v));
    // a flick of the ring carries on a little; a swipe across the music means one step, so it settles where it was left
    const ahead = t.phi === null ? this.angle : this.angle + v * FLICK;
    let n = Math.round(-ahead / this.step);
    n = Math.max(this.n - FLICK_MAX, Math.min(this.n + FLICK_MAX, n));
    this.spring(n, t.phi === null ? 0 : v);
  }

  /** Head for a detent (unwrapped) with the spring, keeping any velocity the hand left. */
  private spring(n: number, v = this.vel) {
    if (mod(n, this.count) !== this.index || n !== this.n) this.hooks.onDetent(mod(n, this.count));
    this.target = n;
    this.vel = v;
    if (this.reduced) {
      this.tween = { from: this.angle, to: -n * this.step, t0: performance.now(), dur: 200 };
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = () => {
    this.raf = 0;
    const now = performance.now();
    const dt = Math.min(0.032, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (this.target === null) return;
    const goal = -this.target * this.step;

    if (this.tween) {
      const p = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = 1 - Math.pow(1 - p, 3);
      this.setAngle(this.tween.from + (this.tween.to - this.tween.from) * e);
      if (p >= 1) {
        this.tween = null;
        this.settle(goal);
        return;
      }
    } else {
      const x = this.angle - goal;
      this.vel += (-K * x - DAMPING * this.vel) * dt;
      this.setAngle(this.angle + this.vel * dt);
      if (Math.abs(this.angle - goal) < 0.05 && Math.abs(this.vel) < 3) {
        this.settle(goal);
        return;
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private settle(goal: number) {
    this.target = null;
    this.vel = 0;
    this.setAngle(goal);
  }

  private setAngle(a: number) {
    this.angle = a;
    const n = Math.round(-a / this.step);
    while (this.n !== n) {
      this.n += Math.sign(n - this.n);
      this.click();
    }
    this.write();
  }

  /** A detent clicks past the index. */
  private click() {
    musicBox.tick();
    haptic(4);
    this.hooks.onTick?.();
    // under a hand the staff follows the ring; on its way to a chosen mark it already knows where it's going
    if (this.turn) this.hooks.onDetent(this.index);
  }

  private write() {
    if (this.ring) this.ring.style.transform = `rotate(${this.angle.toFixed(3)}deg)`;
  }
}
