"use client";

import { musicBox } from "./audio";
import type { NoteEvent, Score, Voice } from "./compose";

/**
 * Plays a Score against the audio clock (a small look-ahead scheduler),
 * and fires visual callbacks in step with what is heard. With sound
 * locked or muted the visuals still run, on the page's own clock.
 */

export type DoneReason = "ended" | "stopped";

export interface PlayOptions {
  /** tempo multiplier (1 = the score's own bpm) */
  rate?: number;
  /** which voices sound; both by default */
  voices?: Voice[];
  /** fires as each note sounds */
  onNote?: (ev: NoteEvent) => void;
  /** fires every animation frame with the current beat */
  onFrame?: (beat: number) => void;
  /** fires once, when the piece ends or is stopped */
  onDone?: (reason: DoneReason) => void;
  /** seconds of silence before the first note */
  lead?: number;
  /** stop any other exclusive playback first (default true) */
  exclusive?: boolean;
}

export interface Playback {
  stop(): void;
  readonly playing: boolean;
}

let current: Playback | null = null;

export function stopAll() {
  current?.stop();
  current = null;
}

export function play(score: Score, opts: PlayOptions = {}): Playback {
  if (opts.exclusive !== false) stopAll();

  const voices = new Set<Voice>(opts.voices ?? ["melody", "accompaniment"]);
  const events = score.events.filter((e) => voices.has(e.voice));
  const spb = 60 / (score.bpm * (opts.rate ?? 1));
  const audioClock = musicBox.clockIsAudio;
  const clock = audioClock ? () => musicBox.now() : () => performance.now() / 1000;
  const t0 = clock() + (opts.lead ?? 0.08);
  const endBeat = score.length + 0.35;
  const LOOKAHEAD = 0.16;

  let scheduled = 0;
  let shown = 0;
  let playing = true;
  let raf = 0;

  const schedule = () => {
    if (!playing) return;
    const now = clock();
    while (scheduled < events.length && t0 + events[scheduled].beat * spb < now + LOOKAHEAD) {
      const ev = events[scheduled++];
      if (audioClock) {
        musicBox.pluck(ev.midi, {
          when: t0 + ev.beat * spb,
          velocity: ev.velocity,
          voice: ev.voice,
        });
      }
    }
  };

  const finish = (reason: DoneReason) => {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    window.clearInterval(timer);
    if (current === handle) current = null;
    opts.onDone?.(reason);
  };

  const frame = () => {
    if (!playing) return;
    schedule();
    const beat = (clock() - t0) / spb;
    while (shown < events.length && events[shown].beat <= beat) {
      opts.onNote?.(events[shown]);
      shown++;
    }
    opts.onFrame?.(Math.max(0, beat));
    if (beat >= endBeat) {
      finish("ended");
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  // keeps audio scheduled even when rAF is throttled
  const timer = window.setInterval(schedule, 25);

  const handle: Playback = {
    stop: () => finish("stopped"),
    get playing() {
      return playing;
    },
  };

  if (opts.exclusive !== false) current = handle;
  schedule();
  raf = requestAnimationFrame(frame);
  return handle;
}
