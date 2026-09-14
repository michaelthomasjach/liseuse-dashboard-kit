import type { SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/** Every idle-loop an icon can be given. Deliberately a small, shared vocabulary rather than one
 *  bespoke animation per icon: an icon is 24×24 of stroked path, so the only motions that read at
 *  that size are transforms and opacity, and the same dozen of them cover a hundred icons while
 *  staying recognisable as one family. Which one an icon gets is a matter of what it *means* —
 *  a bell rings, an eye blinks, a refresh spins.
 *
 *  - `spin` — a full turn, slowly (sun, gear, refresh)
 *  - `pulse` — breathes, scale and opacity together (moon, battery, info)
 *  - `sway` — rocks a few degrees each way (wind, a drawn line, a brush)
 *  - `bob` — rises and settles (arrows, a candle, anything with a vertical sense)
 *  - `slide` — travels a little sideways and back (play, chevrons, forward/back)
 *  - `ring` — swings from its top edge, the way a bell hangs
 *  - `blink` — dips to near-transparent and back (eye, cursor, code)
 *  - `shake` — a short nervous jitter (error, close, alert)
 *  - `grow` — swells from the centre (plus, zoom, maximise)
 *  - `float` — drifts up and down, slower and softer than `bob` (cloud, layers, file)
 *  - `beat` — two quick swells per cycle, like a pulse reading (activity, star, sparkle)
 *  - `tilt` — leans from its bottom-left corner (a lid, a flap, a card)
 *  - `flip` — turns over on its vertical axis (copy, anything two-sided)
 *  - `raindrop` — falls and fades; applied to children, not the whole icon */
export type IconMotion =
  | "spin"
  | "pulse"
  | "sway"
  | "bob"
  | "slide"
  | "ring"
  | "blink"
  | "shake"
  | "grow"
  | "float"
  | "beat"
  | "tilt"
  | "flip"
  | "raindrop";

/** Icons that support an optional idle-loop animation (sun spinning, bell ringing…).
 *  Off by default — pass `animated` on the one instance you want to bring to life. */
export interface AnimatedIconProps extends IconProps {
  animated?: boolean;
  /** Each icon declares its own — see `IconMotion`. Overridable, but the icon's own choice is the
   *  considered one; this exists so the gallery can name the motion rather than for callers to
   *  re-choose it per instance. */
  motion?: IconMotion;
}

/** Shared wrapper: 24x24 viewbox, stroke = currentColor so icons inherit the active theme's text
 *  color, and one opt-in idle animation chosen by the icon itself (see `IconMotion`).
 *
 *  The animation class lands here rather than in each icon so that adding an icon is one line with
 *  its motion in it, and so that `animated`/`motion` can never leak onto the `<svg>` as unknown DOM
 *  attributes. An icon whose animation belongs to *part* of it — the sun inside a cloud, the drops
 *  under one — sets the class on that child itself and leaves `motion` unset. */
export function IconBase({ size = 24, animated, motion, className, children, ...rest }: AnimatedIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={[animated && motion && `lq-icon-${motion}`, className].filter(Boolean).join(" ") || undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}
