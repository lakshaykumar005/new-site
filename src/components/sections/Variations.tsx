"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { variationsCopy } from "@/content/copy";
import { dayOfYear } from "@/lib/device";
import { musicBox } from "@/lib/music/audio";
import { useScorePlayer } from "@/lib/music/hooks";
import System from "./variations/System";
import { DEFAULT_WIDTH, PAGE_SPAN, SPACE_MAX, SYSTEMS, engrave } from "./variations/systems";
import styles from "./variations/variations.module.css";

/**
 * Fig. 3 — six variations on her name, printed as one page of music:
 * six systems stacked, each with its tempo marking, each playable.
 * One plays at a time; the playing system runs its playhead, lights
 * each note as it sounds, and its metronome mark keeps time.
 */

const NONE: ReadonlySet<string> = new Set();

// "today's pick" depends on the visitor's own calendar, so it is only
// known in the browser: nothing is picked in the server render.
const noSubscribe = () => () => {};
const todaysIndex = () => dayOfYear() % SYSTEMS.length;
const noPick = () => -1;

export default function Variations() {
  const headingId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const runRef = useRef(0);
  const { playing, activeId, playedIds, start, stop, beat: beatRef } = useScorePlayer();
  const pick = useSyncExternalStore(noSubscribe, todaysIndex, noPick);

  // engrave 1:1 with the column, so a staff space is a real pixel size;
  // measured before the first paint, then kept in step with resizes
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // a column that isn't laid out (display: none, a mid-resize capture) measures 0: keep the last real width
    const take = (w: number) => {
      if (w > 1) setWidth(w);
    };
    take(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => take(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggle = useCallback(
    (i: number) => {
      const unlocking = musicBox.unlock(); // inside the tap, before anything async
      const run = ++runRef.current;
      stop();
      if (current === i) {
        setCurrent(null);
        return;
      }
      setCurrent(i);
      beatRef.current = 0;
      // On a cold first tap the audio can take a moment to wake. Start only
      // if nothing has happened since: a stop, or another tap, wins.
      void unlocking.then(() => {
        if (runRef.current !== run) return;
        void start(SYSTEMS[i].score, {
          onDone: () => {
            if (runRef.current === run) setCurrent(null);
          },
        });
      });
    },
    [current, start, stop, beatRef]
  );

  const page = useMemo(() => engrave(width ?? DEFAULT_WIDTH), [width]);
  const w = width ?? DEFAULT_WIDTH;

  return (
    <section id="variations" className="section" aria-labelledby={headingId}>
      <div className="wrap">
        <div className={styles.column}>
          <header className="reveal">
            <p className="t-kicker">{variationsCopy.kicker}</p>
            <h2 id={headingId} className={`t-display ${styles.title}`}>
              {variationsCopy.title}
            </h2>
            <p className={`t-lede measure ${styles.lede}`}>{variationsCopy.lede}</p>
          </header>

          {/* role: Safari drops list semantics from an unstyled list */}
          <ol
            ref={listRef}
            role="list"
            className={styles.systems}
            style={
              {
                "--span": PAGE_SPAN,
                "--smax": `${SPACE_MAX}px`,
                // once measured, the page's own staff space (the stylesheet estimates it before that)
                ...(width !== null && { "--s": `${page.space}px` }),
              } as CSSProperties
            }
          >
            {SYSTEMS.map((system, i) => {
              const on = current === i;
              const sounding = on && playing;
              return (
                <System
                  key={system.id}
                  system={system}
                  index={i}
                  lines={page.lines[i]}
                  width={w}
                  space={page.space}
                  on={on}
                  sounding={sounding}
                  activeId={sounding ? activeId : null}
                  playedIds={sounding ? playedIds : NONE}
                  beatRef={beatRef}
                  picked={pick === i}
                  onToggle={toggle}
                />
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
