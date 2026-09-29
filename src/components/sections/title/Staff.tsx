import type { RefObject } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, flagTransform, glyphAtCentre } from "@/components/notation/layout";
import type { TitleGeometry } from "./geometry";
import styles from "./title.module.css";

/** DOM handles the intro choreography writes to. */
export interface StaffNodes {
  notes: (SVGGElement | null)[];
  heads: (SVGGElement | null)[];
  bars: (SVGGElement | null)[];
}

interface Props {
  geo: TitleGeometry;
  /** index of the note sounding now, or -1 */
  active: number;
  /** how many times each note has sounded; a new count replays its ring */
  strikes: readonly number[];
  nodes: RefObject<StaffNodes>;
}

/**
 * The staff under the name: five lines drawn in once, a treble clef,
 * and — once she presses play — one engraved note under each letter.
 * The notes are always in the DOM (hidden until they fall) so nothing
 * shifts when they arrive.
 */
export default function Staff({ geo, active, strikes, nodes }: Props) {
  const { s, top, bottom, staffLeft, staffRight } = geo;
  const lineW = 0.08 * s;

  return (
    <svg
      className={styles.staffSvg}
      viewBox={`0 0 ${geo.width.toFixed(2)} ${geo.height.toFixed(2)}`}
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.lines} stroke="currentColor" strokeWidth={lineW} fill="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            className={styles.line}
            d={`M${staffLeft.toFixed(2)} ${(top + i * s).toFixed(2)}H${staffRight.toFixed(2)}`}
            pathLength={1}
          />
        ))}
      </g>

      <path className={styles.clef} d={GLYPHS.gClef.d} transform={clefTransform(geo.clefX, bottom, s)} fill="currentColor" />

      {geo.bars.map((b, i) => (
        <g
          key={`bar-${i}`}
          className={styles.bar}
          ref={(el) => {
            nodes.current.bars[i] = el;
          }}
          data-after={b.after}
          fill="currentColor"
        >
          {b.final ? (
            <>
              <rect x={b.x - 0.72 * s} y={top} width={0.12 * s} height={4 * s} />
              <rect x={b.x - 0.4 * s} y={top} width={0.5 * s} height={4 * s} />
            </>
          ) : (
            <rect x={b.x - 0.06 * s} y={top} width={0.12 * s} height={4 * s} />
          )}
        </g>
      ))}

      {geo.notes.map((n, i) => {
        const sounding = i === active;
        return (
          <g
            key={n.id}
            className={`${styles.note} ${sounding ? styles.sounding : ""}`}
            ref={(el) => {
              nodes.current.notes[i] = el;
            }}
          >
            {n.ledgers.map((y) => (
              <line
                key={y}
                x1={n.x - n.headW / 2 - 0.42 * s}
                x2={n.x + n.headW / 2 + 0.42 * s}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth={0.16 * s}
              />
            ))}
            {n.stem && (
              <path
                className={styles.stem}
                d={`M${n.stemX.toFixed(2)} ${n.stemY1.toFixed(2)}V${n.stemY2.toFixed(2)}`}
                pathLength={1}
                stroke="currentColor"
                strokeWidth={0.12 * s}
                fill="none"
              />
            )}
            {n.flags > 0 && (
              <path
                className={styles.flag}
                d={GLYPHS.eighthFlagUp.d}
                transform={flagTransform(n.stemX - 0.06 * s, n.stemY2, s, n.stem === "down")}
                fill="currentColor"
              />
            )}
            {n.flags > 1 && (
              <path
                className={styles.flag}
                d={GLYPHS.eighthFlagUp.d}
                transform={flagTransform(n.stemX - 0.06 * s, n.stemY2, s, n.stem === "down", 0.8 * s)}
                fill="currentColor"
              />
            )}
            {n.dot && <circle className={styles.dot} cx={n.dotX} cy={n.dotY} r={0.19 * s} fill="currentColor" />}
            <g
              className={styles.head}
              ref={(el) => {
                nodes.current.heads[i] = el;
              }}
            >
              <path d={GLYPHS[n.head].d} transform={glyphAtCentre(n.head, n.x, n.y, s)} fill="currentColor" />
            </g>
            {/* the ring of the first landing, then one per sounding in the theme */}
            <circle className={styles.ringLand} cx={n.x} cy={n.y} r={0.95 * s} fill="none" stroke="currentColor" strokeWidth={0.1 * s} />
            {(strikes[i] ?? 0) > 0 && (
              <circle
                key={strikes[i]}
                className={styles.ring}
                cx={n.x}
                cy={n.y}
                r={0.95 * s}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.1 * s}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
