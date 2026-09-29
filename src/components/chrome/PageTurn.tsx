import Link from "next/link";
import { PAGES, pagesCopy } from "@/content/pages";
import styles from "./chrome.module.css";

/**
 * The foot of every page: where you came from, where you're going,
 * and the folio — the printed page number — between them.
 */
export default function PageTurn({ index }: { index: number }) {
  const prev = index > 0 ? PAGES[index - 1] : null;
  const next = index < PAGES.length - 1 ? PAGES[index + 1] : null;

  return (
    <nav className={`wrap ${styles.turn}`} aria-label="Pages">
      <div className={styles.turnRule} aria-hidden />
      <div className={styles.turnRow}>
        {prev ? (
          <Link href={prev.slug} transitionTypes={["nav-back"]} className={styles.turnPrev} rel="prev">
            <span className={styles.turnLabel}>
              <span aria-hidden>‹ </span>
              {pagesCopy.back}
            </span>
            <span className={styles.turnTitle}>{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}

        <span className={styles.folio} aria-label={`${pagesCopy.pageWord} ${index + 1} of ${PAGES.length}`}>
          <span aria-hidden>—&thinsp;{index + 1}&thinsp;—</span>
        </span>

        {next ? (
          <Link href={next.slug} transitionTypes={["nav-forward"]} className={styles.turnNext} rel="next">
            <span className={styles.turnLabel}>
              {pagesCopy.next}
              <span aria-hidden> ›</span>
            </span>
            <span className={styles.turnTitle}>{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
