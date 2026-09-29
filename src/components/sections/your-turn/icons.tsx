import styles from "./your-turn.module.css";

/** The small printed marks inside the buttons. */

export function PlayGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M3.4 1.9v8.2L10.1 6z" fill="currentColor" />
    </svg>
  );
}

export function StopGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <rect x="2.6" y="2.6" width="6.8" height="6.8" fill="currentColor" />
    </svg>
  );
}

export function ArrowGlyph() {
  return (
    <svg className={styles.arrow} width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
      <path d="M0.5 5h14M10.5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function TickGlyph() {
  return (
    <svg className={styles.tick} width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
      <path d="M1 5.2l3.8 3.6L13 1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
