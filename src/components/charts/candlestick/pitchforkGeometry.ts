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
 *  "handle" (the tool's 1st click), P1/P2 the two points defining the fork's own width for every
 *  *non*-inside variant (see `pitchforkTineAnchors`). Only the median's own start/target move:
 *  "pitchfork" (standard/Andrews') starts at P0 itself; "schiffPitchfork" moves the start 50% of
 *  the way from P0 toward P1 in *price only* (its own time/x stays at P0's — Schiff's own
 *  original modification); "modifiedSchiffPitchfork" moves that same 50% in *both* price and time
 *  (a plain 2D midpoint of P0-P1) — Dr. Andrews' own response to Schiff's variation, going one
 *  step further by moving the origin equally on both axes instead of price alone;
 *  "insidePitchfork" keeps the *same* P0-P1-midpoint start Modified Schiff uses, but joins it
 *  directly to P2 itself instead of the midpoint of P1-P2 — "ends its own handle at C rather than
 *  the midpoint of B-C" (Andrews' own Inside variants, every one of them, regardless of which
 *  non-inside start formula they otherwise share). */
export function pitchforkMedianEndpoints(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): { start: ScreenPoint; target: ScreenPoint } {
  switch (variant) {
    case "schiffPitchfork":
      return { start: { x: p0.x, y: midpoint(p0, p1).y }, target: midpoint(p1, p2) };
    case "modifiedSchiffPitchfork":
      return { start: midpoint(p0, p1), target: midpoint(p1, p2) };
    case "insidePitchfork":
      return { start: midpoint(p0, p1), target: p2 };
    case "pitchfork":
    default:
      return { start: p0, target: midpoint(p1, p2) };
  }
}

/** Which two of the 3 clicked points the pair of parallel "tine" lines are *anchored at* before
 *  any clipping (see `pitchforkLines`' own use of this) — P1/P2 for every non-inside variant,
 *  same as the "base of the channel" every one of their own medians targets (or a midpoint of).
 *  "insidePitchfork" anchors at P0/P1 instead, since it targets P2 *directly* (see
 *  pitchforkMedianEndpoints), which makes P2 part of the median's own line — a tine through P2
 *  with the median's own slope would be mathematically identical to the median itself (2 lines
 *  through the same point with the same slope are the same line). */
function pitchforkTineAnchors(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): [ScreenPoint, ScreenPoint] {
  return variant === "insidePitchfork" ? [p0, p1] : [p1, p2];
}

// Where the infinite line through (anchor, anchor+direction) crosses the infinite line through
// (lineP1, lineP2) — standard 2D line-line intersection via Cramer's rule. `null` when the two
// are parallel (the two lines never cross, or are the same line) — geometrically shouldn't happen
// for this tool's own callers (the tine direction is never parallel to the B-C leg it's being
// clipped against, short of a degenerate 3-point placement), so callers just fall back to the
// unclipped anchor rather than crash on a division by zero.
function lineIntersection(anchor: ScreenPoint, direction: ScreenPoint, lineP1: ScreenPoint, lineP2: ScreenPoint): ScreenPoint | null {
  const ex = lineP2.x - lineP1.x;
  const ey = lineP2.y - lineP1.y;
  const denom = direction.x * ey - direction.y * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((lineP1.x - anchor.x) * ey - (lineP1.y - anchor.y) * ex) / denom;
  return { x: anchor.x + t * direction.x, y: anchor.y + t * direction.y };
}

// 0.5px tolerance for "is this derived point actually just A/B/C itself" — screen-space
// coordinates come out of a d3 scale (floating point), so an exact `===` would false-negative on
// a point that's mathematically identical but off by a rounding hair.
const EPSILON = 0.5;
function approxEqual(a: ScreenPoint, b: ScreenPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/** The median's own `start`/`target` (see pitchforkMedianEndpoints), labeled and filtered down to
 *  only the ones actually *derived* — worth marking on the chart the same way the reference
 *  diagrams this was modeled on do, rather than silently leaving them as bare line endpoints with
 *  no dot/label of their own the way A/B/C already get. A role landing exactly on one of A/B/C
 *  itself (the plain "pitchfork" variant's own `start`, literally P0; "insidePitchfork"'s own
 *  `target`, literally P2) is skipped — already marked there. Labeled by what the point actually
 *  *is*, not which role (start/target) it happens to be playing this variant: whichever equals
 *  the plain midpoint of the tine-anchor pair (see pitchforkTineAnchors — B-C normally, A-B for
 *  "insidePitchfork") is "D"; any other derived point (Schiff's own price-shifted anchor,
 *  Modified Schiff's full A-B midpoint) is "E". */
export function pitchforkExtraPoints(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant): { point: ScreenPoint; label: "D" | "E" }[] {
  const { start, target } = pitchforkMedianEndpoints(p0, p1, p2, variant);
  const [tineAnchor1, tineAnchor2] = pitchforkTineAnchors(p0, p1, p2, variant);
  const pairMid = midpoint(tineAnchor1, tineAnchor2);
  const rawPoints = [p0, p1, p2];
  const points: { point: ScreenPoint; label: "D" | "E" }[] = [];
  for (const point of [start, target]) {
    if (approxEqual(point, pairMid)) points.push({ point, label: "D" });
    else if (!rawPoints.some((raw) => approxEqual(point, raw))) points.push({ point, label: "E" });
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
 *  extended), the median (via pitchforkMedianEndpoints) as a ray from its own variant-specific
 *  anchor, and the two tines as rays from the tine-anchor pair (see pitchforkTineAnchors), each
 *  parallel to the median and extended one-directionally (past its own anchor, never behind it)
 *  to the plot's own edge. For every non-inside variant the tine anchors already sit exactly on
 *  the B-C line (they *are* B and C), so nothing more happens; "insidePitchfork" anchors its own
 *  tines at A/B instead (see pitchforkTineAnchors' own doc for why), which usually sit well clear
 *  of the B-C leg — drawing the *whole* ray from A/B itself would run the tine straight across the
 *  A-B-C triangle's own interior, so it's clipped to only the portion past where it actually
 *  crosses the B-C line, same as how B's own tine already starts exactly on that line (the
 *  clip there is a no-op — B already satisfies it). The single source of truth both the renderer
 *  and hover/hit-testing build from, so hovering always matches exactly what's drawn instead of
 *  drifting out of sync with a second, hand-copied formula (same reasoning drawingGeometry.ts's
 *  own forecastCurvePoints already follows for the "forecast" tool's curve). */
export function pitchforkLines(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, variant: PitchforkVariant, xMin: number, xMax: number): PitchforkLines {
  const { start, target } = pitchforkMedianEndpoints(p0, p1, p2, variant);
  const median = rayFromAnchor(start, target, xMin, xMax);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const [rawAnchor1, rawAnchor2] = pitchforkTineAnchors(p0, p1, p2, variant);
  const tineAnchor1 = variant === "insidePitchfork" ? (lineIntersection(rawAnchor1, { x: dx, y: dy }, p1, p2) ?? rawAnchor1) : rawAnchor1;
  const tineAnchor2 = variant === "insidePitchfork" ? (lineIntersection(rawAnchor2, { x: dx, y: dy }, p1, p2) ?? rawAnchor2) : rawAnchor2;
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
