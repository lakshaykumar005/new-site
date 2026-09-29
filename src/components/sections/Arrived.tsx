"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, glyphAtCentre } from "@/components/notation/layout";
import { arrived, titlePage, yourTurn } from "@/content/copy";
import { useReducedMotion } from "@/lib/hooks";
import { musicBox } from "@/lib/music/audio";
import { spell } from "@/lib/music/cipher";
import { compose } from "@/lib/music/compose";
import { useScorePlayer, useSound } from "@/lib/music/hooks";
import { letterOfDn } from "@/lib/music/theory";
import { decodeWord } from "@/lib/share";
import Engraving from "./your-turn/Engraving";
import { fitSpace } from "./your-turn/engrave";
import { ArrowGlyph, PlayGlyph, StopGlyph } from "./your-turn/icons";
import { tidy } from "./your-turn/words";
import styles from "./your-turn/your-turn.module.css";

/**
 * /s — a song arrived. The word travels in the link's #hash and is
 * only ever read here, in the browser. Its notes are printed with a
 * blank under each one; as each note sounds its letter is written in,
 * and at the end the word is set large, like a title.
 */

// Strings that aren't in copy.ts (an accessible name).
const MUSIC_LABEL = "Music:";

/** after the last letter sounds, a breath before the answer */
const REVEAL_AFTER_MS = 900;

const NBSP = " ";

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const readHash = () => window.location.hash;
const noHash = () => null;

/** The largest staff space (px), for a desk. */
const SPACE_MAX = 14;
/** A column this wide or wider is a desk: a larger minimum staff, and at most two systems. */
const DESK = 560;
/** Staff sizes and system counts the arrived page may use in a column `w` px wide. */
const range = (w: number) => ({
  sMin: Math.min(10, Math.max(7.25, w / 70)),
  sMax: w >= DESK ? SPACE_MAX : Math.max(9, Math.min(SPACE_MAX, w / 34)),
  maxSystems: w >= DESK ? 2 : 3,
});
/** justify the last system too once it is this full */
const JUSTIFY_LAST = 0.78;
/** room left between Play and the bottom of the first screen (px) */
const BREATH = 20;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A word's letters as a reader sees them: an accented letter or a joined symbol stays one. */
function graphemes(s: string): string[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (g) => g.segment);
  }
  return Array.from(s);
}
const PICTOGRAPH = /\p{Extended_Pictographic}/u;

/** Where "answer with a song of your own" goes: the page she writes one on. */
const ANSWER_HREF = "/your-turn";

export default function Arrived() {
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);

  // undefined: not read yet (the server render); null: no playable word in the link
  const word = useMemo(() => {
    if (hash === null) return undefined;
    const decoded = decodeWord(hash);
    if (!decoded) return null;
    const w = tidy(decoded);
    return spell(w).length > 0 ? w : null;
  }, [hash]);

  return (
    <main className={styles.arrived}>
      <div className="wrap">
        <div className={styles.card}>
          {/* the same for every link, so it is printed before the link is read */}
          <p className="t-kicker">{arrived.kicker}</p>
          {word === undefined ? <Pending /> : word === null ? <Scrambled /> : <Song key={word} word={word} />}
        </div>
      </div>
    </main>
  );
}

/** Before the link has been read (the server's page): the heading's room, held. */
function Pending() {
  return (
    <div className={styles.pending} aria-hidden>
      <p className={cx("t-display", styles.arrivedTitle)}>{arrived.title}</p>
      <p className={cx("t-lede", styles.arrivedLede)}>{arrived.lede}</p>
    </div>
  );
}

interface Room {
  width: number;
  /** px of the first screen left for the music with Play beneath it, and with Play above it */
  below: number;
  above: number;
}

