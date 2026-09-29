"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { glyphAtCentre } from "@/components/notation/layout";
import { cipher } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { haptic } from "@/lib/device";
import { musicBox } from "@/lib/music/audio";
import { NOTE_COLUMNS, normalizeWord, noteOfLetter, spell, themeDnOf } from "@/lib/music/cipher";
import type { NoteEvent } from "@/lib/music/compose";
import { useScorePlayer } from "@/lib/music/hooks";
import type { DoneReason } from "@/lib/music/player";
import { letterOfDn, midiOfDn, type NoteLetter } from "@/lib/music/theory";
import CipherPlate from "./cipher/CipherPlate";
import Derivation from "./cipher/Derivation";
import Readout, { type ReadoutValue } from "./cipher/Readout";
import { holdEnterOnce, keepTogether } from "./cipher/keepTogether";
import { lettersOfColumn, lightColumn, lightLetter, lightNote } from "./cipher/lights";
import { homeChord, spellScore } from "./cipher/spellScore";
import s from "./cipher/cipher.module.css";

// Strings this section needs that copy.ts doesn't carry.
const SPELL_LABEL = "Spell it out";
const TABLE_LABEL = "The cipher: every letter, and the note it becomes";
/** read aloud when a note name is pressed: "B, I, P, and W all become B" */
const ALL_BECOME = (letters: string, note: string) => `${letters} all become ${note}`;

/** Phrases the copy should never break inside (the copy itself is untouched). */
const KEEP = ["Opus 1", "A, B, E, G, G", "A to G", "I only"];

const NAME_NOTES = spell(HER_NAME);
/** her name as the table spells it: PAVITHRAA */
const NAME_KEY = NAME_NOTES.map((n) => normalizeWord(n.char).toUpperCase()).join("");
/** read aloud when her name is complete: "Pavithraa becomes B A A B F A D A A" */
const NAME_SAY = `${HER_NAME} ${cipher.columnsLabel} ${NAME_NOTES.map((n) => n.note).join(" ")}`;
const HOME = homeChord(HER_NAME);

// (iOS before 14.5 has no ListFormat: fall back to plain commas rather than throw)
const LIST =
  typeof Intl.ListFormat === "function"
    ? new Intl.ListFormat("en", { type: "conjunction" })
    : { format: (items: readonly string[]) => items.join(", ") };

/** How much of her name the last few taps spell, counting from its first letter. */
function spelled(taps: string): number {
  for (let k = Math.min(taps.length, NAME_KEY.length); k > 0; k--) {
    if (taps.endsWith(NAME_KEY.slice(0, k))) return k;
  }
  return 0;
}

/** Sound one note now (unlocking audio inside the gesture). */
function pluckNote(note: NoteLetter) {
  const midi = midiOfDn(themeDnOf(note));
  const unlocking = musicBox.unlock();
  if (musicBox.audible) musicBox.pluck(midi, { velocity: 0.82 });
  else void unlocking.then(() => musicBox.pluck(midi, { velocity: 0.82 }));
  haptic(5);
}

/**
 * Her name, spelled by her own hand, comes home: the chord the theme
 * closes on rolls in under her last letter, each tone lit on the staff
 * as it sounds (the lights still run with the sound off).
 */
function comeHome(root: ParentNode) {
  const audible = musicBox.audible;
  const t0 = audible ? musicBox.now() + 0.03 : 0;
  for (const t of HOME) {
    if (audible) musicBox.pluck(t.midi, { when: t0 + t.at, velocity: t.velocity * 0.9, voice: "accompaniment" });
    lightNote(root, letterOfDn(t.dn), 30 + t.at * 1000);
  }
}

