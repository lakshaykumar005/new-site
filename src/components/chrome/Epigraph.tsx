import s from "@/components/sections/plates/epigraph.module.css";
import { epigraphs } from "@/content/copy";
import Divider from "./Divider";

/** Past this many characters a quotation is set smaller, as a passage. */
const LONG = 90;

/**
 * The epigraph for `slot`, set at the head of the next movement:
 * centred between two hairlines, the quotation in italic, its source
 * small beneath, and an answer if there is one. An empty slot is just
 * a pause — the fermata divider.
 */
export default function Epigraph({
  slot,
  atHead = false,
}: {
  slot: keyof typeof epigraphs;
  /** printed at the top of a page: leave no trace when the slot is empty */
  atHead?: boolean;
}) {
  const q = epigraphs[slot];
  if (!q) return atHead ? null : <Divider />;
  const lines = typeof q.text === "string" ? [q.text] : q.text;
  const long = lines.join(" ").length > LONG;
  return (
    <div className={`wrap ${s.epigraph} ${atHead ? s.atHead : ""}`}>
      <div className={`reveal ${s.inner} ${long ? s.long : ""}`}>
        <figure className={s.figure}>
          <blockquote className={s.text}>
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </blockquote>
          {q.by ? (
            <figcaption className={s.by}>
              <span className={s.dash} aria-hidden="true">
                —
              </span>
              {q.by}
            </figcaption>
          ) : null}
        </figure>
        {q.reply ? <p className={s.reply}>{q.reply}</p> : null}
      </div>
    </div>
  );
}
