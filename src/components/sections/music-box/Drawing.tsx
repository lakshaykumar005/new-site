"use client";

import { memo, useId } from "react";
import { armLocalDeg } from "./engine";
import {
  arcPath,
  armPath,
  circlePath,
  fmt,
  gearPath,
  hatchPath,
  leaderPath,
  leaderStart,
  polyPath,
  rotationArrow,
  spokePath,
} from "./draw";
import type { Geo, Pt } from "./geometry";
import type { BoxModel } from "./model";
import s from "./MusicBox.module.css";

/**
 * The patent drawing, in layers so the moving parts can be composited
 * on their own (bottom to top):
 *
 *   base      bed plate, the paper's shadow
 *   pinion    the small gear under the paper's edge (rotates)
 *   paper     the strip; its punched tape slides inside (translates)
 *   front     comb, strip edges, the printed index of note names, and
 *             the vermillion marks struck at the tips
 *   wheel     the toothed hand-wheel: rim, spokes, hub (rotates)
 *   shading   the wheel's shade lines, fixed to the light (upper left)
 *   arm       the crank arm and the hub's cap (rotates with the wheel)
 *   knob      the handle's grip, shaded from a fixed light (translates);
 *             its ring shows when the figure has keyboard focus
 *   notes     centre lines, the turning arrow, reference numerals
 */

const deg = (d: number) => (d * Math.PI) / 180;

function Numeral({ n, x, y, to, bow, r }: { n: number; x: number; y: number; to: Pt; bow: number; r: number }) {
  const from = leaderStart({ x, y }, to, r + 1.5, bow);
  return (
    <g>
      <path d={leaderPath(from, to, bow * 0.9)} className={s.leader} />
      <circle cx={to.x} cy={to.y} r={1.25} className={s.leaderDot} />
      <circle cx={x} cy={y} r={r} className={s.numeralRing} />
      <text x={x} y={y} dy="0.34em" textAnchor="middle" className={s.numeralText} style={{ fontSize: r * 1.3 }}>
        {n}
      </text>
    </g>
  );
}

function Screw({ x, y, r, a }: { x: number; y: number; r: number; a: number }) {
  const dx = Math.cos(deg(a)) * r * 0.72;
  const dy = Math.sin(deg(a)) * r * 0.72;
  return (
    <g>
      <circle cx={x} cy={y} r={r} className={s.partFill} />
      <circle cx={x} cy={y} r={r} className={s.line} style={{ strokeWidth: 0.75 }} />
      <path
        d={`M${fmt(x - dx)} ${fmt(y - dy)}L${fmt(x + dx)} ${fmt(y + dy)}`}
        className={s.line}
        style={{ strokeWidth: 1.15, strokeLinecap: "butt" }}
      />
    </g>
  );
}

