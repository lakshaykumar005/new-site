import { spell } from "@/lib/music/cipher";
import type { VariationId } from "@/lib/music/compose";
import { FROM_NAME, HER_NAME } from "./site";

// ─────────────────────────────────────────────────────────────
// ⚙️  CUSTOMIZE HERE — every word on the site.
// Keep the shapes, change the sentences. Anything that depends on
// the name (counts, first/last notes) is computed below, so it
// stays true if HER_NAME changes.
// ─────────────────────────────────────────────────────────────

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty",
];

/** 9 → "nine" (falls back to digits past twenty) */
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Facts about her name, as music. */
export const NAME_FACTS = (() => {
  const notes = spell(HER_NAME);
  const count = notes.length;
  return {
    notes,
    count,
    countWord: numberWord(count),
    first: notes[0]?.note ?? "A",
    last: notes[count - 1]?.note ?? "A",
  };
})();

const N = NAME_FACTS.countWord;

export const titlePage = {
  eyebrow: "Theme & Variations",
  on: "on the name",
  opus: "Op. 1",
  scoring: "Arranged for music box",
  credits: [`Composed by whoever named you`, `Transcribed by ${FROM_NAME}`],
  play: "Hear your name",
  soundHint: "Sound on, if you can",
  after: ["That was your name.", "Every letter, one note. Turn the page, and I’ll show you the trick."],
  again: "Once more",
  mutedNote: "Sound is off — the notes still move. Tap the speaker, top right, to hear them.",
  welcomeBack: "Welcome back. It’s still in tune.",
};

export const cipher = {
  kicker: "Fig. 1 — The cipher",
  title: "An old composers’ trick",
  paragraphs: [
    "Robert Schumann’s very first published piece — his Opus 1 — was a set of variations on a name: A, B, E, G, G. Bach tucked his own name into a fugue. Ravel wrote a minuet on Haydn’s. Composers have been hiding people inside melodies for a long time.",
    "The rule fits on a napkin. The first seven letters of the alphabet are already notes, A to G. After G you simply start again at A — like a clock with only seven hours.",
  ],
  tableCaption: "Tap any letter to hear it.",
  columnsLabel: "becomes",
  derivationLabel: "Your name, letter by letter",
  result: `${capitalize(N)} letters, ${N} notes. It begins on ${NAME_FACTS.first}, wanders a little, and ends on ${NAME_FACTS.last} — the note it finally rests on. Musicians call that coming home.`,
  kicker2: "Which means I didn’t compose anything.",
  closing:
    "You’ve been carrying this melody around since the day you got your name. I only wrote it down.",
};

export const musicBoxCopy = {
  kicker: "Fig. 2 — The mechanism",
  title: "Turn the handle",
  lede: "It plays at exactly the speed of your hand. Slow is lovely. Backwards works too — some songs are good from either end.",
  callouts: {
    handle: "Handle. Clockwise plays it forward.",
    comb: (teeth: number) => `Comb. ${capitalize(numberWord(teeth))} tuned steel teeth.`,
    strip: "Paper strip, punched with your name — and a little harmony underneath, for support.",
  },
  hintTouch: "Turn the handle in circles, or pull the paper.",
  hintPointer: "Drag the handle round, or pull the paper. Arrow keys work too.",
  letItPlay: "Let it play",
  stop: "Stop",
  playCounts: {
    2: "Twice. It gets better the second time.",
    4: "Four times. I’m choosing to read into that.",
    8: "Eight. Now I’m definitely reading into it.",
    16: "Sixteen. You could hum it by now. (Please do.)",
  } as Record<number, string>,
};

export interface VariationCopy {
  mark: string;
  title: string;
  line: string;
}

export const variationsCopy = {
  kicker: "Fig. 3 — Variations",
  title: `Same ${N} notes, six moods`,
  lede: "A theme isn’t finished until you’ve tried it a few different ways. These are the ways I tried.",
  todaysPick: "Today’s pick",
  play: "Play",
  stop: "Stop",
  items: {
    theme: {
      mark: "Andante",
      title: "The theme",
      line: "Exactly as spelled. No edits needed — there rarely are.",
    },
    retrograde: {
      mark: "Cancrizans",
      title: "Read from the end",
      line: "Your name, backwards — crab-wise, the old composers called it. It still sounds like you, which feels about right.",
    },
    inversion: {
      mark: "Per moto contrario",
      title: "Upside down",
      line: "Every step up becomes a step down. Turned completely over and still lovely — a little unfair, honestly.",
    },
    waltz: {
      mark: "Tempo di valse",
      title: "If it were asked to dance",
      line: "In three, with a bass that goes oom-pah-pah. It said yes immediately.",
    },
    lullaby: {
      mark: "Adagio",
      title: "The 2 a.m. version",
      line: "Half the speed, an octave lower. For when everything should be quieter than it is.",
    },
    allegro: {
      mark: "Allegro",
      title: "Walking into a room",
      line: "Twice as fast, a little bright. The version that plays when you walk in somewhere. Not that I keep track.",
    },
  } satisfies Record<VariationId, VariationCopy>,
};

