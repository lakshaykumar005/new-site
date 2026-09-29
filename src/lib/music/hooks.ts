"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { musicBox } from "./audio";
import type { NoteEvent, Score } from "./compose";
import { play, type Playback, type PlayOptions } from "./player";

/** Mute state and whether a gesture has unlocked audio yet. */
export function useSound() {
  const snap = useSyncExternalStore(
    musicBox.subscribe,
    () => (musicBox.muted ? 1 : 0) | (musicBox.unlocked ? 2 : 0),
    () => 0
  );
  return {
    muted: (snap & 1) === 1,
    unlocked: (snap & 2) === 2,
    toggleMuted: useCallback(() => musicBox.toggleMuted(), []),
    unlock: useCallback(() => musicBox.unlock(), []),
  };
}

export interface ScorePlayerState {
  playing: boolean;
  /** the melody note sounding right now */
  activeId: string | null;
  /** every melody note that has sounded in this run */
  playedIds: ReadonlySet<string>;
}

const IDLE: ScorePlayerState = { playing: false, activeId: null, playedIds: new Set() };

/**
 * Play a score and follow along. `beat` is a ref updated every frame
 * (for playheads — write it to a CSS variable, don't re-render on it).
 */
export function useScorePlayer() {
  const [state, setState] = useState<ScorePlayerState>(IDLE);
  const handle = useRef<Playback | null>(null);
  const beat = useRef(0);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
  }, []);

  const start = useCallback(
    async (score: Score, opts: Omit<PlayOptions, "onDone"> & { onDone?: PlayOptions["onDone"] } = {}) => {
      await musicBox.unlock();
      handle.current?.stop();
      const played = new Set<string>();
      setState({ playing: true, activeId: null, playedIds: played });
      handle.current = play(score, {
        ...opts,
        onNote: (ev: NoteEvent) => {
          if (ev.voice === "melody") {
            played.add(ev.id);
            setState({ playing: true, activeId: ev.id, playedIds: new Set(played) });
          }
          opts.onNote?.(ev);
        },
        onFrame: (b) => {
          beat.current = b;
          opts.onFrame?.(b);
        },
        onDone: (reason) => {
          handle.current = null;
          setState((s) => ({ playing: false, activeId: null, playedIds: s.playedIds }));
          opts.onDone?.(reason);
        },
      });
    },
    []
  );

  useEffect(() => () => handle.current?.stop(), []);

  return { ...state, start, stop, beat };
}
