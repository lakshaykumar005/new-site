import s from "./plates.module.css";

/** The word a score prints where it starts to grow louder. */
const CRESC = "cresc.";

/**
 * A crescendo hairpin, as engraved under a staff: *cresc.*, then two
 * hairlines opening from a point. The sign is stretched to any length
 * while its opening and its stroke stay fixed, like the real thing.
 */
export default function Hairpin() {
  return (
    <span className={s.cresc} aria-hidden="true">
      <span className={s.crescWord} lang="it">
        {CRESC}
      </span>
      <svg className={s.hairpin} viewBox="0 0 100 16" preserveAspectRatio="none" focusable="false">
        <polyline
          points="100,1.25 0,8 100,14.75"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
