"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PAGES, pageIndex, pagesCopy } from "@/content/pages";
import { HER_NAME } from "@/content/site";
import styles from "./chrome.module.css";

/**
 * The running head (top left of every page) opens the contents: the
 * index at the front of a score, with dotted leaders and page numbers.
 */
export default function Contents() {
  const pathname = usePathname();
  const here = pageIndex(pathname);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (here < 0) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.head} ${here === 0 ? styles.headCompact : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${pagesCopy.contentsOpen} — ${PAGES[here].title}, ${pagesCopy.pageWord} ${here + 1}`}
      >
        <span className={styles.headGlyph} aria-hidden>
          <span />
          <span />
          <span />
        </span>
        {/* a title page carries no running head — just the way in */}
        {here > 0 && (
          <span className={styles.headText}>
            <span className={styles.headNo}>{here + 1}</span>
            <span className={styles.headTitle}>{PAGES[here].title}</span>
          </span>
        )}
      </button>

      <dialog
        ref={dialog}
        className={styles.contents}
        aria-labelledby="contents-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className={styles.contentsInner}>
          <div className={styles.contentsTop}>
            <p className="t-kicker">
              {pagesCopy.subtitle} · {HER_NAME}
            </p>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={pagesCopy.contentsClose}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h2 id="contents-title" className={`t-display ${styles.contentsTitle}`}>
            {pagesCopy.contents}
          </h2>
          <ol className={styles.toc}>
            {PAGES.map((p, i) => (
              <li key={p.slug}>
                <Link
                  href={p.slug}
                  transitionTypes={[i >= here ? "nav-forward" : "nav-back"]}
                  className={styles.tocRow}
                  aria-current={i === here ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.tocTitle}>
                    {p.label && <span className={styles.tocLabel}>{p.label}</span>}
                    {p.title}
                    {i === here && <span className={styles.tocHere}>{pagesCopy.here}</span>}
                  </span>
                  <span className={styles.tocLeader} aria-hidden />
                  <span className={styles.tocNo}>{i + 1}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </>
  );
}
