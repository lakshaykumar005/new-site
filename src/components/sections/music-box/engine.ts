"use client";

import { haptic } from "@/lib/device";
import { musicBox } from "@/lib/music/audio";
import { stopAll } from "@/lib/music/player";
import type { Geo } from "./geometry";
import type { BoxModel, Hole } from "./model";

/**
 * The music box as a small flywheel.
 *
 * One number describes the whole machine: `pos`, how many beats of
 * paper have passed the comb. The strip's offset, the handle's angle
 * and the pinion's angle are all read from it, so they can never
 * disagree. Hands move `pos` directly; let go and it keeps its
 * velocity, bleeding it off to friction. Whenever `pos` passes a
 * punched hole — either way, across the loop's join — that note is
 * plucked: its tine fills vermillion and rings, a mark opens at the
 * tip, the hole flashes and her letter lights.
 *
 * Under a hand, notes sound the instant they're crossed. Moving on its
 * own ("Let it play", or coasting), the flywheel can see where it will
 * be a moment from now, so it books its notes a beat-fraction ahead on
 * the audio clock and the tune keeps clockwork time.
 *
 * The loop only runs while something is moving. Every frame writes
 * transforms straight to the DOM; React never re-renders for motion.
 */

const INK = "#1c1b2b";
const VERMILLION = "#d9432a";

/** Beats per turn of the handle. */
const BEATS_PER_TURN = 3;
const DEG_PER_BEAT = 360 / BEATS_PER_TURN;
/** Where the strip rests: the first hole a breath away from the comb. */
export const REST_POS = -0.32;
/** Where the knob rests (degrees, screen space: 0 = 3 o'clock, clockwise). */
const KNOB_REST_DEG = -140;

const FRICTION = 2.2;
/** How briskly "Let it play" brings the flywheel up to tempo (1/s). */
const AUTO_EASE = 2.4;
const V_MIN = 0.05;
const V_MAX = 12;
const NUDGE = 0.75;
/** 1/8 of a turn, in beats */
const TICK_BEATS = BEATS_PER_TURN / 8;
/** How far a finger moves on the paper before it counts as a pull (or a scroll). */
const SLOP = 6;
/** A pull the browser takes back for a scroll this soon is given back too. */
const YOUNG_PULL = 28;
/** Free motion books its notes this far ahead on the audio clock (s)… */
const LOOKAHEAD = 0.09;
/** …when it is moving at least this fast (beats/s). Slower, notes pluck as crossed. */
const V_PREDICT = 0.25;

export interface EngineEls {
  tape: HTMLElement | SVGElement | null;
  wheel: HTMLElement | SVGElement | null;
  arm: HTMLElement | SVGElement | null;
  pinion: HTMLElement | SVGElement | null;
  knob: HTMLElement | SVGElement | null;
  crank: HTMLElement | null;
  /** [copy][hole] */
  holes: (SVGElement | undefined)[][];
  /** [row] */
  teeth: (SVGElement | undefined)[];
  /** [row] the tine's vermillion fill */
  inks: (SVGElement | undefined)[];
  /** [row] the mark at the tip, and the ring that opens from it */
  strikes: ({ disc: SVGElement | null; ring: SVGElement | null } | undefined)[];
  /** [letter index] */
  letters: (HTMLElement | undefined)[];
}

export interface EngineHooks {
  onAuto: (on: boolean) => void;
  onPasses: (n: number) => void;
  /** a hand has taken hold of the handle or the paper (or let go) */
  onGrab?: (on: boolean) => void;
}

type Drag =
  | { kind: "crank"; id: number; angle: number }
  | {
      kind: "strip";
      id: number;
      /** last x seen, and where the finger came down */
      x: number;
      x0: number;
      y0: number;
      /** false until the finger shows it's a pull and not a scroll */
      live: boolean;
      /** how the machine was running when the pull took hold */
      was: { auto: boolean; vel: number } | null;
    };

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * A touch only counts as a user gesture when it lifts (pointerup), so
 * audio can't start on the first pointerdown of a phone visit. Ask only
 * when the browser will say yes, and ask again on release.
 */
