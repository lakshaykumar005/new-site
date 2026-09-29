import { platesCopy } from "@/content/copy";
import { PLATES } from "@/content/photos";
import Plate from "./plates/Plate";
import s from "./plates/plates.module.css";

/**
 * Plates — studies from life. Her photographs, printed in ink as the
 * plates of a fine edition: one to a page on a phone, keeping to
 * alternate margins on a wide page. Touch one and the colour returns.
 */
export default function Plates() {
  return (
    <section id="plates" className="section" aria-labelledby="plates-title">
      <div className="wrap">
        <header className={`reveal ${s.head}`}>
          <p className="t-kicker">{platesCopy.kicker}</p>
          <h2 id="plates-title" className={`t-display ${s.title}`}>
            {platesCopy.title}
          </h2>
          <p className={`t-lede measure ${s.lede}`}>{platesCopy.lede}</p>
          <p className={`t-caption ${s.hint}`}>
            <span className={s.hintTouch}>{platesCopy.touchHint}</span>
            <span className={s.hintPointer}>{platesCopy.pointerHint}</span>
          </p>
        </header>

        <ol className={s.plates}>
          {PLATES.map((plate, i) => (
            <li key={plate.id}>
              <Plate plate={plate} index={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
