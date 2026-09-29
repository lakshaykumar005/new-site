"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { glyphAtCentre } from "@/components/notation/layout";
import { coda } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { musicBox } from "@/lib/music/audio";
import { compose } from "@/lib/music/compose";
import { play, type Playback } from "@/lib/music/player";
import { DIATONIC, triadQuality } from "@/lib/music/theory";
import { layoutEnding } from "./ending";
import { CODA_GLYPHS } from "./glyphs";
import { CHORD_RATE, chordScore, strikeLead, timeline, type Strike, type Take } from "./timeline";
import styles from "./coda.module.css";

/** Timings (ms) for the frame of the system and its final bar, as the lines pass them. */
const AT = { frame: 60, bar: 820, fermata: 1000 };

/** Names the drawing for screen readers ({chord} becomes e.g. "A minor"). */
const ENDING_LABEL =
  "The last bar of the theme: a soft, rolled {chord} chord, held under a fermata, then the final double barline.";

const at = (ms: number, i?: number): CSSProperties =>
  ({ "--at": `${ms}ms`, ...(i === undefined ? {} : { "--i": i }) }) as CSSProperties;

/** A note's own clock, when it sounds: when it's struck, how long it rings (and a stem, how long it grows). */
const struck = (x: Strike | null | undefined): CSSProperties =>
  (x
    ? {
        "--on": `${Math.round(x.at)}ms`,
        "--ring": `${Math.round(x.ring)}ms`,
        ...(x.grow ? { "--grow-for": `${Math.round(x.grow)}ms` } : {}),
      }
    : {}) as CSSProperties;

/**
 * The note under Fine.: a sentence to a line, like a small verse (so the
 * last one lands on its own), and the Italian word itself set roman
 * against the italic.
 */
const fineNote = coda.fineNote.split(/(?<=[.!?])\s+/).map((sentence, i) => {
  const m = /\bfine\b/.exec(sentence);
  return (
    <span key={i} className={styles.verse}>
      {m ? (
        <>
          {sentence.slice(0, m.index)}
          <span className={styles.term}>{m[0]}</span>
          {sentence.slice(m.index + m[0].length)}
        </>
      ) : (
        sentence
      )}{" "}
    </span>
  );
});

