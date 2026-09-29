"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { titlePage } from "@/content/copy";
import { PAGES, type ScorePageInfo } from "@/content/pages";
import { HER_NAME } from "@/content/site";
import { countVisit, haptic } from "@/lib/device";
import { useReducedMotion } from "@/lib/hooks";
import { musicBox } from "@/lib/music/audio";
import { compose, type NoteEvent } from "@/lib/music/compose";
import { useScorePlayer, useSound } from "@/lib/music/hooks";
import { BASELINE, LINE, titleGeometry, type TitleGeometry } from "./title/geometry";
import { runIntro, type IntroHandle, type IntroPart } from "./title/intro";
import Staff, { type StaffNodes } from "./title/Staff";
import styles from "./title/title.module.css";

/** Not in copy.ts: the CTA's label while the name is playing. */
const STOP_LABEL = "Stop";
/**
 * "Turn the page, and I'll show you the trick": the cue under the
 * afterword turns to the next page of the score, and is named after it.
 */
const NEXT_PAGE: ScorePageInfo | undefined = PAGES[1];

type Phase = "idle" | "intro" | "pause" | "theme" | "done";

const THEME = compose(HER_NAME, "theme");
const INITIAL = titleGeometry(HER_NAME, THEME);
const NOTE_INDEX = new Map(INITIAL.notes.map((n, i) => [n.id, i]));

/** The breath between spelling the name and playing it (ms). */
const BREATH = 520;
/**
 * A second tap this soon after the name starts (ms) is the same tap
 * twice — a phone's double tap — not a request to stop it.
 */
const SAME_TAP = 400;
/** Air between "on the name" and the name, in ems of the name. */
const NAME_TOP = 0.09;

const subscribeNothing = () => () => {};

/**
 * Inlined into the server-rendered HTML, so it runs before first paint:
 * waits for the three faces the page is set in, then lets the title
 * appear (and the staff draw). Gives up waiting after 1.5s.
 */
const FONT_GATE = `(function(){var s=document.currentScript,el=s&&s.parentNode;if(!el)return;var d=0;function go(){if(d)return;d=1;el.setAttribute("data-fonts","")}setTimeout(go,1500);try{var c=getComputedStyle(document.documentElement),f=document.fonts;Promise.all([f.load("italic 500 1em "+c.getPropertyValue("--font-bodoni")),f.load("italic 400 1em "+c.getPropertyValue("--font-newsreader")),f.load("400 1em "+c.getPropertyValue("--font-dm-mono"))]).then(go,go)}catch(e){go()}})();`;

function waitForFonts(el: HTMLElement): () => void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    el.setAttribute("data-fonts", "");
  };
  const timer = window.setTimeout(go, 1500);
  try {
    const cs = getComputedStyle(document.documentElement);
    const f = document.fonts;
    Promise.all([
      f.load(`italic 500 1em ${cs.getPropertyValue("--font-bodoni")}`),
      f.load(`italic 400 1em ${cs.getPropertyValue("--font-newsreader")}`),
      f.load(`400 1em ${cs.getPropertyValue("--font-dm-mono")}`),
    ]).then(go, go);
  } catch {
    go();
  }
  return () => window.clearTimeout(timer);
}

