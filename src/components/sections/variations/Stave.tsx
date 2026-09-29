"use client";

import { useMemo, type CSSProperties, type RefObject } from "react";
import ScoreLine from "@/components/notation/ScoreLine";
import { layoutScore, type ScoreLayout } from "@/components/notation/layout";
import type { Staff } from "./systems";
import styles from "./variations.module.css";

interface StaveProps {
  staff: Staff;
  /** column width in px; the engraving is drawn 1:1 with it */
  width: number;
  /** staff space in px, the same for every line on the page */
  space: number;
  activeId: string | null;
  playedIds: ReadonlySet<string>;
  /** the piece's beat, as the player writes it */
  beatRef: RefObject<number>;
  /** the music is on this line: run its playhead */
  playing: boolean;
}

/** A wash under one bar: where it sits, and the beats (of the whole piece) it covers. */
interface Wash {
  x: number;
  width: number;
  from: number;
  to: number;
}

/**
 * One engraved line of a system, justified to both margins, with a
 * faint wash under each bar that the system lights while that bar is
 * being played (see System).
 */
export default function Stave({ staff, width, space, activeId, playedIds, beatRef, playing }: StaveProps) {
  const { score, offset, time, continues } = staff;

  const { viewWidth, cut, height, band, washes } = useMemo(() => {
    const engraveAt = (w: number) => layoutScore(score, { width: w, space, time, letters: true });
    // the right edge of what is printed: the thick final bar, or the plain barline where the music carries on
    const edge = (l: ScoreLayout) => {
      const final = l.bars[l.bars.length - 1];
      return final ? final.x + (continues ? -0.6 : 0.1) * l.s : width;
    };

    // Justify like a printed page: every line ends exactly on the right margin.
    // ScoreLine runs its staff lines a little past the final barline (by an
    // amount that varies with the spacing), so the line is engraved a touch
    // wider than the column, solved so its last barline lands on the margin,
    // and whatever lies beyond is cropped. A line that carries on is cropped
    // just after the thin stroke of its final double bar: a plain barline.
    let w = width;
    let laid = engraveAt(w);
    for (let i = 0; i < 8 && Math.abs(width - edge(laid)) >= 0.01; i++) {
      w += width - edge(laid);
      laid = engraveAt(w);
    }

    const { s, notes, bars } = laid;
    const barlines = bars.filter((b) => b.kind === "single").map((b) => b.x);
    const final = bars[bars.length - 1]?.x ?? w;
    // the music starts where ScoreLine starts its notes: just after the clef and time signature
    const first = notes[0];
    const start = first ? first.x - first.headW / 2 - 0.6 * s : 0;
    // layoutScore draws a barline for every bar that doesn't open the line, in order
    const downbeats = score.bars.map((b) => b.start).filter((b) => b > 1e-6);
    const edges = [start, ...barlines, final - 0.72 * s];
    const beats = [0, ...downbeats, continues ? score.length : Infinity];
    const inset = 0.3 * s;
    // (the piece's last bar ends at Infinity: it stays lit until the music stops)
    const washes: Wash[] = edges.slice(1).map((right, k) => {
      const left = k === 0 ? edges[0] : edges[k] + 0.12 * s;
      return {
        x: left + inset,
        width: Math.max(0, right - left - 2 * inset),
        from: beats[k] + offset,
        to: beats[k + 1] + offset,
      };
    });

    // one band for the whole line: the staff and the ink around it (stems, ledger lines)
    let hi = laid.top - 1.1 * s;
    let lo = laid.bottom + 1.1 * s;
    for (const n of notes) {
      hi = Math.min(hi, n.y - 0.9 * s, (n.stem ? n.stemEnd : n.y) - 0.5 * s);
      lo = Math.max(lo, n.y + 0.9 * s, (n.stem ? n.stemEnd : n.y) + 0.5 * s);
    }

    return { viewWidth: w, cut: Math.max(0, w - edge(laid)), height: laid.height, band: { y: hi, height: lo - hi }, washes };
  }, [score, width, space, time, continues, offset]);

  // the playhead reads this line's own beat
  const lineBeat = useMemo<RefObject<number>>(
    () =>
      offset === 0
        ? beatRef
        : {
            get current() {
              return (beatRef.current ?? 0) - offset;
            },
          },
    [beatRef, offset]
  );

  return (
    <div
      className={styles.staffBox}
      style={{ "--hs": staff.heightInSpaces, "--extra": `${viewWidth - width}px`, "--cut": `${cut}px` } as CSSProperties}
    >
      <svg
        className={styles.wash}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        focusable="false"
      >
        {washes.map((r, k) => (
          <rect key={k} x={r.x} width={r.width} y={band.y} height={band.height} data-from={r.from} data-to={r.to} />
        ))}
      </svg>
      <ScoreLine
        score={score}
        width={viewWidth}
        space={space}
        time={time}
        letters="char"
        className={styles.staff}
        activeId={activeId}
        playedIds={playedIds}
        beatRef={lineBeat}
        playing={playing}
      />
    </div>
  );
}
