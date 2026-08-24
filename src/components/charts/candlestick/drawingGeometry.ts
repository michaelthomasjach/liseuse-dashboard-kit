import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "./interfaces/DataPoint.interface";

/** All of a drawing's points in path order — the shape every multi-point tool's rendering/
 *  hit-testing/dragging works off of instead of the named fields directly. For every *clicked*
 *  multi-point tool (fibonacciExtension, elliott*, disjointChannel, elbowArrow) that's x1/y1,
 *  x2/y2, then extraPoints, since x2 is always the 2nd click and extraPoints are whatever came
 *  after. "brush" is the one exception: it's a *dragged* stroke, not a sequence of clicks — x1/y1
 *  is where the drag started, x2/y2 where it ended, and extraPoints are the samples in between
 *  (see TrendLineDrawing's own doc), so x2 is chronologically *last*, not 2nd. Walking it in the
 *  same x1→x2→extraPoints order as every other tool would jump straight from the start to the end
 *  and then zigzag back through the middle samples — this returns x1→extraPoints→x2 for brush
 *  specifically so callers can keep walking the result pairwise without knowing the difference. */
export function allPointsOf(dr: TrendLineDrawing): DataPoint[] {
  if (dr.lineType === "brush") return [{ x: dr.x1, y: dr.y1 }, ...(dr.extraPoints ?? []), { x: dr.x2, y: dr.y2 }];
  return [{ x: dr.x1, y: dr.y1 }, { x: dr.x2, y: dr.y2 }, ...(dr.extraPoints ?? [])];
}

// A canvas 1px line drawn at an integer y (e.g. moveTo(0, 40)) straddles two physical pixel rows
// half-and-half, so it rasterizes as a ~2px anti-aliased blur instead of a crisp line — unlike an
// SVG/CSS border at the same nominal position, which renders crisp. Offsetting to the pixel's
// center (y + 0.5) keeps the 1px stroke entirely within one row, matching the SVG-drawn dividers
// these canvas lines are meant to continue seamlessly into.
export function snapPixel(v: number): number {
  return Math.round(v) + 0.5;
}

