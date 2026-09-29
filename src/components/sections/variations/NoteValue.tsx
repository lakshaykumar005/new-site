import type { Ref } from "react";
import { GLYPHS } from "@/components/notation/glyphs";
import { flagTransform, glyphAtCentre } from "@/components/notation/layout";
import type { BeatUnit } from "./systems";

/**
 * The little engraved note in a metronome mark ("♩ = 88"), drawn with
 * the same glyphs as the staff so it matches the music under it.
 */

const S = 10; // one staff space, in this drawing's units
const HEAD_W = ((GLYPHS.noteheadBlack.bounds[2] - GLYPHS.noteheadBlack.bounds[0]) / 250) * S;
const CX = HEAD_W / 2 + 0.6;
const STEM_TOP = 1;
const STEM_LEN = 2.9 * S;
const CY = STEM_TOP + STEM_LEN;
const STEM_X = CX + HEAD_W / 2 - 0.06 * S;
const H = CY + 0.56 * S + 0.4;

interface NoteValueProps {
  unit: BeatUnit;
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

export default function NoteValue({ unit, className, ref }: NoteValueProps) {
  const head = unit === "half" ? "noteheadHalf" : "noteheadBlack";
  const w = unit === "eighth" ? STEM_X + 1.25 * S : HEAD_W + 1.4;
  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${H}`} className={className} aria-hidden focusable="false">
      <path d={GLYPHS[head].d} transform={glyphAtCentre(head, CX, CY, S)} fill="currentColor" />
      <line x1={STEM_X} x2={STEM_X} y1={CY - 0.15 * S} y2={STEM_TOP} stroke="currentColor" strokeWidth={0.13 * S} />
      {unit === "eighth" && (
        <path d={GLYPHS.eighthFlagUp.d} transform={flagTransform(STEM_X - 0.065 * S, STEM_TOP, S, false)} fill="currentColor" />
      )}
    </svg>
  );
}
