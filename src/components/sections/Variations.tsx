"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { variationsCopy } from "@/content/copy";
import { dayOfYear } from "@/lib/device";
import { useReducedMotion } from "@/lib/hooks";
import { musicBox } from "@/lib/music/audio";
import { useScorePlayer } from "@/lib/music/hooks";
import { letterOfDn } from "@/lib/music/theory";
import Caption from "./variations/Caption";
import Dial from "./variations/Dial";
import { DialEngine } from "./variations/dialEngine";
import { COUNT, DEFAULT_WIDTH, engrave, tailOf, VARIATIONS } from "./variations/engrave";
import { Morpher } from "./variations/morph";
import Staff from "./variations/Staff";
import styles from "./variations/variations.module.css";

/**
 * Fig. 3 — the kaleidoscope. Six variations on her name, one staff.
 *
 * A dial of six tempo markings; the one at the top is on the staff.
 * Turning the dial morphs the music into the next variation — every
 * note glides to where that variation puts it, her letters travelling
 * underneath — and, if the piece is playing, hands the music over at
 * the same point. Nothing here is laid out twice: the six engravings
 * are computed once per width and the page tweens between them.
 */

/** A swipe across the staff turns the ring: this many degrees per pixel (about 150px a mark). */
const DEG_PER_PX = 360 / COUNT / 150;
/** How far a finger goes before it is a swipe (or, straight down, a scroll). */
const SLOP = 8;
/** How long the metronome's note stays vermillion on each beat (s). */
const TICK = 0.09;

// "today's pick" depends on the visitor's own calendar, so it is only
// known in the browser: nothing is picked in the server render.
const noSubscribe = () => () => {};
const todaysIndex = () => dayOfYear() % COUNT;
const noPick = () => -1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Swipe {
  id: number;
  x0: number;
  y0: number;
  x: number;
  live: boolean;
}

interface Latest {
  turnedTo: (index: number) => void;
  grab: (on: boolean) => void;
}

