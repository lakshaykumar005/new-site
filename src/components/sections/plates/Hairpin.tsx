import { platesCopy } from "@/content/copy";
import s from "./plates.module.css";

/**
 * A crescendo hairpin, as engraved under a staff: *cresc.*, then two
 * hairlines opening from a point. The sign is stretched to any length
 * while its opening and its stroke stay fixed, like the real thing.
 */
export default function Hairpin() {
  return (
    <span className={s.cresc} aria-hidden="true">
      <span className={s.crescWord} lang="it">
        {platesCopy.crescendo}
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