function Drawing({ geo, model }: { geo: Geo; model: BoxModel }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (k: string) => `mb${uid}${k}`;
  const wide = geo.mode === "wide";
  const { strip, comb, wheel, pinion, bed } = geo;
  const S0 = strip.y0;
  const S1 = strip.y1;
  const stripH = S1 - S0;
  const hair = wide ? 0.6 : 0.55;
  const line = wide ? 0.95 : 0.85;

  // ── the paper ──────────────────────────────────────────
  const paperD = polyPath(geo.paper);
  const clipPoly = `polygon(${geo.paper.map((p) => `${fmt(p.x - strip.x0)}px ${fmt(p.y - S0)}px`).join(",")})`;
  const topEdge = geo.breaks
    ? [geo.paper[geo.paper.length - 1], geo.paper[0]]
    : [
        { x: strip.x0, y: S0 },
        { x: strip.x1, y: S0 },
      ];
  const half = geo.paper.length / 2;
  const bottomEdge = geo.breaks
    ? [geo.paper[half], geo.paper[half - 1]]
    : [
        { x: strip.x0, y: S1 },
        { x: strip.x1, y: S1 },
      ];

  // ── the tape (one loop per copy) ───────────────────────
  const L = model.loop;
  const bw = geo.beatW;
  const tapeW = geo.tape.copies * geo.tape.loopW;
  const beats: number[] = [];
  const bars: number[] = [];
  for (let c = 0; c < geo.tape.copies; c++) {
    for (let b = 0; b < L; b++) {
      if (!model.barLines.some((x) => Math.abs(x - b) < 1e-6)) beats.push(c * L + b);
    }
    for (const b of model.barLines) bars.push(c * L + b);
  }
  const beatD = beats.map((b) => `M${fmt(b * bw)} 0V${fmt(stripH)}`).join("");
  const barD = bars.map((b) => `M${fmt(b * bw)} 0V${fmt(stripH)}`).join("");
  const rowD = geo.rowY.map((y) => `M0 ${fmt(y)}H${fmt(tapeW)}`).join("");
  const seams = Array.from({ length: geo.tape.copies }, (_, c) => (c * L + model.seam) * bw);

  // ── the comb ───────────────────────────────────────────
  // The comb is one piece of steel: a brushed plate whose slanted edge is
  // the root line, cut into teeth by slots with rounded bottoms. The plate
  // and slots are drawn once; each tooth is its own element so it can ring.
  const rootAt = (y: number) =>
    comb.rootTop + ((comb.rootBottom - comb.rootTop) * (y - comb.top)) / (comb.bottom - comb.top);
  const backTop = comb.rootTop - comb.plate;
  const backBottom = comb.rootBottom - comb.plate;
  const tw = comb.teeth[0]?.w ?? 4;
  const edges = comb.teeth.map((t) => ({ y0: t.y - t.w / 2, y1: t.y + t.w / 2 }));
  // a slot's rounded bottom, from the lower edge of one tooth to the upper edge of the next
  const slotCurve = (a: number, b: number) => {
    const k = (b - a) * 0.66;
    return `C${fmt(rootAt(a) - k)} ${fmt(a)} ${fmt(rootAt(b) - k)} ${fmt(b)} ${fmt(rootAt(b))} ${fmt(b)}`;
  };
  const slots: string[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i].y1;
    const b = edges[i + 1].y0;
    slots.push(`M${fmt(rootAt(a))} ${fmt(a)}${slotCurve(a, b)}`);
  }
  // the plate's outline, slots included (it clips the hatching)
  let plateD = `M${fmt(backTop)} ${fmt(comb.top)}H${fmt(comb.rootTop)}`;
  edges.forEach((e, i) => {
    plateD += `L${fmt(rootAt(e.y0))} ${fmt(e.y0)}L${fmt(rootAt(e.y1))} ${fmt(e.y1)}`;
    const next = edges[i + 1];
    if (next) plateD += slotCurve(e.y1, next.y0);
  });
  plateD += `L${fmt(comb.rootBottom)} ${fmt(comb.bottom)}H${fmt(backBottom)}Z`;
  const first = edges[0];
  const last = edges[edges.length - 1];
  const rootEnds = [
    `M${fmt(comb.rootTop)} ${fmt(comb.top)}L${fmt(rootAt(first.y0))} ${fmt(first.y0)}`,
    `M${fmt(rootAt(last.y1))} ${fmt(last.y1)}L${fmt(comb.rootBottom)} ${fmt(comb.bottom)}`,
  ].join("");
  // brushed along its length
  const slant = (Math.atan2(comb.bottom - comb.top, comb.rootBottom - comb.rootTop) * 180) / Math.PI;
  const plateHatch = hatchPath(backBottom - 4, comb.top - 4, comb.rootTop + 4, comb.bottom + 4, slant, wide ? 2.3 : 2.1);
  const screwR = wide ? 4.4 : 3.7;

  // ── the hand-wheel ─────────────────────────────────────
  const wBox = Math.ceil(wheel.outer + 3);
  const spokes = 5;
  const spokeW0 = wide ? 9 : 6.4;
  const spokeW1 = wide ? 5.4 : 3.8;
  const armLocal = armLocalDeg(geo);
  const armLen = wheel.arm;
  const armD = armPath(armLen, wide ? 11 : 8, wide ? 8 : 6, wheel.hub + 0.5, wheel.knob * 0.78);
  const knobBox = Math.ceil(wheel.knob + 3);

  // ── the pinion ─────────────────────────────────────────
  const pBox = Math.ceil(pinion.r + pinion.m + 3);
  const knurls = Array.from({ length: 16 }, (_, i) => deg((360 / 16) * i));

  // world-fixed shading on the wheel rim (light from the upper left)
  const rimShade: string[] = [];
  const rimBand = wheel.root - wheel.rimInner;
  for (let k = 1; k <= 3; k++) {
    const r = wheel.rimInner + (rimBand * k) / 4;
    const spread = 70 - k * 12;
    rimShade.push(arcPath(wheel.c.x, wheel.c.y, r, deg(40 - spread), deg(40 + spread)));
  }

  const numeralR = wide ? 10 : 9;

  // which way the handle turns to play forward
  const turn = wide
    ? rotationArrow(wheel.c.x, wheel.c.y, wheel.outer + 11, deg(-28), deg(26), 7)
    : rotationArrow(wheel.c.x, wheel.c.y, wheel.outer + 7, deg(28), deg(74), 6);

  return (
    <>
      {/* base: bed plate and the paper's shadow */}
      <svg className={s.layer} width={geo.W} height={geo.H} aria-hidden focusable="false">
        <rect x={bed.x0} y={bed.y0} width={bed.x1 - bed.x0} height={bed.y1 - bed.y0} rx={3.5} className={s.bed} />
        <rect
          x={bed.x0 + 2.6}
          y={bed.y0 + 2.6}
          width={bed.x1 - bed.x0 - 5.2}
          height={bed.y1 - bed.y0 - 5.2}
          rx={2}
          className={s.line}
          style={{ strokeWidth: hair * 0.8, opacity: 0.55 }}
        />
        <rect
          x={bed.x0}
          y={bed.y0}
          width={bed.x1 - bed.x0}
          height={bed.y1 - bed.y0}
          rx={3.5}
          className={s.line}
          style={{ strokeWidth: line * 0.9 }}
        />
        <path
          d={`M${fmt(bed.x1)} ${fmt(bed.y0 + 3.5)}V${fmt(bed.y1 - 3.5)}Q${fmt(bed.x1)} ${fmt(bed.y1)} ${fmt(bed.x1 - 3.5)} ${fmt(
            bed.y1
          )}H${fmt(bed.x0 + 3.5)}`}
          className={s.shade}
          style={{ strokeWidth: 1.4 }}
        />
        <path d={paperD} transform="translate(1.5 2.5)" className={s.paperShadow} />
      </svg>

      {/* the pinion, half hidden under the paper's lower edge */}
      <svg
        data-mb="pinion"
        className={s.rotor}
        width={pBox * 2}
        height={pBox * 2}
        viewBox={`${-pBox} ${-pBox} ${pBox * 2} ${pBox * 2}`}
        style={{ left: pinion.c.x - pBox, top: pinion.c.y - pBox }}
        aria-hidden
        focusable="false"
      >
        <path d={gearPath(pinion.teeth, pinion.r, pinion.m)} className={s.partFill} />
        <path d={gearPath(pinion.teeth, pinion.r, pinion.m)} className={s.line} style={{ strokeWidth: line * 0.9 }} />
        <circle r={pinion.r - 1.25 * pinion.m - 1.6} className={s.line} style={{ strokeWidth: hair }} />
        <circle r={pinion.roller} className={s.partFill} />
        <circle r={pinion.roller} className={s.line} style={{ strokeWidth: line }} />
        {knurls.map((a, i) => (
          <path
            key={i}
            d={`M${fmt(Math.cos(a) * pinion.roller * 0.7)} ${fmt(Math.sin(a) * pinion.roller * 0.7)}L${fmt(
              Math.cos(a) * pinion.roller
            )} ${fmt(Math.sin(a) * pinion.roller)}`}
            className={s.line}
            style={{ strokeWidth: hair }}
          />
        ))}
        <circle r={pinion.roller * 0.28} className={s.inkFill} />
      </svg>

      {/* the paper strip; the tape inside it slides */}
      <div
        className={s.paper}
        style={{
          left: strip.x0,
          top: S0,
          width: strip.x1 - strip.x0,
          height: stripH,
          clipPath: geo.breaks ? clipPoly : undefined,
        }}
        aria-hidden
      >
        <svg data-mb="tape" className={s.tape} width={tapeW} height={stripH} focusable="false">
          <path d={rowD} className={s.row} />
          <path d={beatD} className={s.beat} />
          <path d={barD} className={s.bar} />
          {seams.map((x, i) => (
            <g key={i}>
              <rect x={x - 2.5} y={0} width={5} height={stripH} className={s.seamFill} />
              <path d={`M${fmt(x - 2.5)} 0V${fmt(stripH)}M${fmt(x + 2.5)} 0V${fmt(stripH)}`} className={s.seamLine} />
            </g>
          ))}
          {Array.from({ length: geo.tape.copies }, (_, c) =>
            model.holes.map((h) => (
              <circle
                key={`${c}-${h.i}`}
                data-hole=""
                data-c={c}
                data-i={h.i}
                cx={(c * L + h.beat) * bw}
                cy={geo.rowY[h.row]}
                r={geo.holeR}
                className={s.hole}
              />
            ))
          )}
        </svg>
      </div>

      {/* front: edges of the paper, the printed index, the comb */}
      <svg className={s.layer} width={geo.W} height={geo.H} aria-hidden focusable="false">
        <defs>
          <clipPath id={id("paper")}>
            <path d={paperD} />
          </clipPath>
          <clipPath id={id("plate")}>
            <path d={plateD} />
          </clipPath>
        </defs>

        {/* the printed index of note names, down the left edge */}
        <g clipPath={`url(#${id("paper")})`}>
          <rect
            x={geo.index.x0 - 10}
            y={S0}
            width={geo.index.x1 - geo.index.x0 + 10}
            height={stripH}
            className={s.paperFill}
          />
          <path d={`M${fmt(geo.index.x1)} ${fmt(S0)}V${fmt(S1)}`} className={s.indexRule} />
          {model.rows.map((r, i) => (
            <text
              key={r.dn}
              x={(geo.index.x0 + geo.index.x1) / 2 + (wide ? 0 : 0.5)}
              y={S0 + geo.rowY[i]}
              dy="0.35em"
              textAnchor="middle"
              className={s.indexText}
              style={{ fontSize: geo.index.size }}
            >
              {r.label}
            </text>
          ))}
        </g>

        {/* the paper's edges; the lower one carries the shade */}
        <path d={polyPath(topEdge, false)} className={s.line} style={{ strokeWidth: line * 0.9 }} />
        <path d={polyPath(bottomEdge, false)} className={s.shade} style={{ strokeWidth: wide ? 1.5 : 1.3 }} />
        {geo.breaks && (
          <>
            <path d={polyPath(geo.paper.slice(0, half), false)} className={s.line} style={{ strokeWidth: line * 0.85 }} />
            <path d={polyPath(geo.paper.slice(half), false)} className={s.line} style={{ strokeWidth: line * 0.85 }} />
          </>
        )}

        {/* the bed plate is screwed down where the comb leaves room */}
        <Screw x={bed.x0 + (wide ? 10 : 8)} y={(bed.y0 + S0) / 2} r={screwR * 0.82} a={38} />
        <Screw x={bed.x1 - (wide ? 8 : 6.5)} y={(bed.y1 + S1) / 2} r={screwR * 0.82} a={-52} />

        {/* the line where the teeth are plucked */}
        <path
          d={`M${fmt(geo.xr)} ${fmt(comb.top - 7)}V${fmt(comb.bottom + 7)}`}
          className={s.centreLine}
        />

        {/* the comb */}
        <path d={plateD} className={s.partFill} />
        <path d={plateHatch} clipPath={`url(#${id("plate")})`} className={s.hatch} />
        <path
          d={`M${fmt(comb.rootTop)} ${fmt(comb.top)}H${fmt(backTop)}L${fmt(backBottom)} ${fmt(comb.bottom)}`}
          className={s.line}
          style={{ strokeWidth: line * 0.85 }}
        />
        <path
          d={`M${fmt(backBottom)} ${fmt(comb.bottom)}H${fmt(comb.rootBottom)}`}
          className={s.shade}
          style={{ strokeWidth: wide ? 1.5 : 1.3 }}
        />
        <path d={rootEnds} className={s.shade} style={{ strokeWidth: wide ? 1.2 : 1.05 }} />
        <path d={slots.join("")} className={s.line} style={{ strokeWidth: line * 0.85 }} />
        {comb.screws.map((p, i) => (
          <Screw key={i} x={p.x} y={p.y} r={screwR} a={i ? 62 : -24} />
        ))}
        {comb.teeth.map((t, i) => {
          const { y0, y1 } = edges[i];
          const r0 = rootAt(y0);
          const r1 = rootAt(y1);
          const rr = Math.min(1.4, tw / 3);
          return (
            <g key={i} data-tooth="" data-row={i} className={s.tooth}>
              <path
                d={`M${fmt(r0 - 1.6)} ${fmt(y0)}H${fmt(t.x1)}V${fmt(y1)}H${fmt(r1 - 1.6)}Z`}
                className={s.toothFill}
              />
              {/* the tine's own outline, root to rounded tip: filled vermillion as it sounds */}
              <path
                data-ink=""
                data-row={i}
                d={`M${fmt(r0)} ${fmt(y0)}H${fmt(t.x1 - rr)}Q${fmt(t.x1)} ${fmt(y0)} ${fmt(t.x1)} ${fmt(
                  y0 + rr
                )}V${fmt(y1 - rr)}Q${fmt(t.x1)} ${fmt(y1)} ${fmt(t.x1 - rr)} ${fmt(y1)}H${fmt(r1)}Z`}
                className={s.toothInk}
              />
              <path
                d={`M${fmt(r0)} ${fmt(y0)}H${fmt(t.x1 - rr)}Q${fmt(t.x1)} ${fmt(y0)} ${fmt(t.x1)} ${fmt(y0 + rr)}`}
                className={s.toothLine}
                style={{ strokeWidth: hair }}
              />
              <path
                d={`M${fmt(t.x1)} ${fmt(y0 + rr)}V${fmt(y1 - rr)}Q${fmt(t.x1)} ${fmt(y1)} ${fmt(t.x1 - rr)} ${fmt(
                  y1
                )}H${fmt(r1)}`}
                className={s.toothLine}
                style={{ strokeWidth: wide ? 1.1 : 0.95 }}
              />
            </g>
          );
        })}

        {/* where each pin lets go of its tine: a mark struck at the tip, and a ring opening from it */}
        {comb.teeth.map((t, i) => (
          <g key={i} data-strike={i}>
            <circle data-part="ring" cx={t.x1} cy={t.y} r={geo.holeR + 1} className={s.strikeRing} />
            <circle data-part="disc" cx={t.x1} cy={t.y} r={geo.holeR} className={s.strikeDisc} />
          </g>
        ))}
      </svg>

      {/* the hand-wheel: rim, curved spokes, hub */}
      <svg
        data-mb="wheel"
        className={s.rotor}
        width={wBox * 2}
        height={wBox * 2}
        viewBox={`${-wBox} ${-wBox} ${wBox * 2} ${wBox * 2}`}
        style={{ left: wheel.c.x - wBox, top: wheel.c.y - wBox }}
        aria-hidden
        focusable="false"
      >
        <path
          d={`${gearPath(wheel.teeth, wheel.r, wheel.m)}${circlePath(0, 0, wheel.rimInner, true)}`}
          fillRule="evenodd"
          className={s.partFill}
        />
        <path d={gearPath(wheel.teeth, wheel.r, wheel.m)} className={s.line} style={{ strokeWidth: line * 0.9 }} />
        <circle r={wheel.root - 1.6} className={s.line} style={{ strokeWidth: hair * 0.8 }} />
        <circle r={wheel.rimInner} className={s.line} style={{ strokeWidth: line }} />
        {Array.from({ length: spokes }, (_, i) => {
          const a = (Math.PI * 2 * i) / spokes;
          return (
            <path
              key={i}
              d={spokePath(a, wheel.hub * 0.9, wheel.rimInner + 0.8, 0.42, spokeW0, spokeW1)}
              className={s.spoke}
              style={{ strokeWidth: line * 0.85 }}
            />
          );
        })}
        <circle r={wheel.hub + 3.2} className={s.partFill} />
        <circle r={wheel.hub + 3.2} className={s.line} style={{ strokeWidth: line }} />
      </svg>

      {/* the wheel's shading, fixed to the light — under the arm and grip, which stand in front of it */}
      <svg className={s.layer} width={geo.W} height={geo.H} aria-hidden focusable="false">
        {rimShade.map((d, i) => (
          <path key={i} d={d} className={s.line} style={{ strokeWidth: hair * 0.75, opacity: 0.8 }} />
        ))}
        <path
          d={arcPath(wheel.c.x, wheel.c.y, wheel.rimInner + 0.2, deg(-20), deg(110))}
          className={s.shade}
          style={{ strokeWidth: 1.4 }}
        />
        <path
          d={arcPath(wheel.c.x, wheel.c.y, wheel.hub + 3.3, deg(-20), deg(110))}
          className={s.shade}
          style={{ strokeWidth: 1.3 }}
        />
      </svg>

      {/* the crank arm and the hub's cap: they turn with the wheel */}
      <svg
        data-mb="arm"
        className={s.rotor}
        width={wBox * 2}
        height={wBox * 2}
        viewBox={`${-wBox} ${-wBox} ${wBox * 2} ${wBox * 2}`}
        style={{ left: wheel.c.x - wBox, top: wheel.c.y - wBox }}
        aria-hidden
        focusable="false"
      >
        <g transform={`rotate(${fmt(armLocal)})`}>
          <path d={armD} className={s.partFill} />
          <path d={armD} className={s.line} style={{ strokeWidth: line }} />
          <path
            d={`M${fmt(wheel.hub + 3)} ${fmt(wide ? 2.2 : 1.6)}L${fmt(armLen - wheel.knob * 0.78)} ${fmt(wide ? 1.6 : 1.2)}`}
            className={s.line}
            style={{ strokeWidth: hair * 0.7, opacity: 0.6 }}
          />
        </g>
        <circle r={wheel.hub * 0.52} className={s.partFill} />
        <circle r={wheel.hub * 0.52} className={s.line} style={{ strokeWidth: line * 0.9 }} />
        <path
          d={`M${fmt(-wheel.hub * 0.36)} 0H${fmt(wheel.hub * 0.36)}`}
          className={s.line}
          style={{ strokeWidth: 1 }}
        />
      </svg>

      {/* the handle's grip: lit from the upper left, whichever way the wheel has turned */}
      <svg
        data-mb="knob"
        className={s.rotor}
        width={knobBox * 2}
        height={knobBox * 2}
        viewBox={`${-knobBox} ${-knobBox} ${knobBox * 2} ${knobBox * 2}`}
        style={{ left: -knobBox, top: -knobBox }}
        aria-hidden
        focusable="false"
      >
        <circle r={wheel.knob} className={s.partFill} />
        {[0.86, 0.75].map((k, i) => (
          <path
            key={k}
            d={arcPath(0, 0, wheel.knob * k, deg(5 + i * 14), deg(85 - i * 14))}
            className={s.line}
            style={{ strokeWidth: hair * 0.8, opacity: 0.85 }}
          />
        ))}
        <circle r={wheel.knob} className={s.line} style={{ strokeWidth: line }} />
        <path d={arcPath(0, 0, wheel.knob - 0.4, deg(-25), deg(115))} className={s.shade} style={{ strokeWidth: 1.7 }} />
        <circle r={wheel.knob * 0.58} className={s.partFill} />
        <circle r={wheel.knob * 0.58} className={s.line} style={{ strokeWidth: hair }} />
        <circle r={wheel.knob * 0.2} className={s.inkFill} />
        {/* keyboard focus: the keys turn the handle, so the ring sits where a hand would */}
        <circle r={wheel.knob + (wide ? 5 : 4.5)} className={s.focusRing} />
      </svg>

      {/* her name, over the comb: the letter that is sounding lights up */}
      <div
        className={s.name}
        style={{ left: geo.name.x, top: geo.name.y - geo.name.size * 0.8, fontSize: geo.name.size }}
        translate="no"
        aria-hidden
      >
        {model.letters.map((l, k) =>
          l.index === null ? (
            <span key={k}>{l.ch}</span>
          ) : (
            <span key={k} data-letter={l.index} className={s.letter}>
              {l.ch}
            </span>
          )
        )}
      </div>

      {/* notes: centre lines, the turning arrow, reference numerals */}
      <svg className={s.layer} width={geo.W} height={geo.H} aria-hidden focusable="false">
        <path
          d={[
            `M${fmt(wheel.c.x - wheel.outer - 9)} ${fmt(wheel.c.y)}H${fmt(wheel.c.x + wheel.outer + 9)}`,
            `M${fmt(wheel.c.x)} ${fmt(wheel.c.y - wheel.outer - 9)}V${fmt(wheel.c.y + wheel.outer + 9)}`,
            `M${fmt(pinion.c.x - pinion.r - pinion.m - 7)} ${fmt(pinion.c.y)}H${fmt(pinion.c.x + pinion.r + pinion.m + 7)}`,
            `M${fmt(pinion.c.x)} ${fmt(S1 + 1)}V${fmt(pinion.c.y + pinion.r + pinion.m + 7)}`,
          ].join("")}
          className={s.centreLine}
        />
        <path d={turn.arc} className={s.leader} style={{ strokeWidth: wide ? 0.8 : 0.75 }} />
        <path d={turn.head} className={s.arrowHead} />
        {geo.numerals.map((nm) => (
          <Numeral key={nm.n} n={nm.n} x={nm.x} y={nm.y} to={nm.to} bow={nm.bow} r={numeralR} />
        ))}
      </svg>
    </>
  );
}

export default memo(Drawing);