export default function FinalBar({ children }: { children?: ReactNode }) {
  const theme = useMemo(() => compose(HER_NAME, "theme"), []);
  const root = useRef<HTMLDivElement>(null);
  const system = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(350);
  const [take, setTake] = useState<Take | null>(null);
  const started = useRef(false);
  const playback = useRef<Playback | null>(null);

  // lay out 1:1 with the column, so hairlines stay hairlines
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Printed once. Whether the closing chord can be heard is settled in the
  // same moment, so the page can keep time with it.
  const begin = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const next: Take = {
      sounding: musicBox.audible,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    setTake(next);
    // the closing chord, once, softly, struck on the audio clock in step with the drawing
    if (next.sounding) {
      playback.current = play(chordScore(theme), { exclusive: false, rate: CHORD_RATE, lead: strikeLead(next.reduced) });
    }
  }, [theme]);

  // ...when she reaches it: once nearly all of the last bar is on screen (or as
  // much of it as a short screen can hold), not the moment its top edge peeks
  // in under the letter she is still reading
  useEffect(() => {
    const el = system.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const view = entry.rootBounds?.height ?? window.innerHeight;
        if (entry.intersectionRatio >= 0.9 || entry.intersectionRect.height >= view * 0.6) {
          io.disconnect();
          begin();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: [0, 0.25, 0.5, 0.75, 0.9, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [begin]);

  useEffect(() => () => playback.current?.stop(), []);

  const layout = useMemo(() => layoutEnding(theme, width), [theme, width]);
  const plan = useMemo(() => (take ? timeline(theme, layout, take) : null), [theme, layout, take]);
  const { s } = layout;

  const last = theme.bars[theme.bars.length - 1];
  const label = ENDING_LABEL.replace(
    "{chord}",
    last ? `${DIATONIC[last.root]} ${triadQuality(last.root)}` : "closing"
  );

  const lines: { y: number; key: string }[] = [];
  for (let i = 0; i < 5; i++) lines.push({ y: layout.trebleTop + i * s, key: `t${i}` });
  for (let i = 0; i < 5; i++) lines.push({ y: layout.bassTop + i * s, key: `b${i}` });
  const barTop = layout.trebleTop;
  const barH = layout.bassBottom - layout.trebleTop;
  const { hairpin, bar } = layout;
  // Fine. hangs from a point just under the bass staff; measured in staff
  // spaces (the same at every width), so it sits right before hydration too
  const fineLift = (layout.bassBottom + 2.1 * s - layout.height) / s;

  const classes = [styles.ending, take && styles.drawn, take?.sounding && styles.sounding].filter(Boolean).join(" ");

  return (
    // a keyboard can reach the da capo first: then the ending is printed at once
    <div ref={root} className={classes} style={plan?.vars as CSSProperties | undefined} onFocus={begin}>
      <svg
        ref={system}
        className={styles.system}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        // the box is sized in CSS from the same staff-space rule (see .system),
        // so its height is right before this lays itself out: no layout shift;
        // should the two ever differ by a hair, the barline still meets the edge
        preserveAspectRatio="xMaxYMin meet"
        style={{ "--h-per-space": layout.height / s } as CSSProperties}
        role="img"
        aria-label={label}
      >
        <g className={styles.ink} style={at(AT.frame)} fill="currentColor">
          <text
            className={styles.barNumber}
            x={layout.barNumber.x}
            y={layout.barNumber.y}
            fontSize={layout.barNumber.size}
          >
            {layout.barNumber.text}
          </text>
          <path d={CODA_GLYPHS.brace.d} transform={layout.brace} />
          <rect x={layout.sysX} y={barTop} width={0.12 * s} height={barH} />
          <path d={GLYPHS.gClef.d} transform={layout.gClef} />
          <path d={GLYPHS.fClef.d} transform={layout.fClef} />
        </g>

        <g strokeWidth={0.1 * s}>
          {lines.map((l, i) => (
            <path
              key={l.key}
              className={styles.staffLine}
              style={at(0, i % 5)}
              d={`M${layout.sysX} ${l.y}H${layout.lineEnd}`}
              pathLength={1}
            />
          ))}
        </g>

        <g className={`${styles.ink} ${styles.chord}`} fill="currentColor">
          {layout.heads.map((h, i) => (
            <g key={`${h.staff}${h.step}`} className={styles.head} style={struck(plan?.heads[i])}>
              {h.ledgers.map((y) => (
                <rect
                  key={y}
                  x={h.x - layout.headW / 2 - 0.4 * s}
                  y={y - 0.08 * s}
                  width={layout.headW + 0.8 * s}
                  height={0.16 * s}
                />
              ))}
              <path d={GLYPHS.noteheadHalf.d} transform={glyphAtCentre("noteheadHalf", h.x, h.y, s)} />
              <circle cx={h.dotX} cy={h.dotY} r={0.19 * s} />
            </g>
          ))}
          {layout.stems.map((st, i) => (
            <rect
              key={st.staff}
              className={styles.stem}
              // the part above the roll's first note is held back until the roll reaches it
              style={{ "--grow": `${(st.grow * 100).toFixed(3)}%`, ...struck(plan?.stems[i]) } as CSSProperties}
              x={st.x - 0.06 * s}
              y={Math.min(st.y1, st.y2)}
              width={0.12 * s}
              height={Math.abs(st.y2 - st.y1)}
            />
          ))}
          {layout.arpeggio && (
            <g className={styles.arp}>
              <path d={CODA_GLYPHS.arpeggiato.d} transform={layout.arpeggio.transform} />
            </g>
          )}
        </g>

        <g className={`${styles.ink} ${styles.dynamic}`} fill="currentColor">
          <path d={CODA_GLYPHS.piano.d} transform={layout.dynamic[0]} />
          <path d={CODA_GLYPHS.piano.d} transform={layout.dynamic[1]} />
        </g>
        <g strokeWidth={0.1 * s}>
          <path
            className={styles.hairpinLine}
            d={`M${hairpin.x1} ${hairpin.y - hairpin.open}L${hairpin.x2} ${hairpin.y}`}
            pathLength={1}
          />
          <path
            className={styles.hairpinLine}
            d={`M${hairpin.x1} ${hairpin.y + hairpin.open}L${hairpin.x2} ${hairpin.y}`}
            pathLength={1}
          />
        </g>

        <g className={styles.ink} style={at(AT.bar)} fill="currentColor">
          <rect x={bar.thinX} y={barTop} width={bar.thin} height={barH} />
          <rect x={bar.thickX} y={barTop} width={bar.thick} height={barH} />
        </g>
        <g className={`${styles.ink} ${styles.fermata}`} style={at(AT.fermata)}>
          <path d={GLYPHS.fermata.d} transform={layout.fermata} fill="currentColor" />
        </g>
      </svg>

      <p className={styles.fine} style={{ marginTop: `calc(${fineLift} * var(--space) - 0.1125em)` }}>
        {coda.fine}
      </p>
      <p className={styles.fineNote}>{fineNote}</p>
      {children && <div className={styles.after}>{children}</div>}
    </div>
  );
}