export default function TitlePage() {
  const [geo, setGeo] = useState<TitleGeometry>(INITIAL);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [heard, setHeard] = useState(false);
  const [strikes, setStrikes] = useState<number[]>(() => INITIAL.notes.map(() => 0));

  const phaseRef = useRef<Phase>("idle");
  const sectionRef = useRef<HTMLElement>(null);
  const letterEls = useRef<(HTMLSpanElement | null)[]>([]);
  const labelEls = useRef<(HTMLSpanElement | null)[]>([]);
  const nodes = useRef<StaffNodes>({ notes: [], heads: [], bars: [] });
  const intro = useRef<IntroHandle | null>(null);
  const breath = useRef<number | undefined>(undefined);
  const run = useRef(0);
  /** when the spelling or the theme last began (performance.now) */
  const startedAt = useRef(-Infinity);

  const { start, stop, activeId } = useScorePlayer();
  const { muted } = useSound();
  const reduced = useReducedMotion();
  const welcome = useSyncExternalStore(subscribeNothing, () => countVisit() > 1, () => false);
  // true only while rendering on the server and hydrating that HTML
  const serverPass = useSyncExternalStore(subscribeNothing, () => false, () => true);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  // ── the full theme, with accompaniment ─────────────────────
  const playTheme = useCallback(() => {
    const id = ++run.current;
    startedAt.current = performance.now();
    setPhase("theme");
    void start(THEME, {
      onNote: (ev: NoteEvent) => {
        if (ev.voice !== "melody" || id !== run.current) return;
        const k = NOTE_INDEX.get(ev.id);
        if (k === undefined) return;
        setStrikes((prev) => prev.map((c, i) => (i === k ? c + 1 : c)));
      },
      onDone: () => {
        if (id !== run.current) return;
        setPhase("done");
        setHeard(true);
      },
    }).then(() => {
      // stopped while the audio was still waking up
      if (id !== run.current && phaseRef.current !== "theme") stop();
    });
  }, [start, stop, setPhase]);

  // ── letter by letter, the name becomes notes ───────────────
  const spell = useCallback(() => {
    run.current++;
    startedAt.current = performance.now();
    setPhase("intro");
    const staff = nodes.current;
    const parts: IntroPart[] = geo.notes.map((n, i) => ({
      letter: letterEls.current[n.glyph] ?? null,
      note: staff.notes[i] ?? null,
      head: staff.heads[i] ?? null,
      label: labelEls.current[i] ?? null,
      bars: geo.bars.flatMap((b, j) => (b.after === i ? [staff.bars[j] ?? null] : [])),
      drop: n.drop,
    }));
    intro.current = runIntro({
      parts,
      reduced,
      onLand: (i, late) => {
        if (late) return;
        musicBox.pluck(geo.notes[i].midi, { velocity: 0.8, voice: "melody" });
        if (!reduced) haptic(6);
      },
      onDone: () => {
        intro.current = null;
        setPhase("pause");
        breath.current = window.setTimeout(playTheme, BREATH);
      },
    });
  }, [geo, reduced, playTheme, setPhase]);

  const halt = useCallback(() => {
    run.current++;
    window.clearTimeout(breath.current);
    intro.current?.cancel();
    intro.current = null;
    stop();
    setPhase("done");
    setHeard(true);
  }, [stop, setPhase]);

  const onPlay = () => {
    // inside the gesture, before anything async (iOS)
    void musicBox.unlock();
    const p = phaseRef.current;
    if (p === "idle") spell();
    else if (p === "done") playTheme();
    else if (performance.now() - startedAt.current >= SAME_TAP) halt();
  };

  // The Coda's "D.C." sends her back here to hear it again.
  useEffect(() => {
    const onReplay = () => {
      const p = phaseRef.current;
      if (p === "idle") spell();
      else if (p === "done" || p === "theme") playTheme();
    };
    window.addEventListener("von:replay", onReplay);
    return () => window.removeEventListener("von:replay", onReplay);
  }, [spell, playTheme]);

  useEffect(() => {
    const running = intro;
    const pause = breath;
    return () => {
      running.current?.cancel();
      window.clearTimeout(pause.current);
    };
  }, []);

  // Arrived by client-side navigation: the inline gate never ran.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || el.hasAttribute("data-fonts")) return;
    return waitForFonts(el);
  }, []);

  // Once the real face is in, measure the letters as rendered and
  // re-seat the notes if the browser's advances differ from the table.
  useEffect(() => {
    let alive = true;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-bodoni");
    document.fonts
      .load(`italic 500 1em ${family}`)
      .then(() => {
        const els = letterEls.current.slice(0, INITIAL.glyphs.length);
        if (!alive || els.length !== INITIAL.glyphs.length || els.some((e) => !e)) return;
        const size = parseFloat(getComputedStyle(els[0]!).fontSize);
        if (!size) return;
        const adv = els.map((e) => e!.getBoundingClientRect().width / size);
        const E = adv.reduce((a, b) => a + b, 0);
        if (Math.abs(E - INITIAL.E) > INITIAL.E * 0.0015) setGeo(titleGeometry(HER_NAME, THEME, adv));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const active = activeId ? (NOTE_INDEX.get(activeId) ?? -1) : -1;
  const activeGlyph = active >= 0 ? geo.notes[active]?.glyph : -1;
  const mode = phase === "idle" ? "play" : phase === "done" ? "again" : "stop";
  const showMuted = muted && phase !== "idle";
  const off = (hidden: boolean) => (hidden ? true : undefined);

  // vertical extent of the name and its staff, in ems of the fitted size
  const tall = LINE + NAME_TOP + geo.height / 100 + (BASELINE - LINE);
  const columnVars = { "--k": geo.K.toFixed(4), "--tall": tall.toFixed(4) } as CSSProperties;

  return (
    <section id="top" ref={sectionRef} className={styles.page} suppressHydrationWarning>
      {serverPass && <script dangerouslySetInnerHTML={{ __html: FONT_GATE }} />}
      <div className={`${styles.gated} ${styles.column}`} style={columnVars}>
        <div className={styles.spacer} data-w="1" />

        <div className={styles.head}>
          <p className={`t-caption ${styles.welcome}`} data-show={welcome || undefined} aria-hidden={!welcome}>
            {titlePage.welcomeBack}
          </p>
        </div>

        <h1 className={styles.heading}>
          <span className="t-kicker">{titlePage.eyebrow}</span>{" "}
          <span className={styles.hairline} aria-hidden="true" />
          <span className={styles.on}>{titlePage.on}</span>{" "}
          <span className="sr-only">{HER_NAME}</span>
          <span className={styles.fit} aria-hidden="true">
            <span className={`t-title ${styles.name}`} style={{ marginTop: `${NAME_TOP}em` }}>
              {geo.glyphs.map((g, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    letterEls.current[i] = el;
                  }}
                  className={`${styles.letter} ${i === activeGlyph ? styles.sounding : ""}`}
                >
                  {g.ch === " " ? "\u00a0" : g.ch}
                </span>
              ))}
            </span>
          </span>
        </h1>

        <div className={styles.fit}>
          <div className={styles.staff} style={{ marginTop: `${(BASELINE - LINE).toFixed(3)}em` }}>
            <Staff geo={geo} active={active} strikes={strikes} nodes={nodes} />
            <div className={styles.labels} aria-hidden="true">
              {geo.notes.map((n, i) => (
                <span
                  key={n.id}
                  ref={(el) => {
                    labelEls.current[i] = el;
                  }}
                  className={`${styles.label} ${i === active ? styles.sounding : ""}`}
                  style={{ left: `${((n.x / geo.width) * 100).toFixed(3)}%` }}
                >
                  {n.name}
                </span>
              ))}
            </div>
            <p className={styles.row}>
              <span className={`t-caption ${styles.scoring}`}>{titlePage.scoring}</span>
              <span className={`t-mark ${styles.opus}`}>{titlePage.opus}</span>
            </p>
          </div>
        </div>

        <div className={styles.spacer} data-w="2" />

        {/* one column; on a phone turned on its side, the credits sit
            beside the button */}
        <div className={styles.foot}>
          <p className={styles.credits}>
            {titlePage.credits.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>

          <div className={styles.spacer} data-w="3" />

          <button type="button" className={`btn-play ${styles.cta}`} onClick={onPlay}>
            <span className="disc" aria-hidden="true">
              <span className={styles.stack}>
                <svg className={styles.discIcon} data-off={off(mode === "stop")} width="14" height="14" viewBox="0 0 14 14">
                  <path d="M4 2.2v9.6L11.6 7z" fill="currentColor" />
                </svg>
                <svg className={styles.discIcon} data-off={off(mode !== "stop")} width="14" height="14" viewBox="0 0 14 14">
                  <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="0.6" fill="currentColor" />
                </svg>
              </span>
            </span>
            <span className={`${styles.stack} ${styles.ctaLabel}`}>
              <span data-off={off(mode !== "play")}>{titlePage.play}</span>
              <span data-off={off(mode !== "stop")}>{STOP_LABEL}</span>
              <span data-off={off(mode !== "again")}>{titlePage.again}</span>
            </span>
          </button>

          <p className={`t-caption ${styles.hint} ${styles.stack}`} aria-live="polite">
            <span data-off={off(phase !== "idle")}>{titlePage.soundHint}</span>
            <span data-off={off(!showMuted)}>{titlePage.mutedNote}</span>
          </p>
        </div>

        <div className={styles.spacer} data-w="4" />

        <div className={styles.after} data-show={heard || undefined}>
          <p className={styles.afterLead}>{titlePage.after[0]}</p>
          <p className={styles.afterLine}>{titlePage.after[1]}</p>
          {NEXT_PAGE && (
            <Link
              href={NEXT_PAGE.slug}
              transitionTypes={["nav-forward"]}
              className={styles.cue}
              tabIndex={heard ? undefined : -1}
            >
              <span className="t-kicker">{NEXT_PAGE.title}</span>
              <svg className={styles.cueArrow} width="34" height="9" viewBox="0 0 34 9" aria-hidden="true">
                <path className={styles.cueShaft} d="M0.5 4.5H32.5" pathLength={1} />
                <path className={styles.cueHead} d="M28.5 1L32.5 4.5L28.5 8" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
