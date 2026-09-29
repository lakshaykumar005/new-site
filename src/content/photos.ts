// ─────────────────────────────────────────────────────────────
// ⚙️  CUSTOMIZE HERE — her photographs.
// Files live in public/photos/ and are prepared by
//   python3 scripts/photos.py <folder with the originals>
// which writes a colour JPEG and an ink-on-paper duotone of each
// plate, and the tone map the frontispiece is engraved from.
// ─────────────────────────────────────────────────────────────

export interface PlatePhoto {
  /** colour photograph */
  src: string;
  /** the same photograph printed in ink on paper */
  duo: string;
  width: number;
  height: number;
  alt: string;
  /** small label under this photo (used by the crescendo pair) */
  label?: string;
}

export interface Plate {
  id: string;
  /** the Italian marking, printed large */
  mark: string;
  /** its meaning, printed small */
  gloss: string;
  line: string;
  /** one photo, or two for a pair */
  photos: PlatePhoto[];
}

export const FRONTISPIECE = {
  /** R = darkness, G = form (see scripts/photos.py) */
  tone: "/photos/frontispiece-tone.png",
  toneWidth: 420,
  toneHeight: 519,
  photo: "/photos/frontispiece.jpg",
  alt: "An engraved portrait of Pavithraa, smiling",
  photoAlt: "Pavithraa smiling on a terrace in a sage-green kurta",
};

const p = (name: string, width: number, height: number, alt: string, label?: string): PlatePhoto => ({
  src: `/photos/plate-${name}.jpg`,
  duo: `/photos/plate-${name}-duo.jpg`,
  width,
  height,
  alt,
  label,
});

export const PLATES: Plate[] = [
  {
    id: "scherzando",
    mark: "Scherzando",
    gloss: "playfully",
    line: "Marked over the lightest, most joking passages. The tiny umbrella has clearly read the score.",
    photos: [p("scherzando", 500, 860, "Pavithraa smiling, holding a tiny paper cocktail umbrella")],
  },
  {
    id: "dolce",
    mark: "Dolce",
    gloss: "sweetly",
    line: "Printed over the passages meant to be played as gently as possible. Composers only use it where it’s earned.",
    photos: [p("dolce", 548, 930, "Pavithraa in a blue dress with small gold stars, smiling, one hand in her hair")],
  },
  {
    id: "notturno",
    mark: "Notturno",
    gloss: "a night piece",
    line: "Music meant for after dark. Chopin wrote a whole book of them; this one needs no piano.",
    photos: [p("notturno", 620, 897, "Pavithraa at night in a white T-shirt and jeans, looking to one side")],
  },
  {
    id: "tutti",
    mark: "Tutti",
    gloss: "everyone plays",
    line: "The whole orchestra, all at once — and somehow you’re still the melody.",
    photos: [p("tutti", 1100, 716, "Pavithraa in a beach selfie with a group of friends")],
  },
  {
    id: "crescendo",
    mark: "Crescendo",
    gloss: "growing louder",
    line: "One year, then the next — a little louder each time. Composers have a sign for that. It opens as it goes.",
    photos: [
      p(
        "crescendo-2025",
        770,
        700,
        "Pavithraa receiving the K S Girl Achiever Award on stage at College Day 2025",
        "College Day, 2025"
      ),
      p(
        "crescendo-2026",
        580,
        600,
        "Pavithraa receiving the MSP Award of Excellence on stage at College Day 2026",
        "College Day, 2026"
      ),
    ],
  },
];
