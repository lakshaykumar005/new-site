"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Plate as PlateData, PlatePhoto } from "@/content/photos";
import Hairpin from "./Hairpin";
import { aspectOf, growOf, kindOf, plateNumber, sideOf, uprightHeight } from "./layout";
import s from "./plates.module.css";

// Strings this section needs that copy.ts doesn't carry.
/** Appended to each plate's accessible name: what pressing it does. */
const TOGGLE_HINT = "show in colour";
/** What the "Pl." abbreviation stands for. */
const PLATE_WORD = "Plate";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** One photograph: the ink print, with its colour waiting above it. */
function Print({ photo }: { photo: PlatePhoto }) {
  return (
    <span className={s.frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a plate is printed at its own size, never larger */}
      <img
        src={photo.duo}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <span className={s.tint}>
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
    </span>
  );
}

/**
 * A plate: her photograph printed in ink, numbered and captioned.
 * Touch it (or hover, with a mouse) and the colour fades back in;
 * touch again, or move on, and it returns to ink.
 */
export default function Plate({ plate, index }: { plate: PlateData; index: number }) {
  const [tinted, setTinted] = useState(false);
  const figure = useRef<HTMLElement>(null);

  // Moving on — scrolling the plate out of sight — returns it to ink,
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

  // Only a real mouse hovers; a finger's tap is a click, and toggles.
  const hover = (on: boolean) => (e: PointerEvent) => {
    if (e.pointerType === "mouse") setTinted(on);
  };

  const first = plate.photos[0];
  if (!first) return null;
  const kind = kindOf(plate);
  const side = sideOf(index);
  const vars: Vars =
    kind === "pair"
      ? { "--grow-max": Math.max(...plate.photos.map(growOf)).toFixed(4) }
      : {
          "--px": `${first.width}px`,
          "--ar": aspectOf(first).toFixed(4),
          "--hd": `${uprightHeight(index)}px`,
        };

  return (
    <figure ref={figure} className={`reveal ${s.plate} ${s[kind]} ${s[side]}`} style={vars}>
      <button
        type="button"
        className={s.print}
        aria-pressed={tinted}
        aria-label={`${plate.photos.map((p) => p.alt).join("; ")} (${TOGGLE_HINT})`}
        onClick={() => setTinted((v) => !v)}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        {kind === "pair" ? (
          <>
            <span className={s.pairRow}>
              {plate.photos.map((photo, i) => (
                <span
                  key={photo.src}
                  className={s.pairItem}
                  style={{ "--px": `${photo.width}px`, "--grow": growOf(photo, i).toFixed(4) } as Vars}
                >
                  <Print photo={photo} />
                  {photo.label ? <span className={s.label}>{photo.label}</span> : null}
                </span>
              ))}
            </span>
            <Hairpin />
          </>
        ) : (
          <Print photo={first} />
        )}
      </button>

      <figcaption className={s.caption}>
        <p className={s.no}>
          <abbr title={PLATE_WORD}>Pl.</abbr> {plateNumber(index + 1)}
        </p>
        <p className={s.mark} lang="it">
          {plate.mark}
        </p>
        <p className={s.gloss}>{plate.gloss}</p>
        <p className={s.line}>{plate.line}</p>
      </figcaption>
    </figure>
  );
}
