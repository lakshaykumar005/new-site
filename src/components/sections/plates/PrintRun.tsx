"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { platesCopy } from "@/content/copy";
import type { Plate, PlatePhoto } from "@/content/photos";
import { useInView, useMediaQuery, useReducedMotion } from "@/lib/hooks";
import Hairpin from "./Hairpin";
import { aspectOf, gripOf, growOf, kindOf, plateNumber, restOf, sideOf, uprightHeight, type PlateKind } from "./layout";
import { bloom, restTransform, runPress, type PressRun } from "./press";
import Roller, { rollerSize } from "./Roller";
import s from "./plates.module.css";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * blank     the empty plate, waiting
 * printing  the roller, the sheet, the pull
 * printed   the print lies on its plate
 * clearing  the print is lifted away before another impression
 */
type Phase = "blank" | "printing" | "printed" | "clearing";

/** the pair stands side by side from here (keep in step with plates.module.css) */
const SIDE_BY_SIDE = "(min-width: 640px)";
/** the empty plate runs when this much of it is on the page */
const RUN_AT = 0.35;
/** how long to wait for a photograph before printing it regardless */
const DECODE_WAIT_MS = 900;
const CLEAR_MS = 240;
const REST_MS = 220;

/** One photograph on the sheet: the ink, with its colour waiting above it. */
function Frame({ photo, onSheet }: { photo: PlatePhoto; onSheet: boolean }) {
  return (
    <span className={s.frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a plate is printed at its own size, never larger */}
      <img
        src={photo.duo}
        alt={onSheet ? photo.alt : ""}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {onSheet && (
        <span className={s.tint} data-tint="">
          {/* eslint-disable-next-line @next/next/no-img-element -- the same photograph, in colour */}
          <img
            src={photo.src}
            alt=""
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </span>
      )}
    </span>
  );
}

/**
 * What is printed: the photograph, or the pair with their labels and
 * the hairpin between them. Laid out once on the sheet and once more,
 * in reverse, as the plate that printed it.
 */
function Impression({ plate, kind, onSheet }: { plate: Plate; kind: PlateKind; onSheet: boolean }) {
  if (kind !== "pair") return <Frame photo={plate.photos[0]} onSheet={onSheet} />;
  return (
    <>
      <span className={s.pairRow}>
        {plate.photos.map((photo, i) => (
          <span
            key={photo.src}
            className={s.pairItem}
            style={{ "--px": `${photo.width}px`, "--grow": growOf(photo, i).toFixed(4) } as Vars}
          >
            <Frame photo={photo} onSheet={onSheet} />
            {photo.label ? <span className={s.label}>{photo.label}</span> : null}
          </span>
        ))}
      </span>
      <Hairpin />
    </>
  );
}

/**
 * A print run. The plate mark waits empty on the page with its number;
 * as it comes into view the roller inks it, a sheet is laid on it and
 * pulled off from one corner, and the print is left lying on the plate,
 * a little askew, to dry. Touch the print and colour blooms in from the
 * finger, the way prints were once tinted by hand; touch again and it
 * returns to ink. "Print again" pulls another impression.
 */
