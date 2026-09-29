"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, flagTransform, glyphAtCentre } from "@/components/notation/layout";
import type { Score } from "@/lib/music/compose";
import { engrave, type Engraving as Layout, type PlacedBar, type PlacedNote, type PlacedSystem } from "./engrave";
import styles from "./your-turn.module.css";

/**
 * A melody engraved live, one or more systems deep. Every note and
 * barline keeps its identity between renders, so when a word grows or
 * shrinks the music re-flows the way a page is re-set, not animated:
 * a note that stays on its line slides along it; anything that changes
 * line lifts off where it was and is inked in where it lands; a new
 * line is only printed once the page has made room for it.
 */

export interface EngravingProps {
  score: Score;
  /** a stable key per melody note, in order (defaults to the note ids) */
  keys?: readonly string[];
  staff: "manuscript" | "engraved";
  /** staff space (px) for a measured column width */
  space: (width: number) => number;
  /** "char": letters under the notes; "blank": a blank until `revealed` has the note */
  letters: "char" | "blank";
  revealed?: ReadonlySet<string>;
  /** the melody note (by id) sounding in a performance */
  activeId?: string | null;
  /** a note (by key) that has just been typed: it sounds, so it lights */
  flashKey?: string | null;
  /** how long (ms) each new note waits before it is set down */
  enterDelays?: ReadonlyMap<string, number>;
  beatRef?: RefObject<number>;
  playing?: boolean;
  /** slide, ink-in and fade (off for a page that should arrive still) */
  animate?: boolean;
  justifyLast?: number;
  center?: boolean;
  emptyText?: string;
  label: string;
  /** an estimate of one system's height (a CSS length) before the column is measured */
  reserve?: string;
}

/** the page makes room for a new line in this long (the SVG's height transition, in the stylesheet) */
const GROW_MS = 280;
/** a line that has gone fades for this long before the page closes up */
const SHRINK_DELAY_MS = 200;
/** ghosts are cleared once every fade has finished */
const GHOST_MS = 360;
/** the written staff trails off into the paper's ruling over this many staff spaces */
const FADE_SPACES = 2.5;

interface GhostNote {
  id: string;
  note: PlacedNote;
  y: number;
  s: number;
  labelY: number;
  /** deleted (lifts away) rather than moved to another line (fades in place) */
  lift: boolean;
}

interface GhostBar {
  id: string;
  bar: PlacedBar;
  y: number;
  s: number;
  top: number;
}

interface GhostSystem {
  id: string;
  sys: PlacedSystem;
  s: number;
  top: number;
  bottom: number;
  time: [string, string];
}

interface Motion {
  gen: number;
  notes: GhostNote[];
  bars: GhostBar[];
  systems: GhostSystem[];
  /** element id → how long (ms) its entrance waits */
  born: ReadonlyMap<string, number>;
  /** ms the page waits before closing up after a line has gone */
  heightDelay: number;
}

const STILL: Motion = { gen: 0, notes: [], bars: [], systems: [], born: new Map(), heightDelay: 0 };

const noteId = (n: PlacedNote) => `n:${n.key}@${n.system}`;
const barId = (b: PlacedBar) => `b:${b.key}@${b.system}`;
const systemId = (sys: PlacedSystem) => `s:${sys.index}`;

