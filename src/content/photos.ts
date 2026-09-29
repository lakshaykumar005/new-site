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
    line: "Holding a tiny paper umbrella like it’s the most serious thing in the world. I’ve looked at this one more times than I’ll admit.",
    photos: [p("scherzando", 500, 860, "Pavithraa smiling, holding a tiny paper cocktail umbrella")],
  },
  {
    id: "dolce",
    mark: "Dolce",
    gloss: "sweetly",
    line: "A dress covered in stars, and not one person is looking at the stars.",
    photos: [p("dolce", 548, 930, "Pavithraa in a blue dress with small gold stars, smiling, one hand in her hair")],
  },
  {
    id: "notturno",
    mark: "Notturno",
    gloss: "a night piece",
    line: "It was dark out and you still lit up the photo. Next time, look this way.",
    photos: [p("notturno", 620, 897, "Pavithraa at night in a white T-shirt and jeans, looking to one side")],
  },
  {
    id: "amoroso",
    mark: "Amoroso",
    gloss: "lovingly",
    line: "Nobody had to tell me how to look at this one.",
    photos: [p("amoroso", 676, 1160, "Pavithraa smiling on a terrace in a sage-green kurta, hands folded")],
  },
];
