import type { NoteEvent, Score } from "@/lib/music/compose";
import { finalChord, type EndingLayout } from "./ending";

/**
 * When each mark of the ending is printed, in ms from the moment it starts
 * to draw.
 *
 * In silence (muted, or before a first touch has woken the audio) the
 * engraving keeps its own pace. When the last chord is heard, the page
 * follows the sound instead: each note is printed as it is struck, in
 * vermillion, and cools to ink as it dies away; the arpeggio line is inked
 * upward in step with the roll; the diminuendo closes as the sound fades;
 * and Fine. arrives in the silence after it.
 */

/** How the ending is being printed: decided once, when she reaches it. */
export interface Take {
  sounding: boolean;
  reduced: boolean;
}

/** When a note is struck (ms from the draw start) and how long it rings (ms). */
export interface Strike {
  at: number;
  ring: number;
  /** stems only: how long the stem takes to grow up through a rolled chord (ms) */
  grow?: number;
}

export type CssVars = Record<`--${string}`, string>;

export interface Timeline {
  /** custom properties for the ending's root */
  vars: CssVars;
  /** per notehead and per stem, in layout order (sounding only) */
  heads: (Strike | null)[];
  stems: (Strike | null)[];
}

/** How soft the closing chord is, against the theme's own dynamics. */
const SOFTLY = 0.55;
/** A touch of ritardando on the roll: the tempo the chord is played at (the player's `rate`). */
export const CHORD_RATE = 0.8;
/** ms after the staff starts drawing that the chord is struck (reduced motion: at once). */
const STRIKE_AT = 320;
const STRIKE_AT_REDUCED = 20;
/** A breath of silence between the last of the sound and Fine. (ms). */
const BREATH = 200;

/** The engraving's own pace, when nothing sounds (ms). */
const SILENT = { chord: 300, dynamic: 420, hairpinAt: 520, hairpinFor: 1100, fine: 1250, note: 1700, after: 2100 };
const SILENT_REDUCED = { fine: 200, note: 320, after: 440 };

/** After Fine.: its note, then the da capo (ms). */
const FOLLOW = { note: 450, after: 850 };
const FOLLOW_REDUCED = { note: 120, after: 240 };

/** Seconds from the draw start to the chord's first strike: the player's `lead`. */
export const strikeLead = (reduced: boolean) => (reduced ? STRIKE_AT_REDUCED : STRIKE_AT) / 1000;

/**
 * How long the music box lets a note ring, in seconds. This is its own rule
 * (pluck() in lib/music/audio.ts): low tines ring longer than high ones, and
 * by this time a note has decayed by e^-3, about 26 dB, which is to say gone.
 */
export function ringOf(midi: number): number {
  return Math.max(0.55, Math.min(2.6, 2.6 - (midi - 45) * 0.045));
}

/** The closing chord as a little score of its own: soft, and starting at once. */
export function chordScore(theme: Score): Score {
  const events = finalChord(theme);
  const start = events[0]?.beat ?? 0;
  const soft: NoteEvent[] = events.map((e) => ({ ...e, beat: e.beat - start, velocity: e.velocity * SOFTLY }));
  return {
    ...theme,
    pickup: 0,
    length: theme.barBeats,
    bars: [],
    events: soft,
    melody: soft.filter((e) => e.voice === "melody"),
  };
}

const ms = (n: number) => `${Math.round(n)}ms`;

export function timeline(theme: Score, layout: EndingLayout, take: Take): Timeline {
  const { reduced } = take;
  const chord = chordScore(theme);

  if (!take.sounding || chord.events.length === 0) {
    const t = reduced ? { ...SILENT, ...SILENT_REDUCED } : SILENT;
    return {
      vars: {
        "--chord-at": ms(t.chord),
        "--dynamic-at": ms(t.dynamic),
        "--hairpin-at": ms(t.hairpinAt),
        "--hairpin-for": ms(t.hairpinFor),
        "--hairpin-ease": "var(--ease-out)",
        "--fine-at": ms(t.fine),
        "--note-at": ms(t.note),
        "--after-at": ms(t.after),
      },
      heads: layout.heads.map(() => null),
      stems: layout.stems.map(() => null),
    };
  }

  // when each note of the chord is struck and how long it rings, as played
  const strikeAt = strikeLead(reduced) * 1000;
  const msPerBeat = 60000 / (chord.bpm * CHORD_RATE);
  const strike = new Map<string, Strike>(
    chord.events.map((e) => [e.id, { at: strikeAt + e.beat * msPerBeat, ring: ringOf(e.midi) * 1000 }])
  );

  const heads = layout.heads.map((h): Strike => {
    const ss = h.ids.map((id) => strike.get(id)).filter((x): x is Strike => !!x);
    return { at: Math.min(...ss.map((x) => x.at)), ring: Math.max(...ss.map((x) => x.ring)) };
  });

  // the arpeggio line is inked from the bottom up, its tip passing each
  // rolled note as it sounds (the roll runs from the lowest note to the highest)
  let roll = { at: strikeAt, dur: 1 };
  let speed = 0; // px per ms
  const arp = layout.arpeggio;
  const rolled = layout.heads.map((h, i) => ({ y: h.y, at: heads[i].at, rolled: h.rolled })).filter((r) => r.rolled);
  if (arp && rolled.length > 1) {
    const low = rolled.reduce((a, b) => (b.y > a.y ? b : a));
    const high = rolled.reduce((a, b) => (b.y < a.y ? b : a));
    const span = low.y - high.y;
    const took = high.at - low.at;
    if (span > 0.5 && took > 1) {
      speed = span / took;
      roll = { at: low.at - (arp.bottom - low.y) / speed, dur: (arp.bottom - arp.top) / speed };
    } else {
      roll = { at: low.at, dur: 120 };
    }
  }

  // a stem is struck with the first note on it and rings as long as the
  // longest; through a rolled chord it grows upward with the roll's tip
  const stems = layout.stems.map((st): Strike => {
    const on = heads.filter((_, i) => layout.heads[i].staff === st.staff);
    const height = Math.abs(st.y2 - st.y1);
    return {
      at: Math.min(...on.map((x) => x.at)),
      ring: Math.max(...on.map((x) => x.ring)),
      grow: speed > 0 ? (st.grow * height) / speed : 0,
    };
  });

  // the last of the sound: whichever note is the last to die away
  const silence = Math.max(...[...strike.values()].map((x) => x.at + x.ring));
  const fine = silence + BREATH;
  const follow = reduced ? FOLLOW_REDUCED : FOLLOW;

  return {
    vars: {
      "--chord-at": ms(strikeAt),
      "--dynamic-at": ms(strikeAt - 20),
      // the diminuendo is drawn for exactly as long as the chord takes to fade
      "--hairpin-at": ms(strikeAt),
      "--hairpin-for": ms(silence - strikeAt),
      "--hairpin-ease": "linear",
      // (a delay below zero starts the wipe part-way through, which is the point)
      "--roll-at": ms(roll.at),
      "--roll-for": ms(roll.dur),
      "--roll-end": ms(roll.at + roll.dur),
      "--fine-at": ms(fine),
      "--note-at": ms(fine + follow.note),
      "--after-at": ms(fine + follow.after),
    },
    heads,
    stems,
  };
}
