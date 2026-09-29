"use client";

import { memo, useId, type RefObject } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, flagTransform, glyphAtCentre } from "@/components/notation/layout";
import { variationsCopy } from "@/content/copy";
import { HEAD_GLYPH, LETTERS, stepY, VARIATIONS, type Engraving, type Pose } from "./engrave";
import styles from "./variations.module.css";

interface StaffProps {
  engraving: Engraving;
  /** the letter whose note is sounding, or −1 */
  activeLetter: number;
  /** the SVG, for the Morpher to take hold of */
  svgRef: RefObject<SVGSVGElement | null>;
  label: string;
}

const f2 = (v: number) => v.toFixed(2);

/** The letters, in the order the name spells them (the theme's order). */
const CHARS = VARIATIONS[0].score.melody.map((m) => m.char ?? "");

/** Short strokes hatched under a line at 45°, the way a diagram shows the back of a mirror. */
function hatch(x0: number, x1: number, y: number, s: number): string {
  const step = 0.72 * s;
  const len = 0.42 * s;
  const parts: string[] = [];
  for (let x = x0 + step; x < x1; x += step) parts.push(`M${f2(x)} ${f2(y + 0.1 * s)}l${f2(-len)} ${f2(len)}`);
  return parts.join("");
}

/**
 * The one staff of the kaleidoscope. Printed at rest as the theme
 * (so the page arrives engraved, before any script runs); from then on
 * the Morpher writes every position straight into it, and React only
 * ever touches which note is sounding.
 */
function Staff({ engraving, activeLetter, svgRef, label }: StaffProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { frame, sheets, ledgerSteps, maxBars, times } = engraving;
  const { s, top, bottom, left, labelY, clefX, timeX, width, height } = frame;
  const rest = sheets[0];

  const staffLines = [0, 1, 2, 3, 4].map((i) => top + i * s);
  const stemW = 0.12 * s;
  const mirrorY = top + 2 * s;
  const mirrorClip = `${uid}-mirror`;

  return (
    <svg
      ref={svgRef}
      className={styles.staff}
      viewBox={`0 0 ${f2(width)} ${f2(height)}`}
      width="100%"
      role="img"
      aria-label={label}
      focusable="false"
    >
      <g data-music="">
        <g className={styles.staffLines} strokeWidth={0.1 * s}>
          {staffLines.map((y, i) => (
            <line key={i} data-staff-line="" x1={f2(left)} x2={f2(rest.staffEnd)} y1={f2(y)} y2={f2(y)} />
          ))}
        </g>

        {/* the inversion's mirror: the middle line hatched behind, the way a diagram draws a mirror, drawn in as the melody flips over it */}
        <clipPath id={mirrorClip}>
          <rect data-mirror-clip="" x={f2(rest.musicStart)} y={f2(top - 2.4 * s)} width="0" height={f2(8.8 * s)} />
        </clipPath>
        <g data-mirror="" opacity="0" clipPath={`url(#${mirrorClip})`}>
          <path className={styles.mirrorLine} d={hatch(left, width, mirrorY, s)} strokeWidth={f2(0.08 * s)} fill="none" />
          <line
            className={styles.mirrorLine}
            x1={f2(rest.finalX - 0.9 * s)}
            x2={f2(rest.finalX - 0.9 * s)}
            y1={f2(top - 1.2 * s)}
            y2={f2(mirrorY)}
            strokeWidth={0.1 * s}
          />
          <text className={styles.mirrorText} x={f2(rest.finalX - 1.3 * s)} y={f2(top - 1.35 * s)} textAnchor="end">
            {variationsCopy.mirror}
          </text>
        </g>

        <path className={styles.ink} d={GLYPHS.gClef.d} transform={clefTransform(clefX, bottom, s)} />

        {times.map((t, k) => {
          const [num, den] = t.split("/");
          return (
            <g
              key={t}
              data-time={k}
              className={`${styles.ink} ${styles.time}`}
              opacity={t === rest.time ? 1 : 0}
              textAnchor="middle"
              fontWeight={800}
              style={{ fontVariationSettings: '"opsz" 14' }}
            >
              <text x={f2(timeX)} y={f2(top + s)} dominantBaseline="central" fontSize={f2(2.8 * s)}>
                {num}
              </text>
              <text x={f2(timeX)} y={f2(top + 3 * s)} dominantBaseline="central" fontSize={f2(2.8 * s)}>
                {den}
              </text>
            </g>
          );
        })}

        {Array.from({ length: maxBars }, (_, k) => (
          <rect
            key={k}
            data-bar={k}
            className={styles.ink}
            x={f2(k < rest.bars.length ? rest.bars[k] : rest.finalX - 0.72 * s)}
            y={f2(top)}
            width={f2(0.12 * s)}
            height={f2(4 * s)}
            opacity={k < rest.bars.length ? 1 : 0}
          />
        ))}
        <g data-final="" className={styles.ink} transform={`translate(${f2(rest.finalX)} 0)`}>
          <rect x={f2(-0.72 * s)} y={f2(top)} width={f2(0.12 * s)} height={f2(4 * s)} />
          <rect x={f2(-0.4 * s)} y={f2(top)} width={f2(0.5 * s)} height={f2(4 * s)} />
        </g>

        <g className={styles.ledgers} strokeWidth={0.16 * s}>
          {ledgerSteps.map((steps, i) =>
            steps.map((st) => {
              const p = rest.poses[i];
              const on = p?.ledgers.includes(st);
              return (
                <line
                  key={`${i}:${st}`}
                  data-ledger={`${i}:${st}`}
                  x1={f2((p?.x ?? 0) - (p?.ledgerHalf ?? 0))}
                  x2={f2((p?.x ?? 0) + (p?.ledgerHalf ?? 0))}
                  y1={f2(stepY(frame, st))}
                  y2={f2(stepY(frame, st))}
                  opacity={on ? 1 : 0}
                />
              );
            })
          )}
        </g>

        {Array.from({ length: LETTERS }, (_, i) => (
          <Note key={i} index={i} pose={rest.poses[i]} s={s} stemW={stemW} active={activeLetter === i} />
        ))}

        <g className={styles.letters} textAnchor="middle">
          {CHARS.map((ch, i) => (
            <text
              key={i}
              data-letter={i}
              className={styles.letter}
              data-on={activeLetter === i ? "" : undefined}
              x="0"
              y={f2(labelY)}
              transform={`translate(${f2(rest.poses[i]?.x ?? 0)} 0)`}
            >
              {ch}
            </text>
          ))}
        </g>
      </g>

      <line
        data-playhead=""
        className={styles.playhead}
        x1="0"
        x2="0"
        y1={f2(top - 1.6 * s)}
        y2={f2(bottom + 1.6 * s)}
        strokeWidth={f2(0.14 * s)}
        opacity="0"
      />
    </svg>
  );
}

