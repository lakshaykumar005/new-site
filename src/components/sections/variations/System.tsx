"use client";

import { memo, useEffect, useId, useRef, type RefObject } from "react";
import { variationsCopy } from "@/content/copy";
import NoteValue from "./NoteValue";
import Stave from "./Stave";
import type { MusicSystem, Staff } from "./systems";
import styles from "./variations.module.css";

interface SystemProps {
  system: MusicSystem;
  index: number;
  /** its engraved lines: one, or two where the page had to break it */
  lines: Staff[];
  /** column width in px; the engraving is drawn 1:1 with it */
  width: number;
  /** staff space in px, the same for every system on the page */
  space: number;
  /** its button is on: playing, or about to */
  on: boolean;
  /** its notes are sounding right now (drives the playhead) */
  sounding: boolean;
  activeId: string | null;
  playedIds: ReadonlySet<string>;
  beatRef: RefObject<number>;
  /** today's pick */
  picked: boolean;
  onToggle: (index: number) => void;
}

/** How long the metronome's little note stays vermillion on each beat before it fades back to ink, in seconds. */
const TICK = 0.09;

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

/** One variation, printed as a system: heading, tempo marking, the engraved line (or two), a sentence. */
function System({
  system,
  index,
  lines,
  width,
  space,
  on,
  sounding,
  activeId,
  playedIds,
  beatRef,
  picked,
  onToggle,
}: SystemProps) {
  const titleId = useId();
  const actionId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const tickRef = useRef<SVGSVGElement>(null);
  const { copy, score, tempo } = system;

  // the line the music is on: the one holding the note that sounded last
  const atLine = Math.max(0, lines.findIndex((l) => l.score.melody.some((e) => e.id === activeId)));

  // While it sounds, the printed metronome mark keeps time (its note ticks
  // vermillion on every beat) and a wash follows the bar being played.
  // Written straight to the DOM from the player's beat, and only while
  // this system is sounding: the page is still the rest of the time.
  useEffect(() => {
    if (!sounding) return;
    const washes = Array.from(itemRef.current?.querySelectorAll<SVGRectElement>("rect[data-from]") ?? []);
    const spans = washes.map((r) => [Number(r.dataset.from), Number(r.dataset.to)] as const);
    const note = tickRef.current;
    const secondsPerBeat = (tempo.pulse * 60) / score.bpm;
    let raf = 0;
    const frame = () => {
      const beat = beatRef.current ?? 0;
      washes.forEach((r, i) => r.toggleAttribute("data-on", beat >= spans[i][0] && beat < spans[i][1]));
      note?.toggleAttribute("data-tick", ((beat / tempo.pulse) % 1) * secondsPerBeat < TICK);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      washes.forEach((r) => r.removeAttribute("data-on"));
      note?.removeAttribute("data-tick");
    };
  }, [sounding, beatRef, tempo.pulse, score.bpm, lines]);

  return (
    <li
      ref={itemRef}
      className={`reveal ${styles.system}`}
      data-picked={picked ? "" : undefined}
      // a keyboard can land on its button before it has scrolled far enough to fade in: show it now
      onFocus={(e) => e.currentTarget.classList.add("is-visible")}
    >
      {picked && <p className={`t-kicker ${styles.badge}`}>{variationsCopy.todaysPick}</p>}

      <div className={styles.head}>
        <div>
          <h3 id={titleId} className={`t-heading ${styles.name}`}>
            {copy.title}
          </h3>
          <p className={`t-mark ${styles.mark}`}>
            {copy.mark}
            <span className={styles.metro} aria-hidden>
              <NoteValue ref={tickRef} unit={tempo.unit} className={styles.metroNote} />
              {"= "}
              {tempo.perMinute}
            </span>
          </p>
        </div>

        <button
          type="button"
          className={styles.play}
          data-on={on}
          aria-labelledby={`${actionId} ${titleId}`}
          onClick={() => onToggle(index)}
        >
          <span id={actionId} className="sr-only">
            {on ? variationsCopy.stop : variationsCopy.play}
          </span>
          <span className={styles.disc} aria-hidden>
            <svg viewBox="0 0 20 20" className={styles.glyph} focusable="false">
              <path className={styles.tri} d="M7 4.8 15.6 10 7 15.2Z" />
              <rect className={styles.sq} x="5.6" y="5.6" width="8.8" height="8.8" rx="0.7" />
            </svg>
          </span>
        </button>
      </div>

      {lines.map((staff, k) => (
        <Stave
          key={k}
          staff={staff}
          width={width}
          space={space}
          activeId={activeId}
          playedIds={playedIds}
          beatRef={beatRef}
          playing={sounding && k === atLine}
        />
      ))}

      <p className={`t-body ${styles.line}`}>{keepCompounds(copy.line)}</p>
    </li>
  );
}

export default memo(System);