function Song({ word }: { word: string }) {
  const score = useMemo(() => compose(word, "theme"), [word]);
  const player = useScorePlayer();
  const { muted } = useSound();
  const reduced = useReducedMotion();
  const [heard, setHeard] = useState<ReadonlySet<string>>(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [room, setRoom] = useState<Room | null>(null);
  const timers = useRef(new Set<number>());
  const answerRef = useRef<HTMLDivElement>(null);
  const staffRef = useRef<HTMLDivElement>(null);
  const lastId = score.melody[score.melody.length - 1]?.id;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // How much of the first screen is left for the music once the heading
  // and Play are set. Read when the page opens (and again if the column
  // changes width) — not as a phone's toolbar slides, so the music never
  // changes size under her thumb.
  const stage = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let alive = true;
    let measured = 0;
    const read = (force = false) => {
      const width = Math.floor(el.getBoundingClientRect().width);
      if (!width || (!force && width === measured)) return;
      measured = width;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const play = el.querySelector<HTMLElement>("[data-play]")?.getBoundingClientRect().height ?? 48;
      const gap = parseFloat(getComputedStyle(el).rowGap) || 24;
      const left = window.innerHeight - top - play - gap;
      setRoom((r) => {
        const next = { width, below: Math.floor(left - BREATH), above: Math.floor(left - 12) };
        return r && r.width === next.width && r.below === next.below && r.above === next.above ? r : next;
      });
    };
    read();
    const ro = new ResizeObserver(() => read());
    ro.observe(el);
    // the heading may wrap differently once its typeface has arrived
    void document.fonts?.ready.then(() => {
      if (alive) read(true);
    });
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);

  // Like an engraver choosing a staff size for the page: the fewest
  // systems, then as large as they allow — and the whole of it, with
  // Play beneath, inside the first screen. If it can't be, Play comes first.
  const fitAt = useCallback(
    (width: number, maxHeight?: number) =>
      fitSpace(score, { width, ...range(width), maxHeight, staff: "engraved", justifyLast: JUSTIFY_LAST, center: true }),
    [score]
  );
  const plan = useMemo(() => {
    if (!room) return null;
    const below = fitAt(room.width, room.below);
    if (below.fits) return { width: room.width, s: below.s, playFirst: false };
    return { width: room.width, s: fitAt(room.width, room.above).s, playFirst: true };
  }, [room, fitAt]);
  const spaceFor = useCallback(
    (w: number) => (plan && Math.abs(w - plan.width) < 1 ? plan.s : fitAt(w).s),
    [plan, fitAt]
  );

  const onPlay = () => {
    void musicBox.unlock(); // inside the tap, before anything async
    if (player.playing) {
      player.stop();
      return;
    }
    // with Play set above the music, bring all of the music into view as it starts
    const staff = staffRef.current;
    if (plan?.playFirst && staff && staff.getBoundingClientRect().bottom > window.innerHeight) {
      staff.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
    }
    void player.start(score, {
      onNote: (ev) => {
        if (ev.voice !== "melody") return;
        // each letter is written in under its note as the note sounds
        setHeard((h) => (h.has(ev.id) ? h : new Set(h).add(ev.id)));
        if (ev.id === lastId) {
          const t = window.setTimeout(() => {
            timers.current.delete(t);
            setRevealed(true);
          }, REVEAL_AFTER_MS);
          timers.current.add(t);
        }
      },
      onDone: (reason) => {
        if (reason !== "ended") return;
        setRevealed(true);
        setRounds((r) => r + 1);
      },
    });
  };

  // bring the answer into view if it lands below the fold
  useEffect(() => {
    if (!revealed) return;
    const el = answerRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      if (el.getBoundingClientRect().bottom > window.innerHeight - 8) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
      }
    }, 260);
    return () => window.clearTimeout(t);
  }, [revealed, reduced]);

  const playLabel = player.playing ? yourTurn.stop : revealed || rounds > 0 ? arrived.again : arrived.play;
  const linksDelay = Math.min(graphemes(word).length * 75, 1400) + 1000;

  return (
    <>
      <h1 className={cx("t-display reveal", styles.arrivedTitle)}>{arrived.title}</h1>
      <p className={cx("t-lede reveal", styles.arrivedLede)}>{arrived.lede}</p>

      <div ref={stage} className={cx(styles.stage, plan?.playFirst && styles.playFirst)}>
        <div ref={staffRef} className="reveal">
          <Engraving
            score={score}
            staff="engraved"
            space={spaceFor}
            letters="blank"
            revealed={heard}
            activeId={player.activeId}
            beatRef={player.beat}
            playing={player.playing}
            animate={false}
            justifyLast={JUSTIFY_LAST}
            center
            label={`${MUSIC_LABEL} ${score.melody.map((m) => letterOfDn(m.dn)).join(" ")}`}
            reserve="calc(min(14px, max(9px, (100vw - 2 * var(--gutter, 20px)) / 34)) * 10.6 + 2px)"
          />
        </div>

        {/* the page's one action: never left waiting on the scroll observer */}
        <div className={styles.arrivedPlay} data-play>
          <button type="button" className="btn-play" onClick={onPlay}>
            <span className="disc" aria-hidden>
              {player.playing ? <StopGlyph /> : <PlayGlyph />}
            </span>
            <span className={styles.playLabel}>{playLabel}</span>
          </button>
          {muted && <p className={styles.mutedNote}>{titlePage.mutedNote}</p>}
        </div>
      </div>

      <div ref={answerRef} aria-live="polite">
        {revealed && (
          <div className={styles.reveal}>
            <p className={cx("t-mark", styles.says)}>{arrived.reveal}</p>
            <BigWord word={word} />
            <nav className={styles.links} style={{ animationDelay: `${linksDelay}ms` }}>
              <Link href={ANSWER_HREF} className="btn-quiet">
                {arrived.answer}
                <ArrowGlyph />
              </Link>
              <Link href="/" className={styles.homeLink}>
                {arrived.home}
              </Link>
            </nav>
          </div>
        )}
      </div>
    </>
  );
}

