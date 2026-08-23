import type { ScaleLinear } from "d3";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import { FIBONACCI_LEVELS, FIBONACCI_EXTENSION_LEVELS } from "./drawingCatalog";
import { allPointsOf, distanceToSegment, effectiveExtendOf, extendSegmentToEdges, forecastCurvePoints } from "./drawingGeometry";
import { pitchforkLines } from "./pitchforkGeometry";
import type { PitchforkVariant } from "./pitchforkGeometry";

const PITCHFORK_LINE_TYPES = new Set(["pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork", "insidePitchfork"]);

export interface HitTestContext {
  dims: { boundedWidth: number };
  plotBoundedHeight: number;
  priceHeight: number;
  zoomedXScale: ScaleLinear<number, number>;
  zoomedPriceScale: ScaleLinear<number, number>;
  indexForDate: (d: Date) => number;
  pixelYForDrawing: (dr: TrendLineDrawing) => number;
  overlayProjections: { drawing: TrendLineDrawing; mainReference: number; points: { i: number; price: number }[] }[];
}

/** Pixel distance from (mouseX, mouseY) to a drawing, one dedicated per-lineType formula each
 *  matching exactly what its own render branch actually draws (see drawPriceDrawings.ts,
 *  drawPitchfork.ts, drawRangeForecast.ts) — pulled out of `useDrawingInteractions`'s own
 *  pointer-move handler purely to keep that file under its 1000-line budget; behavior unchanged,
 *  this is the same per-lineType if/else-if chain it always was. */