export const yourTurn = {
  kicker: "Fig. 4 — Your turn",
  title: "Every word is a song",
  lede: "Now you know the trick, it works on anything. Type a word and listen to it.",
  placeholder: "type a word",
  inputLabel: "A word to turn into music",
  tryLabel: "or try",
  suggestions: ["hello", "coffee", FROM_NAME.toLowerCase(), "soon"],
  empty: "Nothing yet. Even one letter is a note.",
  play: "Play it",
  stop: "Stop",
  send: `Send it to ${FROM_NAME}`,
  sendNote: "It arrives as a link. The word stays hidden until it’s played.",
  shareText: "I made you a song. Play it to find out what it says.",
  copied: "Link copied — paste it anywhere.",
  tooLong: "That’s a whole sonata. Keep it under 24 letters.",
};

export const coda = {
  kicker: "Coda",
  title: "Before the last bar",
  // ⚙️ The third paragraph is the one to rewrite in your own words.
  letter: [
    "I could have just texted you. I have, plenty. But a text can’t be played, and your name seemed like it deserved an instrument.",
    `Nothing here is made up. No invented memories, no borrowed songs — just ${N} letters you already had, and a very old rule.`,
    "I wanted to give you something that was already yours, so it could never feel like too much.",
    "If you ever want to hear it again, it lives here. Turn the handle. It’ll play at whatever speed you’re in the mood for.",
  ],
  signoff: `— ${FROM_NAME}`,
  fine: "Fine.",
  fineNote:
    "Musicians write fine at the end of a piece. In Italian it means the end. In English, it’s an understatement.",
  daCapo: "D.C. — from the top",
  daCapoLabel: "Da capo: back to the top, to hear your name again",
};

export const arrived = {
  kicker: "A song arrived",
  title: "Someone sent you a word, written in notes.",
  lede: "Press play to find out which one.",
  play: "Play it",
  again: "Play it again",
  reveal: "It says",
  answer: "Answer with a song of your own",
  invalidTitle: "This one arrived a little scrambled.",
  invalidLede: "The link looks incomplete. Ask for it again?",
  home: `The song that started it`,
};

export const chrome = {
  soundOn: "Sound on",
  soundOff: "Sound off",
  notFoundTitle: "That note isn’t in the song.",
  notFoundLede: "The page you wanted doesn’t exist. The music does.",
  notFoundHome: "Back to the beginning",
};

// ─────────────────────────────────────────────────────────────
// ⚙️  EPIGRAPHS — your own lines go here.
// Each slot prints a quotation between two sections, set like the
// epigraph at the head of a movement. Leave a slot `null` to skip it.
// `reply` is an optional answer printed beneath, in the site's voice.
// ─────────────────────────────────────────────────────────────

export interface Epigraph {
  text: string;
  /** who said it — printed small, after an em dash */
  by?: string;
  /** an optional answer beneath it */
  reply?: string;
}

export const epigraphs: Record<
  "cipher" | "musicBox" | "variations" | "plates" | "yourTurn" | "coda",
  Epigraph | null
> = {
  cipher: {
    text: "What’s in a name?",
    by: "Shakespeare, Romeo and Juliet",
    reply: `${capitalize(N)} notes, as it happens.`,
  },
  musicBox: {
    text: "If music be the food of love, play on.",
    by: "Shakespeare, Twelfth Night",
  },
  variations: null,
  plates: null,
  yourTurn: null,
  coda: null,
};

export const frontispiece = {
  kicker: "Frontispiece",
  caption: "The theme, drawn from life.",
  engravedNote: (lines: number) =>
    `Engraved in ${lines} lines of ink from a photograph. Touch the plate to see it.`,
  photoCaption: "The photograph it was drawn from.",
  photoNote: "Touch it again for the engraving.",
  toggleLabel: "Show the photograph the engraving was made from",
  toggleBackLabel: "Show the engraving again",
};

export const platesCopy = {
  kicker: "Plates",
  title: "Studies from life",
  lede: "Every good score comes with a few plates. These are printed in ink — touch one and the colour comes back.",
  touchHint: "Touch a plate",
  pointerHint: "Hover a plate",
};
