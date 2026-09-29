"use client";

import { memo, useCallback, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, glyphAtCentre } from "@/components/notation/layout";
import { cipher } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { ALPHABET, CIPHER_ROWS, NOTE_COLUMNS, normalizeWord, spell, themeDnOf } from "@/lib/music/cipher";
import { trebleStep } from "@/lib/music/theory";
import { holdEnterOnce } from "./keepTogether";
import s from "./cipher.module.css";

/** Letters of her name get a ring in the table. */
const IN_NAME = new Set(spell(HER_NAME).map((n) => normalizeWord(n.char).toUpperCase()));

const COLS = NOTE_COLUMNS.length;
const LAST = ALPHABET.length - 1;
/** Focus positions: 0–25 are the letters, HEAD + c the note names over the columns. */
const HEAD = 100;

// Staff geometry, in drawing units: a staff space is 10, a table column 63.
// CSS scales these units with the cell size (see `--u`), so the whole notes
// stay centred over their columns at every breakpoint.
const SP = 10;
const COL_W = 63;
const STAFF_H = 76;
const TOP_LINE = 17;
const BOTTOM_LINE = TOP_LINE + 4 * SP;
const LINES = [0, 1, 2, 3, 4].map((k) => TOP_LINE + k * SP);
const yOfStep = (step: number) => BOTTOM_LINE - (step * SP) / 2;

/** The seven notes as they are written: a treble clef and a rising scale. */
const Staff = memo(function Staff() {
  return (
    <div className={s.staff} aria-hidden="true">
      <svg className={s.staffLines} viewBox={`0 0 1 ${STAFF_H}`} preserveAspectRatio="none" focusable="false">
        {LINES.map((y) => (
          <line
            key={y}
            x1={0}
            x2={1}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        ))}
      </svg>
      <svg className={s.clef} viewBox={`0 0 30 ${STAFF_H}`} focusable="false">
        <path d={GLYPHS.gClef.d} transform={clefTransform(2, BOTTOM_LINE, SP)} fill="currentColor" />
      </svg>
      <svg className={s.barline} viewBox={`0 0 8 ${STAFF_H}`} focusable="false">
        <rect x={2.4} y={TOP_LINE} width={1.2} height={4 * SP} fill="currentColor" />
        <rect x={6.8} y={TOP_LINE} width={1.2} height={4 * SP} fill="currentColor" />
      </svg>
      <div className={s.staffNotes}>
        {NOTE_COLUMNS.map((note, c) => {
          const y = yOfStep(trebleStep(themeDnOf(note)));
          const at = glyphAtCentre("wholeNote", COL_W / 2, y, SP);
          return (
            <svg key={note} className={s.staffNote} viewBox={`0 0 ${COL_W} ${STAFF_H}`} focusable="false">
              <circle
                className={s.staffRing}
                data-staff-ring={c}
                cx={COL_W / 2}
                cy={y}
                r={9}
                fill="none"
                strokeWidth={1.1}
              />
              <path d={GLYPHS.wholeNote.d} transform={at} fill="currentColor" />
              <path className={s.staffHot} data-staff-hot={c} d={GLYPHS.wholeNote.d} transform={at} />
            </svg>
          );
        })}
      </div>
    </div>
  );
});

