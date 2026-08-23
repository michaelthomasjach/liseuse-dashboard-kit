import { extendSegmentToEdges } from "./drawingGeometry";

export type PitchforkVariant = "pitchfork" | "schiffPitchfork" | "modifiedSchiffPitchfork" | "insidePitchfork";

// Screen-space (pixel) points, like every other geometry helper here (drawingGeometry.ts's own
// forecastControlPoint, channelOffsetFromClick) — not DataPoint (Date-based), which has no
// meaningful "midpoint" of its own without first converting through a scale.
export interface ScreenPoint {
  x: number;
  y: number;
}

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Where each pitchfork variant's own median line starts from and heads toward — P0 is the
 *  "handle" (the tool's 1st click), P1/P2 the two points defining the fork's own width (the two
 *  parallel "tine" lines pass through these, unchanged across every variant). Only the median's
 *  own start/target move: "pitchfork" (standard/Andrews') starts at P0 itself; "schiffPitchfork"
 *  moves the start 50% of the way from P0 toward P1 in *price only* (its own time/x stays at
 *  P0's — Schiff's own original modification); "modifiedSchiffPitchfork" moves that same 50% in
 *  *both* price and time (a plain 2D midpoint of P0-P1) — Dr. Andrews' own response to Schiff's
 *  variation, going one step further by moving the origin equally on both axes instead of price
 *  alone; "insidePitchfork" swaps the median's own start and target entirely, starting at the
 *  midpoint of P1-P2 and heading through P0 instead. */
export function pitchforkMedianEndpoints(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): { start: ScreenPoint; target: ScreenPoint } {
  const mid12 = midpoint(p1, p2);
  switch (variant) {
    case "schiffPitchfork":
      return { start: { x: p0.x, y: midpoint(p0, p1).y }, target: mid12 };
    case "modifiedSchiffPitchfork":
      return { start: midpoint(p0, p1), target: mid12 };
    case "insidePitchfork":
      return { start: mid12, target: p0 };
    case "pitchfork":
    default:
      return { start: p0, target: mid12 };
  }
}

// A one-directional ray: starts exactly at `anchor` (never moved) and extends *only* through and
// past `through`, out to whichever plot edge lies in that direction — never extended backward
// past the anchor the way `extendSegmentToEdges`'s own default "both" mode would (that was this
// tool's actual bug: every line reached both plot edges instead of stopping dead at its own point
// A/B/C). `extendSegmentToEdges`'s "left"/"right" modes each keep one specific *argument
// position* fixed rather than "whichever point is geometrically further left/right" — so when
// `through` sits to the left of `anchor` the two points need swapping before calling it,
// otherwise asking for "right" would push the far end toward xMax, the opposite side from where
// `through` (and so the ray) actually needs to go.
function rayFromAnchor(anchor: ScreenPoint, through: ScreenPoint, xMin: number, xMax: number): { x1: number; y1: number; x2: number; y2: number } {
  if (anchor.x === through.x) return { x1: anchor.x, y1: anchor.y, x2: through.x, y2: through.y };
  return through.x >= anchor.x
    ? extendSegmentToEdges(anchor.x, anchor.y, through.x, through.y, xMin, xMax, "right")
    : extendSegmentToEdges(through.x, through.y, anchor.x, anchor.y, xMin, xMax, "left");
}

export interface PitchforkLines {
  /** The plain B–C segment ("V") — never extended, just the two points as clicked. */
  spine: { x1: number; y1: number; x2: number; y2: number };
  median: { x1: number; y1: number; x2: number; y2: number };
  tine1: { x1: number; y1: number; x2: number; y2: number };
  tine2: { x1: number; y1: number; x2: number; y2: number };
}

/** The 4 actual on-screen lines for a pitchfork drawing — the B–C spine, the median (via
 *  pitchforkMedianEndpoints) as a ray from its own variant-specific anchor, and the two tines as
 *  rays from P1/P2 respectively, each parallel to the median and extended one-directionally (past
 *  its own anchor, never behind it) to the plot's own edge. The single source of truth both the
 *  renderer and hover/hit-testing build from, so hovering always matches exactly what's drawn
 *  instead of drifting out of sync with a second, hand-copied formula (same reasoning
 *  drawingGeometry.ts's own forecastCurvePoints already follows for the "forecast" tool's curve). */
export function pitchforkLines(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant, xMin: number, xMax: number): PitchforkLines {
  const { start, target } = pitchforkMedianEndpoints(p0, p1, p2, variant);
  const median = rayFromAnchor(start, target, xMin, xMax);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const tine1 = rayFromAnchor(p1, { x: p1.x + dx, y: p1.y + dy }, xMin, xMax);
  const tine2 = rayFromAnchor(p2, { x: p2.x + dx, y: p2.y + dy }, xMin, xMax);
  return { spine: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, median, tine1, tine2 };
}
