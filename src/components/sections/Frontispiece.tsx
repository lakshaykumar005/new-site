"use client";

import { useEffect, useRef, useState } from "react";
import { frontispiece as copy } from "@/content/copy";
import { FRONTISPIECE } from "@/content/photos";
import { HER_NAME } from "@/content/site";
import { useReducedMotion } from "@/lib/hooks";
import { engrave, loadToneMap, type ToneMap } from "./frontispiece/engrave";
import styles from "./frontispiece/frontispiece.module.css";

const ASPECT = FRONTISPIECE.toneHeight / FRONTISPIECE.toneWidth;
const INK = "#1c1b2b";
const PRINT_MS = 1700;

function lineCount(h: number) {
  return Math.max(120, Math.min(190, Math.round(h / 2.25)));
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Scores open with an engraved portrait facing the title page.
 * Hers is engraved here, in the browser, from a photograph — and
 * prints itself top to bottom the first time it comes into view.
 */
export default function Frontispiece() {
  const box = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState(170);
  const [photo, setPhoto] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let map: ToneMap | null = null;
    let off: HTMLCanvasElement | null = null;
    let printed = false;
    let visible = false;
    let raf = 0;
    let cancelled = false;

    const drawFull = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !off) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(off, 0, 0);
    };

    const print = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !off) return;
      const source = off;
      const start = performance.now();
      const frame = (now: number) => {
        const p = Math.min(1, (now - start) / PRINT_MS);
        const y = Math.round(easeInOut(p) * cv.height);
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (y > 0) ctx.drawImage(source, 0, 0, cv.width, y, 0, 0, cv.width, y);
        // the band still wet under the roller
        const band = Math.round(cv.height * 0.018);
        if (p < 1 && band > 0) {
          ctx.globalAlpha = 0.35;
          const h = Math.min(band, cv.height - y);
          if (h > 0) ctx.drawImage(source, 0, y, cv.width, h, 0, y, cv.width, h);
          ctx.globalAlpha = 1;
        }
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    const render = () => {
      if (!map) return;
      const w = el.clientWidth;
      if (w < 10) return;
      const h = w * ASPECT;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const n = lineCount(h);
      setLines(n);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      off = document.createElement("canvas");
      off.width = cv.width;
      off.height = cv.height;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engrave(octx, map, w, h, { lines: n, ink: INK });
      if (printed) {
        drawFull();
      } else if (visible) {
        printed = true;
        if (reduced) drawFull();
        else print();
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || printed) return;
        visible = true;
        if (off) {
          printed = true;
          if (reduced) drawFull();
          else print();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        render();
      }, 120);
    });

    loadToneMap(FRONTISPIECE.tone)
      .then((m) => {
        if (cancelled) return;
        map = m;
        render();
        ro.observe(el);
      })
      .catch(() => {
        /* the plate stays blank paper; the photograph toggle still works */
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduced]);

  return (
    <section id="frontispiece" className="section" aria-labelledby="frontispiece-name">
      <div className={`wrap ${styles.page}`}>
        <p className="t-kicker reveal">{copy.kicker}</p>

        <div className={`${styles.plateMark} reveal`}>
          <button
            ref={box}
            type="button"
            className={`${styles.plate} ${photo ? styles.photoOn : ""}`}
            style={{ aspectRatio: `${FRONTISPIECE.toneWidth} / ${FRONTISPIECE.toneHeight}` }}
            onClick={() => setPhoto((v) => !v)}
            aria-pressed={photo}
            aria-label={photo ? copy.toggleBackLabel : copy.toggleLabel}
          >
            <canvas ref={canvas} className={styles.canvas} role="img" aria-label={FRONTISPIECE.alt} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FRONTISPIECE.photo}
              alt={photo ? FRONTISPIECE.photoAlt : ""}
              aria-hidden={!photo}
              className={styles.photo}
              loading="lazy"
              decoding="async"
              width={720}
              height={889}
            />
            <svg className={styles.frame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <ellipse cx="50" cy="50" rx="49.4" ry="49.4" fill="none" stroke="currentColor" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
              <ellipse cx="50" cy="50" rx="48.6" ry="48.6" fill="none" stroke="currentColor" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
            </svg>
          </button>
        </div>

        <p id="frontispiece-name" className={`${styles.name} reveal`}>
          {HER_NAME}
        </p>
        <p className={`${styles.caption} reveal`}>{photo ? copy.photoCaption : copy.caption}</p>
        <p className={`t-caption ${styles.note} reveal`} aria-live="polite">
          {photo ? copy.photoNote : copy.engravedNote(lines)}
        </p>
      </div>
    </section>
  );
}
