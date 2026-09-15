import * as d3 from "d3";

/* Pure black and white, not a softened near-black/near-white pair. The worst case for a
   two-choice label is a background sitting exactly where the two candidates tie, and how bad that
   tie is depends entirely on how far apart the pair is: #14161a/#f7f8fa bottomed out at 4.26:1,
   under the 4.5:1 AA threshold, while #000/#fff bottoms out at 4.58:1, over it. */
export const LABEL_DARK = "#000000";
export const LABEL_LIGHT = "#ffffff";

/** WCAG relative luminance. */
export function luminance(color: d3.RGBColor): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** A label colour that stays readable on `background`.
 *
 *  Whichever of the two candidates actually contrasts better, rather than a luminance threshold
 *  picked by eye: a first attempt in the heatmap used `> 0.45`, which put white text on a mid-grey
 *  tile at 2.3:1 where black would have given 7.3:1. Comparing the two ratios has no such blind
 *  spot and puts the crossover exactly where it belongs.
 *
 *  Shared between the heatmap and the matrix because both have the same problem for the same
 *  reason: a cell whose colour is decided at paint time — a `color-mix()` in one, a fill plus a
 *  fill-opacity in the other — cannot have its label's contrast known from the markup. */
export function labelColorOn(background: d3.RGBColor | null): string {
  if (background === null) return "var(--lq-color-text)";
  const bg = luminance(background);
  const dark = contrast(bg, luminance(d3.rgb(LABEL_DARK)));
  const light = contrast(bg, luminance(d3.rgb(LABEL_LIGHT)));
  return dark >= light ? LABEL_DARK : LABEL_LIGHT;
}
