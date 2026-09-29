import { spell } from "@/lib/music/cipher";
import { compose, type NoteEvent, type Score } from "@/lib/music/compose";
import { midiOfDn } from "@/lib/music/theory";

/** Seconds between letters when the name is spelled out on the plate. */
export const SPELL_STEP = 0.34;

export interface ChordTone {
  dn: number;
  midi: number;
  /** seconds after the chord's downbeat (it is rolled, root first) */
  at: number;
  velocity: number;
}

/**
 * The chord the theme ends on — the name "coming home": root, fifth and
 * tenth, rolled upwards, exactly as the full theme closes.
 */
export function homeChord(word: string): ChordTone[] {
  const theme = compose(word, "theme");
  const last = theme.bars[theme.bars.length - 1];
  if (!last) return [];
  const spb = 60 / theme.bpm;
  return theme.events
    .filter((e) => e.voice === "accompaniment" && e.beat >= last.start - 1e-9)
    .map((e) => ({ dn: e.dn, midi: e.midi, at: (e.beat - last.start) * spb, velocity: e.velocity }));
}

/**
 * The name, one letter at a time and evenly spaced, closing on its home
 * chord — a Score, so the shared player schedules it against the audio
 * clock (and stops any other music first, and is stopped by it).
 */
export function spellScore(word: string): Score {
  const letters = spell(word);
  const last = letters.length - 1;
  const melody: NoteEvent[] = letters.map((l, i) => ({
    id: `m${i}`,
    beat: i,
    dur: 1,
    dn: l.dn,
    midi: midiOfDn(l.dn),
    voice: "melody",
    velocity: i === 0 ? 0.86 : i === last ? 0.82 : 0.72,
    letter: l.index,
    char: l.char,
  }));
  const chord: NoteEvent[] =
    last < 0
      ? []
      : homeChord(word).map((t, k) => ({
          id: `a${k}`,
          beat: last + t.at / SPELL_STEP,
          dur: 3,
          dn: t.dn,
          midi: t.midi,
          voice: "accompaniment",
          velocity: t.velocity * 0.9,
        }));
  return {
    ...compose(word, "theme"),
    bpm: 60 / SPELL_STEP,
    barBeats: 1,
    pickup: 0,
    length: letters.length,
    bars: [],
    events: [...melody, ...chord].sort((a, b) => a.beat - b.beat || (a.voice === "melody" ? -1 : 1)),
    melody,
  };
}