export function audioAllowed(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean; hasBeenActive: boolean } })
    .userActivation;
  return !ua || ua.isActive || ua.hasBeenActive;
}

let arming: Promise<void> | null = null;

/**
 * Start the audio now if it isn't running, the browser will allow it and
 * it would be heard (muted, there's no point waking it — the sound toggle
 * does that itself).
 */
export function armAudio() {
  if (arming || musicBox.unlocked || musicBox.muted || !audioAllowed()) return;
  arming = musicBox.unlock().finally(() => {
    arming = null;
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class BoxEngine {
  pos = REST_POS;
  vel = 0;
  auto = false;

  private readonly model: BoxModel;
  private readonly hooks: EngineHooks;
  private geo: Geo | null = null;
  private els: EngineEls | null = null;

  private drag: Drag | null = null;
  private raf = 0;
  private lastT = 0;
  private prevPos = REST_POS;
  private ema = 0;
  private lastEventT = 0;
  private lastMoveT = 0;
  private tickIdx = Math.floor(REST_POS / TICK_BEATS);
  private lastTickT = 0;
  private lastHapticT = 0;
  /** how fast it was going when it was last left to itself (for the settling click) */
  private coastFrom = 0;
  private passes = 0;
  private reduced = false;
  private dead = false;
  /** which loop the tape is anchored on (changes once per loop) */
  private anchor: number;
  /** holes mid-flash: [copy, hole, animation] */
  private flashes: { c: number; i: number; anim: Animation }[] = [];
  /** notes already booked on the audio clock: "dir:hole:loop" → when they're due (performance ms) */
  private booked = new Map<string, number>();
  /**
   * The audio clock minus the page clock (s). `currentTime` only moves
   * once per audio callback (every 3–12ms), so a single reading lags by a
   * random amount; the least-lagged recent reading is the true offset.
   */
  private clockOff = Number.NaN;

  constructor(model: BoxModel, hooks: EngineHooks) {
    this.model = model;
    this.hooks = hooks;
    this.anchor = Math.floor((REST_POS - model.seam) / model.loop);
  }

  // ── wiring ──────────────────────────────────────────────

  bind(geo: Geo, els: EngineEls) {
    this.geo = geo;
    this.els = els;
    this.render();
  }

  setReducedMotion(on: boolean) {
    this.reduced = on;
  }

  destroy() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.drag = null;
    this.els = null;
    this.booked.clear();
  }

  /** A hand has hold of the machine (a finger that may yet be a scroll doesn't count). */
  private get holding() {
    const d = this.drag;
    return d !== null && (d.kind === "crank" || d.live);
  }

  get dragging() {
    return this.holding;
  }

  // ── input ───────────────────────────────────────────────

  /** Anything a hand does first: wake the audio, silence other players. */
  private wake() {
    if (!musicBox.muted && audioAllowed()) void musicBox.unlock();
    stopAll();
  }

  /** A hand takes hold: the flywheel (and "Let it play") stops under it. */
  private hold(ts: number) {
    this.wake();
    if (this.auto) this.setAuto(false);
    this.vel = 0;
    this.ema = 0;
    this.coastFrom = 0;
    this.lastEventT = ts;
    this.lastMoveT = performance.now();
    // anything booked ahead was for a motion that has just been stopped
    this.booked.clear();
  }

  startCrank(e: PointerEvent) {
    // (a finger resting on the paper, not yet pulling, doesn't stop the other hand)
    if (this.holding || !this.els?.crank) return false;
    this.drag = null;
    this.hold(e.timeStamp);
    this.drag = { kind: "crank", id: e.pointerId, angle: this.angleAt(e) };
    this.hooks.onGrab?.(true);
    return true;
  }

  /**
   * A finger on the paper might be a pull, or the start of a scroll: it
   * takes hold only once it has moved sideways (a mouse, which can't
   * scroll, takes hold at once). Until then the music carries on.
   */
  startStrip(e: PointerEvent) {
    if (this.holding) return false;
    const d: Drag = {
      kind: "strip",
      id: e.pointerId,
      x: e.clientX,
      x0: e.clientX,
      y0: e.clientY,
      live: false,
      was: null,
    };
    this.drag = d;
    if (e.pointerType === "mouse") this.takeStrip(d, e.timeStamp);
    return true;
  }

  private takeStrip(d: Extract<Drag, { kind: "strip" }>, ts: number) {
    d.was = { auto: this.auto, vel: this.vel };
    d.live = true;
    this.hold(ts);
    this.hooks.onGrab?.(true);
  }

  move(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId || !this.geo) return;
    if (d.kind === "crank") {
      const a = this.angleAt(e);
      let delta = a - d.angle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      d.angle = a;
      // too near the axle, or a jump too big to know which way it went
      if (this.radiusAt(e) < this.geo.wheel.hub * 1.4 || Math.abs(delta) > 2.3) {
        this.lastEventT = e.timeStamp;
        return;
      }
      this.moveBy((delta / (Math.PI * 2)) * BEATS_PER_TURN, e.timeStamp);
      return;
    }
    if (!d.live) {
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        // a scroll: the page has it, and the music never noticed
        this.drag = null;
        return;
      }
      this.takeStrip(d, e.timeStamp);
      // (d.x is still where the finger came down: the paper catches up with it)
    }
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    // drag left = forward
    this.moveBy(-dx / this.geo.beatW, e.timeStamp);
  }

  end(e: PointerEvent, cancelled = false) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;

    if (d.kind === "strip" && !d.live) {
      // it never moved: either the browser took it for a scroll (leave
      // everything as it was), or it was a tap — a finger on the paper,
      // which stops it
      if (!cancelled) {
        this.hold(e.timeStamp);
        this.kick();
      }
      return;
    }

    this.hooks.onGrab?.(false);
    // the first touch of a visit only counts as a gesture as it lifts
    if (!cancelled) armAudio();

    if (cancelled && d.kind === "strip" && d.was && Math.abs(d.x - d.x0) < YOUNG_PULL) {
      // the browser decided it was a scroll after all: give the music back
      this.ema = 0;
      if (d.was.auto) {
        this.vel = d.was.vel;
        this.setAuto(true);
      } else {
        this.vel = d.was.vel;
        this.coastFrom = Math.abs(this.vel);
        this.kick();
      }
      return;
    }

    const still = performance.now() - this.lastMoveT > 90;
    this.vel = cancelled || still ? 0 : clamp(this.ema, -V_MAX, V_MAX);
    if (Math.abs(this.vel) < V_MIN) this.vel = 0;
    this.ema = 0;
    this.coastFrom = Math.abs(this.vel);
    this.kick();
  }

  /** ←/→: push the flywheel a little either way. */
  nudge(dir: 1 | -1) {
    this.wake();
    if (this.auto) this.setAuto(false);
    this.vel = clamp(this.vel + dir * NUDGE, -V_MAX, V_MAX);
    this.coastFrom = Math.max(this.coastFrom, Math.abs(this.vel));
    this.kick();
  }

  toggleAuto() {
    this.wake();
    this.setAuto(!this.auto);
  }

  setAuto(on: boolean) {
    if (on && this.holding) return;
    if (this.auto === on) return;
    this.auto = on;
    // switched off, it winds down from whatever speed it had
    if (!on) this.coastFrom = Math.abs(this.vel);
    this.hooks.onAuto(on);
    this.kick();
  }

  private angleAt(e: PointerEvent) {
    const r = this.els?.crank?.getBoundingClientRect();
    if (!r) return 0;
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }

  private radiusAt(e: PointerEvent) {
    const r = this.els?.crank?.getBoundingClientRect();
    if (!r) return 0;
    return Math.hypot(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }

  private moveBy(dpos: number, ts: number) {
    this.pos += dpos;
    const dt = (ts - this.lastEventT) / 1000;
    if (dt > 0.001) {
      const inst = clamp(dpos / dt, -3 * V_MAX, 3 * V_MAX);
      // an exponential moving average over roughly the last 50ms
      this.ema += (inst - this.ema) * (1 - Math.exp(-dt / 0.05));
    }
    this.lastEventT = ts;
    this.lastMoveT = performance.now();
    this.kick();
  }

  // ── the loop ────────────────────────────────────────────

  private kick() {
    if (this.raf || this.dead) return;
    this.lastT = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (t: number) => {
    this.raf = 0;
    if (this.dead) return;
    const dt = this.lastT ? Math.min(0.05, Math.max(0, (t - this.lastT) / 1000)) : 1 / 60;
    this.lastT = t;
    let rested = false;

    if (this.holding) {
      // the hand sets pos directly (see move)
    } else if (this.auto) {
      const target = this.model.bpm / 60;
      this.vel += (target - this.vel) * (1 - Math.exp(-dt * AUTO_EASE));
      this.pos += this.vel * dt;
    } else if (this.vel !== 0) {
      this.vel *= Math.exp(-FRICTION * dt);
      if (Math.abs(this.vel) < V_MIN) {
        this.vel = 0;
        rested = true;
      }
      this.pos += this.vel * dt;
    }

    if (this.pos !== this.prevPos) {
      this.render();
      this.cross(this.prevPos, this.pos);
      this.prevPos = this.pos;
    }
    if (rested) this.settle();
    this.lookAhead(t);

    const handMoving = this.holding && performance.now() - this.lastMoveT < 150;
    if (handMoving || this.auto || this.vel !== 0) {
      this.lastT = t;
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  /** Pluck every hole whose beat lies between p0 and p1 (in the direction travelled). */
  private cross(p0: number, p1: number) {
    const L = this.model.loop;
    const fwd = p1 > p0;
    const hits: { h: Hole; t: number; k: number }[] = [];
    for (const h of this.model.holes) {
      const k = fwd ? Math.floor((p1 - h.beat) / L) : Math.ceil((p1 - h.beat) / L);
      const t = h.beat + k * L;
      if (fwd ? t > p0 : t < p0) hits.push({ h, t, k });
    }
    if (hits.length) {
      hits.sort((a, b) => (fwd ? a.t - b.t : b.t - a.t));
      for (const { h, k } of hits) {
        // booked ahead on the audio clock? then it sounds on its own; just show it
        const booked = this.booked.delete(`${fwd ? 1 : -1}:${h.i}:${k}`);
        this.sound(h, p1, !booked);
      }
    }

    // the handle's ratchet: a tick every eighth of a turn — under the
    // hand, as a flung wheel winds down, and a whisper of it under "Let
    // it play". Only a hand on it feels the buzz (and never under reduced
    // motion).
    const idx = Math.floor(p1 / TICK_BEATS);
    if (idx !== this.tickIdx) {
      this.tickIdx = idx;
      const now = performance.now();
      if (now - this.lastTickT > 28) {
        this.lastTickT = now;
        const hand = this.holding;
        musicBox.tick(hand ? 0.045 : this.auto ? 0.011 : 0.03);
        if (hand && !this.reduced && now - this.lastHapticT > 45) {
          this.lastHapticT = now;
          haptic(4);
        }
      }
    }

    // complete forward passes of the loop
    const passes = Math.floor((p1 - REST_POS) / L);
    if (passes > this.passes) {
      this.passes = passes;
      this.hooks.onPasses(passes);
    }
  }

  /**
   * Moving on its own, the flywheel knows where it will be a moment from
   * now: velocity relaxes toward the tempo ("Let it play") or toward rest
   * (friction). Book each hole that will reach the comb within LOOKAHEAD
   * at the exact moment it will get there, once; the crossing itself then
   * only shows it.
   */
  private lookAhead(frameT: number) {
    const v = this.vel;
    if (this.holding || Math.abs(v) < V_PREDICT || !musicBox.audible) return;
    const now = performance.now();
    for (const [key, due] of this.booked) {
      // it turned round, or was caught, before it got there
      if (now - due > 250) this.booked.delete(key);
    }
    // keep the freshest reading of the audio clock (allowing for slow drift,
    // and starting afresh if it jumped — resumed after being hidden, say)
    const off = musicBox.now() - now / 1000;
    if (!(off <= this.clockOff) || this.clockOff - off > 0.05) this.clockOff = off;
    else this.clockOff -= 0.00002;

    const toward = this.auto ? this.model.bpm / 60 : 0;
    const acc = (this.auto ? AUTO_EASE : FRICTION) * (toward - v);
    const dir = v > 0 ? 1 : -1;
    const L = this.model.loop;
    for (const h of this.model.holes) {
      // this hole's next arrival at the comb, the way it's going
      const k = dir > 0 ? Math.floor((this.pos - h.beat) / L) + 1 : Math.ceil((this.pos - h.beat) / L) - 1;
      const d = h.beat + k * L - this.pos;
      // d = v·τ + ½·acc·τ², τ from the frame's timestamp (where `pos` stood);
      // rationalised, so it stays exact as acc → 0
      const disc = v * v + 2 * acc * d;
      if (disc < 0) continue; // it will stop before it gets there
      const tau = (2 * d) / (v + dir * Math.sqrt(disc));
      const due = frameT + tau * 1000;
      const lead = (due - now) / 1000;
      if (!(lead > 0.004) || lead > LOOKAHEAD) continue;
      const key = `${dir}:${h.i}:${k}`;
      if (this.booked.has(key)) continue;
      this.booked.set(key, due);
      const ev = h.ev;
      musicBox.pluck(ev.midi, { when: due / 1000 + this.clockOff, velocity: ev.velocity, voice: ev.voice });
    }
  }

  /** The flywheel has come to rest: the pawl drops into the ratchet with a soft click. */
  private settle() {
    const now = performance.now();
    if (this.coastFrom >= 0.6 && now - this.lastTickT > 140) {
      this.lastTickT = now;
      musicBox.tick(0.026);
    }
    this.coastFrom = 0;
    this.booked.clear();
  }

  private sound(h: Hole, at: number, pluck: boolean) {
    const ev = h.ev;
    if (pluck) musicBox.pluck(ev.midi, { velocity: ev.velocity, voice: ev.voice });
    const els = this.els;
    const geo = this.geo;
    if (!els || !geo) return;

    // the copy of this hole that is at the comb right now
    const L = this.model.loop;
    const c = clamp(geo.tape.lead + Math.round((this.phase(at) - h.beat) / L), 0, geo.tape.copies - 1);
    this.flash(c, h.i, 0);

    // the tine it struck: filled vermillion, a beat's breath, then steel again
    const tooth = els.teeth[h.row];
    if (tooth) {
      tooth.animate([{ color: VERMILLION }, { color: VERMILLION, offset: 0.3 }, { color: INK }], {
        duration: 640,
        easing: "ease-out",
      });
      if (!this.reduced) {
        const t = geo.comb.teeth[h.row];
        const len = t ? t.x1 - t.x0 : 40;
        // a cantilevered tine rings: a quick, decaying wobble about its root
        const amp = (Math.atan2(1.5, len) * 180) / Math.PI;
        const k = [1, -0.8, 0.62, -0.46, 0.32, -0.2, 0.1, -0.04, 0];
        tooth.animate(
          k.map((v) => ({ transform: `rotate(${(v * amp).toFixed(3)}deg)` })),
          { duration: 480, easing: "linear" }
        );
      }
    }
    els.inks[h.row]?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], {
      duration: 600,
      easing: "ease-out",
    });

    // …and at its tip, where the pin let go: a printed mark, and a
    // hairline ring opening from it (a fade alone under reduced motion)
    const strike = els.strikes[h.row];
    if (strike?.disc) {
      strike.disc.animate([{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], {
        duration: 520,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    }
    if (strike?.ring && !this.reduced) {
      strike.ring.animate(
        [
          { opacity: 0.9, transform: "scale(0.7)" },
          { opacity: 0, transform: "scale(1.75)" },
        ],
        { duration: 640, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }

    if (ev.voice === "melody" && ev.letter != null) {
      els.letters[ev.letter]?.animate(
        [{ color: VERMILLION }, { color: VERMILLION, offset: 0.4 }, { color: INK }],
        { duration: 900, easing: "ease-out" }
      );
    }
  }

  /** A punched hole passing the comb turns vermillion, then back to ink. */
  private flash(c: number, i: number, from: number) {
    const el = this.els?.holes[c]?.[i];
    if (!el) return;
    const anim = el.animate([{ fill: VERMILLION }, { fill: VERMILLION, offset: 0.28 }, { fill: INK }], {
      duration: 820,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    if (from) anim.currentTime = from;
    this.flashes = this.flashes.filter((f) => f.anim.playState === "running");
    this.flashes.push({ c, i, anim });
  }

  /**
   * The tape just jumped a whole loop to stay in view: hand any flash
   * still running to the copy of the hole that now sits where it was.
   */
  private reanchor(shift: number) {
    const copies = this.geo?.tape.copies ?? 0;
    const running = this.flashes.filter((f) => f.anim.playState === "running");
    this.flashes = [];
    for (const f of running) {
      const t = Number(f.anim.currentTime ?? 0);
      f.anim.cancel();
      const c = f.c - shift;
      if (c >= 0 && c < copies) this.flash(c, f.i, t);
    }
  }

  // ── drawing ─────────────────────────────────────────────

  /**
   * Where in the loop the comb is, in [seam, seam + loop). The tape is
   * re-anchored by one loop's width as this wraps — at the splice, in the
   * silence between the last note and the first.
   */
  private phase(pos: number) {
    const L = this.model.loop;
    const w = this.model.seam;
    return mod(pos - w, L) + w;
  }

  render() {
    const geo = this.geo;
    const els = this.els;
    if (!geo || !els) return;
    const L = this.model.loop;
    const pos = this.pos;

    if (els.tape) {
      const tx = geo.xr - geo.strip.x0 - (geo.tape.lead * L + this.phase(pos)) * geo.beatW;
      els.tape.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`;
      const anchor = Math.floor((pos - this.model.seam) / L);
      if (anchor !== this.anchor) {
        const shift = anchor - this.anchor;
        this.anchor = anchor;
        if (this.flashes.length && Math.abs(shift) < geo.tape.copies) this.reanchor(shift);
      }
    }

    // (angles kept in one turn, however long she has been playing)
    const turn = pos * DEG_PER_BEAT;
    const wheel = `rotate(${mod(geo.wheel.phase + turn, 360).toFixed(3)}deg)`;
    if (els.wheel) els.wheel.style.transform = wheel;
    if (els.arm) els.arm.style.transform = wheel;
    if (els.pinion) {
      const ratio = geo.wheel.teeth / geo.pinion.teeth;
      els.pinion.style.transform = `rotate(${mod(geo.pinion.phase - turn * ratio, 360).toFixed(3)}deg)`;
    }
    if (els.knob) {
      const a = ((KNOB_REST_DEG + (pos - REST_POS) * DEG_PER_BEAT) * Math.PI) / 180;
      const x = geo.wheel.c.x + Math.cos(a) * geo.wheel.arm;
      const y = geo.wheel.c.y + Math.sin(a) * geo.wheel.arm;
      els.knob.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
    }
  }
}

/** The arm's angle inside the wheel's own drawing, so the knob rests where it should. */
export function armLocalDeg(geo: Geo): number {
  return KNOB_REST_DEG - REST_POS * DEG_PER_BEAT - geo.wheel.phase;
}
