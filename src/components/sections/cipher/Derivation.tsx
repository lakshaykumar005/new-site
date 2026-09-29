"use client";

import { memo, useRef, type CSSProperties } from "react";
import { cipher } from "@/content/copy";
import { useInView } from "@/lib/hooks";
import type { SpelledNote } from "@/lib/music/cipher";
import { holdEnterOnce } from "./keepTogether";
import s from "./cipher.module.css";

const HEAD = "M4.5 9 0.9 0.4Q4.5 2.3 8.1 0.4Z";

interface DerivationProps {
  notes: readonly SpelledNote[];
  onPlay: (index: number) => void;
}

/**
 * Her name worked through by hand: each letter over a hairline arrow over
 * its note. It writes itself out, pair by pair, the first time it scrolls
 * into view (silently); each pair plays its note when touched.
 */
function Derivation({ notes, onPlay }: DerivationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, threshold: 0.35, rootMargin: "0px 0px -8% 0px" });

  return (
    <div
      ref={ref}
      className={s.derivation}
      data-derivation=""
      data-in={seen ? "" : undefined}
      style={{ "--n": Math.max(notes.length, 1) } as CSSProperties}
    >
      <p className={`t-kicker reveal ${s.dLabel}`} id="cipher-derivation">
        {cipher.derivationLabel}
      </p>
      <ol className={s.pairs} aria-labelledby="cipher-derivation">
        {notes.map((n, i) => (
          <li key={i} className={s.pairSlot} style={{ "--i": i } as CSSProperties}>
            <button
              type="button"
              className={s.pair}
              data-pair={i}
              aria-label={`${n.char} ${cipher.columnsLabel} ${n.note}`}
              onKeyDown={holdEnterOnce}
              onClick={() => onPlay(i)}
            >
              <span className={s.pLetter} data-lift="" aria-hidden="true">
                <span>{n.char}</span>
                <span className={s.pLetterHot} data-pair-letter={i}>
                  {n.char}
                </span>
              </span>
              <span className={s.pArrow} aria-hidden="true">
                <span className={s.shaft} />
                <svg className={s.arrowHead} viewBox="0 0 9 9" focusable="false">
                  <path d={HEAD} />
                </svg>
                <span className={s.hot} data-pair-shaft={i} />
                <svg className={s.hot} data-pair-head={i} viewBox="0 0 9 9" focusable="false">
                  <path d={HEAD} />
                </svg>
              </span>
              <span className={s.pNote} aria-hidden="true">
                <span>{n.note}</span>
                <span className={s.pNoteHot} data-pair-note={i}>
                  {n.note}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default memo(Derivation);
