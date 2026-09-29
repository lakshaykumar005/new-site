"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { titlePage, yourTurn } from "@/content/copy";
import { HER_NAME } from "@/content/site";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";
import { musicBox } from "@/lib/music/audio";
import { compose } from "@/lib/music/compose";
import { useScorePlayer, useSound } from "@/lib/music/hooks";
import { stopAll } from "@/lib/music/player";
import { letterOfDn } from "@/lib/music/theory";
import { MAX_WORD, songLink } from "@/lib/share";
import Engraving from "./your-turn/Engraving";
import { oneLineSpan } from "./your-turn/engrave";
import { ArrowGlyph, PlayGlyph, StopGlyph, TickGlyph } from "./your-turn/icons";
import { sendSong } from "./your-turn/send";
import { midiOfChar, noteKeys, rekey, sounds, tidy } from "./your-turn/words";
import styles from "./your-turn/your-turn.module.css";

/**
 * Fig. 4 — her turn. Every letter she types sounds as it lands and is
 * engraved on the staff below; the music re-flows around each new
 * letter like type. Then she can play it, or send it back.
 */

// Strings that aren't in copy.ts (accessible names and a last-resort prompt).
const MUSIC_LABEL = "Music:";
const COPY_PROMPT = "Copy this link";

/** seconds between the notes of a word that arrives all at once (a paste) */
const STRUM = 0.075;
/** how long a typed note stays lit */
const FLASH_MS = 520;

const NO_DELAYS: ReadonlyMap<string, number> = new Map();

/**
 * The paper is ruled once, for her name: a staff size at which her whole
 * name fits on one line of this column (she has just seen it printed on
 * one line in the Variations), within a sensible range. It never changes
 * while she types, the way ruled paper doesn't.
 */
