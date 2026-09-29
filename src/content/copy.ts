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
  scoring: "For music box, and you",
  credits: [`Composed by whoever named you`, `Transcribed, fondly, by ${FROM_NAME}`],
  play: "Hear your name",
  soundHint: "Sound on — you sound even better out loud",
  after: ["That was your name.", "Every letter, one note. It suits you. Turn the page — I wrote your portrait too."],
  again: "Once more, for me",
  mutedNote: "Sound is off — the notes still move. Tap the speaker, top right, to hear them.",
  welcomeBack: "You came back. I was hoping you would.",
};

export const cipher = {
  kicker: "Fig. 1 — The cipher",
  title: "Your name is a tune",
  paragraphs: [
    "You are beautiful, giving, gentle, idiotically and deliciously feminine, wonderfully intelligent and wonderfully silly as well.",
    "I want to listen to you and watch you, your beautiful voice and your beauty, to argue with you and to laugh with you, to show things and share things with you, and to explore your magnificent mind.",
  ],
  tableCaption: "Tap any letter to hear it. The ones in your name sound best.",
  columnsLabel: "becomes",
  derivationLabel: "Your name, letter by letter",
  result: `${capitalize(N)} letters, ${N} notes. It begins on ${NAME_FACTS.first}, wanders a little, and ends on ${NAME_FACTS.last} — the note it finally rests on. Musicians call that coming home. I think I know the feeling.`,
  kicker2: "Which means I didn’t compose anything.",
  closing:
    "You’ve been carrying this melody around since the day you got your name. I only wrote it down — and I haven’t stopped humming it since.",
};

export const musicBoxCopy = {
  kicker: "Fig. 2 — The mechanism",
  title: "Go on, turn it",
  lede: "It only plays while you turn it, as fast or as slow as your hand goes. Backwards works too. Take your time with it. I did.",
  callouts: {
    handle: "Handle. Clockwise plays it forward.",
    comb: (teeth: number) => `Comb. ${capitalize(numberWord(teeth))} tuned steel teeth.`,
    strip: "Paper strip, punched with your name, and a little harmony underneath so it never has to play alone.",
  },
  hintTouch: "Turn the handle in circles, or pull the paper.",
  hintPointer: "Drag the handle round, or pull the paper. Arrow keys work too.",
  letItPlay: "Let it play",
  stop: "Stop",
  plate: {
    kicker: "Fig. 2a — The plate",
    idle: "A blank plate. Every note you play cuts a line into it. Keep going and see who shows up.",
    progress: (cut: number, total: number) => `${cut} of ${total} lines cut. Don’t stop now.`,
    done: "Turns out the song knew your face by heart. Can’t say I blame it.",
    clear: "Clear the plate",
    alt: `A portrait of ${HER_NAME}, engraved line by line by the music`,
  },
  playCounts: {
    2: "Twice. It gets better the second time.",
    4: "Four times. I’m choosing to read into that.",
    8: "Eight. Now I’m definitely reading into it.",
    16: "Sixteen. You could hum it by now. Hum it to me sometime?",
  } as Record<number, string>,
};

export interface VariationCopy {
  mark: string;
  title: string;
  line: string;
}

