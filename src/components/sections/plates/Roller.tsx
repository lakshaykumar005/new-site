import { forwardRef, useId } from "react";
import { OVER } from "./press";
import s from "./plates.module.css";

/**
 * The ink roller, seen from above as it lies on the plate, drawn the
 * way a patent draws a part: one ink, hairlines, hatching for the
 * round of the cylinder, the grain of the handle. The frame runs along
 * the roller's axis and the handle trails behind it, to the left.
 */

export interface RollerSize {
  /** the cylinder's diameter */
  d: number;
  /** the handle, from its end to where it meets the boss */
  grip: number;
}

/** A plate on a phone gets a smaller roller than one on a wide page. */
export const rollerSize = (bedW: number): RollerSize => (bedW < 480 ? { d: 26, grip: 50 } : { d: 32, grip: 62 });

/** How far the drawing reaches to the left of the cylinder. */
export const rollerReach = (size: RollerSize) => size.grip + 2;

const f = (v: number) => Math.round(v * 100) / 100;

interface Props {
  size: RollerSize;
  /** the plate's height; the roller overhangs it top and bottom */
  bedH: number;
}

const Roller = forwardRef<SVGSVGElement, Props>(function Roller({ size, bedH }, ref) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { d, grip } = size;
  const reach = rollerReach(size);
  const H = bedH + 2 * OVER;
  const len = bedH;
  const W = reach + d + 2;

  // the round of the cylinder: lines crowd towards its edges
  const N = 13;
  let hatch = "";
  for (let k = 1; k < N; k++) {
    const x = f((d / 2) * (1 - Math.cos((Math.PI * k) / N)));
    hatch += `M${x} ${OVER}V${f(OVER + len)}`;
  }

  // the frame along the axis, the boss at its middle, the handle trailing left
  const barW = f(d * 0.26);
  const bossR = f(d * 0.34);
  const cy = f(H / 2);
  const gh = f(d * 0.5);
  const gx0 = -grip;
  const gx1 = f(d / 2 - bossR * 0.55);
  const gripD = `M${f(gx0 + gh / 2)} ${f(cy - gh / 2)}H${gx1}V${f(cy + gh / 2)}H${f(gx0 + gh / 2)}A${f(gh / 2)} ${f(
    gh / 2
  )} 0 0 1 ${f(gx0 + gh / 2)} ${f(cy - gh / 2)}Z`;
  const grain = [-0.24, 0, 0.24].map((t) => `M${f(gx0 + 3)} ${f(cy + t * gh)}H${gx1}`).join("");
  const ferruleX = f(gx1 - gh * 1.15);

  return (
    <svg
      ref={ref}
      className={s.roller}
      width={W}
      height={H}
      viewBox={`${-reach} 0 ${W} ${H}`}
      style={{ left: -reach, top: -OVER }}
      aria-hidden
      focusable="false"
    >
      <defs>
        <clipPath id={`rl${uid}c`}>
          <rect x={0} y={OVER} width={d} height={len} rx={1.5} />
        </clipPath>
        <clipPath id={`rl${uid}g`}>
          <path d={gripD} />
        </clipPath>
      </defs>
      {/* the rubber, inked */}
      <rect x={0} y={OVER} width={d} height={len} rx={1.5} className={s.rollerRubber} />
      <path d={hatch} clipPath={`url(#rl${uid}c)`} className={s.rollerHatch} />
      <rect x={0} y={OVER} width={d} height={len} rx={1.5} className={s.rollerLine} />
      {/* the frame along the axis, bearing on both ends */}
      <rect x={f(d / 2 - barW / 2)} y={OVER - 8} width={barW} height={len + 16} rx={1.5} className={s.rollerPart} />
      <rect x={f(d / 2 - barW / 2)} y={OVER - 8} width={barW} height={len + 16} rx={1.5} className={s.rollerLine} />
      <rect x={f(d / 2 - barW * 0.3)} y={OVER - 8} width={f(barW * 0.6)} height={5} className={s.rollerInk} />
      <rect x={f(d / 2 - barW * 0.3)} y={OVER + len + 3} width={f(barW * 0.6)} height={5} className={s.rollerInk} />
      {/* the handle: turned wood, a ferrule where it meets the boss */}
      <path d={gripD} className={s.rollerPart} />
      <path d={grain} clipPath={`url(#rl${uid}g)`} className={s.rollerHatch} />
      <rect x={ferruleX} y={f(cy - gh / 2)} width={4} height={gh} className={s.rollerFerrule} />
      <path d={gripD} className={s.rollerLine} />
      <path d={`M${ferruleX} ${f(cy - gh / 2)}V${f(cy + gh / 2)}M${f(+ferruleX + 4)} ${f(cy - gh / 2)}V${f(cy + gh / 2)}`} className={s.rollerLine} />
      {/* the boss the handle turns on */}
      <circle cx={f(d / 2)} cy={cy} r={bossR} className={s.rollerPart} />
      <circle cx={f(d / 2)} cy={cy} r={bossR} className={s.rollerLine} />
      <circle cx={f(d / 2)} cy={cy} r={f(bossR * 0.68)} className={s.rollerHair} />
      <circle cx={f(d / 2)} cy={cy} r={f(d * 0.11)} className={s.rollerInk} />
    </svg>
  );
});

export default Roller;
