import { spell, type SpelledNote } from "./cipher";
import { chordName, degreeOf, letterOfDn, midiOfDn, triadDegrees, triadQuality } from "./theory";

/**
 * Turns a word into a small, singable piece of music.
 *
 * Every melody note is one letter. The rhythm lilts in three
 * (dotted quarter, eighth, quarter), the last letter always lands on a
 * downbeat and is held for a full bar, and each bar is harmonised with
 * the diatonic chord that fits its notes best — with a gentle cadence
 * into the final chord, so every word "comes home".
 */

export type Voice = "melody" | "accompaniment";

export type VariationId = "theme" | "retrograde" | "inversion" | "waltz" | "lullaby" | "allegro";

export const VARIATION_ORDER: readonly VariationId[] = [
  "theme",
  "retrograde",
  "inversion",
  "waltz",
  "lullaby",
  "allegro",
];

export interface NoteEvent {
  /** stable id: "m3" = 4th melody note, "a7" = 8th accompaniment note */
  id: string;
  /** onset in beats (quarter notes, or the time signature's unit) */
  beat: number;
  dur: number;
  /** diatonic pitch (see theory.ts) */
  dn: number;
  midi: number;
  voice: Voice;
  /** 0–1 */
  velocity: number;
  /** melody only: which letter of the word this note spells */
  letter?: number;
  char?: string;
}

export interface Bar {
  start: number;
  end: number;
  /** root degree of the chord under this bar (0 = C … 6 = B) */
  root: number;
  chord: string;
}

export interface Score {
  id: VariationId;
  word: string;
  /** the letters, in the order this variation plays them */
  notes: SpelledNote[];
  bpm: number;
  /** written time signature, e.g. [3, 4] */
  time: [number, number];
  /** length of a written bar, in beats */
  barBeats: number;
  /** beats before the first full bar (an upbeat), 0 if none */
  pickup: number;
  /** total length in beats */
  length: number;
  bars: Bar[];
  /** every note, all voices, sorted by onset */
  events: NoteEvent[];
  /** melody notes only, in order */
  melody: NoteEvent[];
}

type Accompaniment = "theme" | "waltz" | "lullaby" | "allegro";

interface BuildSpec {
  id: VariationId;
  seq: SpelledNote[];
  /** melody notes per full bar */
  perBar: number;
  /** durations of the notes inside a full bar (sums to 3) */
  rhythm: number[];
  pickupDur: number;
  /** stretch or squeeze all time (lullaby 2, allegro 0.5) */
  scale: number;
  bpm: number;
  accompaniment: Accompaniment;
  loudness: number;
}

const BAR = 3;

/** Home-ness of each chord root, used to break ties. A, F, C first. */
const WARMTH = [2, 1.5, 1, 3, 2, 3, 0];

/** Accompaniment root: between A2 and G3. */
function bassDn(root: number): number {
  const r = ((root % 7) + 7) % 7;
  return r >= 5 ? 14 + r : 21 + r;
}

function finalRoot(last: SpelledNote): number {
  const r = degreeOf(last.note);
  // B can't be home (diminished) — rest on G major, where B is the third.
  return triadQuality(r) === "diminished" ? 4 : r;
}

