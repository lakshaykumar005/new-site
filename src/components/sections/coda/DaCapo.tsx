"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, type MouseEvent } from "react";
import { coda } from "@/content/copy";
import { musicBox } from "@/lib/music/audio";
import styles from "./coda.module.css";

/** Where "the top" is: the title page. */
const TITLE_PAGE = "/";
/** Longest we'll wait for the scroll to settle, or the title page to arrive, before giving up (ms). */
const PATIENCE = 4000;
/** How long the page takes to turn (the view transition in globals.css), plus a breath (ms). */
const PAGE_TURN = 560;

/** Ask the title page to play her name again, and put the keyboard where it can do that again too. */
function replay(top: HTMLElement) {
  top.querySelector<HTMLElement>("button, a[href]")?.focus({ preventScroll: true });
  window.dispatchEvent(new Event("von:replay"));
}

/**
 * The title page is on this page: glide up to it, and replay once there.
 * Returns a cancel function.
 */
function scrollUpAndReplay(top: HTMLElement, reduce: boolean): () => void {
  const targetY = Math.max(0, window.scrollY + top.getBoundingClientRect().top);
  let settled = false;
  let raf = 0;
  let still = 0;
  let lastY = window.scrollY;
  const started = performance.now();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scrollend", onEnd);
  };
  const land = () => {
    if (settled) return;
    settled = true;
    cleanup();
    // if she took over the scroll on the way up, don't start playing at her
    if (Math.abs(window.scrollY - targetY) > window.innerHeight * 0.5) return;
    replay(top);
  };
  function onEnd() {
    if (Math.abs(window.scrollY - targetY) < 2) land();
  }
  // scrollend isn't everywhere yet: also watch for the page to stop moving
  const watch = () => {
    const y = window.scrollY;
    still = Math.abs(y - lastY) < 0.5 ? still + 1 : 0;
    lastY = y;
    if (Math.abs(y - targetY) < 2 || still > 8 || performance.now() - started > PATIENCE) {
      land();
      return;
    }
    raf = requestAnimationFrame(watch);
  };

  if (Math.abs(window.scrollY - targetY) < 2) {
    land();
    return cleanup;
  }
  window.scrollTo({ top: targetY, behavior: reduce ? "auto" : "smooth" });
  if (reduce) {
    land();
    return cleanup;
  }
  window.addEventListener("scrollend", onEnd);
  raf = requestAnimationFrame(watch);
  return cleanup;
}

/**
 * The title page is a page of its own: the link turns back to it, and once
 * it has arrived (and the page has finished turning) it is asked to play.
 * This outlives the coda, which is unmounted by the turn.
 */
function replayOnArrival(reduce: boolean) {
  const started = performance.now();
  const look = () => {
    const top = document.getElementById("top");
    if (top && window.location.pathname === TITLE_PAGE) {
      window.setTimeout(() => replay(top), reduce ? 60 : PAGE_TURN);
      return;
    }
    if (performance.now() - started < PATIENCE) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

/**
 * Da capo: back to the top, where the title page plays the theme again (it
 * listens for "von:replay"). Audio is unlocked here, inside the tap, so the
 * replay can sound once she's there.
 *
 * Its name is what it says ("D.C. — from the top"), so a voice-control user
 * can say what they see; the fuller label is its description.
 */
export default function DaCapo() {
  const cancel = useRef<(() => void) | null>(null);
  const describedBy = useId();

  useEffect(() => () => cancel.current?.(), []);

  const onClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    // a new tab or window is the browser's business
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    void musicBox.unlock();
    cancel.current?.();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = document.getElementById("top");
    if (top) {
      e.preventDefault();
      cancel.current = scrollUpAndReplay(top, reduce);
    } else {
      replayOnArrival(reduce);
    }
  }, []);

  return (
    <>
      <Link
        href={TITLE_PAGE}
        transitionTypes={["nav-back"]}
        className={`btn-quiet ${styles.daCapo}`}
        aria-describedby={describedBy}
        onClick={onClick}
      >
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
          <path d="M6 13V1.6M1.8 5.6 6 1.4l4.2 4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {coda.daCapo}
      </Link>
      <span id={describedBy} hidden>
        {coda.daCapoLabel}
      </span>
    </>
  );
}
