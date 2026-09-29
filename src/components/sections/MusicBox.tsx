"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { musicBoxCopy } from "@/content/copy";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";
import Drawing from "./music-box/Drawing";
import { armAudio, BoxEngine, type EngineEls } from "./music-box/engine";
import PortraitPlate, { type PlateHandle } from "./music-box/PortraitPlate";
import { figureHeight, GRIP, layout, type Geo } from "./music-box/geometry";
import { MODEL } from "./music-box/model";
import s from "./music-box/MusicBox.module.css";

/** The figure's accessible name (not in copy.ts: it only exists for screen readers). */
const FIGURE_LABEL = "The music box. Left and right arrow keys turn the handle; Space lets it play.";

/**
 * The wide plate needs 768px, and the height to be seen whole (a phone on
 * its side gets the compact plate) — or a mouse. The same query sets the
 * plate's height in MusicBox.module.css; keep the two in step.
 */
const WIDE_QUERY = "(min-width: 768px) and (min-height: 560px), (min-width: 768px) and (pointer: fine)";
/** Where the page's gutter widens (globals.css), which the compact plate lines up with. */
const WIDE_GUTTER_QUERY = "(min-width: 768px)";

const H_COMPACT = figureHeight("compact", MODEL);
const H_COMPACT_FINE = figureHeight("compact", MODEL, true);
const H_WIDE = figureHeight("wide", MODEL);
const TEETH = MODEL.rows.length;
const MILESTONES = [16, 8, 4, 2];
/** Things that count as a tap, for arming the audio early. */
const ACTIVATIONS = ["pointerup", "touchend", "click", "keydown"] as const;

/** "Handle. Clockwise…" → ["Handle.", " Clockwise…"] — the part's name, then what it does. */
function splitPart(text: string): [string, string] {
  const m = /^[^.,]+[.,]/.exec(text);
  return m ? [m[0], text.slice(m[0].length)] : ["", text];
}

function collect(root: HTMLElement, geo: Geo): EngineEls {
  const one = <T extends Element>(k: string) => root.querySelector<T>(`[data-mb="${k}"]`);
  const holes: (SVGElement | undefined)[][] = Array.from({ length: geo.tape.copies }, () => []);
  root.querySelectorAll<SVGElement>("[data-hole]").forEach((el) => {
    const c = Number(el.dataset.c);
    const i = Number(el.dataset.i);
    if (holes[c]) holes[c][i] = el;
  });
  const teeth: (SVGElement | undefined)[] = [];
  root.querySelectorAll<SVGElement>("[data-tooth]").forEach((el) => {
    teeth[Number(el.dataset.row)] = el;
  });
  const inks: (SVGElement | undefined)[] = [];
  root.querySelectorAll<SVGElement>("[data-ink]").forEach((el) => {
    inks[Number(el.dataset.row)] = el;
  });
  const strikes: EngineEls["strikes"] = [];
  root.querySelectorAll<SVGElement>("[data-strike]").forEach((el) => {
    strikes[Number(el.dataset.strike)] = {
      disc: el.querySelector<SVGElement>('[data-part="disc"]'),
      ring: el.querySelector<SVGElement>('[data-part="ring"]'),
    };
  });
  const letters: (HTMLElement | undefined)[] = [];
  root.querySelectorAll<HTMLElement>("[data-letter]").forEach((el) => {
    letters[Number(el.dataset.letter)] = el;
  });
  return {
    tape: one<SVGSVGElement>("tape"),
    wheel: one<SVGSVGElement>("wheel"),
    arm: one<SVGSVGElement>("arm"),
    pinion: one<SVGSVGElement>("pinion"),
    knob: one<SVGSVGElement>("knob"),
    crank: one<HTMLDivElement>("crank"),
    holes,
    teeth,
    inks,
    strikes,
    letters,
  };
}

function PlayGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <path d="M3.2 1.6v8.8L10.4 6z" fill="currentColor" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <rect x="2.4" y="2.4" width="7.2" height="7.2" fill="currentColor" />
    </svg>
  );
}

/** How often each row of the strip sounds in one pass of the song. */
const HOLES_PER_ROW = MODEL.rows.map((_, r) => MODEL.holes.filter((h) => h.row === r).length);

