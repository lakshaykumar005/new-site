import { platesCopy } from "@/content/copy";
import { PLATES } from "@/content/photos";
import PrintRun from "./plates/PrintRun";
import s from "./plates/plates.module.css";

/**
 * Plates — the print room. Her photographs arrive the way plates do:
 * each is inked by a roller as it comes into view, a sheet is laid on
 * it and pulled off from one corner, and the print is left lying on
 * its plate to dry. Touch one and the colour comes back.
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
        </header>

        <ol className={s.runs}>
          {PLATES.map((plate, i) => (
            <li key={plate.id}>
              <PrintRun plate={plate} index={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
