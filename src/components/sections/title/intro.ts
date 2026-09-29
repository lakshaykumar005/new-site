/**
 * The title page's first performance: letter by letter, the letter
 * lifts and reddens, lets go of a notehead, and the notehead falls onto
 * the staff under gravity, lands (the pluck is fired on that very
 * frame), overshoots a hair and settles like something with weight.
 *
 * One requestAnimationFrame clock drives everything and writes straight
 * to the DOM; the stateful styling (colour, stem drawing, labels) lives
 * in CSS keyed off data attributes, which React never touches.
 */

export interface IntroPart {
  letter: HTMLElement | null;
  note: SVGGElement | null;
  head: SVGGElement | null;
  label: HTMLElement | null;
  /** barlines that appear when this note lands */
  bars: (SVGGElement | null)[];
  /** how far the head falls, in SVG units (1/100 em of the name) */
  drop: number;
}

export interface IntroOptions {
  parts: IntroPart[];
  reduced: boolean;
  /**
   * fired on the frame each note lands; `late` when the frame came long
   * after the landing (the tab was hidden), so it shouldn't be sounded
   */
  onLand: (i: number, late: boolean) => void;
  /** fired once the last note has settled */
  onDone: () => void;
}

export interface IntroHandle {
  /** jump to the end state without calling onDone */
  cancel: () => void;
}

/** seconds between landings — the pulse of the spelling */
const SPACING = 0.28;
/** the letter lifts this long before it lets go of its note */
const LIFT = 0.09;
/**
 * The fall: a note is let go with a little downward speed (a pin
 * releasing it, not a drop from rest — from rest it would seem to hang
 * under the letter) and then gathers speed. A drop of 45 units (0.45em)
 * takes 0.27s; shorter drops take less, as sqrt(d).
 */
const FALL_REF = 0.27;
const DROP_REF = 45;
/** share of the average speed the note already has when it's let go */
const PUSH = 0.4;
/** after landing: the letter settles, then the note cools to ink */
const SETTLE = 0.07;
const COOL = 0.46;
/** the landing spring */
const SPRING_HZ = 7.5;
const SPRING_DECAY = 0.075;
const SPRING_TIME = 0.42;
const RESTITUTION = 0.5;
/** a landing noticed this late (s) happened while nobody was watching */
const LATE = 0.15;

type Stage = 0 | 1 | 2 | 3 | 4 | 5;

export function runIntro({ parts, reduced, onLand, onDone }: IntroOptions): IntroHandle {
  const n = parts.length;
  const fall = parts.map((p) => (reduced ? 0 : FALL_REF * Math.sqrt(Math.max(p.drop, 4) / DROP_REF)));
  const first = LIFT + (fall[0] ?? 0) + 0.02;
  const land = parts.map((_, i) => first + i * SPACING);
  const release = land.map((t, i) => t - fall[i]);
  const lift = release.map((t) => Math.max(0, t - LIFT));
  const end = (land[n - 1] ?? 0) + Math.max(COOL, SPRING_TIME) + 0.1;
  const omega = 2 * Math.PI * SPRING_HZ;

  // 0 waiting · 1 lifted · 2 falling · 3 landed · 4 letter settled · 5 cooled
  const stage: Stage[] = new Array(n).fill(0);
  let raf = 0;
  let over = false;
  // The clock starts now, not at the first frame's timestamp: in Chromium
  // that frame can be the very one the tap arrived in, stamped before the
  // tap's handler ran — and waking the audio up inside that handler can
  // take a good fraction of a second, which would all be charged to the
  // first letter, and it would lift and let go of its note in one frame.
  const born = performance.now();

  const setHead = (p: IntroPart, dy: number | null, opacity: number | null) => {
    if (!p.head) return;
    if (dy === null) p.head.removeAttribute("transform");
    else p.head.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`);
    p.head.style.opacity = opacity === null ? "" : opacity.toFixed(3);
  };

  const showLanded = (p: IntroPart) => {
    p.label?.setAttribute("data-shown", "");
    for (const b of p.bars) b?.setAttribute("data-shown", "");
  };

  const advance = (i: number, t: number) => {
    const p = parts[i];
    if (stage[i] < 1 && t >= lift[i]) {
      p.letter?.setAttribute("data-lift", "");
      stage[i] = 1;
    }
    if (stage[i] < 2 && t >= release[i]) {
      p.note?.setAttribute("data-state", "fall");
      stage[i] = 2;
    }
    if (stage[i] === 2) {
      if (t < land[i]) {
        const k = (t - release[i]) / fall[i];
        const travelled = PUSH * k + (1 - PUSH) * k * k;
        setHead(p, -p.drop * (1 - travelled), Math.min(1, (t - release[i]) / 0.06));
      } else {
        p.note?.setAttribute("data-state", "struck");
        showLanded(p);
        stage[i] = 3;
        onLand(i, t - land[i] > LATE);
      }
    }
    if (stage[i] >= 3) {
      const tau = t - land[i];
      if (!reduced && tau < SPRING_TIME) {
        // impact speed of the fall, carried on into a small damped spring
        const v = ((2 - PUSH) * p.drop * RESTITUTION) / Math.max(fall[i], 1e-3);
        setHead(p, (v / omega) * Math.exp(-tau / SPRING_DECAY) * Math.sin(omega * tau), null);
      } else if (p.head?.hasAttribute("transform") || p.head?.style.opacity) {
        setHead(p, null, null);
      }
    }
    if (stage[i] === 3 && t >= land[i] + SETTLE) {
      p.letter?.removeAttribute("data-lift");
      stage[i] = 4;
    }
    if (stage[i] === 4 && t >= land[i] + COOL) {
      p.note?.setAttribute("data-state", "placed");
      stage[i] = 5;
    }
  };

  const settleAll = () => {
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      // cut short: notes that never landed arrive quietly, without a ring
      if (stage[i] < 3) p.note?.setAttribute("data-quiet", "");
      p.letter?.removeAttribute("data-lift");
      p.note?.setAttribute("data-state", "placed");
      setHead(p, null, null);
      showLanded(p);
      stage[i] = 5;
    }
  };

  const frame = (now: number) => {
    if (over) return;
    const t = Math.max(0, now - born) / 1000;
    for (let i = 0; i < n; i++) advance(i, t);
    if (t >= end) {
      over = true;
      settleAll();
      onDone();
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  if (n === 0) {
    queueMicrotask(onDone);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    cancel: () => {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      settleAll();
    },
  };
}
