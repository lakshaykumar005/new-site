"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/device";
import { drawMicro, type Micro } from "./micrograph";
import styles from "./frontispiece.module.css";

interface GlassProps {
  micro: Micro | null;
  family: string;
  /** the portrait's size in CSS px */
  W: number;
  H: number;
  /** where the glass starts, as fractions of the portrait */
  start: { u: number; v: number };
  label: string;
}

/** Legible text under the lens, whatever the portrait's print size. */
const LENS_TEXT_PX = 10.5;

/**
 * A reading glass lying on the plate. Drag it (by the handle on a
 * phone, so a finger doesn't cover the lens), or focus it and use the
 * arrow keys. The lens re-prints the words beneath it at magnification,
 * so they stay crisp instead of being a blown-up picture.
 */
export default function Glass({ micro, family, W, H, start, label }: GlassProps) {
  const lens = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState(start);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const D = W < 380 ? 136 : W < 440 ? 150 : 188;
  const R = D / 2;
  const M = micro ? Math.max(2.6, LENS_TEXT_PX / micro.size) : 4;
  // the handle swings to whichever side keeps it on the page
  const handleLeft = pos.u > 0.5;

  useEffect(() => {
    const cv = lens.current;
    if (!cv || !micro) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(D * dpr);
    if (cv.width !== px) {
      cv.width = px;
      cv.height = px;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f7f2e8";
    ctx.fillRect(0, 0, D, D);
    const cx = pos.u * W;
    const cy = pos.v * H;
    const r = D / 2 / M;
    ctx.save();
    ctx.translate(D / 2, D / 2);
    ctx.scale(M, M);
    ctx.translate(-cx, -cy);
    drawMicro(ctx, micro, { family, window: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, legible: true });
    ctx.restore();
  }, [micro, pos, W, H, D, M, family]);

  // the lens may overhang the oval's edge a little, never leave it: it
  // should always have words under it, never bare paper
  const clamp = (u: number, v: number) => {
    const ax = Math.max(0.05, 0.485 - (0.45 * R) / W);
    const ay = Math.max(0.05, 0.485 - (0.45 * R) / H);
    const du = u - 0.5;
    const dv = v - 0.5;
    const d = Math.hypot(du / ax, dv / ay);
    return d <= 1 ? { u, v } : { u: 0.5 + du / d, v: 0.5 + dv / d };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const plate = root.current?.parentElement;
    if (!plate) return;
    const rect = plate.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      dx: e.clientX - (rect.left + pos.u * W),
      dy: e.clientY - (rect.top + pos.v * H),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    haptic(5);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const plate = root.current?.parentElement;
    if (!plate) return;
    const rect = plate.getBoundingClientRect();
    setPos(clamp((e.clientX - d.dx - rect.left) / W, (e.clientY - d.dy - rect.top) / H));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.06 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setPos((p) => clamp(p.u + m[0], p.v + m[1]));
  };

  const handleLen = D * 0.62;
  const handleW = D * 0.13;

  return (
    <div
      ref={root}
      className={styles.glass}
      style={{ left: pos.u * W - R, top: pos.v * H - R, width: D, height: D }}
      data-noswipe
    >
      {/* the handle, under the ring */}
      <svg
        className={styles.handle}
        width={D * 2}
        height={D * 2}
        viewBox={`${-D} ${-D} ${D * 2} ${D * 2}`}
        style={{ left: R - D, top: R - D, transform: `rotate(${handleLeft ? 90 : 0}deg)` }}
        aria-hidden
      >
        <g transform="rotate(45)">
          <rect x={R + 2} y={-handleW * 0.42} width={D * 0.1} height={handleW * 0.84} rx={2} fill="#c9bfae" stroke="var(--color-ink)" strokeWidth={1.1} />
          <rect
            x={R + D * 0.1}
            y={-handleW / 2}
            width={handleLen}
            height={handleW}
            rx={handleW / 2}
            fill="var(--color-ink)"
            className={styles.grip}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={i}
              x1={R + D * 0.16 + i * (handleLen * 0.12)}
              x2={R + D * 0.16 + i * (handleLen * 0.12)}
              y1={-handleW * 0.32}
              y2={handleW * 0.32}
              stroke="var(--color-paper)"
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
        </g>
      </svg>

      <div
        className={styles.lens}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={lens} className={styles.lensCanvas} style={{ width: D, height: D }} />
        <svg className={styles.ring} viewBox={`0 0 ${D} ${D}`} aria-hidden>
          <circle cx={R} cy={R} r={R - 1.8} fill="none" stroke="var(--color-ink)" strokeWidth={3.6} />
          <circle cx={R} cy={R} r={R - 5.2} fill="none" stroke="var(--color-ink)" strokeOpacity={0.35} strokeWidth={0.8} />
          <path
            d={`M ${R + (R - 12) * Math.cos(3.55)} ${R + (R - 12) * Math.sin(3.55)} A ${R - 12} ${R - 12} 0 0 1 ${R + (R - 12) * Math.cos(4.2)} ${R + (R - 12) * Math.sin(4.2)}`}
            fill="none"
            stroke="#fffdf8"
            strokeOpacity={0.85}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