export default function PrintRun({ plate, index }: { plate: Plate; index: number }) {
  const reduced = useReducedMotion();
  const sideBySide = useMediaQuery(SIDE_BY_SIDE);

  const figure = useRef<HTMLElement>(null);
  const bed = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLButtonElement>(null);
  const print = useRef<HTMLSpanElement>(null);
  const cover = useRef<HTMLSpanElement>(null);
  const curl = useRef<HTMLSpanElement>(null);
  const edge = useRef<HTMLSpanElement>(null);
  const roller = useRef<SVGSVGElement>(null);

  const [phase, setPhase] = useState<Phase>("blank");
  const [impressions, setImpressions] = useState(0);
  const [tinted, setTinted] = useState(false);
  const [bedSize, setBedSize] = useState({ w: 0, h: 0 });

  const run = useRef<PressRun | null>(null);
  const timers = useRef<number[]>([]);
  const blooms = useRef<Animation[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const kind = kindOf(plate);
  const side = sideOf(index);
  const grip = gripOf(kind, side, sideBySide);
  const rest = restOf(index, grip);
  const number = plateNumber(index + 1);
  const seen = useInView(figure, { once: true, threshold: RUN_AT, rootMargin: "0px 0px -6% 0px" });

  // the roller is drawn for the plate's exact size
  useLayoutEffect(() => {
    const el = bed.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setBedSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  // ── the run ──
  const print_ = useCallback(async () => {
    const sheetEl = sheet.current;
    const coverEl = cover.current;
    const curlEl = curl.current;
    const edgeEl = edge.current;
    const bedEl = bed.current;
    if (!sheetEl || !coverEl || !curlEl || !edgeEl || !bedEl) return;
    setPhase("printing");
    // let the photograph arrive before it is printed (but not for ever)
    const img = print.current?.querySelector("img");
    if (img && !img.complete) {
      await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, DECODE_WAIT_MS))]);
    }
    if (reduced) {
      setPhase("printed");
      setImpressions((n) => n + 1);
      return;
    }
    const bedW = bedEl.clientWidth;
    run.current?.cancel();
    run.current = runPress(
      { roller: roller.current, ink: ink.current, label: label.current, sheet: sheetEl, cover: coverEl, curl: curlEl, edge: edgeEl },
      { bedW, rollerW: rollerSize(bedW).d, grip, rest }
    );
    const ok = await run.current.done;
    if (!ok) return;
    setPhase("printed");
    setImpressions((n) => n + 1);
  }, [reduced, grip, rest]);

  // once it scrolls into view, the plate is printed
  const started = useRef(false);
  useEffect(() => {
    if (!seen || started.current) return;
    started.current = true;
    void print_();
  }, [seen, print_]);

  // the finished run's animations are held by the stylesheet from here on
  useLayoutEffect(() => {
    if (phase !== "printed") return;
    run.current?.cancel();
    run.current = null;
  }, [phase]);

  useEffect(
    () => () => {
      run.current?.cancel();
      for (const t of timers.current) window.clearTimeout(t);
      for (const a of blooms.current) a.cancel();
    },
    []
  );

  // ── hand-tinting ──
  const tintOn = useCallback(
    (origin: { x: number; y: number } | null) => {
      const el = print.current;
      if (!el) return;
      setTinted(true);
      for (const a of blooms.current) a.cancel();
      blooms.current = [];
      if (reduced) return;
      const r = el.getBoundingClientRect();
      blooms.current = bloom(el, origin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [reduced]
  );

  const tintOff = useCallback(() => setTinted(false), []);

  // Moving on — scrolling the print out of sight — returns it to ink,
  // so the page is always found at rest, as printed.
  useEffect(() => {
    if (!tinted) return;
    const el = figure.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setTinted(false);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [tinted]);

  const ready = phase === "printed";

  // Only a real mouse hovers; a finger's tap is a click, and toggles.
  const onEnter = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && ready && !tinted) tintOn({ x: e.clientX, y: e.clientY });
  };
  const onLeave = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") tintOff();
  };
  const onDown = (e: ReactPointerEvent) => {
    lastPoint.current = { x: e.clientX, y: e.clientY };
  };
  const onClick = (e: ReactMouseEvent) => {
    if (!ready) return;
    if (tinted) tintOff();
    else tintOn(e.detail === 0 ? null : lastPoint.current);
  };

  // ── another impression ──
  const printAgain = () => {
    if (!ready) return;
    setTinted(false);
    setPhase("clearing");
    later(() => {
      setPhase("blank");
      later(() => void print_(), REST_MS);
    }, CLEAR_MS);
  };

  const first = plate.photos[0];
  if (!first) return null;

  const vars: Vars = {
    "--rest": restTransform(rest),
    ...(kind === "pair"
      ? { "--grow-max": Math.max(...plate.photos.map(growOf)).toFixed(4) }
      : { "--px": `${first.width}px`, "--ar": aspectOf(first).toFixed(4), "--hd": `${uprightHeight(index)}px` }),
  };

  const state =
    phase === "printed" ? platesCopy.impression(impressions) : phase === "blank" ? platesCopy.unprinted : platesCopy.printing;
  // told once, as each print is pulled
  const announce = phase === "printed" && impressions > 0 ? platesCopy.printed(index + 1, plate.mark) : "";

  return (
    <figure
      ref={figure}
      className={`${s.run} ${s[kind]} ${s[side]} ${s[phase]} ${reduced ? s.still : ""}`}
      style={vars}
    >
      <div className={s.press}>
        <span className={s.ticks} aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <div ref={bed} className={s.bed}>
          {/* the plate itself: the image cut into it in reverse */}
          <div ref={ink} className={s.plateInk} aria-hidden>
            <span className={s.mirror}>
              <Impression plate={plate} kind={kind} onSheet={false} />
            </span>
          </div>
          <span ref={label} className={s.plateNo} aria-hidden>
            Pl. {number}
          </span>

          {/* the sheet: the print, and the colour waiting under a touch */}
          <button
            ref={sheet}
            type="button"
            className={s.sheet}
            aria-pressed={tinted}
            aria-label={`${plate.photos.map((p) => p.alt).join("; ")} (${platesCopy.showColour})`}
            tabIndex={ready ? 0 : -1}
            onClick={onClick}
            onPointerDown={onDown}
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
          >
            <span ref={print} className={s.print}>
              <Impression plate={plate} kind={kind} onSheet />
            </span>
            <span ref={cover} className={s.cover} aria-hidden />
            <span ref={curl} className={s.curl} aria-hidden />
            <span ref={edge} className={s.curlEdge} aria-hidden />
          </button>

          {bedSize.h > 0 && !reduced && <Roller ref={roller} size={rollerSize(bedSize.w)} bedH={bedSize.h} />}
        </div>
      </div>

      <figcaption className={`reveal ${s.colophon}`}>
        <p className={s.no}>
          <abbr title={platesCopy.plateWord}>Pl.</abbr> {number}
        </p>
        <p className={s.mark} lang="it">
          {plate.mark}
        </p>
        <p className={s.gloss}>{plate.gloss}</p>
        <p className={s.line}>{plate.line}</p>
        <div className={s.state}>
          <p className={s.impression}>{state}</p>
          <button
            type="button"
            className={`btn-quiet ${s.again}`}
            aria-disabled={!ready}
            aria-label={platesCopy.printAgainLabel(plate.mark)}
            onClick={printAgain}
          >
            {platesCopy.printAgain}
          </button>
        </div>
      </figcaption>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </figure>
  );
}