const RULE = Math.max(39, Math.min(52, oneLineSpan(compose(HER_NAME, "theme")) + 0.3));
const spaceFor = (w: number) => Math.max(7, Math.min(14, w / RULE));
/** the same, in CSS, to hold one system's height before the column is measured */
const RESERVE = `calc(clamp(7px, (100vw - 2 * var(--gutter, 20px)) / ${RULE.toFixed(3)}, 14px) * 10.6 + 2px)`;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function YourTurn() {
  const id = useId();
  const [text, setText] = useState("");
  const [charKeys, setCharKeys] = useState<number[]>([]);
  const [enterDelays, setEnterDelays] = useState<ReadonlyMap<string, number>>(NO_DELAYS);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [toast, setToast] = useState(0);

  const nextKey = useRef(1);
  const timers = useRef(new Set<number>());
  const toastTimer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const staffRef = useRef<HTMLDivElement>(null);

  const player = useScorePlayer();
  const { muted } = useSound();
  const reduced = useReducedMotion();
  const coarse = useMediaQuery("(pointer: coarse)");

  const word = useMemo(() => tidy(text), [text]);
  const chars = useMemo(() => Array.from(word), [word]);
  const score = useMemo(() => compose(word, "theme"), [word]);
  const keys = useMemo(() => noteKeys(chars, charKeys), [chars, charKeys]);
  const hasNotes = score.melody.length > 0;
  const full = text.length >= MAX_WORD;

  const later = useCallback((ms: number, fn: () => void) => {
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);

  const hush = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    setFlashKey(null);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    const slip = toastTimer;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(slip.current);
    };
  }, []);

  // With a phone keyboard up, keep the word and its staff both in sight.
  const keepInView = useCallback(() => {
    const field = inputRef.current;
    const staff = staffRef.current;
    if (!field || !staff || document.activeElement !== field) return;
    const vv = window.visualViewport;
    const viewTop = vv?.offsetTop ?? 0;
    const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
    const f = field.getBoundingClientRect();
    const st = staff.getBoundingClientRect();
    let delta = Math.max(0, st.bottom + 12 - viewBottom);
    // never push the word up under the sound toggle
    delta = Math.min(delta, f.top - (viewTop + 76));
    if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
  }, [reduced]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!coarse || !vv) return;
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(keepInView, 140);
    };
    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [coarse, keepInView]);

  /** Writes a new word onto the staff; untouched letters keep their notes. Returns the new notes. */
  const rewrite = (next: string, stagger: number) => {
    const nextChars = Array.from(tidy(next));
    const { keys: k, inserted } = rekey(chars, charKeys, nextChars, () => nextKey.current++);
    const fresh = inserted
      .filter((i) => sounds(nextChars[i]))
      .map((i) => ({ key: `k${k[i]}`, ch: nextChars[i] }));
    setText(next);
    setCharKeys(k);
    setEnterDelays(fresh.length > 1 ? new Map(fresh.map((f, j) => [f.key, j * stagger])) : NO_DELAYS);
    return fresh;
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const ready = musicBox.audible;
    const unlocking = musicBox.unlock(); // inside the keystroke, before anything async
    stopAll(); // a new letter hushes any performance, here or elsewhere on the page
    hush();

    const fresh = rewrite(e.target.value, Math.round(STRUM * 1000));
    if (coarse) later(380, keepInView);
    if (fresh.length === 0) return;

    // each new letter sounds as it lands; a pasted word, strummed
    const strum = () => {
      const t0 = musicBox.now();
      fresh.forEach((f, j) => {
        const midi = midiOfChar(f.ch);
        if (midi !== null) musicBox.pluck(midi, { when: t0 + j * STRUM, velocity: 0.8, voice: "melody" });
      });
    };
    if (ready) strum();
    else void unlocking.then(strum);

    setFlashKey(fresh[0].key);
    fresh.slice(1).forEach((f, j) => later((j + 1) * STRUM * 1000, () => setFlashKey(f.key)));
    later((fresh.length - 1) * STRUM * 1000 + FLASH_MS, () => setFlashKey(null));
  };

  const perform = (w: string = word) => {
    const sc = w === word ? score : compose(w, "theme");
    if (sc.melody.length === 0) return;
    hush();
    void player.start(sc);
  };

  const onPlay = () => {
    void musicBox.unlock();
    if (player.playing) {
      player.stop();
      return;
    }
    perform();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void musicBox.unlock();
    // on a phone, put the keyboard away so the staff can be seen
    if (coarse) inputRef.current?.blur();
    perform();
  };

  const choose = (w: string) => {
    void musicBox.unlock();
    if (w !== text) rewrite(w, 45);
    perform(tidy(w));
  };

  const onSend = () => {
    if (!hasNotes) return;
    const url = songLink(word, window.location.origin);
    void sendSong(url, { promptLabel: COPY_PROMPT }).then((result) => {
      if (result !== "copied") return;
      setToast((n) => n + 1);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(0), 2800);
    });
  };

  const label = hasNotes
    ? `${MUSIC_LABEL} ${score.melody.map((m) => letterOfDn(m.dn)).join(" ")}`
    : yourTurn.empty;

  return (
    <section id="your-turn" className="section" aria-labelledby={`${id}-title`}>
      <div className="wrap">
        <div className={styles.column}>
          <header className={cx("reveal", styles.head)}>
            <p className="t-kicker">{yourTurn.kicker}</p>
            <h2 id={`${id}-title`} className={cx("t-display", styles.title)}>
              {yourTurn.title}
            </h2>
            <p className={cx("t-lede", styles.lede)}>{yourTurn.lede}</p>
          </header>

          <div className={cx("reveal", styles.instrument)}>
            <form className={styles.field} onSubmit={onSubmit}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                value={text}
                onChange={onChange}
                // any of these can be the gesture that lets sound start (iOS is particular)
                onPointerDown={() => void musicBox.unlock()}
                onClick={() => void musicBox.unlock()}
                onKeyDown={() => void musicBox.unlock()}
                onFocus={() => {
                  if (coarse) later(420, keepInView);
                }}
                maxLength={MAX_WORD}
                placeholder={yourTurn.placeholder}
                aria-label={yourTurn.inputLabel}
                aria-describedby={`${id}-status`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
              />
              <span className={styles.rule} aria-hidden />
            </form>

            <div className={styles.below}>
              <div
                className={cx(styles.try, full && styles.tryAway)}
                role="group"
                aria-labelledby={`${id}-try`}
              >
                <span id={`${id}-try`} className={cx("t-kicker", styles.tryLabel)}>
                  {yourTurn.tryLabel}
                </span>
                {yourTurn.suggestions.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={styles.chip}
                    aria-current={word === w ? "true" : undefined}
                    onClick={() => choose(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
              {/* at the limit, the suggestions make way for one quiet line */}
              <p id={`${id}-status`} className={styles.status} role="status" aria-live="polite">
                {full && <span className={styles.statusText}>{yourTurn.tooLong}</span>}
              </p>
            </div>

            <div ref={staffRef} className={styles.staff}>
              <Engraving
                score={score}
                keys={keys}
                staff="manuscript"
                space={spaceFor}
                letters="char"
                activeId={player.activeId}
                flashKey={flashKey}
                enterDelays={enterDelays}
                beatRef={player.beat}
                playing={player.playing}
                animate={!reduced}
                emptyText={yourTurn.empty}
                label={label}
                reserve={RESERVE}
              />
              {/* she is typing and hearing nothing: say why, where she is looking */}
              {muted && hasNotes && <p className={styles.mutedHint}>{titlePage.mutedNote}</p>}
            </div>

            <div className={styles.actions}>
              <button type="button" className="btn-play" onClick={onPlay} disabled={!hasNotes}>
                <span className="disc" aria-hidden>
                  {player.playing ? <StopGlyph /> : <PlayGlyph />}
                </span>
                <span className={styles.playLabel}>{player.playing ? yourTurn.stop : yourTurn.play}</span>
              </button>
              <button type="button" className="btn-quiet" onClick={onSend} disabled={!hasNotes}>
                {yourTurn.send}
                <ArrowGlyph />
              </button>
              {/* the copied-link slip: beside the button on a desk, over the note on a phone */}
              <div className={cx(styles.toast, toast > 0 && styles.toastOn)} aria-hidden>
                <TickGlyph />
                {yourTurn.copied}
              </div>
            </div>
            <p className={cx(styles.sendNote, toast > 0 && styles.sendNoteAway)}>{yourTurn.sendNote}</p>
            <p className="sr-only" role="status" aria-live="polite">
              {toast > 0 ? yourTurn.copied : ""}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
