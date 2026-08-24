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

/** Where each pitchfork variant's own *dashed* median line starts from and heads toward — P0 is
 *  the "handle" (the tool's 1st click), P1/P2 the two points defining the fork's own width.
 *  "pitchfork" (standard/Andrews') starts at P0 itself, toward the midpoint of P1-P2;
 *  "schiffPitchfork" moves the start 50% of the way from P0 toward P1 in *price only* (its own
 *  time/x stays at P0's — Schiff's own original modification), same target;
 *  "modifiedSchiffPitchfork" moves that same 50% in *both* price and time (a plain 2D midpoint of
 *  P0-P1) — Dr. Andrews' own response to Schiff's variation, going one step further by moving the
 *  origin equally on both axes instead of price alone, same target. "insidePitchfork" is a
 *  genuinely different shape, not just another start/target pair on the same 2 outer tines: its
 *  own 2 *outer* tines pass through D (=mid(P0,P1), the very point every other variant's own
 *  median would start from) and P1 directly — see `pitchforkTineAnchors` — so its median sits
 *  exactly *between* them instead, anchored at mid(P1,P2) and sharing the same D→P2 direction
 *  those two outer tines already travel in. */
export function pitchforkMedianEndpoints(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): { start: ScreenPoint; target: ScreenPoint } {
  switch (variant) {
    case "schiffPitchfork":
      return { start: { x: p0.x, y: midpoint(p0, p1).y }, target: midpoint(p1, p2) };
    case "modifiedSchiffPitchfork":
      return { start: midpoint(p0, p1), target: midpoint(p1, p2) };
    case "insidePitchfork": {
      const d = midpoint(p0, p1);
      const start = midpoint(p1, p2);
      return { start, target: { x: start.x + (p2.x - d.x), y: start.y + (p2.y - d.y) } };
    }
    case "pitchfork":
    default:
      return { start: p0, target: midpoint(p1, p2) };
  }
}

/** Which two points the pair of *solid* outer "tine" lines are anchored at — P1/P2 for every
 *  non-inside variant (the median's own target, or a midpoint of it, always lands on this same
 *  pair, so the tines and the median share their "base"). "insidePitchfork" anchors its own tines
 *  at D (=mid(P0,P1)) and P1 instead — its median (see pitchforkMedianEndpoints) sits at mid(P1,P2)
 *  precisely because that's the midpoint *between* these two tines, not because it shares their
 *  own anchor pair the way every other variant's median does. */
function pitchforkTineAnchors(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): [ScreenPoint, ScreenPoint] {
  return variant === "insidePitchfork" ? [midpoint(p0, p1), p1] : [p1, p2];
}

// 0.5px tolerance for "is this derived point actually just A/B/C itself" — screen-space
// coordinates come out of a d3 scale (floating point), so an exact `===` would false-negative on
// a point that's mathematically identical but off by a rounding hair.
const EPSILON = 0.5;
function approxEqual(a: ScreenPoint, b: ScreenPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/** The chart's own hollow, unlabeled-on-the-line-but-lettered-here markers for whichever points a
 *  variant actually *derives* rather than lets the user click directly — worth marking the same
 *  way the reference diagrams this was modeled on do, rather than silently leaving them as bare
 *  line endpoints. Every non-inside variant derives at most 2: the median's own `start` (skipped
 *  when it's literally P0 — the plain "pitchfork" variant's own case) labeled "E", and its own
 *  `target` (always mid(P1,P2)) labeled "D". "insidePitchfork" derives a different pair — D itself
 *  (one of its own *tine* anchors here, not the median's) and the median's own start (mid(P1,P2))
 *  — labeled the same way for consistency: "D" for the mid(P1,P2) point, "E" for D. */
export function pitchforkExtraPoints(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): { point: ScreenPoint; label: "D" | "E" }[] {
  if (variant === "insidePitchfork") {
    return [
      { point: midpoint(p0, p1), label: "E" },
      { point: midpoint(p1, p2), label: "D" },
    ];
  }
  const { start, target } = pitchforkMedianEndpoints(p0, p1, p2, variant);
  const pairMid = midpoint(p1, p2);
  const points: { point: ScreenPoint; label: "D" | "E" }[] = [];
  for (const point of [start, target]) {
    if (approxEqual(point, pairMid)) points.push({ point, label: "D" });
    else if (!approxEqual(point, p0)) points.push({ point, label: "E" });
  }
  return points;
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
  /** The plain A–B segment — never extended, just the two points as clicked. Visualizes the leg
   *  D (and, for Schiff/Modified Schiff, E) is derived from. */
  handle: { x1: number; y1: number; x2: number; y2: number };
  /** The plain B–C segment — never extended, just the two points as clicked. */
  spine: { x1: number; y1: number; x2: number; y2: number };
  median: { x1: number; y1: number; x2: number; y2: number };
  tine1: { x1: number; y1: number; x2: number; y2: number };
  tine2: { x1: number; y1: number; x2: number; y2: number };
}

/** The 5 actual on-screen lines for a pitchfork drawing — the plain A–B/B–C segments (never
 *  extended), the *dashed* median (via pitchforkMedianEndpoints) as a ray from its own
 *  variant-specific anchor, and the two *solid* tines as rays from the tine-anchor pair (see
 *  pitchforkTineAnchors), each parallel to the median and extended one-directionally (past its
 *  own anchor, never behind it) to the plot's own edge. For "insidePitchfork" this puts the
 *  median (still dashed) *between* its own two tines rather than alongside them the way every
 *  other variant's median sits flush with one of its own tines — see both functions' own doc for
 *  why. The single source of truth both the renderer and hover/hit-testing build from, so
 *  hovering always matches exactly what's drawn instead of drifting out of sync with a second,
 *  hand-copied formula (same reasoning drawingGeometry.ts's own forecastCurvePoints already
 *  follows for the "forecast" tool's curve). */
export function pitchforkLines(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant, xMin: number, xMax: number): PitchforkLines {
  const { start, target } = pitchforkMedianEndpoints(p0, p1, p2, variant);
  const median = rayFromAnchor(start, target, xMin, xMax);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const [tineAnchor1, tineAnchor2] = pitchforkTineAnchors(p0, p1, p2, variant);
  const tine1 = rayFromAnchor(tineAnchor1, { x: tineAnchor1.x + dx, y: tineAnchor1.y + dy }, xMin, xMax);
  const tine2 = rayFromAnchor(tineAnchor2, { x: tineAnchor2.x + dx, y: tineAnchor2.y + dy }, xMin, xMax);
  return {
    handle: { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y },
    spine: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
    median,
    tine1,
    tine2,
  };
}