export default function MusicBox() {
  const wide = useMediaQuery(WIDE_QUERY);
  const wideGutter = useMediaQuery(WIDE_GUTTER_QUERY);
  const coarse = useMediaQuery("(pointer: coarse)");
  const reduced = useReducedMotion();

  const figRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BoxEngine | null>(null);
  const plateRef = useRef<PlateHandle>(null);
  const [width, setWidth] = useState(0);
  const [auto, setAuto] = useState(false);
  const [passes, setPasses] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  // one flywheel for the life of the section
  useLayoutEffect(() => {
    const engine = new BoxEngine(MODEL, {
      onAuto: setAuto,
      onPasses: setPasses,
      onGrab: setGrabbing,
      // every note cuts the next lines of her portrait into the plate above
      onStrike: (h) => plateRef.current?.strike(h.row),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  // the drawing is laid out for the exact width it has
  useLayoutEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(
    () =>
      width > 0
        ? layout(width, wide ? "wide" : "compact", MODEL, !coarse, !wide && wideGutter ? 48 : undefined)
        : null,
    [width, wide, wideGutter, coarse]
  );

  useLayoutEffect(() => {
    const engine = engineRef.current;
    const root = figRef.current;
    if (!engine || !root || !geo) return;
    engine.bind(geo, collect(root, geo));
  }, [geo]);

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    // A touch counts as a gesture only as it lifts, so a handle grabbed
    // before anything else on the page would turn its first turn in
    // silence. While the box is in view, any earlier tap — "Let it play",
    // the paper, the page — arms the audio before she reaches for it.
    // And coming back to the page (the audio is put to sleep while it's
    // hidden, and doesn't wake by itself), it picks up where it left off.
    let listening = false;
    const onVisible = () => {
      if (document.visibilityState === "visible") armAudio();
    };
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      for (const type of ACTIVATIONS) {
        if (on) document.addEventListener(type, armAudio, { capture: true, passive: true });
        else document.removeEventListener(type, armAudio, { capture: true });
      }
      if (on) document.addEventListener("visibilitychange", onVisible);
      else document.removeEventListener("visibilitychange", onVisible);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      listen(entry.isIntersecting);
      // scrolled away while it plays: let it wind down on its own
      if (!entry.isIntersecting) engineRef.current?.setAuto(false);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      listen(false);
    };
  }, []);

  const grab = useCallback((e: ReactPointerEvent<HTMLDivElement>, kind: "crank" | "strip") => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    const ok = kind === "crank" ? engine.startCrank(e.nativeEvent) : engine.startStrip(e.nativeEvent);
    if (!ok) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    // (the press itself focuses the figure, without a focus ring, so the keys work next;
    // `grabbing` follows the engine, which takes hold of the paper only once it's pulled)
  }, []);

  const onCrankDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => grab(e, "crank"), [grab]);
  const onStripDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => grab(e, "strip"), [grab]);
  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => engineRef.current?.move(e.nativeEvent), []);
  const onUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => engineRef.current?.end(e.nativeEvent), []);
  const onCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => engineRef.current?.end(e.nativeEvent, true),
    []
  );

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      engine.nudge(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      engine.nudge(-1);
    } else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (!e.repeat) engine.toggleAuto();
    }
  }, []);

  const onToggle = useCallback(() => engineRef.current?.toggleAuto(), []);

  const reached = MILESTONES.find((n) => passes >= n);
  const key = [musicBoxCopy.callouts.handle, musicBoxCopy.callouts.comb(TEETH), musicBoxCopy.callouts.strip];

  const heights = {
    "--mb-h-compact": `${H_COMPACT}px`,
    "--mb-h-compact-fine": `${H_COMPACT_FINE}px`,
    "--mb-h-wide": `${H_WIDE}px`,
  } as CSSProperties;

  return (
    <section id="music-box" className="section" aria-labelledby="music-box-title">
      <div className={`wrap ${s.stage}`}>
        <div className={s.stageHead}>
          <p className="t-kicker reveal">{musicBoxCopy.kicker}</p>
          <h2 id="music-box-title" className="t-display reveal mt-4">
            {musicBoxCopy.title}
          </h2>
          <p className="t-lede measure reveal mt-5">{musicBoxCopy.lede}</p>
        </div>

        <div className={s.figureWrap} style={heights}>
          {/* (data-noswipe: pulling the paper sideways must never turn the page) */}
          <div
            ref={figRef}
            className={`${s.figure} ${grabbing ? s.grabbing : ""}`}
            tabIndex={0}
            role="application"
            aria-roledescription="music box"
            aria-label={FIGURE_LABEL}
            data-noswipe=""
            onKeyDown={onKeyDown}
          >
            {geo && (
              <>
                <Drawing geo={geo} model={MODEL} />
                <div
                  data-mb="strip-hit"
                  className={s.hitStrip}
                  style={{
                    left: geo.strip.x0,
                    top: geo.strip.y0,
                    width: geo.strip.x1 - geo.strip.x0,
                    height: geo.strip.y1 - geo.strip.y0,
                  }}
                  onPointerDown={onStripDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onCancel}
                  onLostPointerCapture={onUp}
                />
                <div
                  data-mb="crank"
                  className={s.hitCrank}
                  style={{
                    left: geo.wheel.c.x - geo.wheel.outer - GRIP,
                    top: geo.wheel.c.y - geo.wheel.outer - GRIP,
                    width: (geo.wheel.outer + GRIP) * 2,
                    height: (geo.wheel.outer + GRIP) * 2,
                  }}
                  onPointerDown={onCrankDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onCancel}
                  onLostPointerCapture={onUp}
                />
              </>
            )}
          </div>

          {geo && (
            <div className={s.controls} style={{ left: geo.controls.x, top: geo.controls.y, width: geo.controls.w }}>
              <button type="button" className="btn-play" onClick={onToggle}>
                <span className={`disc ${s.disc}`} aria-hidden>
                  {auto ? <StopGlyph /> : <PlayGlyph />}
                </span>
                {auto ? musicBoxCopy.stop : musicBoxCopy.letItPlay}
              </button>
              {/* how to play it — until she has; then, how many times she has */}
              <div className={s.note} aria-live="polite">
                {reached ? (
                  <p key={reached} className={s.countLine}>
                    {musicBoxCopy.playCounts[reached]}
                  </p>
                ) : (
                  <p className={`t-caption ${s.hint}`}>{coarse ? musicBoxCopy.hintTouch : musicBoxCopy.hintPointer}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fig. 2a: beside the box on a wide screen (and pinned in view),
            straight under it on a phone — wherever she can watch it while she plays */}
        <div className={`${s.stagePlate} reveal`}>
          <PortraitPlate ref={plateRef} rows={MODEL.rows.length} holesPerRow={HOLES_PER_ROW} />
        </div>

        <ol className={`${s.key} ${s.stageKey}`}>
          {key.map((text, i) => {
            const [part, rest] = splitPart(text);
            return (
              <li key={i} className={s.keyItem}>
                <span className={s.keyNum} aria-hidden>
                  {i + 1}
                </span>
                <span>
                  <span className={s.keyPart}>{part}</span>
                  {rest}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
