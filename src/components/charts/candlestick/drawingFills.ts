import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/** The pale fills every shape-drawing tool paints its background with.
 *
 *  They are fixed hues rather than the theme's own up/down colours, and that is the point: on a
 *  monochrome palette those resolve to two greys, which left a risk/reward box — the one drawing
 *  whose entire meaning is that one half is the gain and the other is the loss — with two
 *  identical halves. A background that cannot be told apart is not a background.
 *
 *  Painted at `FILL_ALPHA`, so these name the hue and never the strength: a fill that competes
 *  with the candles underneath it has stopped being a background. */
export const PALE_GREEN = "#4caf50";
export const PALE_RED = "#ef5350";
export const PALE_NEUTRAL = "#9e9e9e";

/** Every shape fill in the chart uses this one opacity, so no tool's background reads as louder
 *  than another's. */
export const FILL_ALPHA = 0.16;

/** The tools whose "background" is a filled shape, and so read `fillColor`. The label-bodied ones
 *  — comment, note, priceNote, signpost, priceLabel — fill a label instead and keep using
 *  `textBackgroundColor`; `fillColorField` below is what tells the edit modal which is which. */
const SHAPE_FILL_TOOLS = new Set([
  "channel",
  "disjointChannel",
  "pitchfork",
  "schiffPitchfork",
  "modifiedSchiffPitchfork",
  "insidePitchfork",
  "rectangle",
  "table",
  "headShoulders",
  "pin",
  "flagMark",
]);

/** The tools that fill a label rather than a shape. */
const LABEL_FILL_TOOLS = new Set(["comment", "note", "priceNote", "signpost", "priceLabel", "text"]);

/** Which field a "Couleur de fond" control should write for this drawing — or `null` where the
 *  tool has no background at all (a bare trend line, an arrow marker), in which case the modal
 *  offers no such control rather than one that does nothing. */
export function fillColorField(dr: Pick<TrendLineDrawing, "lineType">): "fillColor" | "textBackgroundColor" | null {
  const type = dr.lineType ?? "";
  if (SHAPE_FILL_TOOLS.has(type)) return "fillColor";
  if (LABEL_FILL_TOOLS.has(type)) return "textBackgroundColor";
  return null;
}

/** A shape tool's own fill, falling back to whatever it painted before `fillColor` existed — so a
 *  drawing saved earlier looks exactly as it did. */
export function shapeFill(dr: TrendLineDrawing, fallback: string): string {
  return dr.fillColor ?? fallback;
}
