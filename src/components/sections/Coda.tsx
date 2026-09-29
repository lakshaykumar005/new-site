import { coda } from "@/content/copy";
import DaCapo from "./coda/DaCapo";
import FinalBar from "./coda/FinalBar";
import { CODA_GLYPHS } from "./coda/glyphs";
import styles from "./coda/coda.module.css";

/** The engraver's imprint at the foot of the last page (each face named in itself). */
const COLOPHON = {
  lead: "Set in",
  faces: ["Bodoni Moda", "Cormorant Garamond", "Newsreader", "DM Mono"],
  and: "and",
  tail: "Engraved in code.",
};

/** The coda sign, as a score marks the way to its ending. */
function CodaSign() {
  const g = CODA_GLYPHS.coda;
  const [x0, y0, x1, y1] = g.bounds;
  return (
    <svg className={styles.codaSign} viewBox={`${x0} ${-y1} ${x1 - x0} ${y1 - y0}`} aria-hidden>
      <path d={g.d} transform="scale(1 -1)" fill="currentColor" />
    </svg>
  );
}

/** Typesetting only: a dash never starts a line (it stays with the word before it). */
const set = (p: string) => p.replace(/ (—|–) /g, "\u00a0$1 ");
/** …and the signature's dash never leaves the name. */
const signed = coda.signoff.replace(/^(—|–) /, "$1\u00a0");

export default function Coda() {
  const [first, ...rest] = coda.letter.map(set);
  const dropped = first.charAt(0);

  return (
    <section id="coda" className={styles.root} aria-labelledby="coda-title">
      <div className="wrap">
        <div className={styles.col}>
          <header className="reveal">
            <p className={`t-kicker ${styles.kicker}`}>
              <CodaSign />
              {coda.kicker}
            </p>
            <h2 id="coda-title" className={`t-display ${styles.title}`}>
              {coda.title}
            </h2>
          </header>

          <div className={styles.letter}>
            <p className={`t-body reveal ${styles.para}`}>
              <span className={styles.dropCap}>{dropped}</span>
              {first.slice(dropped.length)}
            </p>
            {rest.map((p) => (
              <p key={p.slice(0, 24)} className={`t-body reveal ${styles.para}`}>
                {p}
              </p>
            ))}
            <p className={`reveal ${styles.signoff}`}>{signed}</p>
          </div>

          <FinalBar>
            <DaCapo />
          </FinalBar>
        </div>

        <footer className={styles.colophon}>
          <span className={styles.colophonRule} aria-hidden />
          <p className="t-caption">
            {COLOPHON.lead} <span className={`${styles.face} ${styles.faceBodoni}`}>{COLOPHON.faces[0]},</span>{" "}
            <span className={`${styles.face} ${styles.faceCormorant}`}>{COLOPHON.faces[1]},</span>{" "}
            <span className={`${styles.face} ${styles.faceNewsreader}`}>{COLOPHON.faces[2]}</span> {COLOPHON.and}{" "}
            <span className={`${styles.face} ${styles.faceMono}`}>{COLOPHON.faces[3]}</span>. {COLOPHON.tail}
          </p>
        </footer>
      </div>
    </section>
  );
}
