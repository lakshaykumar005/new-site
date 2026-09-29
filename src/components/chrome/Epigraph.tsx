import s from "@/components/sections/plates/epigraph.module.css";
import { epigraphs } from "@/content/copy";
import Divider from "./Divider";

/**
 * The epigraph for `slot`, set at the head of the next movement:
 * centred between two hairlines, the quotation in italic, its source
 * small beneath, and an answer if there is one. An empty slot is just
 * a pause — the fermata divider.
 */
export default function Epigraph({ slot }: { slot: keyof typeof epigraphs }) {
  const q = epigraphs[slot];
  if (!q) return <Divider />;
  return (
    <div className={`wrap ${s.epigraph}`}>
      <div className={`reveal ${s.inner}`}>
        <figure className={s.figure}>
          <blockquote className={s.text}>
            <p>{q.text}</p>
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