function chooseRoot(
  notes: { dn: number; dur: number; downbeat: boolean }[],
  prevRoot: number | null,
  cadenceTo: number | null
): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let r = 0; r < 7; r++) {
    const triad = triadDegrees(r);
    let s = WARMTH[r] * 0.05;
    for (const n of notes) {
      const inChord = triad.includes(degreeOf(letterOfDn(n.dn)));
      if (inChord) s += n.dur + (n.downbeat ? 0.75 : 0);
    }
    if (triadQuality(r) === "diminished") s -= 2;
    if (prevRoot !== null && r === prevRoot) s -= 0.4;
    if (cadenceTo !== null) {
      const dominant = (cadenceTo + 4) % 7;
      const subdominant = (cadenceTo + 3) % 7;
      if (r === dominant || r === subdominant) s += 0.5;
    }
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function build(word: string, spec: BuildSpec): Score {
  const { seq } = spec;
  const n = seq.length;
  const time: [number, number] =
    spec.scale === 2 ? [6, 4] : spec.scale === 0.5 ? [3, 8] : [3, 4];

  const empty: Score = {
    id: spec.id,
    word,
    notes: seq,
    bpm: spec.bpm,
    time,
    barBeats: BAR * spec.scale,
    pickup: 0,
    length: 0,
    bars: [],
    events: [],
    melody: [],
  };
  if (n === 0) return empty;

  // ── melody ──────────────────────────────────────────────
  const pickupCount = (n - 1) % spec.perBar;
  const melody: NoteEvent[] = [];
  const push = (i: number, beat: number, dur: number, velocity: number) => {
    const s = seq[i];
    melody.push({
      id: `m${i}`,
      beat,
      dur,
      dn: s.dn,
      midi: midiOfDn(s.dn),
      voice: "melody",
      velocity: Math.min(1, velocity * spec.loudness),
      letter: s.index,
      char: s.char,
    });
  };

  let t = 0;
  for (let i = 0; i < pickupCount; i++) {
    push(i, t, spec.pickupDur, 0.7);
    t += spec.pickupDur;
  }
  const firstBar = t;
  let j = 0;
  for (let i = pickupCount; i < n - 1; i++) {
    const d = spec.rhythm[j % spec.perBar];
    push(i, t, d, j % spec.perBar === 0 ? 0.92 : 0.74);
    t += d;
    j++;
  }
  push(n - 1, t, BAR, 0.88);
  const length = t + BAR;

  // ── harmony ─────────────────────────────────────────────
  const home = finalRoot(seq[n - 1]);
  const bars: Bar[] = [];
  let prev: number | null = null;
  for (let start = firstBar; start < length - 1e-9; start += BAR) {
    const end = start + BAR;
    const isFinal = end >= length - 1e-9;
    const beforeFinal = !isFinal && end + BAR >= length - 1e-9;
    let root: number;
    if (isFinal) {
      root = home;
    } else {
      const inBar = melody
        .filter((e) => e.beat >= start - 1e-9 && e.beat < end - 1e-9)
        .map((e) => ({ dn: e.dn, dur: e.dur, downbeat: Math.abs(e.beat - start) < 1e-9 }));
      root = chooseRoot(inBar, prev, beforeFinal ? home : null);
    }
    bars.push({ start, end, root, chord: chordName(root) });
    prev = root;
  }

  // ── accompaniment ───────────────────────────────────────
  const acc: NoteEvent[] = [];
  const add = (beat: number, dur: number, dn: number, velocity: number) => {
    acc.push({
      id: `a${acc.length}`,
      beat,
      dur,
      dn,
      midi: midiOfDn(dn),
      voice: "accompaniment",
      velocity: Math.min(1, velocity * spec.loudness),
    });
  };

  for (const bar of bars) {
    const b = bassDn(bar.root);
    const s = bar.start;
    const isFinal = bar.end >= length - 1e-9;
    if (isFinal) {
      // a rolled chord to close: root, fifth, tenth
      add(s, BAR, b, 0.56);
      add(s + 0.2, BAR - 0.2, b + 4, 0.36);
      add(s + 0.4, BAR - 0.4, b + 9, 0.3);
      continue;
    }
    switch (spec.accompaniment) {
      case "theme":
        add(s, 3, b, 0.5);
        add(s + 1, 2, b + 4, 0.32);
        add(s + 2, 1, b + 9, 0.26);
        break;
      case "waltz":
        add(s, 1, b, 0.56);
        add(s + 1, 0.8, b + 9, 0.26);
        add(s + 1, 0.8, b + 11, 0.24);
        add(s + 2, 0.8, b + 9, 0.24);
        add(s + 2, 0.8, b + 11, 0.22);
        break;
      case "lullaby":
        add(s, 3, b, 0.4);
        add(s + 1.5, 1.5, b + 4, 0.24);
        break;
      case "allegro":
        add(s, 1.5, b, 0.46);
        add(s + 1.5, 1.5, b + 7, 0.3);
        break;
    }
  }

  // ── time scale ──────────────────────────────────────────
  const k = spec.scale;
  const scaleEv = (e: NoteEvent): NoteEvent => ({ ...e, beat: e.beat * k, dur: e.dur * k });
  const mel = melody.map(scaleEv);
  const all = [...mel, ...acc.map(scaleEv)].sort(
    (a, b) => a.beat - b.beat || (a.voice === "melody" ? -1 : 1)
  );

  return {
    ...empty,
    pickup: firstBar * k,
    length: length * k,
    bars: bars.map((bar) => ({ ...bar, start: bar.start * k, end: bar.end * k })),
    events: all,
    melody: mel,
  };
}

const LILT = [1.5, 0.5, 1];

/** Re-centre a line on the staff's middle line by whole octaves, keeping its shape. */
function centreOctave(seq: SpelledNote[], target = 34): SpelledNote[] {
  if (seq.length === 0) return seq;
  const dns = seq.map((s) => s.dn);
  const mid = (Math.min(...dns) + Math.max(...dns)) / 2;
  const shift = Math.round((target - mid) / 7) * 7;
  return seq.map((s) => ({ ...s, dn: s.dn + shift }));
}

export function compose(word: string, id: VariationId = "theme"): Score {
  const letters = spell(word);
  switch (id) {
    case "theme":
      return build(word, {
        id,
        seq: letters,
        perBar: 3,
        rhythm: LILT,
        pickupDur: 1,
        scale: 1,
        bpm: 88,
        accompaniment: "theme",
        loudness: 1,
      });
    case "retrograde":
      return build(word, {
        id,
        seq: [...letters].reverse(),
        perBar: 3,
        rhythm: LILT,
        pickupDur: 1,
        scale: 1,
        bpm: 84,
        accompaniment: "theme",
        loudness: 1,
      });
    case "inversion": {
      const first = letters[0]?.dn ?? 0;
      const mirrored = letters.map((s) => ({ ...s, dn: 2 * first - s.dn }));
      return build(word, {
        id,
        seq: centreOctave(mirrored),
        perBar: 3,
        rhythm: LILT,
        pickupDur: 1,
        scale: 1,
        bpm: 84,
        accompaniment: "theme",
        loudness: 1,
      });
    }
    case "waltz":
      return build(word, {
        id,
        seq: letters,
        perBar: 2,
        rhythm: [2, 1],
        pickupDur: 1,
        scale: 1,
        bpm: 168,
        accompaniment: "waltz",
        loudness: 0.95,
      });
    case "lullaby":
      return build(word, {
        id,
        seq: letters.map((s) => ({ ...s, dn: s.dn - 7 })),
        perBar: 3,
        rhythm: LILT,
        pickupDur: 1,
        scale: 2,
        bpm: 92,
        accompaniment: "lullaby",
        loudness: 0.8,
      });
    case "allegro":
      return build(word, {
        id,
        seq: letters,
        perBar: 3,
        rhythm: LILT,
        pickupDur: 1,
        scale: 0.5,
        bpm: 92,
        accompaniment: "allegro",
        loudness: 1,
      });
  }
}

/** Seconds a score takes to play at its own tempo. */
export function durationOf(score: Score): number {
  return (score.length * 60) / score.bpm;
}
