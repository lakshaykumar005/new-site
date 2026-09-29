"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Score } from "@/lib/music/compose";
import { letterOfDn } from "@/lib/music/theory";
import { GLYPHS } from "./glyphs";
import { clefTransform, flagTransform, glyphAtCentre, layoutScore, type LaidNote, type ScoreLayout } from "./layout";

export interface ScoreLineProps {
  score: Score;
  /** viewBox width; the SVG scales to its container */
  width?: number;
  space?: number;
  clef?: boolean;
  time?: boolean;
  /** letters under the staff: the spelled letter, its note name, or both */
  letters?: "char" | "note" | "both" | false;
  activeId?: string | null;
  playedIds?: ReadonlySet<string>;
  /** drive a playhead: pass the player's beat ref while playing */
  beatRef?: RefObject<number>;
  playing?: boolean;
  className?: string;
  label?: string;
}

function Note({ n, s, state }: { n: LaidNote; s: number; state: "idle" | "active" | "played" }) {
  const glyph = n.head === "whole" ? "wholeNote" : n.head === "half" ? "noteheadHalf" : "noteheadBlack";
  const ledgerHalf = n.headW / 2 + 0.42 * s;
  return (
    <g className={`sl-note sl-${state}`} data-id={n.ev.id}>
      {n.ledgers.map((y, i) => (
        <line
          key={i}
          x1={n.x - ledgerHalf}
          x2={n.x + ledgerHalf}
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth={0.16 * s}
          className="sl-ledger"
        />
      ))}
      {state === "active" && (
        <circle cx={n.x} cy={n.y} r={0.9 * s} className="sl-ring" fill="none" stroke="currentColor" strokeWidth={0.12 * s} />
      )}
      <path d={GLYPHS[glyph].d} transform={glyphAtCentre(glyph, n.x, n.y, s)} fill="currentColor" />
      {n.stem && (
        <line
          x1={n.stemX}
          x2={n.stemX}
          y1={n.stem === "up" ? n.y - 0.15 * s : n.y + 0.15 * s}
          y2={n.stemEnd}
          stroke="currentColor"
          strokeWidth={0.12 * s}
          strokeLinecap="butt"
        />
      )}
      {n.flags > 0 && (
        <path
          d={GLYPHS.eighthFlagUp.d}
          transform={flagTransform(n.stemX - 0.06 * s, n.stemEnd, s, n.stem === "down")}
          fill="currentColor"
        />
      )}
      {n.flags > 1 && (
        <path
          d={GLYPHS.eighthFlagUp.d}
          transform={flagTransform(n.stemX - 0.06 * s, n.stemEnd, s, n.stem === "down", 0.8 * s)}
          fill="currentColor"
        />
      )}
      {n.dot && <circle cx={n.dotX} cy={n.dotY} r={0.19 * s} fill="currentColor" />}
    </g>
  );
}

/** One engraved line of melody, with an optional playhead. */
export default function ScoreLine({
  score,
  width = 640,
  space = 10,
  clef = true,
  time = true,
  letters = false,
  activeId = null,
  playedIds,
  beatRef,
  playing = false,
  className,
  label,
}: ScoreLineProps) {
  const layout: ScoreLayout = useMemo(
    () => layoutScore(score, { width, space, clef, time, letters: !!letters }),
    [score, width, space, clef, time, letters]
  );
  const head = useRef<SVGLineElement>(null);

  useEffect(() => {
    if (!playing || !beatRef) return;
    let raf = 0;
    const tick = () => {
      const x = layout.beatToX(beatRef.current ?? 0);
      head.current?.setAttribute("transform", `translate(${x} 0)`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, beatRef, layout]);

  const { s, top, bottom, left, right } = layout;
  const staffLines = [0, 1, 2, 3, 4].map((i) => top + i * s);
  // the staff ends where the music does: flush with the final double bar
  const finalBar = layout.bars.find((b) => b.kind === "final");
  const staffEnd = finalBar ? Math.min(right, finalBar.x + 0.1 * s) : right;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      className={`score-line ${className ?? ""}`}
      role="img"
      aria-label={label ?? `Music: ${score.melody.map((m) => letterOfDn(m.dn)).join(" ")}`}
      style={{ overflow: "visible" }}
    >
      <g className="sl-staff" stroke="currentColor" strokeWidth={0.1 * s}>
        {staffLines.map((y, i) => (
          <line key={i} x1={left} x2={staffEnd} y1={y} y2={y} pathLength={1} className="sl-staff-line" />
        ))}
      </g>

      {layout.clef && <path d={GLYPHS.gClef.d} transform={clefTransform(layout.clef.x, bottom, s)} fill="currentColor" />}

      {layout.time && (
        <g
          className="sl-time"
          fill="currentColor"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight={800}
          style={{ fontVariationSettings: '"opsz" 14' }}
        >
          <text x={layout.time.x} y={top + 1 * s} dominantBaseline="central" fontSize={2.8 * s}>
            {layout.time.top}
          </text>
          <text x={layout.time.x} y={top + 3 * s} dominantBaseline="central" fontSize={2.8 * s}>
            {layout.time.bottom}
          </text>
        </g>
      )}

      {layout.bars.map((b, i) =>
        b.kind === "final" ? (
          <g key={i}>
            <rect x={b.x - 0.72 * s} y={top} width={0.12 * s} height={4 * s} fill="currentColor" />
            <rect x={b.x - 0.4 * s} y={top} width={0.5 * s} height={4 * s} fill="currentColor" />
          </g>
        ) : (
          <rect key={i} x={b.x} y={top} width={0.12 * s} height={4 * s} fill="currentColor" />
        )
      )}

      {layout.notes.map((n) => (
        <Note
          key={n.ev.id}
          n={n}
          s={s}
          state={n.ev.id === activeId ? "active" : playedIds?.has(n.ev.id) ? "played" : "idle"}
        />
      ))}

      {letters &&
        layout.notes.map((n) => (
          <text
            key={`l-${n.ev.id}`}
            x={n.x}
            y={layout.labelY}
            textAnchor="middle"
            className={`sl-letter ${n.ev.id === activeId ? "sl-active" : ""}`}
            fontFamily="var(--font-mono)"
            fontSize={1.35 * s}
            fill="currentColor"
          >
            {letters === "char"
              ? n.ev.char
              : letters === "note"
                ? letterOfDn(n.ev.dn)
                : `${n.ev.char}·${letterOfDn(n.ev.dn)}`}
          </text>
        ))}

      {beatRef && (
        <line
          ref={head}
          className="sl-playhead"
          x1={0}
          x2={0}
          y1={top - 1.6 * s}
          y2={bottom + 1.6 * s}
          stroke="var(--color-vermillion)"
          strokeWidth={0.14 * s}
          opacity={playing ? 1 : 0}
          transform={`translate(${layout.beatToX(0)} 0)`}
        />
      )}
    </svg>
  );
}
