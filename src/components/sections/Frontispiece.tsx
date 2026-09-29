"use client";

import { useEffect, useRef, useState } from "react";
import { frontispiece as copy } from "@/content/copy";
import { FRONTISPIECE } from "@/content/photos";
import { HER_NAME } from "@/content/site";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";
import { loadToneMap, type ToneMap } from "./frontispiece/engrave";
import Glass from "./frontispiece/Glass";
import { drawMicro, ensureFont, layoutMicro, monoFamily, type Micro } from "./frontispiece/micrograph";
import styles from "./frontispiece/frontispiece.module.css";

const ASPECT = FRONTISPIECE.toneHeight / FRONTISPIECE.toneWidth;
const PRINT_MS = 1500;

function lineCount(h: number) {
  return Math.max(120, Math.min(175, Math.round(h / 2.6)));
}

/**
 * Scores open with an engraved portrait facing the title page. Hers is
 * written rather than drawn: every engraved line is a line of tiny
 * words, printed here in the browser from a photograph. A reading glass
 * lies on the plate so the words can be read.
 */
export default function Frontispiece() {
  const plate = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const [micro, setMicro] = useState<Micro | null>(null);
  const [family, setFamily] = useState("monospace");
  const [photo, setPhoto] = useState(false);
  const reduced = useReducedMotion();
  const coarse = useMediaQuery("(pointer: coarse)");

  // measure the plate
  useEffect(() => {
    const el = plate.current;
    if (!el) return;
    let t = 0;
    const measure = () => {
      const W = el.clientWidth;
      if (W > 10) setSize((s) => (s && Math.abs(s.W - W) < 1 ? s : { W, H: W * ASPECT }));
    };
    measure();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(measure, 120);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // lay the words out along the engraved lines
  const mapRef = useRef<ToneMap | null>(null);
  useEffect(() => {
    if (!size) return;
    let cancelled = false;
    (async () => {
      const fam = monoFamily();
      await ensureFont(fam);
      if (!mapRef.current) mapRef.current = await loadToneMap(FRONTISPIECE.tone);
      if (cancelled) return;
      const m = layoutMicro(mapRef.current, size.W, size.H, {
        lines: lineCount(size.H),
        stream: copy.microText.join("  ·  ") + "  ·  ",
        hidden: copy.hidden,
        family: fam,
      });
      setFamily(fam);
      setMicro(m);
    })().catch(() => {
      /* the plate stays blank paper; the photograph still works */
    });
    return () => {
      cancelled = true;
    };
  }, [size]);

  // print it: line by line the first time it's seen, all at once after
  const printed = useRef(false);
  useEffect(() => {
    const cv = canvas.current;
    const el = plate.current;
    if (!cv || !el || !micro) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(micro.W * dpr);
    cv.height = Math.round(micro.H * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const drawAll = () => {
      ctx.clearRect(0, 0, micro.W, micro.H);
      drawMicro(ctx, micro, { family });
    };

    if (printed.current || reduced) {
      printed.current = true;
      drawAll();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || printed.current) return;
        printed.current = true;
        io.disconnect();
        ctx.clearRect(0, 0, micro.W, micro.H);
        const start = performance.now();
        let done = 0;
        const frame = (now: number) => {
          const p = Math.min(1, (now - start) / PRINT_MS);
          const upto = Math.round((1 - Math.pow(1 - p, 2)) * micro.lines);
          if (upto > done) {
            drawMicro(ctx, micro, { family, fromLine: done, toLine: upto });
            done = upto;
          }
          if (p < 1) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [micro, family, reduced]);

  const intro = (
    <div className={styles.text}>
      <p className="t-kicker reveal">{copy.kicker}</p>
      <h2 className={`t-display reveal ${styles.title}`}>{copy.title}</h2>
      {copy.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className={`t-body reveal ${styles.para}`}>
          {p}
        </p>
      ))}
      <p className={`reveal ${styles.lead}`}>{copy.lead}</p>
    </div>
  );

  return (
    <section id="frontispiece" className="section" aria-labelledby="frontispiece-name">
      <div className={`wrap ${styles.spread}`}>
        {intro}

        <figure className={styles.figure}>
          <div className={`${styles.plateMark} reveal`}>
            <div
              ref={plate}
              className={`${styles.plate} ${photo ? styles.photoOn : ""}`}
              style={{ aspectRatio: `${FRONTISPIECE.toneWidth} / ${FRONTISPIECE.toneHeight}` }}
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
              {size && !photo && (
                <Glass
                  micro={micro}
                  family={family}
                  W={size.W}
                  H={size.H}
                  // resting on her shoulder, so her face is the first thing seen
                  start={{ u: 0.7, v: 0.76 }}
                  label={copy.glassLabel}
                />
              )}
            </div>
          </div>

          <figcaption className={styles.captionBlock}>
            <p id="frontispiece-name" className={`${styles.name} reveal`}>
              {HER_NAME}
            </p>
            <p className={`${styles.caption} reveal`}>{photo ? copy.photoCaption : copy.caption}</p>
            <p className={`t-caption ${styles.note} reveal`} aria-live="polite">
              {photo || !micro ? " " : copy.engravedNote(micro.lines, micro.words)}
            </p>
          </figcaption>

          <div className={`${styles.actions} reveal`}>
            <p className={`t-caption ${styles.hint}`}>{coarse ? copy.hintTouch : copy.hintPointer}</p>
            <button type="button" className="btn-quiet" aria-pressed={photo} onClick={() => setPhoto((v) => !v)}>
              {photo ? copy.showEngraving : copy.showPhoto}
            </button>
          </div>
        </figure>
      </div>
    </section>
  );
}
