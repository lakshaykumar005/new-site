import { GLYPHS, STAFF_SPACE_UNITS } from "@/components/notation/glyphs";
import { clefTransform, glyphAtCentre } from "@/components/notation/layout";

/** Printed above the system, the way scores number their bars. */
const BAR_NUMBER = "404";

/**
 * One bar of silence, for the page that isn't there: a treble clef, a
 * whole-bar rest held under a fermata, and a final barline — numbered, as
 * engravers number bars, 404. (The piece has four.)
 */
export default function RestBar({ className }: { className?: string }) {
  const s = 9;
  const k = s / STAFF_SPACE_UNITS;
  const W = 252;
  const top = 3.4 * s;
  const bottom = top + 4 * s;
  const H = bottom + 2.2 * s;
  const clefX = 1;
  const barX = W - 0.1 * s;
  const clefEnd = clefX + (GLYPHS.gClef.bounds[2] - GLYPHS.gClef.bounds[0]) * k;
  const mid = (clefEnd + barX) / 2 + 0.3 * s;

  // a whole-bar rest: a block half a space deep, hanging from the fourth line
  const fourth = top + s;

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <text
        x={clefX + 0.2 * s}
        y={top - 2.1 * s}
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontWeight={500}
        fontSize={1.55 * s}
        style={{ fill: "var(--color-graphite)" }}
      >
        {BAR_NUMBER}
      </text>
      <g style={{ stroke: "color-mix(in srgb, var(--color-ink) 78%, var(--color-paper))" }} strokeWidth={0.1 * s}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={0} x2={barX + 0.1 * s} y1={top + i * s} y2={top + i * s} />
        ))}
      </g>
      <g style={{ fill: "var(--color-ink)" }}>
        <path d={GLYPHS.gClef.d} transform={clefTransform(clefX, bottom, s)} />
        <rect x={mid - 0.64 * s} y={fourth} width={1.28 * s} height={0.52 * s} />
        <path d={GLYPHS.fermata.d} transform={glyphAtCentre("fermata", mid, top - 1.45 * s, s)} />
        <rect x={barX - 0.72 * s} y={top} width={0.12 * s} height={4 * s} />
        <rect x={barX - 0.4 * s} y={top} width={0.5 * s} height={4 * s} />
      </g>
    </svg>
  );
}
