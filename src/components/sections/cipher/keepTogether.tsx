import { Fragment, type ReactNode } from "react";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Copy stays verbatim; only its break opportunities change. Each phrase
 * that must not be split across lines ("Opus 1", "A, B, E, G, G") is set
 * in a nowrap span. Phrases that aren't in the text are simply ignored,
 * so rewriting the copy can never break it.
 */
export function keepTogether(text: string, phrases: readonly string[], className: string): ReactNode {
  const found = phrases.filter((p) => p && text.includes(p));
  if (found.length === 0) return text;
  const parts = text.split(new RegExp(`(${found.map(escape).join("|")})`));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={className}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/**
 * Enter presses a focused button on every auto-repeat of a held key, so
 * one long press would pluck a note eight times. Only the first counts.
 */
export function holdEnterOnce(e: { key: string; repeat: boolean; preventDefault(): void }): boolean {
  if (e.key === "Enter" && e.repeat) {
    e.preventDefault();
    return true;
  }
  return false;
}
