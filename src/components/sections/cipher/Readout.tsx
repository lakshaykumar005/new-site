"use client";

import type { CSSProperties } from "react";
import { normalizeWord, type SpelledNote } from "@/lib/music/cipher";
import type { NoteLetter } from "@/lib/music/theory";
import s from "./cipher.module.css";

export type ReadoutValue =
  /** one letter — or every letter of a column — and the note it becomes */
  | { kind: "pair"; letters: readonly string[]; note: NoteLetter; n: number; say: string }
  /** her name so far: the first `count` letters, each over its note */
  | { kind: "name"; count: number; run: number; say: string };

interface ReadoutProps {
  value: ReadoutValue | null;
  /** her name, as notes (the worked example is its first letter) */
  name: readonly SpelledNote[];
}

const ARROW = "M8 4.5 0.4 0.9Q2.3 4.5 0.4 8.1Z";

const upper = (ch: string) => normalizeWord(ch).toUpperCase();

/**
 * "P → B", set like a worked exercise on two ruled blanks. Before the
 * first tap the example is pencilled in from her own name; after that it
 * shows whatever was pressed last. When the taps start spelling her name,
 * the blanks become one per letter of it, and fill in as she goes.
 */
export default function Readout({ value, name }: ReadoutProps) {
  const example = name[0];

  return (
    <div className={s.readout} data-state={value?.kind ?? "example"}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {value?.say ?? ""}
      </span>

      {value?.kind === "name" ? (
        <span
          key={value.run}
          className={s.rName}
          style={{ "--n": Math.max(name.length, 1) } as CSSProperties}
          aria-hidden="true"
        >
          {name.map((l, i) => (
            <span key={i} className={s.rCol}>
              {i < value.count && (
                <>
                  <span className={s.rColLetter}>{upper(l.char)}</span>
                  <span className={s.rColNote}>{l.note}</span>
                </>
              )}
            </span>
          ))}
        </span>
      ) : (
        <span className={s.rPair} aria-hidden="true">
          <span className={s.slot}>
            {value ? (
              <span key={value.n} className={s.rLetter} data-many={value.letters.length > 1 ? "" : undefined}>
                {value.letters.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </span>
            ) : (
              example && <span className={s.exLetter}>{upper(example.char)}</span>
            )}
          </span>
          <span className={s.rArrow}>
            <span />
            <svg viewBox="0 0 8 9" focusable="false">
              <path d={ARROW} />
            </svg>
          </span>
          <span className={s.slot}>
            {value ? (
              <span key={value.n} className={s.rNote}>
                {value.note}
              </span>
            ) : (
              example && <span className={s.exNote}>{example.note}</span>
            )}
          </span>
        </span>
      )}
    </div>
  );
}