function Hatch({ id }: { id: string }) {
  return (
    <svg className={s.hatch} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

interface CipherPlateProps {
  /** a letter was pressed (by pointer, Enter/Space, or typed while the table has focus) */
  onPlay: (letter: string) => void;
  /** a note name (or its note on the staff) was pressed: column 0–6 */
  onColumn: (col: number) => void;
  /** accessible name of the table */
  label: string;
  /** the figure's caption, which also describes the table */
  caption: string;
  captionId: string;
}

/** Where focus sits: a letter's index, or HEAD + a column for a note name. */
function positionOf(el: HTMLElement): number {
  if (el.dataset.index !== undefined) return Number(el.dataset.index);
  if (el.dataset.headKey !== undefined) return HEAD + Number(el.dataset.headKey);
  return NaN;
}

/**
 * The cipher table. It is a real grid for assistive tech: the note names
 * are its column headers (and play their note), and one arrow-key-driven
 * tab stop moves across names and letters alike (→ from G wraps to H,
 * the same way the alphabet does).
 */
function CipherPlate({ onPlay, onColumn, label, caption, captionId }: CipherPlateProps) {
  const [focusAt, setFocusAt] = useState(0);
  const keys = useRef(new Map<number, HTMLButtonElement>());
  const hatchId = `cipher-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const moveTo = useCallback((pos: number) => {
    setFocusAt(pos);
    keys.current.get(pos)?.focus();
  }, []);

  const keep = useCallback(
    (pos: number) => (el: HTMLButtonElement | null) => {
      if (el) keys.current.set(pos, el);
      else keys.current.delete(pos);
    },
    []
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (holdEnterOnce(e)) return;
      const from = positionOf(e.target as HTMLElement);
      if (!Number.isInteger(from)) return;
      const head = from >= HEAD;
      const col = head ? from - HEAD : from % COLS;
      const rowStart = from - col;
      let to: number;
      switch (e.key) {
        case "ArrowRight":
          to = head ? HEAD + Math.min(COLS - 1, col + 1) : Math.min(LAST, from + 1);
          break;
        case "ArrowLeft":
          to = head ? HEAD + Math.max(0, col - 1) : Math.max(0, from - 1);
          break;
        case "ArrowDown":
          to = head ? col : from + COLS <= LAST ? from + COLS : from;
          break;
        case "ArrowUp":
          to = head ? from : from - COLS >= 0 ? from - COLS : HEAD + col;
          break;
        case "Home":
          to = e.ctrlKey ? HEAD : head ? HEAD : rowStart;
          break;
        case "End":
          to = e.ctrlKey ? LAST : head ? HEAD + COLS - 1 : Math.min(LAST, rowStart + COLS - 1);
          break;
        default: {
          // typing a letter plays it — her name can be spelled on a keyboard
          if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
          const i = ALPHABET.indexOf(normalizeWord(e.key).toUpperCase());
          if (i < 0) return;
          e.preventDefault();
          if (!e.repeat) onPlay(ALPHABET[i]);
          moveTo(i);
          return;
        }
      }
      e.preventDefault();
      moveTo(to);
    },
    [moveTo, onPlay]
  );

  return (
    <figure className={s.figure}>
      <Staff />

      {/* the verb of the table, over the row it governs */}
      <div className={s.bracket} aria-hidden="true">
        <span className={s.bracketArm} />
        <span className={s.bracketLabel}>{cipher.columnsLabel}</span>
        <span className={s.bracketArm} />
      </div>

      {/* data-noswipe: a finger dragged across the letters is playing, not turning the page */}
      <div
        role="grid"
        aria-label={label}
        aria-describedby={captionId}
        className={s.grid}
        onKeyDown={onKeyDown}
        data-noswipe=""
      >
        <div role="rowgroup">
          <div role="row" className={s.names}>
            {NOTE_COLUMNS.map((note, c) => (
              <div role="columnheader" key={note} className={s.name} data-head={c}>
                <button
                  type="button"
                  ref={keep(HEAD + c)}
                  className={s.headKey}
                  data-head-key={c}
                  tabIndex={focusAt === HEAD + c ? 0 : -1}
                  onClick={() => {
                    setFocusAt(HEAD + c);
                    onColumn(c);
                  }}
                >
                  <span className={s.headRing} aria-hidden="true" />
                  <span>{note}</span>
                  <span className={s.nameHot} data-head-hot={c} aria-hidden="true">
                    {note}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div role="rowgroup" className={s.body}>
          {CIPHER_ROWS.map((row, r) => (
            <div role="row" key={row} className={s.row}>
              {NOTE_COLUMNS.map((note, c) => {
                const letter = row[c];
                if (!letter) {
                  return (
                    <div role="gridcell" key={note} className={`${s.cell} ${s.blank}`}>
                      <Hatch id={`${hatchId}-${c}`} />
                    </div>
                  );
                }
                const i = r * COLS + c;
                const mine = IN_NAME.has(letter);
                return (
                  <div role="gridcell" key={note} className={s.cell} data-c={c}>
                    <button
                      type="button"
                      ref={keep(i)}
                      className={s.key}
                      data-index={i}
                      tabIndex={i === focusAt ? 0 : -1}
                      onClick={() => {
                        setFocusAt(i);
                        onPlay(letter);
                      }}
                    >
                      {mine && <span className={s.ring} aria-hidden="true" />}
                      <span className={s.focusRing} aria-hidden="true" />
                      <span className={s.glyph}>{letter}</span>
                      <span className={s.disc} data-disc={letter} aria-hidden="true" />
                      <span className={s.glyphHot} data-key-hot={letter} aria-hidden="true">
                        {letter}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {NOTE_COLUMNS.map((note, c) => (
          <span key={note} className={s.wash} data-wash={c} style={{ "--c": c } as CSSProperties} aria-hidden="true" />
        ))}
      </div>

      <figcaption id={captionId} className={`t-caption ${s.caption}`}>
        {caption}
      </figcaption>
    </figure>
  );
}

export default memo(CipherPlate);