export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Rounded at the *source* — every place a price gets computed from a pixel position (a new
 *  point's placement, any kind of drag) — not just when the edit modal's own fields are typed
 *  into, so a freshly-drawn or freshly-dragged line's coordinates never carry more precision
 *  than the modal shows in the first place (a raw scale.invert() pixel→price conversion easily
 *  produces a dozen-plus decimal digits). */
export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// "extended" lines keep their own two defining points (x1/y1/x2/y2, still what's draggable) but
// draw all the way to the price section's left/right edges instead of stopping at them —
// screen-space linear extrapolation along the same slope. A perfectly vertical segment (in
// screen space) has nothing to extend into on the X axis, so it's returned unchanged. `direction`
// picks which edge(s) actually move — "left"/"right" only push the one endpoint on that side out
// to xMin/xMax respectively, leaving the other exactly where it was; "both" does what the
// original two-direction-only version always did.
export function extendSegmentToEdges(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  xMin: number,
  xMax: number,
  direction: "left" | "right" | "both" = "both"
): { x1: number; y1: number; x2: number; y2: number } {
  if (x1 === x2) return { x1, y1, x2, y2 };
  const slope = (y2 - y1) / (x2 - x1);
  const left = direction === "right" ? { x1, y1 } : { x1: xMin, y1: y1 + slope * (xMin - x1) };
  const right = direction === "left" ? { x2, y2 } : { x2: xMax, y2: y1 + slope * (xMax - x1) };
  return { ...left, ...right };
}

// A drawing's actual extend setting, folding in the "extended" tool's own implicit "both" for a
// drawing saved before the `extend` field existed (see TrendLineDrawing.extend's own doc for why
// it's independent of lineType instead of just always being "extended" vs. not).
export function effectiveExtendOf(dr: TrendLineDrawing): "none" | "left" | "right" | "both" {
  return dr.extend ?? (dr.lineType === "extended" ? "both" : "none");
}

// A pasted duplicate (see useDrawingState's own Ctrl+C/Ctrl+V) lands at *exactly* its source's own
// coordinates — invisible until dragged, with no way to tell a paste actually happened. Nudged up
// by 1% of its own reference price (y1) instead, the same delta applied uniformly across every one
// of its points (never scaled per-point) so a multi-point shape — channel, fibonacci, elliott —
// keeps its own relative geometry, just translated as a whole rather than distorted. Falls back to
// a tiny fixed nudge only when y1 is exactly 0 (1% of nothing is still nothing).
export function offsetDrawingUp(dr: TrendLineDrawing): TrendLineDrawing {
  const delta = Math.abs(dr.y1) * 0.01 || 0.01;
  return {
    ...dr,
    y1: round4(dr.y1 + delta),
    y2: round4(dr.y2 + delta),
    extraPoints: dr.extraPoints?.map((p) => ({ ...p, y: round4(p.y + delta) })),
  };
}

// Shared by "channel" and "disjointChannel": the 3rd click's own vertical distance from line 1
// (p1→p2) at that click's date — a constant applied uniformly to line 2 rather than a true
// perpendicular distance, the same simplification most trading platforms use for this tool.
export function channelOffsetFromClick(p1: DataPoint, p2: DataPoint, click: DataPoint, indexForDate: (d: Date) => number): number {
  const x1i = indexForDate(p1.x);
  const x2i = indexForDate(p2.x);
  const onLineY = x2i === x1i ? p1.y : p1.y + (p2.y - p1.y) * ((indexForDate(click.x) - x1i) / (x2i - x1i));
  return click.y - onLineY;
}

// "forecast"'s own quadratic-bezier control point — a fixed 28%-of-length offset perpendicular to
// the straight A→B segment, the one formula both the committed render and its live preview (see
// drawPriceDrawings.ts) build their curve from. Pulled out here (rather than left inlined in each
// of those two spots, as it used to be) so hit-testing (see forecastCurvePoints below) can derive
// hover/drag detection from the *exact* same curve that actually gets drawn, instead of drifting
// out of sync with a second, hand-copied formula.
export function forecastControlPoint(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // The offset's own sign bows a *rising* A→B (B's own price above A's) the intended way by
  // default; a *declining* one needs it mirrored to read the same way visually instead of bowing
  // toward the "outside" of the falling line — declining means A's own price is higher than B's,
  // i.e. in pixel terms A's own pixel-Y sits *below* B's numerically (price and pixel-Y are
  // inverted), so `ay < by`.
  const bow = len * 0.28 * (ay < by ? -1 : 1);
  return { x: (ax + bx) / 2 - (dy / len) * bow, y: (ay + by) / 2 + (dx / len) * bow };
}

// "rangeForecast"'s own default Max/Min band width — 5% of the 2nd ("direction") click's own
// price, the level their own average always lands on exactly, not of its distance from the start
// (a direction click landing barely off the start's own price would otherwise get an almost-zero
// band). Only ever applied once, at creation — Max/Min are freely, independently draggable by
// hand afterward, same as any other point.
const RANGE_FORECAST_BAND_RATIO = 0.05;

// "rangeForecast" only takes 2 clicks — the start and a "direction" click that's never itself
// stored, only used to derive where Max/Min first land (see TrendLineDrawing.lineType's own doc)
// — both then ordinary, independently draggable points like any other tool's. Max/Min bracket the
// direction click's own price symmetrically (see RANGE_FORECAST_BAND_RATIO), sharing its date, so
// their own average lands exactly on the direction click itself.
export function rangeForecastMaxMin(direction: DataPoint): { max: DataPoint; min: DataPoint } {
  const spread = Math.abs(direction.y) * RANGE_FORECAST_BAND_RATIO;
  return {
    max: { x: direction.x, y: round4(direction.y + spread) },
    min: { x: direction.x, y: round4(direction.y - spread) },
  };
}

// "longPosition"/"shortPosition"'s own default reward/risk — 10% toward profit, 5% toward loss,
// a 2:1 reward:risk ratio being the most common rule-of-thumb default for this kind of tool. Only
// ever applied once, at creation — target/stop are freely, independently draggable by hand
// afterward, same as rangeForecast's own Max/Min.
const POSITION_TARGET_RATIO = 0.1;
const POSITION_STOP_RATIO = 0.05;

// "longPosition"/"shortPosition" are single-click tools — entry is the click itself, target/stop
// are derived from it immediately, no 2nd "direction" click needed (unlike rangeForecast). A long
// profits as price rises, so its target sits above entry and its stop below; a short profits as
// price falls, so it's the mirror image. Prices only — the caller supplies target/stop's own date
// (a fixed default bar offset from entry, needing indexForDate/dateForIndex this file doesn't
// have access to) and assembles the full DataPoint itself.
export function longShortPositionDefaults(entryPrice: number, kind: "longPosition" | "shortPosition"): { targetPrice: number; stopPrice: number } {
  const targetDelta = entryPrice * POSITION_TARGET_RATIO;
  const stopDelta = entryPrice * POSITION_STOP_RATIO;
  return kind === "longPosition"
    ? { targetPrice: round4(entryPrice + targetDelta), stopPrice: round4(entryPrice - stopDelta) }
    : { targetPrice: round4(entryPrice - targetDelta), stopPrice: round4(entryPrice + stopDelta) };
}

// "forecast"'s curve, sampled into a polyline for hit-testing (see useDrawingInteractions' own
// hover-detection, which walks this the same "min distance over consecutive segments" way brush/
// elliott/symbolOverlay already do for their own multi-point shapes) — a curved line has no single
// straight chord a plain distanceToSegment call could test against, so this stands in for one.
export function forecastCurvePoints(ax: number, ay: number, bx: number, by: number, steps = 24): { x: number; y: number }[] {
  const c = forecastControlPoint(ax, ay, bx, by);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    // Quadratic Bézier: B(t) = (1-t)²·A + 2(1-t)t·C + t²·B — same curve ctx.quadraticCurveTo(cx,
    // cy, bx, by) draws natively on canvas, just evaluated pointwise here instead.
    points.push({
      x: mt * mt * ax + 2 * mt * t * c.x + t * t * bx,
      y: mt * mt * ay + 2 * mt * t * c.y + t * t * by,
    });
  }
  return points;
}