export default function Variations() {
  const headingId = useId();
  const reduced = useReducedMotion();
  const pick = useSyncExternalStore(noSubscribe, todaysIndex, noPick);
  const [current, setCurrent] = useState(0);
  /** which variation's score is sounding (what the active note is read against) */
  const [sounding, setSounding] = useState(0);
  const [width, setWidth] = useState<number | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const { playing, activeId, start, stop, beat: beatRef } = useScorePlayer();

  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cylRef = useRef<SVGGElement>(null);
  const metroRef = useRef<SVGGElement>(null);
  const soundingRef = useRef(0);
  /** the beat the sounding score was taken up from (after a hand-over) */
  const offsetRef = useRef(0);
  const runRef = useRef(0);
  const swipeRef = useRef<Swipe | null>(null);

  const engraving = useMemo(() => engrave(width ?? DEFAULT_WIDTH), [width]);

  // the two engines live for the life of the section; they call whatever the latest render decided
  const dialRef = useRef<DialEngine | null>(null);
  const morpherRef = useRef<Morpher | null>(null);
  const latest = useRef<Latest>({ turnedTo: () => {}, grab: () => {} });

  useLayoutEffect(() => {
    const dial = new DialEngine(COUNT, {
      onDetent: (i) => latest.current.turnedTo(i),
      onGrab: (on) => latest.current.grab(on),
    });
    const morpher = new Morpher();
    dialRef.current = dial;
    morpherRef.current = morpher;
    dial.bind(ringRef.current);
    return () => {
      dial.destroy();
      morpher.destroy();
      dialRef.current = null;
      morpherRef.current = null;
    };
  }, []);

  // a new engraving (the plate was resized): print the current variation at rest, before paint
  useLayoutEffect(() => {
    morpherRef.current?.bind(svgRef.current, engraving);
  }, [engraving]);

  useEffect(() => {
    const dial = dialRef.current;
    if (dial) dial.reduced = reduced;
  }, [reduced]);

  // the staff is engraved 1:1 with the plate, measured before the first paint, then kept in step
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const take = (w: number) => {
      if (w > 1) setWidth(Math.round(w));
    };
    take(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => take(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Start (or take over) a score; the audio may need a moment to wake on a cold tap. */
  const sound = useCallback(
    (index: number, fromBeat: number) => {
      const unlocking = musicBox.unlock(); // inside the tap, before anything async
      const run = ++runRef.current;
      soundingRef.current = index;
      offsetRef.current = fromBeat;
      setSounding(index);
      void unlocking.then(() => {
        if (runRef.current !== run) return;
        void start(tailOf(VARIATIONS[index].score, fromBeat), {
          lead: fromBeat > 0 ? 0.02 : 0.08,
          onDone: (why) => {
            if (why === "ended" && runRef.current === run) runRef.current++;
          },
        });
      });
    },
    [start]
  );

  const toggle = useCallback(() => {
    if (playing) {
      runRef.current++;
      stop();
      return;
    }
    sound(current, 0);
  }, [playing, stop, sound, current]);

  /** The dial points at a new variation: the staff morphs, and the music, if playing, is handed over at the same point. */
  const turnedTo = useCallback(
    (index: number) => {
      setCurrent(index);
      morpherRef.current?.goTo(index, reduced);
      if (playing) {
        const from = VARIATIONS[soundingRef.current].score;
        const to = VARIATIONS[index].score;
        const beat = (beatRef.current ?? 0) + offsetRef.current;
        const fraction = from.length > 0 ? clamp01(beat / from.length) : 0;
        sound(index, fraction * to.length);
      }
    },
    [reduced, playing, beatRef, sound]
  );

  useLayoutEffect(() => {
    latest.current = { turnedTo, grab: setGrabbing };
  }, [turnedTo]);

  // while it plays: the playhead, the waltz's sway, the cylinder round the hub and the metronome's beat
  useEffect(() => {
    const morpher = morpherRef.current;
    const music = boxRef.current;
    const cyl = cylRef.current;
    if (!playing) {
      morpher?.setBeat(null);
      return;
    }
    let raf = 0;
    const frame = () => {
      const v = VARIATIONS[soundingRef.current];
      const beat = (beatRef.current ?? 0) + offsetRef.current;
      morpher?.setBeat(beat);
      const bars = Math.max(1e-6, v.score.barBeats);
      const phase = ((((beat - v.score.pickup) / bars) % 1) + 1) % 1;
      if (music) {
        // the waltz sways on its bass: the music leans a little into each downbeat
        music.style.transform =
          !reduced && v.id === "waltz" ? `rotate(${(0.6 * Math.sin(2 * Math.PI * phase)).toFixed(3)}deg)` : "";
      }
      if (cyl && !reduced) cyl.setAttribute("transform", `rotate(${((beat / bars) * 360).toFixed(2)})`);
      const spb = (v.tempo.pulse * 60) / v.score.bpm;
      metroRef.current?.toggleAttribute("data-tick", ((((beat / v.tempo.pulse) % 1) + 1) % 1) * spb < TICK);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      morpher?.setBeat(null);
      if (music) music.style.transform = "";
      cyl?.removeAttribute("transform");
      // (the mark is re-drawn for each variation; whichever note is there now is the one to put back to ink)
      metroRef.current?.removeAttribute("data-tick"); // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, [playing, reduced, beatRef]);

  // ── a swipe across the music turns the ring ─────────────
  const onPlateDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, live: false };
    // taken hold of now (the browser still takes a straight-down drag back for a scroll)
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
  }, []);
  const onPlateMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const sw = swipeRef.current;
      if (!sw || sw.id !== e.pointerId) return;
      if (!sw.live) {
        const dx = e.clientX - sw.x0;
        const dy = e.clientY - sw.y0;
        if (Math.hypot(dx, dy) < SLOP) return;
        if (Math.abs(dx) < Math.abs(dy)) {
          // straight down: the page scrolls, not the ring
          swipeRef.current = null;
          return;
        }
        sw.live = true;
        sw.x = e.clientX;
        void musicBox.unlock();
        dialRef.current?.beginTurn();
      }
      const d = e.clientX - sw.x;
      sw.x = e.clientX;
      dialRef.current?.turnBy(d * DEG_PER_PX);
    },
    []
  );
  const onPlateUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const sw = swipeRef.current;
    if (!sw || sw.id !== e.pointerId) return;
    swipeRef.current = null;
    if (sw.live) {
      void musicBox.unlock();
      dialRef.current?.endTurn();
    }
  }, []);

  const soundingMelody = VARIATIONS[sounding].score.melody;
  const activeLetter = playing && activeId ? (soundingMelody.find((e) => e.id === activeId)?.letter ?? -1) : -1;
  const v = VARIATIONS[current];
  const mood = v.id === "lullaby" ? "night" : v.id === "allegro" ? "bright" : undefined;
  const staffLabel = `${v.copy.mark} — ${v.copy.title}: ${v.score.melody.map((m) => letterOfDn(m.dn)).join(" ")}`;

  return (
    <section id="variations" className={`section ${styles.stage}`} aria-labelledby={headingId}>
      <div className="wrap">
        <div className={styles.grid}>
          <header className={`reveal ${styles.head}`}>
            <p className="t-kicker">{variationsCopy.kicker}</p>
            <h2 id={headingId} className={`t-display ${styles.title}`}>
              {variationsCopy.title}
            </h2>
            <p className={`t-lede measure ${styles.lede}`}>{variationsCopy.lede}</p>
          </header>

          <div className={`reveal ${styles.dialCol}`}>
            <Dial
              engineRef={dialRef}
              ringRef={ringRef}
              current={current}
              pick={pick}
              playing={playing}
              grabbing={grabbing}
              onToggle={toggle}
              cylRef={cylRef}
              metroRef={metroRef}
            />
            <p className={`t-caption ${styles.hint}`}>
              <span className={styles.hintTouch}>{variationsCopy.hintTouch}</span>
              <span className={styles.hintPointer}>{variationsCopy.hintPointer}</span>
            </p>
          </div>

          <div className={`reveal ${styles.music}`}>
            <div
              className={styles.plate}
              data-mood={mood}
              data-grabbing={grabbing ? "" : undefined}
              style={{ "--s": `${engraving.frame.s}px` } as CSSProperties}
              onPointerDown={onPlateDown}
              onPointerMove={onPlateMove}
              onPointerUp={onPlateUp}
              onPointerCancel={onPlateUp}
              onLostPointerCapture={onPlateUp}
            >
              <div ref={boxRef} className={styles.staffBox}>
                <Staff engraving={engraving} activeLetter={activeLetter} svgRef={svgRef} label={staffLabel} />
              </div>
            </div>
            <Caption current={current} pick={pick} />
          </div>
        </div>
      </div>
    </section>
  );
}