/** Splits a phrase in two at the space nearest its middle. */
function balance(word: string): [string, string] | null {
  const spaces: number[] = [];
  for (let i = 0; i < word.length; i++) if (word[i] === " ") spaces.push(i);
  if (spaces.length === 0) return null;
  const mid = word.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [word.slice(0, at).trimEnd(), word.slice(at + 1).trimStart()];
}

/**
 * The word, set as large as the column allows (measured, not guessed),
 * each letter rising into place in turn. A long phrase breaks once.
 */
function BigWord({ word }: { word: string }) {
  const halves = useMemo(() => balance(word), [word]);
  const [fit, setFit] = useState<{ size: number; split: boolean } | null>(null);

  const box = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const probes = Array.from(el.querySelectorAll<HTMLElement>("[data-probe]"));
      const measure = () => {
        const avail = el.clientWidth;
        const [whole, a, b] = probes.map((p) => p.getBoundingClientRect().width);
        if (!avail || !whole) return;
        const max = Math.min(avail * 0.3, 150);
        const at = (w: number) => ((avail * 0.94) / w) * 100;
        let size = at(whole);
        let split = false;
        if (halves && a && b && size < 46 && at(Math.max(a, b)) > size * 1.25) {
          size = at(Math.max(a, b));
          split = true;
        }
        setFit({ size: Math.max(26, Math.min(max, size)), split });
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      let alive = true;
      void document.fonts?.ready.then(() => {
        if (alive) measure();
      });
      return () => {
        alive = false;
        ro.disconnect();
      };
    },
    [halves]
  );

  const lines = (fit?.split && halves ? halves : [word]).map(graphemes);
  // each letter's place in the whole word, for the stagger
  const starts = lines.map((_, li) => lines.slice(0, li).reduce((sum, l) => sum + l.length, 0));

  return (
    <div ref={box} className={styles.bigBox}>
      <p
        className={cx("t-title", styles.bigWord)}
        style={{ fontSize: fit ? `${fit.size.toFixed(1)}px` : undefined, visibility: fit ? undefined : "hidden" }}
      >
        {lines.map((line, li) => (
          <span key={li} style={{ display: "block" }} aria-hidden>
            {line.map((c, ci) => (
              <span
                key={ci}
                className={cx(styles.bigLetter, PICTOGRAPH.test(c) && styles.pictograph)}
                style={{ "--i": starts[li] + ci } as CSSProperties}
              >
                {c === " " ? NBSP : c}
              </span>
            ))}
          </span>
        ))}
        <span className="sr-only">{word}</span>
      </p>
      {/* the word at 100px, out of the flow, to size the line above (after it, so the page reads in order) */}
      <div className={styles.measureBox} aria-hidden>
        <span data-probe className={cx("t-title", styles.measure)}>
          {word}
        </span>
        {halves?.map((h, i) => (
          <span key={i} data-probe className={cx("t-title", styles.measure)}>
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The link didn't survive the journey: an empty bar, held. */
function Scrambled() {
  return (
    <>
      <h1 className={cx("t-display reveal", styles.arrivedTitle)}>{arrived.invalidTitle}</h1>
      <p className={cx("t-lede reveal", styles.arrivedLede)}>{arrived.invalidLede}</p>
      <Silence />
      <div className={cx("reveal", styles.invalidHome)}>
        <Link href="/" className="btn-quiet">
          {arrived.home}
          <ArrowGlyph />
        </Link>
      </div>
    </>
  );
}

function Silence() {
  const s = 10;
  const top = 34;
  const bottom = top + 4 * s;
  const right = 236;
  return (
    <svg viewBox={`0 0 240 ${bottom + 26}`} className={cx("reveal", styles.silence)} aria-hidden>
      <g stroke="currentColor" strokeWidth={0.1 * s} opacity={0.78}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={0} x2={right} y1={top + i * s} y2={top + i * s} />
        ))}
      </g>
      <path d={GLYPHS.gClef.d} transform={clefTransform(3, bottom, s)} fill="currentColor" />
      <path d={GLYPHS.fermata.d} transform={glyphAtCentre("fermata", 136, top - 1.4 * s, s)} fill="currentColor" />
      <path d={GLYPHS.quarterRest.d} transform={glyphAtCentre("quarterRest", 136, top + 2 * s, s)} fill="currentColor" />
      <rect x={right - 0.72 * s - 0.1 * s} y={top} width={0.12 * s} height={4 * s} fill="currentColor" />
      <rect x={right - 0.5 * s} y={top} width={0.5 * s} height={4 * s} fill="currentColor" />
    </svg>
  );
}
