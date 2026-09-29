"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { musicBoxCopy } from "@/content/copy";
import { useReducedMotion } from "@/lib/hooks";
import { buildPlate, loadToneMap, type Plate, type PlateLine, type ToneMap } from "./plate";
import s from "./plate.module.css";

export interface PlateHandle {
  /** a note on row `row` of the strip has just sounded */
  strike(row: number): void;
}

interface PortraitPlateProps {
  ref?: Ref<PlateHandle>;
  /** rows on the paper strip — one band of the portrait each */
  rows: number;
  /** how many holes each row has in one pass of the song */
  holesPerRow: number[];
}

const TONE = "/photos/musicbox-tone.png";
const TONE_ASPECT = 496 / 400;
/** her portrait is complete after this many passes of the song */
const PASSES = 2;
const CUT_MS = 460;
const INK = "#1c1b2b";
const VERMILLION = "#d9432a";

interface Cut {
  line: PlateLine;
  start: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Fig. 2a — a blank engraver's plate above the music box. Every note the
 * box plays cuts the next lines of her portrait into the band that
 * belongs to its row on the strip (high notes at the top, the bass at
 * the bottom). The burin's tip glows vermillion while it cuts — the
 * site's colour for "sounding" — and the line settles into ink.
 */
export default function PortraitPlate({ ref, rows, holesPerRow }: PortraitPlateProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [cut, setCut] = useState(0);
  const [total, setTotal] = useState(0);

  const st = useRef({
    map: null as ToneMap | null,
    plate: null as Plate | null,
    baked: null as HTMLCanvasElement | null,
    dpr: 1,
    next: [] as number[],
    perStrike: [] as number[],
    active: [] as Cut[],
    count: 0,
    hatched: 0,
    raf: 0,
  });

  /** Draws one frame; true while there is still something being cut. */
  const paint = useCallback((): boolean => {
    const t = st.current;
    const cv = canvas.current;
    const plate = t.plate;
    if (!cv || !plate || !t.baked) return false;
    const ctx = cv.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(t.baked, 0, 0);
    ctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    const now = performance.now();
    const bctx = t.baked.getContext("2d");
    const still: Cut[] = [];
    for (const c of t.active) {
      const p = Math.min(1, Math.max(0, (now - c.start) / CUT_MS));
      if (p >= 1) {
        if (bctx) {
          bctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
          bctx.fillStyle = INK;
          bctx.fill(c.line.path);
        }
        ctx.fillStyle = INK;
        ctx.fill(c.line.path);
        continue;
      }
      still.push(c);
      if (p <= 0) continue;
      const x = c.line.x0 + (c.line.x1 - c.line.x0) * easeOut(p);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, c.line.y - plate.spacing * 2, x, plate.spacing * 4);
      ctx.clip();
      ctx.fillStyle = INK;
      ctx.fill(c.line.path);
      ctx.restore();
      // the burin's tip, still warm
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(0, x - plate.spacing * 5), c.line.y - plate.spacing * 2, plate.spacing * 5, plate.spacing * 4);
      ctx.clip();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = VERMILLION;
      ctx.fill(c.line.path);
      ctx.restore();
      ctx.fillStyle = VERMILLION;
      ctx.beginPath();
      ctx.arc(x, c.line.y, Math.max(1.1, plate.spacing * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
    t.active = still;

    // once she's all there, the shadows are cross-hatched
    if (t.hatched > 0) {
      const a = Math.min(1, (now - t.hatched) / 900);
      ctx.globalAlpha = a;
      ctx.fillStyle = INK;
      ctx.fill(plate.hatch);
      ctx.globalAlpha = 1;
      if (a >= 1 && bctx) {
        bctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
        bctx.fillStyle = INK;
        bctx.fill(plate.hatch);
        t.hatched = -1;
      }
    }

    return t.active.length > 0 || t.hatched > 0;
  }, []);

  const kick = useCallback(() => {
    const t = st.current;
    if (t.raf) return;
    const loop = () => {
      t.raf = 0;
      if (paint()) t.raf = requestAnimationFrame(loop);
    };
    t.raf = requestAnimationFrame(loop);
  }, [paint]);

  // lay the plate out for the width it has
  const build = useCallback(() => {
    const t = st.current;
    const el = box.current;
    const cv = canvas.current;
    if (!t.map || !el || !cv) return;
    const W = el.clientWidth;
    if (W < 20) return;
    const H = W * TONE_ASPECT;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const lines = Math.max(110, Math.min(170, Math.round(H / 2.4)));
    const plate = buildPlate(t.map, W, H, lines, Math.max(1, rows));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const baked = document.createElement("canvas");
    baked.width = cv.width;
    baked.height = cv.height;
    t.plate = plate;
    t.baked = baked;
    t.dpr = dpr;
    t.active = [];
    t.hatched = 0;
    t.next = plate.bands.map(() => 0);
    t.perStrike = plate.bands.map((band, r) => {
      const holes = holesPerRow[r] ?? 0;
      return holes > 0 ? Math.max(1, Math.ceil(band.length / (holes * PASSES))) : band.length;
    });
    // a re-layout keeps what she has already engraved
    const keep = t.count;
    t.count = 0;
    if (keep > 0) {
      const bctx = baked.getContext("2d");
      if (bctx) {
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bctx.fillStyle = INK;
        let left = keep;
        let r = 0;
        while (left > 0 && plate.bands.some((b, i) => t.next[i] < b.length)) {
          const band = plate.bands[r];
          if (t.next[r] < band.length) {
            bctx.fill(band[t.next[r]].path);
            t.next[r]++;
            t.count++;
            left--;
          }
          r = (r + 1) % plate.bands.length;
        }
        if (t.count >= plate.total) bctx.fill(plate.hatch);
      }
    }
    setTotal(plate.total);
    setCut(t.count);
    paint();
  }, [rows, holesPerRow, paint]);

  useEffect(() => {
    let cancelled = false;
    loadToneMap(TONE)
      .then((m) => {
        if (cancelled) return;
        st.current.map = m;
        build();
      })
      .catch(() => {
        /* the plate stays blank */
      });
    const el = box.current;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 150);
    });
    if (el) ro.observe(el);
    const t = st.current;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ro.disconnect();
      cancelAnimationFrame(t.raf);
      t.raf = 0;
    };
  }, [build]);

  useImperativeHandle(
    ref,
    () => ({
      strike(row: number) {
        const t = st.current;
        const plate = t.plate;
        if (!plate || t.count >= plate.total) return;
        const r = Math.min(plate.bands.length - 1, Math.max(0, row));
        const band = plate.bands[r];
        const n = Math.min(t.perStrike[r] ?? 1, band.length - t.next[r]);
        if (n <= 0) return;
        const now = performance.now();
        for (let k = 0; k < n; k++) {
          const line = band[t.next[r]++];
          if (reduced) {
            const bctx = t.baked?.getContext("2d");
            if (bctx) {
              bctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
              bctx.fillStyle = INK;
              bctx.fill(line.path);
            }
          } else {
            t.active.push({ line, start: now + k * 70 });
          }
        }
        t.count += n;
        if (t.count >= plate.total) t.hatched = reduced ? -1 : now + n * 70 + CUT_MS;
        if (reduced && t.count >= plate.total && t.baked) {
          const bctx = t.baked.getContext("2d");
          if (bctx) {
            bctx.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
            bctx.fillStyle = INK;
            bctx.fill(plate.hatch);
          }
        }
        setCut(t.count);
        if (reduced) paint();
        else kick();
      },
    }),
    [reduced, kick, paint]
  );

  const clear = () => {
    const t = st.current;
    if (!t.plate || !t.baked) return;
    cancelAnimationFrame(t.raf);
    t.raf = 0;
    t.active = [];
    t.hatched = 0;
    t.count = 0;
    t.next = t.plate.bands.map(() => 0);
    t.baked.getContext("2d")?.clearRect(0, 0, t.baked.width, t.baked.height);
    setCut(0);
    paint();
  };

  const done = total > 0 && cut >= total;
  const status = done
    ? musicBoxCopy.plate.done
    : cut === 0
      ? musicBoxCopy.plate.idle
      : musicBoxCopy.plate.progress(cut, total);

  return (
    <figure className={s.plateFig}>
      <p className={`t-kicker ${s.kicker}`}>{musicBoxCopy.plate.kicker}</p>
      <div className={s.mark}>
        <div ref={box} className={s.plate} style={{ aspectRatio: "400 / 496" }}>
          <canvas ref={canvas} className={s.canvas} role="img" aria-label={musicBoxCopy.plate.alt} />
          <svg className={s.frame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <ellipse cx="50" cy="50" rx="49.4" ry="49.4" fill="none" stroke="currentColor" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
            <ellipse cx="50" cy="50" rx="48.6" ry="48.6" fill="none" stroke="currentColor" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <figcaption className={s.caption}>
        <span className={`${s.status} ${done ? s.statusDone : ""}`} aria-live="polite">
          {status}
        </span>
        {cut > 0 && (
          <button type="button" className={s.clear} onClick={clear}>
            {musicBoxCopy.plate.clear}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
