"use client";

import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { flagTransform, glyphAtCentre } from "@/components/notation/layout";
import { variationsCopy } from "@/content/copy";
import { musicBox } from "@/lib/music/audio";
import type { DialEngine } from "./dialEngine";
import { COUNT, VARIATIONS, type Tempo } from "./engrave";
import styles from "./variations.module.css";

interface DialProps {
  /** the engine that turns it (the section owns it) */
  engineRef: RefObject<DialEngine | null>;
  /** the ring — everything that turns — for the engine to take hold of */
  ringRef: RefObject<HTMLDivElement | null>;
  /** the mark under the index */
  current: number;
  /** today's pick, or −1 */
  pick: number;
  playing: boolean;
  grabbing: boolean;
  onToggle: () => void;
  /** the rotating cylinder round the hub and the metronome's note: written to while the music plays */
  cylRef: RefObject<SVGGElement | null>;
  metroRef: RefObject<SVGGElement | null>;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const STEP = 360 / COUNT;
const TICKS = 60;
/** width the dial is drawn at before it has been measured (a phone) */
const DEFAULT_D = 280;

const f1 = (v: number) => v.toFixed(1);

/** a point on a circle, `deg` clockwise from the top */
function pt(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/** a full circle starting `deg` clockwise from the top, drawn clockwise (text on it reads outward) */
function circleFrom(deg: number, r: number): string {
  const [x0, y0] = pt(deg, r);
  const [x1, y1] = pt(deg + 180, r);
  return `M${f1(x0)} ${f1(y0)}A${f1(r)} ${f1(r)} 0 1 1 ${f1(x1)} ${f1(y1)}A${f1(r)} ${f1(r)} 0 1 1 ${f1(x0)} ${f1(y0)}`;
}

/** Bodoni Moda italic, at 600: about this many ems per character, spaces included. */
const EM_PER_CHAR = 0.6;

interface MarkSetting {
  lines: string[];
  /** the baseline radius of each line, outermost first */
  radii: number[];
  font: number;
}

/**
 * A marking is engraved on one line round the ring — or, when it would
 * overrun its sixth of the ring, on two concentric lines split at the
 * middle of its words, a little smaller, the way a compass rose sets
 * a long name.
 */
function setMark(text: string, font: number, arc: number, rt: number): MarkSetting {
  const width = (s: string, f: number) => s.length * EM_PER_CHAR * f;
  if (width(text, font) <= arc) return { lines: [text], radii: [rt], font };
  const words = text.split(" ");
  if (words.length < 2) return { lines: [text], radii: [rt], font: Math.max(10, (font * arc) / width(text, font)) };
  // split where the two halves come out most even
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  const lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  const small = font * 0.86;
  const longest = Math.max(...lines.map((l) => width(l, small)));
  const f = longest <= arc ? small : Math.max(10, (small * arc) / longest);
  return { lines, radii: [rt + 0.55 * f, rt - 0.62 * f], font: f };
}

/** The little engraved note of a metronome mark, drawn with the staff's own glyphs. */
function MetroNote({ tempo, x, y, s }: { tempo: Tempo; x: number; y: number; s: number }) {
  const head = tempo.unit === "half" ? "noteheadHalf" : "noteheadBlack";
  const headW = ((GLYPHS.noteheadBlack.bounds[2] - GLYPHS.noteheadBlack.bounds[0]) / 250) * s;
  const stemX = x + headW / 2 - 0.06 * s;
  const stemTop = y - 2.9 * s;
  return (
    <g>
      <path d={GLYPHS[head].d} transform={glyphAtCentre(head, x, y, s)} />
      <line x1={f1(stemX)} x2={f1(stemX)} y1={f1(y - 0.15 * s)} y2={f1(stemTop)} stroke="currentColor" strokeWidth={f1(0.13 * s)} />
      {tempo.unit === "eighth" && <path d={GLYPHS.eighthFlagUp.d} transform={flagTransform(stemX - 0.065 * s, stemTop, s, false)} />}
    </g>
  );
}

/**
 * The dial: six tempo markings engraved round a ring, like the bezel of
 * a watch. The one at the top is the variation on the staff. It turns
 * under a finger (the ring), by tapping a marking, with ← / →, and it
 * always settles on a mark. The play disc sits at its hub.
 */
function Dial({ engineRef, ringRef, current, pick, playing, grabbing, onToggle, cylRef, metroRef }: DialProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [d, setD] = useState(DEFAULT_D);

  // drawn at the size it has, so the markings are set in real pixels
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const take = (w: number) => {
      // (never so small that the ring's geometry turns inside out)
      if (w > 1) setD(Math.max(160, Math.round(w)));
    };
    take(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => take(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest("button")) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (r > rect.width / 2) return;
      void musicBox.unlock();
      engine.pointerDown(e.clientX, e.clientY, cx, cy);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
    },
    [engineRef]
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const engine = engineRef.current;
      if (engine?.turning) engine.pointerMove(e.clientX, e.clientY);
    },
    [engineRef]
  );
  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const engine = engineRef.current;
      if (!engine?.turning) return;
      // a touch counts as a gesture as it lifts: the tick can sound from here on
      void musicBox.unlock();
      engine.pointerUp(e.clientX, e.clientY);
    },
    [engineRef]
  );
  const onPointerCancel = useCallback(() => engineRef.current?.pointerCancel(), [engineRef]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
      const engine = engineRef.current;
      if (!engine) return;
      let handled = true;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          engine.stepBy(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          engine.stepBy(-1);
          break;
        case "Home":
          engine.select(0);
          break;
        case "End":
          engine.select(COUNT - 1);
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          if (!e.repeat) onToggle();
          break;
        default:
          handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      void musicBox.unlock();
    },
    [engineRef, onToggle]
  );

  // ── geometry, in px ─────────────────────────────────────
  const pad = 12;
  const R = d / 2 - pad;
  const Rt = R - 27;
  const Rin = Rt - 19;
  const big = d >= 360;
  const hub = big ? 64 : 56;
  const fontMark = Math.max(13.5, Math.min(17, d * 0.046));
  /** the arc each marking may take: its sixth of the ring, less a breath either side */
  const arc = (2 * Math.PI * Rt) / COUNT - 14;
  const numeralY = -(hub / 2 + 38);
  const metroY = hub / 2 + 34;
  const metroS = big ? 6 : 5.5;
  const v = VARIATIONS[current];
  const half = d / 2;
  const viewBox = `${-half} ${-half} ${d} ${d}`;

  /** Where a marking's lines go: one on the ring, or two concentric ones when it is too long for its arc. */
  const marksSet = VARIATIONS.map((item) => setMark(item.copy.mark, fontMark, arc, Rt));

  return (
    <div
      ref={wrapRef}
      className={styles.dial}
      role="slider"
      tabIndex={0}
      aria-label={variationsCopy.dialLabel}
      aria-valuemin={1}
      aria-valuemax={COUNT}
      aria-valuenow={current + 1}
      aria-valuetext={`${v.copy.mark} — ${v.copy.title}`}
      aria-orientation="horizontal"
      data-grabbing={grabbing ? "" : undefined}
      data-playing={playing ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      {/* the ring: everything that turns (the engine writes its rotation) */}
      <div ref={ringRef} className={styles.ring} aria-hidden>
        <svg className={styles.ringSvg} viewBox={viewBox} focusable="false">
          <circle className={styles.bezel} cx="0" cy="0" r={f1(R)} />
          <circle className={styles.bezelInner} cx="0" cy="0" r={f1(Rin)} />
          <g className={styles.ticks}>
            {Array.from({ length: TICKS }, (_, i) => {
              const major = i % (TICKS / COUNT) === 0;
              // today's pick: that marking's own tick, in vermillion
              const picked = major && i / (TICKS / COUNT) === pick;
              const [x0, y0] = pt((i * 360) / TICKS, R);
              const [x1, y1] = pt((i * 360) / TICKS, R - (major ? 10 : 5));
              return (
                <line
                  key={i}
                  className={picked ? styles.pickTick : major ? styles.tickMajor : styles.tick}
                  x1={f1(x0)}
                  y1={f1(y0)}
                  x2={f1(x1)}
                  y2={f1(y1)}
                >
                  {picked && <title>{variationsCopy.todaysPick}</title>}
                </line>
              );
            })}
          </g>
          <defs>
            {VARIATIONS.map((item, i) =>
              marksSet[i].lines.map((_, k) => (
                <path key={`${item.id}-${k}`} id={`${uid}-m${i}-${k}`} d={circleFrom(i * STEP - 180, marksSet[i].radii[k])} />
              ))
            )}
          </defs>
          {VARIATIONS.map((item, i) => (
            <text
              key={item.id}
              className={styles.mark}
              data-on={i === current ? "" : undefined}
              fontSize={f1(marksSet[i].font)}
            >
              {marksSet[i].lines.map((line, k) => (
                <textPath key={k} href={`#${uid}-m${i}-${k}`} startOffset="50%" textAnchor="middle">
                  {line}
                </textPath>
              ))}
            </text>
          ))}
        </svg>
      </div>

      {/* what stays put: the index, the hub's rings, the numeral and the metronome mark */}
      <svg className={styles.fixed} viewBox={viewBox} aria-hidden focusable="false">
        <circle className={styles.focusRing} cx="0" cy="0" r={f1(R + 5)} />
        <path className={styles.notch} d={`M${f1(-4.5)} ${f1(-R - 10)}h9l-4.5 7.5z`} />
        <circle className={styles.hubRing} cx="0" cy="0" r={f1(hub / 2 + 7)} />
        <g ref={cylRef} className={styles.cyl}>
          <circle cx="0" cy="0" r={f1(hub / 2 + 14)} />
        </g>
        <g key={current} className={styles.fadeIn}>
          <text className={styles.numeral} x="0" y={f1(numeralY)} textAnchor="middle" fontSize={big ? 21 : 18}>
            {ROMAN[current] ?? current + 1}
          </text>
          <g ref={metroRef} className={styles.metroNote}>
            <MetroNote tempo={v.tempo} x={-(big ? 20 : 18)} y={metroY + 0.2 * metroS} s={metroS} />
          </g>
          <text className={styles.metro} x={-(big ? 8 : 7)} y={f1(metroY)} fontSize={big ? 12.5 : 11.5}>
            {`= ${v.tempo.perMinute}`}
          </text>
        </g>
      </svg>

      <button
        type="button"
        className={styles.hub}
        data-on={playing}
        aria-label={`${playing ? variationsCopy.stop : variationsCopy.play}: ${v.copy.title}`}
        onClick={onToggle}
      >
        <svg viewBox="0 0 20 20" className={styles.glyph} aria-hidden focusable="false">
          <path className={styles.tri} d="M7 4.8 15.6 10 7 15.2Z" />
          <rect className={styles.sq} x="5.6" y="5.6" width="8.8" height="8.8" rx="0.7" />
        </svg>
      </button>
    </div>
  );
}

export default memo(Dial);
