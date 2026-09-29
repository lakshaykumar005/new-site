"use client";

import { useEffect, useState } from "react";
import { variationsCopy } from "@/content/copy";
import { VARIATIONS } from "./engrave";
import styles from "./variations.module.css";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Keeps hyphenated words ("oom-pah-pah", "crab-wise") whole when the caption wraps; the text is unchanged. */
function keepCompounds(text: string) {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={styles.compound}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

function Layer({ index, pick, className }: { index: number; pick: number; className: string }) {
  const v = VARIATIONS[index];
  return (
    <div className={`${styles.captionLayer} ${className}`}>
      <p className={`t-kicker ${styles.captionKicker}`}>
        <span>
          {variationsCopy.numeral} {ROMAN[index] ?? index + 1}
        </span>
        {index === pick && <span className={styles.captionPick}>{variationsCopy.todaysPick}</span>}
      </p>
      <h3 className={`t-heading ${styles.captionTitle}`}>{v.copy.title}</h3>
      <p className={`t-body ${styles.captionLine}`}>{keepCompounds(v.copy.line)}</p>
    </div>
  );
}

/**
 * The current variation's title and its line, under the instrument.
 * When the dial turns, the old words lift away and the new ones rise
 * into their place.
 */
export default function Caption({ current, pick }: { current: number; pick: number }) {
  const [prev, setPrev] = useState(current);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [settled, setSettled] = useState(true);
  if (prev !== current) {
    setPrev(current);
    setLeaving(prev);
    setSettled(false);
  }

  useEffect(() => {
    if (leaving === null) return;
    const t = window.setTimeout(() => {
      setLeaving(null);
      setSettled(true);
    }, 360);
    return () => window.clearTimeout(t);
  }, [leaving, current]);

  return (
    <div className={styles.caption}>
      {leaving !== null && leaving !== current && (
        <div key={`out-${leaving}`} className={styles.captionOut} aria-hidden>
          <Layer index={leaving} pick={pick} className="" />
        </div>
      )}
      <div key={`in-${current}`} className={settled && leaving === null ? undefined : styles.captionIn}>
        <Layer index={current} pick={pick} className="" />
      </div>
    </div>
  );
}