/** Fig. 1 — the composers' cipher, and her name run through it. */
export default function Cipher() {
  const root = useRef<HTMLElement>(null);
  const captionId = useId();
  const [readout, setReadout] = useState<ReadoutValue | null>(null);
  const [spelling, setSpelling] = useState(false);
  const { start, stop } = useScorePlayer();
  const score = useMemo(() => spellScore(HER_NAME), []);

  /** her last few letters (from the table or the pairs), to notice her name */
  const taps = useRef("");
  /** letters of her name on show in the readout, and which spelling that is */
  const shown = useRef(0);
  const run = useRef(0);
  const tick = useRef(0);

  const showName = useCallback((count: number, say: string) => {
    // one more letter (or the same ones again) keeps the blanks in place and
    // only the new letter prints; anything else is a fresh spelling
    if (count !== shown.current && count !== shown.current + 1) run.current++;
    shown.current = count;
    setReadout({ kind: "name", count, run: run.current, say });
  }, []);

  const showPair = useCallback((letters: readonly string[], note: NoteLetter, say: string) => {
    shown.current = 0;
    setReadout({ kind: "pair", letters, note, n: ++tick.current, say });
  }, []);

  /** a letter pressed on the table, or a pair of the derivation */
  const answer = useCallback(
    (letter: string, pair?: number) => {
      const note = noteOfLetter(letter);
      const el = root.current;
      if (!note || !el) return;
      stop(); // her hand takes over from the spell-through
      pluckNote(note);

      const upper = normalizeWord(letter).toUpperCase();
      const say = `${upper} ${cipher.columnsLabel} ${note}`;
      taps.current = (taps.current + upper).slice(-NAME_KEY.length);
      const k = NAME_KEY.length > 1 ? spelled(taps.current) : 0;
      // while the taps follow her name, the derivation answers each one: the
      // pair for that letter of her name lights as its note sounds
      lightLetter(el, letter, pair ?? (k > 0 ? k - 1 : undefined));
      if (k === NAME_KEY.length) {
        taps.current = "";
        comeHome(el);
        showName(k, NAME_SAY);
      } else if (k >= 2) {
        showName(k, say);
      } else {
        showPair([upper], note, say);
      }
    },
    [stop, showName, showPair]
  );

  const onKey = useCallback((letter: string) => answer(letter), [answer]);

  const onPair = useCallback(
    (i: number) => {
      const n = NAME_NOTES[i];
      if (n) answer(n.char, i);
    },
    [answer]
  );

  /** a note name (or its note on the staff): every letter that becomes it */
  const onColumn = useCallback(
    (c: number) => {
      const note = NOTE_COLUMNS[c];
      const el = root.current;
      if (!note || !el) return;
      stop();
      pluckNote(note);
      lightColumn(el, c);
      taps.current = "";
      const letters = lettersOfColumn(c);
      showPair(letters, note, ALL_BECOME(LIST.format(letters), note));
    },
    [stop, showPair]
  );

  const onSpell = useCallback(() => {
    if (spelling) {
      stop();
      return;
    }
    setSpelling(true);
    taps.current = "";
    shown.current = 0;
    run.current++;
    void start(score, {
      onNote: (ev: NoteEvent) => {
        const el = root.current;
        if (!el) return;
        if (ev.voice === "accompaniment") {
          lightNote(el, letterOfDn(ev.dn));
          return;
        }
        if (ev.char === undefined || ev.letter === undefined) return;
        lightLetter(el, ev.char, ev.letter);
        showName(ev.letter + 1, "");
      },
      onDone: (reason: DoneReason) => {
        setSpelling(false);
        if (reason === "ended") showName(NAME_NOTES.length, NAME_SAY);
      },
    });
  }, [spelling, start, stop, score, showName]);

  return (
    <section id="cipher" ref={root} className="section" aria-labelledby="cipher-title">
      <div className="wrap">
        <header className={`reveal ${s.head}`}>
          <p className="t-kicker">{cipher.kicker}</p>
          <h2 id="cipher-title" className="t-display mt-4">
            {cipher.title}
          </h2>
        </header>

        <div className={s.spread}>
          <div className={`measure ${s.prose}`}>
            {cipher.paragraphs.map((p) => (
              <p key={p} className="t-body reveal">
                {keepTogether(p, KEEP, s.nowrap)}
              </p>
            ))}
          </div>

          <div className={`reveal ${s.plateCol}`}>
            <CipherPlate
              onPlay={onKey}
              onColumn={onColumn}
              label={TABLE_LABEL}
              caption={cipher.tableCaption}
              captionId={captionId}
            />
            <div className={s.controls}>
              <Readout value={readout} name={NAME_NOTES} />
              <button
                type="button"
                className={`btn-quiet ${s.spell}`}
                aria-pressed={spelling}
                onKeyDown={holdEnterOnce}
                onClick={onSpell}
              >
                <svg className={s.spellHead} viewBox="0 0 10 16" aria-hidden="true" focusable="false">
                  <path d={GLYPHS.noteheadBlack.d} transform={glyphAtCentre("noteheadBlack", 4.4, 12.2, 7)} fill="currentColor" />
                  <rect x={7.75} y={1} width={0.85} height={10.4} fill="currentColor" />
                </svg>
                {SPELL_LABEL}
              </button>
            </div>
          </div>
        </div>

        <Derivation notes={NAME_NOTES} onPlay={onPair} />

        <div className={s.coda}>
          <p className="t-lede reveal">{cipher.result}</p>
          <div className={`reveal ${s.pull}`}>
            <span className={s.pullRule} aria-hidden="true" />
            <p className="t-heading">{cipher.kicker2}</p>
          </div>
          <p className={`t-body reveal ${s.closing}`}>{keepTogether(cipher.closing, KEEP, s.nowrap)}</p>
        </div>
      </div>
    </section>
  );
}