/** One note, everything relative to its centre: the Morpher moves the group and re-draws the parts. */
function Note({ index, pose, s, stemW, active }: { index: number; pose: Pose | undefined; s: number; stemW: number; active: boolean }) {
  const p = pose;
  const len = p ? Math.abs(p.stemDy) : 0;
  const down = (p?.stemDy ?? 0) > 0;
  const stemStart = len < 0.3 * s ? 0 : (down ? 1 : -1) * 0.15 * s;
  return (
    <g
      data-note={index}
      className={styles.note}
      data-state={active ? "active" : undefined}
      transform={`translate(${f2(p?.x ?? 0)} ${f2(p?.y ?? 0)})`}
    >
      <line
        data-stem=""
        x1={f2(p?.stemDx ?? 0)}
        x2={f2(p?.stemDx ?? 0)}
        y1={f2(stemStart)}
        y2={f2(p?.stemDy ?? 0)}
        stroke="currentColor"
        strokeWidth={f2(stemW)}
        opacity={len < 0.3 * s ? 0 : 1}
      />
      {[1, 2].map((k) => {
        const on = p ? p.flags >= k : false;
        return (
          <path
            key={k}
            data-flag={k}
            d={GLYPHS.eighthFlagUp.d}
            fill="currentColor"
            opacity={on ? 1 : 0}
            transform={p ? flagTransform(p.stemDx - 0.06 * s, p.stemDy, s, down, (k - 1) * 0.8 * s) : undefined}
          />
        );
      })}
      <circle data-pulse="" className={styles.pulse} cx="0" cy="0" r={f2(0.9 * s)} fill="none" stroke="currentColor" strokeWidth={f2(0.12 * s)} />
      {(["black", "half", "whole"] as const).map((kind) => (
        <path
          key={kind}
          data-head={kind}
          d={GLYPHS[HEAD_GLYPH[kind]].d}
          transform={glyphAtCentre(HEAD_GLYPH[kind], 0, 0, s)}
          fill="currentColor"
          opacity={p?.head === kind ? 1 : 0}
        />
      ))}
      <circle data-dot="" cx={f2(p?.dotDx ?? 0)} cy={f2(p?.dotDy ?? 0)} r={f2(0.19 * s)} fill="currentColor" opacity={p?.dot ? 1 : 0} />
    </g>
  );
}

export default memo(Staff);