export const variationsCopy = {
  kicker: "Fig. 3 — Variations",
  title: "Six moods, all\u00a0of\u00a0them\u00a0you",
  lede: "I kept playing your name in different moods to see if I’d get tired of it. I didn’t. These are the six I kept.",
  todaysPick: "Today’s pick",
  play: "Play",
  stop: "Stop",
  // the kaleidoscope: one dial, one staff
  dialLabel: "The dial. Six variations — turn it to change the mood. Enter plays.",
  hintTouch: "Turn the ring, or tap a marking. Swiping the music sideways turns it too.",
  hintPointer: "Drag the ring round, or click a marking. ← and → turn it as well.",
  numeral: "Var.",
  mirror: "mirror",
  items: {
    theme: {
      mark: "Andante",
      title: "Just you",
      line: "Exactly as spelled. I didn’t change a thing. It didn’t need it.",
    },
    retrograde: {
      mark: "Cancrizans",
      title: "Back to front",
      line: "Your name from the last letter to the first. It still sounds like you. I wasn’t surprised.",
    },
    inversion: {
      mark: "Per moto contrario",
      title: "Upside down",
      line: "Every step up becomes a step down. Flipped completely over and it’s still pretty, which is a bit unfair on the rest of us.",
    },
    waltz: {
      mark: "Tempo di valse",
      title: "If I asked you to dance",
      line: "In three, with a bass going oom-pah-pah. Your name said yes straight away. Your turn.",
    },
    lullaby: {
      mark: "Adagio",
      title: "The 2 a.m. version",
      line: "Slower and lower. For the hour when you should be asleep and I’m still thinking about you.",
    },
    allegro: {
      mark: "Allegro",
      title: "Walking into a room",
      line: "Twice as fast and a little bright. This is what my head plays when you walk in. Not that I keep track.",
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
  /** one quotation, or its lines in order — each set on a line of its own */
  text: string | readonly string[];
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
    reply: `${capitalize(N)} notes, as it happens. No other name would sound as sweet.`,
  },
  musicBox: {
    text: "If music be the food of love, play on.",
    by: "Shakespeare, Twelfth Night",
  },
  variations: null,
  plates: {
    text: "A thing of beauty is a joy for ever.",
    by: "John Keats, Endymion",
    reply: "He hadn’t even met you.",
  },
  yourTurn: null,
  coda: null,
};

export const frontispiece = {
  kicker: "Frontispiece",
  title: "Every line is about you",
  paragraphs: [
    "Old scores open with a portrait facing the title page, cut into copper by someone with a very steady hand. Mine aren’t that steady when you’re around, so I cut yours in words.",
    `Every line of ink in it is a line of text — your name, the ${N} notes it makes, and things I’ve never quite said out loud. From across the room it looks like shading. Up close, every line says something about you — which, now that I think about it, is exactly how you work too.`,
  ],
  lead: "Pick up the glass and come closer. Start with the smile — I couldn’t stop writing there.",
  caption: "The theme, drawn from life. The original is still better.",
  engravedNote: (lines: number, words?: number) =>
    typeof words === "number" && words > 0
      ? `Engraved in ${lines} lines of ink — ${words.toLocaleString("en")} words — from a photograph.`
      : `Engraved in ${lines} lines of ink from a photograph.`,
  hintTouch: "Drag the glass by its handle. Three sentences are hidden in there.",
  hintPointer: "Drag the glass, or focus it and use the arrow keys. Three sentences are hidden in there.",
  glassLabel: "Magnifying glass. Use the arrow keys to move it over the portrait.",
  showPhoto: "Show the photograph",
  showEngraving: "Back to the engraving",
  photoCaption: "The photograph it was drawn from.",
  // ⚙️ The words the portrait is written in, in reading order. They repeat
  // until every line is full. Add your own lines anywhere in this list.
  microText: [
    HER_NAME,
    NAME_FACTS.notes.map((n) => n.note).join(" "),
    "Beautiful, giving, gentle",
    "Idiotically and deliciously feminine",
    "Wonderfully intelligent and wonderfully silly as well",
    "This portrait is not drawn. It is written",
    "Every line of ink is a line of words, and every word is about you",
    "If you are reading this, you found the glass. Most people never look this closely",
    `Composed by whoever named you. Transcribed, very carefully, by ${FROM_NAME}`,
    `${capitalize(N)} letters, ${N} notes, and a smile that took more lines than anything else here`,
    "I want to listen to you and watch you",
    "Your beautiful voice and your beauty",
    "To argue with you and to laugh with you",
    "To show things and share things with you",
    "And to explore your magnificent mind",
    "Turn the page when you are ready. The music is waiting",
  ],
  // ⚙️ Sentences set at a particular place in the portrait (u = across,
  // v = down, 0–1). The glass starts over the first one.
  hidden: [
    { text: "This smile is the reason I made all of this", u: 0.41, v: 0.458 },
    { text: "You caught me staring", u: 0.42, v: 0.335 },
    { text: "Talking to you is my favourite part", u: 0.73, v: 0.6 },
  ],
};

export const platesCopy = {
  kicker: "Plates",
  title: "The evidence",
  lede: "In case anyone ever asks why I made all this, here are four reasons. They’re printed in ink. Touch one and the colour comes back, which is roughly what you do to my day.",
  touchHint: "Touch a print to bring the colour back",
  pointerHint: "Hover over a print to bring the colour back",
  // ── the print room ──
  /** under the lede: how the plates arrive */
  pressHint: "Each one prints as you reach it. No rush.",
  /** the state of a plate, printed in its margin */
  unprinted: "Waiting for you",
  printing: "Printing…",
  impression: (n: number) =>
    n === 1 ? "First impression" : n === 2 ? "Second look" : n === 3 ? "Third look. Understandable" : `Look ${n}. I get it`,
  printAgain: "Print again",
  printAgainLabel: (mark: string) => `Print the plate marked ${mark} again`,
  /** announced when a plate has been pulled */
  printed: (n: number, mark: string) => `Plate ${n}, ${mark}, printed.`,
  /** what the "Pl." abbreviation stands for */
  plateWord: "Plate",
  /** appended to a print's accessible name */
  showColour: "show in colour",
  crescendo: "cresc.",
};