/** What changed between two engravings: what fades where it stood, and what waits to be printed. */
function reflow(prev: Layout, next: Layout, m: Motion): Motion {
  const gen = m.gen + 1;
  const tag = (id: string) => `g${gen}:${id}`;
  const room = prev.systems.length; // lines at or past this index are new to the page
  const sysY = (l: Layout, i: number) => l.systems[i]?.y ?? 0;

  const nextNotes = new Map(next.notes.map((n) => [n.key, n]));
  const notes: GhostNote[] = [];
  for (const n of prev.notes) {
    const now = nextNotes.get(n.key);
    if (now && now.system === n.system) continue;
    const deleted = !now;
    // a deleted note whose place another note now takes simply gives way to it
    if (deleted && next.notes.some((o) => o.system === n.system && Math.abs(o.x - n.x) < 1.2 * next.s)) continue;
    notes.push({ id: tag(noteId(n)), note: n, y: sysY(prev, n.system), s: prev.s, labelY: prev.labelY, lift: deleted });
  }

  const nextBars = new Map(next.bars.map((b) => [b.key, b]));
  const bars: GhostBar[] = [];
  for (const b of prev.bars) {
    const now = nextBars.get(b.key);
    if (now && now.system === b.system) continue;
    bars.push({ id: tag(barId(b)), bar: b, y: sysY(prev, b.system), s: prev.s, top: prev.top });
  }

  const systems: GhostSystem[] = prev.systems.slice(next.systems.length).map((sys) => ({
    id: tag(systemId(sys)),
    sys,
    s: prev.s,
    top: prev.top,
    bottom: prev.bottom,
    time: prev.time,
  }));

  // entrances: whatever is new waits until its line has room; whatever stays keeps its timing
  const prevIds = new Set([...prev.notes.map(noteId), ...prev.bars.map(barId), ...prev.systems.map(systemId)]);
  const born = new Map<string, number>();
  const settle = (id: string, system: number) =>
    born.set(id, prevIds.has(id) ? (m.born.get(id) ?? 0) : system >= room ? GROW_MS : 0);
  for (const n of next.notes) settle(noteId(n), n.system);
  for (const b of next.bars) settle(barId(b), b.system);
  for (const sys of next.systems) settle(systemId(sys), sys.index);

  return {
    gen,
    notes: [...m.notes, ...notes],
    bars: [...m.bars, ...bars],
    // a line that comes straight back replaces its own fading ghost
    systems: [...m.systems.filter((g) => g.sys.index >= next.systems.length), ...systems],
    born,
    heightDelay: next.height < prev.height - 0.5 ? SHRINK_DELAY_MS : 0,
  };
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const waitFor = (ms: number | undefined): CSSProperties | undefined => (ms ? { animationDelay: `${ms}ms` } : undefined);

export default function Engraving({
  score,
  keys,
  staff,
  space,
  letters,
  revealed,
  activeId = null,
  flashKey = null,
  enterDelays,
  beatRef,
  playing = false,
  animate = true,
  justifyLast,
  center,
  emptyText,
  label,
  reserve = "96px",
}: EngravingProps) {
  const [width, setWidth] = useState<number | null>(null);
  const fadeId = `yt-ink-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const manuscript = staff === "manuscript";

  // engrave 1:1 with the column: a staff space is a real pixel size
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const read = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo<Layout | null>(
    () =>
      width
        ? engrave(score, { width, s: space(width), keys, staff, justifyLast, center })
        : null,
    [score, width, space, keys, staff, justifyLast, center]
  );

  // what the last change left fading, and what it asked to wait
  const [prev, setPrev] = useState<Layout | null>(layout);
  const [motion, setMotion] = useState<Motion>(STILL);
  if (layout !== prev) {
    setPrev(layout);
    if (animate && prev && layout) setMotion((m) => reflow(prev, layout, m));
  }
  useEffect(() => {
    if (motion.notes.length === 0 && motion.bars.length === 0 && motion.systems.length === 0) return;
    const t = window.setTimeout(() => setMotion((m) => ({ ...m, notes: [], bars: [], systems: [] })), GHOST_MS);
    return () => window.clearTimeout(t);
  }, [motion]);

  // the playhead follows the performance by direct DOM writes
  const head = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!playing || !beatRef || !layout) return;
    let raf = 0;
    const tick = () => {
      const p = layout.beatToPos(beatRef.current ?? 0);
      const y = layout.systems[p.system]?.y ?? 0;
      head.current?.setAttribute("transform", `translate(${p.x.toFixed(2)} ${y})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, beatRef, layout]);

  if (!layout) {
    return <div ref={measure} className={styles.engraving} style={{ height: reserve }} aria-hidden />;
  }

  const { s, top, bottom, labelY } = layout;
  const glide = animate ? styles.glide : undefined;
  const empty = layout.notes.length === 0;
  const letterSize = Math.max(11, 1.45 * s);
  const born = (id: string) => (animate ? motion.born.get(id) : undefined);
  const at = (x: number, system: number): CSSProperties => ({
    transform: `translate(${x}px, ${layout.systems[system]?.y ?? 0}px)`,
  });

  return (
    <div ref={measure} className={styles.engraving}>
      <svg
        width={layout.width}
        height={layout.height}
        className={cx("score-line", styles.svg)}
        style={{
          height: layout.height,
          // a page that arrives still doesn't grow into place either
          transition: animate ? undefined : "none",
          transitionDelay: animate && motion.heightDelay ? `${motion.heightDelay}ms` : undefined,
        }}
        role="img"
        aria-label={label}
      >
        {manuscript && (
          <defs>
            <linearGradient id={fadeId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={FADE_SPACES * s} y2={0}>
              <stop offset={0} className={styles.inkStop} />
              <stop offset={1} className={styles.ruleStop} />
            </linearGradient>
          </defs>
        )}

        {animate &&
          motion.systems
            .filter((g) => g.sys.index >= layout.systems.length)
            .map((g) => (
              <g key={g.id} className={styles.leave} aria-hidden>
                <Staff sys={g.sys} s={g.s} top={g.top} bottom={g.bottom} time={g.time} manuscript={manuscript} fade={fadeId} />
              </g>
            ))}

        {layout.systems.map((sys) => (
          <g
            key={sys.index}
            className={animate && sys.index > 0 ? styles.appear : undefined}
            style={waitFor(born(systemId(sys)))}
          >
            <Staff
              sys={sys}
              s={s}
              top={top}
              bottom={bottom}
              time={layout.time}
              manuscript={manuscript}
              fade={fadeId}
              glide={animate}
            />
          </g>
        ))}

        {animate &&
          motion.bars.map((g) => (
            <g key={g.id} style={{ transform: `translate(${g.bar.x}px, ${g.y}px)` }} aria-hidden>
              <g className={styles.leave}>
                <Barline kind={g.bar.kind} s={g.s} top={g.top} />
              </g>
            </g>
          ))}

        {layout.bars.map((b) => (
          <g key={barId(b)} className={glide} style={at(b.x, b.system)}>
            <g className={animate ? styles.appear : undefined} style={waitFor(born(barId(b)))}>
              <Barline kind={b.kind} s={s} top={top} />
            </g>
          </g>
        ))}

        {animate &&
          motion.notes.map((g) => (
            <g key={g.id} style={{ transform: `translate(${g.note.x}px, ${g.y}px)` }} aria-hidden>
              <g className={g.lift ? styles.lift : styles.leave}>
                <Note note={g.note} s={g.s} state="idle" />
                {letters === "char" && (
                  <text
                    x={0}
                    y={g.labelY}
                    textAnchor="middle"
                    className={styles.letter}
                    fontSize={Math.max(11, 1.45 * g.s)}
                  >
                    {g.note.ev.char}
                  </text>
                )}
              </g>
            </g>
          ))}

        {layout.notes.map((n) => {
          const active = n.ev.id === activeId || (activeId === null && n.key === flashKey);
          const shown = letters === "char" || !!revealed?.has(n.ev.id);
          const delay = (born(noteId(n)) ?? 0) + (enterDelays?.get(n.key) ?? 0);
          return (
            <g key={noteId(n)} className={glide} style={at(n.x, n.system)}>
              <g className={animate ? styles.enter : undefined} style={waitFor(delay)}>
                <Note note={n} s={s} state={active ? "active" : "idle"} ring={active ? `${activeId ?? flashKey}` : null} />
                {letters === "blank" && (
                  <line
                    x1={-0.62 * s}
                    x2={0.62 * s}
                    y1={labelY + 0.3 * s}
                    y2={labelY + 0.3 * s}
                    strokeWidth={1}
                    className={cx(styles.blank, shown && styles.blankGone)}
                  />
                )}
                {/* a hidden letter isn't in the page at all until its note has sounded */}
                {shown && (
                  <text
                    x={0}
                    y={labelY}
                    textAnchor="middle"
                    className={cx(
                      styles.letter,
                      letters === "blank" && styles.letterIn,
                      active && styles.letterActive
                    )}
                    fontSize={letterSize}
                  >
                    {n.ev.char}
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {beatRef && (
          <g ref={head} className={cx(styles.playhead, playing && styles.playheadOn)} aria-hidden>
            <line x1={0} x2={0} y1={top - 1.6 * s} y2={bottom + 1.6 * s} strokeWidth={Math.max(1, 0.14 * s)} />
          </g>
        )}
      </svg>

      {emptyText && (
        <p
          className={cx(styles.empty, !empty && styles.emptyGone)}
          // written where the first letters will be: on their baseline, after the clef
          style={{ top: labelY - 16, left: layout.systems[0]?.contentX ?? 0 }}
          // the staff's own label says it; this is its printed form
          aria-hidden
        >
          {emptyText}
        </p>
      )}
    </div>
  );
}

/**
 * One system's staff, clef and (on the first) time signature. On
 * manuscript paper the written staff runs to its closing barline and
 * trails off into the paper's own ruling, which carries on to the margin.
 */
function Staff({
  sys,
  s,
  top,
  bottom,
  time,
  manuscript,
  fade,
  glide = false,
}: {
  sys: PlacedSystem;
  s: number;
  top: number;
  bottom: number;
  time: [string, string];
  manuscript: boolean;
  fade: string;
  glide?: boolean;
}) {
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * s);
  const trail = Math.max(0, Math.min(FADE_SPACES * s, sys.lineEnd - sys.inkEnd));
  return (
    <g transform={`translate(0 ${sys.y})`}>
      {manuscript ? (
        <>
          <g className={styles.ruling} strokeWidth={0.1 * s}>
            {lines.map((y, i) => (
              <line key={i} x1={sys.lineStart} x2={sys.lineEnd} y1={y} y2={y} />
            ))}
          </g>
          {/* drawn one unit long and stretched, so it can follow the closing barline as it moves */}
          <g
            className={cx("sl-staff", glide && styles.inkRun)}
            stroke="currentColor"
            strokeWidth={0.1 * s}
            style={{ transform: `scaleX(${sys.inkEnd.toFixed(2)})` }}
          >
            {lines.map((y, i) => (
              <line key={i} x1={0} x2={1} y1={y} y2={y} />
            ))}
          </g>
          {trail > 0 && (
            <g className={glide ? styles.glide : undefined} style={{ transform: `translateX(${sys.inkEnd.toFixed(2)}px)` }}>
              {lines.map((y, i) => (
                <line key={i} x1={0} x2={trail} y1={y} y2={y} stroke={`url(#${fade})`} strokeWidth={0.1 * s} />
              ))}
            </g>
          )}
        </>
      ) : (
        <g className="sl-staff" stroke="currentColor" strokeWidth={0.1 * s}>
          {lines.map((y, i) => (
            <line key={i} x1={sys.lineStart} x2={sys.lineEnd} y1={y} y2={y} />
          ))}
        </g>
      )}
      <path d={GLYPHS.gClef.d} transform={clefTransform(sys.clefX, bottom, s)} fill="currentColor" />
      {sys.time && (
        <g
          fill="currentColor"
          textAnchor="middle"
          fontWeight={800}
          style={{ fontVariationSettings: '"opsz" 14', fontFamily: "var(--font-display)" }}
        >
          <text x={sys.timeX} y={top + 1 * s} dominantBaseline="central" fontSize={2.8 * s}>
            {time[0]}
          </text>
          <text x={sys.timeX} y={top + 3 * s} dominantBaseline="central" fontSize={2.8 * s}>
            {time[1]}
          </text>
        </g>
      )}
    </g>
  );
}

/** A barline around its anchor: a thin line, or the final thin-and-thick double bar. */
function Barline({ kind, s, top }: { kind: PlacedBar["kind"]; s: number; top: number }) {
  return kind === "final" ? (
    <>
      <rect x={-0.72 * s} y={top} width={0.12 * s} height={4 * s} fill="currentColor" />
      <rect x={-0.4 * s} y={top} width={0.5 * s} height={4 * s} fill="currentColor" />
    </>
  ) : (
    <rect x={0} y={top} width={0.12 * s} height={4 * s} fill="currentColor" />
  );
}

/** One engraved note, drawn around its notehead's x (the parent places it). */
function Note({
  note,
  s,
  state,
  ring = null,
}: {
  note: PlacedNote;
  s: number;
  state: "idle" | "active";
  ring?: string | null;
}) {
  const L = note.laid;
  const glyph = L.head === "whole" ? "wholeNote" : L.head === "half" ? "noteheadHalf" : "noteheadBlack";
  const ledgerHalf = L.headW / 2 + 0.42 * s;
  const stemX = L.stemX - L.x;
  return (
    <g className={`sl-note sl-${state}`}>
      {L.ledgers.map((y) => (
        <line
          key={y}
          x1={-ledgerHalf}
          x2={ledgerHalf}
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth={0.16 * s}
        />
      ))}
      {ring !== null && (
        <circle
          key={ring}
          cx={0}
          cy={L.y}
          r={0.9 * s}
          className="sl-ring"
          fill="none"
          stroke="currentColor"
          strokeWidth={0.12 * s}
        />
      )}
      <path d={GLYPHS[glyph].d} transform={glyphAtCentre(glyph, 0, L.y, s)} fill="currentColor" />
      {L.stem && (
        <line
          x1={stemX}
          x2={stemX}
          y1={L.stem === "up" ? L.y - 0.15 * s : L.y + 0.15 * s}
          y2={L.stemEnd}
          stroke="currentColor"
          strokeWidth={0.12 * s}
        />
      )}
      {L.flags > 0 && (
        <path
          d={GLYPHS.eighthFlagUp.d}
          transform={flagTransform(stemX - 0.06 * s, L.stemEnd, s, L.stem === "down")}
          fill="currentColor"
        />
      )}
      {L.flags > 1 && (
        <path
          d={GLYPHS.eighthFlagUp.d}
          transform={flagTransform(stemX - 0.06 * s, L.stemEnd, s, L.stem === "down", 0.8 * s)}
          fill="currentColor"
        />
      )}
      {L.dot && <circle cx={L.dotX - L.x} cy={L.dotY} r={0.19 * s} fill="currentColor" />}
    </g>
  );
}
