import { GLYPHS } from "@/components/notation/glyphs";
import { glyphAtCentre } from "@/components/notation/layout";

/** A hairline between sections, held by a small fermata — a pause. */
export default function Divider() {
  return (
    <div className="wrap" aria-hidden>
      <svg viewBox="0 0 400 24" className="mx-auto block h-6 w-full max-w-[28rem] text-ink-soft" preserveAspectRatio="xMidYMid meet">
        <line x1="0" x2="176" y1="16" y2="16" stroke="var(--color-rule)" strokeWidth="1" />
        <line x1="224" x2="400" y1="16" y2="16" stroke="var(--color-rule)" strokeWidth="1" />
        <path d={GLYPHS.fermata.d} transform={glyphAtCentre("fermata", 200, 10, 18)} fill="currentColor" />
      </svg>
    </div>
  );
}