export function distanceToDrawing(dr: TrendLineDrawing, mouseX: number, mouseY: number, ctx: HitTestContext): number {
  const { dims, plotBoundedHeight, priceHeight, zoomedXScale, zoomedPriceScale, indexForDate, pixelYForDrawing, overlayProjections } = ctx;
  // Axis-constrained lines render full-span (see the canvas draw effect) rather than between
  // their stored x1/x2 pixel positions, so hit-testing has to match that.
  if (dr.lineType === "horizontal") {
    const y = pixelYForDrawing(dr);
    return distanceToSegment(mouseX, mouseY, 0, y, dims.boundedWidth, y);
  }
  if (dr.lineType === "ray") {
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = pixelYForDrawing(dr);
    return distanceToSegment(mouseX, mouseY, x, y, dims.boundedWidth, y);
  }
  if (dr.lineType === "vertical") {
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    return distanceToSegment(mouseX, mouseY, x, 0, x, plotBoundedHeight);
  }
  if (dr.lineType === "channel") {
    const cx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const cy1 = zoomedPriceScale(dr.y1);
    const cx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const cy2 = zoomedPriceScale(dr.y2);
    const offsetPx = zoomedPriceScale(dr.y1 + (dr.channelOffset ?? 0)) - zoomedPriceScale(dr.y1);
    return Math.min(
      distanceToSegment(mouseX, mouseY, cx1, cy1, cx2, cy2),
      distanceToSegment(mouseX, mouseY, cx1, cy1 + offsetPx, cx2, cy2 + offsetPx)
    );
  }
  if (dr.lineType === "fibonacci") {
    const fx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const fx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    return Math.min(
      // The diagonal x1/y1–x2/y2 line itself, same as a regular trend line...
      distanceToSegment(mouseX, mouseY, fx1, zoomedPriceScale(dr.y1), fx2, zoomedPriceScale(dr.y2)),
      // ...plus whichever retracement level line is closest.
      ...FIBONACCI_LEVELS.map((ratio) => {
        const y = zoomedPriceScale(dr.y1 + (dr.y2 - dr.y1) * ratio);
        return distanceToSegment(mouseX, mouseY, fx1, y, fx2, y);
      })
    );
  }
  if (dr.lineType === "elliottImpulse" || dr.lineType === "elliottCorrection" || dr.lineType === "brush" || dr.lineType === "elbowArrow" || dr.lineType === "headShoulders") {
    // Same "polyline through every point" distance for a freehand stroke, an open-ended
    // elbow-arrow polyline, or an Elliott wave's/Head & Shoulders' own fixed vertices.
    const screenPoints = allPointsOf(dr).map((p) => ({ x: zoomedXScale(indexForDate(p.x) + 0.5), y: zoomedPriceScale(p.y) }));
    let minSegmentDist = Infinity;
    for (let i = 1; i < screenPoints.length; i++) {
      minSegmentDist = Math.min(minSegmentDist, distanceToSegment(mouseX, mouseY, screenPoints[i - 1].x, screenPoints[i - 1].y, screenPoints[i].x, screenPoints[i].y));
    }
    return minSegmentDist;
  }
  if (dr.lineType === "rectangle") {
    const rx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const ry1 = zoomedPriceScale(dr.y1);
    const rx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const ry2 = zoomedPriceScale(dr.y2);
    return Math.min(
      distanceToSegment(mouseX, mouseY, rx1, ry1, rx2, ry1),
      distanceToSegment(mouseX, mouseY, rx2, ry1, rx2, ry2),
      distanceToSegment(mouseX, mouseY, rx2, ry2, rx1, ry2),
      distanceToSegment(mouseX, mouseY, rx1, ry2, rx1, ry1)
    );
  }
  if (dr.lineType === "zones") {
    // Unlike "rectangle" above (outline-only hit-testing), the three bands together fill the
    // whole pane height for this x-range — so anywhere inside that column counts as a direct hit
    // (d = 0), not just near one of the two boundary lines.
    const rx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const rx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const left = Math.min(rx1, rx2);
    const right = Math.max(rx1, rx2);
    return mouseX >= left && mouseX <= right && mouseY >= 0 && mouseY <= priceHeight
      ? 0
      : Math.min(
          distanceToSegment(mouseX, mouseY, left, 0, right, 0),
          distanceToSegment(mouseX, mouseY, left, priceHeight, right, priceHeight),
          distanceToSegment(mouseX, mouseY, left, 0, left, priceHeight),
          distanceToSegment(mouseX, mouseY, right, 0, right, priceHeight)
        );
  }
  if (dr.lineType === "arrowUp" || dr.lineType === "arrowDown") {
    return Math.hypot(mouseX - zoomedXScale(indexForDate(dr.x1) + 0.5), mouseY - zoomedPriceScale(dr.y1));
  }
  if (dr.lineType === "symbolOverlay") {
    // Same "polyline through every point" distance as a freehand stroke — over its own projected
    // (rebased-to-price-space) points, not x1/y1/x2/y2, which aren't meaningful for this lineType
    // (see its own doc comment).
    const projection = overlayProjections.find((p) => p.drawing.id === dr.id);
    const screenPoints = (projection?.points ?? []).map((p) => ({ x: zoomedXScale(p.i + 0.5), y: zoomedPriceScale(p.price) }));
    let minSegmentDist = Infinity;
    for (let i = 1; i < screenPoints.length; i++) {
      minSegmentDist = Math.min(minSegmentDist, distanceToSegment(mouseX, mouseY, screenPoints[i - 1].x, screenPoints[i - 1].y, screenPoints[i].x, screenPoints[i].y));
    }
    return minSegmentDist;
  }
  if (dr.lineType === "fibonacciExtension") {
    const ax = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const ay = zoomedPriceScale(dr.y1);
    const bx = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const by = zoomedPriceScale(dr.y2);
    const distances = [distanceToSegment(mouseX, mouseY, ax, ay, bx, by)];
    const pointC = dr.extraPoints?.[0];
    if (pointC) {
      const cx = zoomedXScale(indexForDate(pointC.x) + 0.5);
      const cy = zoomedPriceScale(pointC.y);
      distances.push(distanceToSegment(mouseX, mouseY, bx, by, cx, cy));
      const legDelta = dr.y2 - dr.y1;
      const levelX1 = Math.min(bx, cx);
      const levelX2 = Math.max(bx, cx);
      for (const ratio of FIBONACCI_EXTENSION_LEVELS) {
        const y = zoomedPriceScale(pointC.y + legDelta * ratio);
        distances.push(distanceToSegment(mouseX, mouseY, levelX1, y, levelX2, y));
      }
    }
    return Math.min(...distances);
  }
  if (dr.lineType === "disjointChannel") {
    const jx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const jy1 = zoomedPriceScale(dr.y1);
    const jx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const jy2 = zoomedPriceScale(dr.y2);
    const distances = [distanceToSegment(mouseX, mouseY, jx1, jy1, jx2, jy2)];
    const [p3, p4] = dr.extraPoints ?? [];
    if (p3 && p4) {
      distances.push(
        distanceToSegment(mouseX, mouseY, zoomedXScale(indexForDate(p3.x) + 0.5), zoomedPriceScale(p3.y), zoomedXScale(indexForDate(p4.x) + 0.5), zoomedPriceScale(p4.y))
      );
    }
    return Math.min(...distances);
  }
  if (PITCHFORK_LINE_TYPES.has(dr.lineType ?? "") && dr.extraPoints?.length) {
    // Same 3 extended lines the renderer itself draws (see pitchforkLines' own doc) — reused
    // verbatim rather than re-derived here, so hovering always matches what's shown.
    const p0 = { x: zoomedXScale(indexForDate(dr.x1) + 0.5), y: zoomedPriceScale(dr.y1) };
    const p1 = { x: zoomedXScale(indexForDate(dr.x2) + 0.5), y: zoomedPriceScale(dr.y2) };
    const p2Point = dr.extraPoints[0];
    const p2 = { x: zoomedXScale(indexForDate(p2Point.x) + 0.5), y: zoomedPriceScale(p2Point.y) };
    const { handle, spine, median, tine1, tine2 } = pitchforkLines(p0, p1, p2, dr.lineType as PitchforkVariant, 0, dims.boundedWidth);
    return Math.min(
      distanceToSegment(mouseX, mouseY, handle.x1, handle.y1, handle.x2, handle.y2),
      distanceToSegment(mouseX, mouseY, spine.x1, spine.y1, spine.x2, spine.y2),
      distanceToSegment(mouseX, mouseY, median.x1, median.y1, median.x2, median.y2),
      distanceToSegment(mouseX, mouseY, tine1.x1, tine1.y1, tine1.x2, tine1.y2),
      distanceToSegment(mouseX, mouseY, tine2.x1, tine2.y1, tine2.x2, tine2.y2)
    );
  }
  if (dr.lineType === "rangeForecast" && dr.extraPoints?.length) {
    // Three independent segments fanning from the same start point (Current) to Max/Avg/Min —
    // unlike every other polyline type above, they don't chain point-to-point. Avg isn't one of
    // this drawing's own stored points (see MULTI_POINT_TOOLS' own doc on "rangeForecast") —
    // always the midpoint of Max/Min, recomputed here in screen space.
    const minPoint = dr.extraPoints[0];
    const sx = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const sy = zoomedPriceScale(dr.y1);
    const maxX = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const maxY = zoomedPriceScale(dr.y2);
    const minX = zoomedXScale(indexForDate(minPoint.x) + 0.5);
    const minY = zoomedPriceScale(minPoint.y);
    return Math.min(
      distanceToSegment(mouseX, mouseY, sx, sy, maxX, maxY),
      distanceToSegment(mouseX, mouseY, sx, sy, (maxX + minX) / 2, (maxY + minY) / 2),
      distanceToSegment(mouseX, mouseY, sx, sy, minX, minY)
    );
  }
  if (dr.lineType === "forecast") {
    // Same "polyline through sampled points" distance as brush/elliott/symbolOverlay above —
    // "forecast" bows away from its own straight x1/y1→x2/y2 chord by up to 28% of that chord's
    // own length (see forecastControlPoint's doc), so testing distance-to-the-chord itself would
    // miss the actually-drawn curve almost entirely.
    const fcx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const fcy1 = zoomedPriceScale(dr.y1);
    const fcx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const fcy2 = zoomedPriceScale(dr.y2);
    const screenPoints = forecastCurvePoints(fcx1, fcy1, fcx2, fcy2);
    let minSegmentDist = Infinity;
    for (let i = 1; i < screenPoints.length; i++) {
      minSegmentDist = Math.min(minSegmentDist, distanceToSegment(mouseX, mouseY, screenPoints[i - 1].x, screenPoints[i - 1].y, screenPoints[i].x, screenPoints[i].y));
    }
    return minSegmentDist;
  }
  const x1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
  const y1 = zoomedPriceScale(dr.y1);
  const x2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
  const y2 = zoomedPriceScale(dr.y2);
  // A regular trend line ("extended" included — see effectiveExtendOf) can be extended past
  // x1/x2 via the Style tab, not only when drawn with the dedicated tool.
  const extend = effectiveExtendOf(dr);
  if (extend === "none") return distanceToSegment(mouseX, mouseY, x1, y1, x2, y2);
  const extended = extendSegmentToEdges(x1, y1, x2, y2, 0, dims.boundedWidth, extend);
  return distanceToSegment(mouseX, mouseY, extended.x1, extended.y1, extended.x2, extended.y2);
}
