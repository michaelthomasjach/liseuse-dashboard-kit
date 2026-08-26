import type { ScaleLinear } from "d3";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import type { Candle } from "./interfaces/Candle.interface";
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
  /** "signpost" only — its own vertical connector needs the actual candle at its own date to know
   *  where the *other* end (the close) lands, same lookup drawSignpost.ts does at render time. */
  data: Candle[];
}

/** Pixel distance from (mouseX, mouseY) to a drawing, one dedicated per-lineType formula each
 *  matching exactly what its own render branch actually draws (see drawPriceDrawings.ts,
 *  drawPitchfork.ts, drawRangeForecast.ts) — pulled out of `useDrawingInteractions`'s own
 *  pointer-move handler purely to keep that file under its 1000-line budget; behavior unchanged,
 *  this is the same per-lineType if/else-if chain it always was. */
export function distanceToDrawing(dr: TrendLineDrawing, mouseX: number, mouseY: number, ctx: HitTestContext): number {
  const { dims, plotBoundedHeight, priceHeight, zoomedXScale, zoomedPriceScale, indexForDate, pixelYForDrawing, overlayProjections, data } = ctx;
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
  if (
    dr.lineType === "elliottImpulse" ||
    dr.lineType === "elliottCorrection" ||
    dr.lineType === "brush" ||
    dr.lineType === "elbowArrow" ||
    dr.lineType === "headShoulders" ||
    dr.lineType === "cupHandle"
  ) {
    // Same "polyline through every point" distance for a freehand stroke, an open-ended
    // elbow-arrow polyline, or an Elliott wave's/Head & Shoulders'/Cup & Handle's own fixed
    // vertices.
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
  if (dr.lineType === "table") {
    // Unlike "rectangle" above (outline-only), the grid reads as one filled shape — anywhere
    // inside counts as a direct hit (d = 0), matching "zones"' own reasoning below, since a cell
    // needs to be clickable/double-clickable everywhere within its own bounds, not just its border.
    const rx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const ry1 = zoomedPriceScale(dr.y1);
    const rx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const ry2 = zoomedPriceScale(dr.y2);
    const left = Math.min(rx1, rx2);
    const right = Math.max(rx1, rx2);
    const top = Math.min(ry1, ry2);
    const bottom = Math.max(ry1, ry2);
    return mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom
      ? 0
      : Math.min(
          distanceToSegment(mouseX, mouseY, left, top, right, top),
          distanceToSegment(mouseX, mouseY, right, top, right, bottom),
          distanceToSegment(mouseX, mouseY, right, bottom, left, bottom),
          distanceToSegment(mouseX, mouseY, left, bottom, left, top)
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
  if (dr.lineType === "pin" || dr.lineType === "flagMark") {
    // Both markers draw entirely *above* their own anchor (see drawMarkers.ts) — a plain distance
    // to the anchor pixel itself would need the pointer right at its very tip/base, missing most
    // of what's actually visible. Same clamp-into-a-box technique as text/comment above, just a
    // fixed size instead of one estimated from text content, since these have no text at all.
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);
    const halfWidth = dr.lineType === "pin" ? 8 : 15;
    const height = dr.lineType === "pin" ? 26 : 20;
    const clampedX = Math.min(Math.max(mouseX, x - halfWidth), x + halfWidth);
    const clampedY = Math.min(Math.max(mouseY, y - height), y);
    return Math.hypot(mouseX - clampedX, mouseY - clampedY);
  }
  if (dr.lineType === "signpost" && dr.text && data.length > 0) {
    // Min of the vertical connector (distanceToSegment, down/up to whatever candle's own close
    // sits at x1's date — same lookup drawSignpost.ts uses at render time) and the label's own
    // box, same clamp-into-the-box technique as text/comment below (grows upward from x1/y1,
    // "top"-aligned like "comment", see commitTextEntry).
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const labelY = zoomedPriceScale(dr.y1);
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(indexForDate(dr.x1) - 0.5)));
    const closeY = zoomedPriceScale(data[idx].close);
    const lineDist = distanceToSegment(mouseX, mouseY, x, labelY, x, closeY);
    const size = dr.textSize ?? 11;
    const boxWidth = dr.text.length * size * 0.55 + 20;
    const bottom = labelY - 6;
    const top = bottom - size - 4;
    const clampedX = Math.min(Math.max(mouseX, x), x + boxWidth);
    const clampedY = Math.min(Math.max(mouseY, top), bottom);
    return Math.min(lineDist, Math.hypot(mouseX - clampedX, mouseY - clampedY));
  }
  if (dr.lineType === "priceLabel") {
    // Same bubble shape as "comment" below (both go through drawSpeechBubble) — estimated from a
    // fixed length instead of dr.text.length, since this tool never sets dr.text at all (its own
    // bubble always shows a live-computed price string, see drawPriceLabel.ts).
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);
    const size = dr.textSize ?? 11;
    const boxWidth = dr.y1.toFixed(2).length * size * 0.55 + 20;
    const top = y - 8 - size - 14;
    const bottom = y - 8;
    const clampedX = Math.min(Math.max(mouseX, x), x + boxWidth);
    const clampedY = Math.min(Math.max(mouseY, top), bottom);
    return Math.hypot(mouseX - clampedX, mouseY - clampedY);
  }
  if (dr.lineType === "text" || dr.lineType === "comment") {
    // No canvas context here to measure the *actual* rendered width (see drawTextAndComment.ts),
    // so this estimates it from character count — close enough for "is the pointer roughly over
    // the label," the only thing this feeds into. Clamping the pointer into the box and measuring
    // from there gives 0 (a direct hit) anywhere inside it and the distance to the nearest edge
    // outside it, in one formula, same idea "zones"' own hit-test above already uses.
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);
    if (!dr.text) return Math.hypot(mouseX - x, mouseY - y);
    const size = dr.textSize ?? 11;
    const estWidth = dr.text.length * size * 0.55;
    const boxWidth = estWidth + 20;
    // Both start exactly at the anchor and grow right — "comment"'s bubble always does (its own
    // fillText is always left-aligned); "text" does too since it's created with
    // textHorizontalAlign: "left" (see useDrawingState's own commitTextEntry) so the live input
    // and the committed render line up instead of the render re-centering out from under it.
    const left = x;
    // "comment"'s bubble sits above its anchor (tail pointing down at it); "text" (created with
    // textVerticalAlign: "bottom", see commitTextEntry) grows downward from its own instead.
    const top = dr.lineType === "comment" ? y - 8 - size - 14 : y + 6;
    const bottom = dr.lineType === "comment" ? y - 8 : top + size + 4;
    const clampedX = Math.min(Math.max(mouseX, left), left + boxWidth);
    const clampedY = Math.min(Math.max(mouseY, top), bottom);
    return Math.hypot(mouseX - clampedX, mouseY - clampedY);
  }
  if (dr.lineType === "note" || dr.lineType === "priceNote") {
    // Min of the plain anchor-to-label line (distanceToSegment, same as a regular trend line)
    // and the label's own box at the far end (same clamp-into-the-box technique as text/comment
    // above) — "priceNote" pads its own estimate for the price prefix drawNote.ts always adds
    // ahead of `dr.text` (not itself part of the stored string), close enough at a fixed guess
    // since the actual price string's length barely varies test to test.
    const x1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y1 = zoomedPriceScale(dr.y1);
    const x2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const y2 = zoomedPriceScale(dr.y2);
    const lineDist = distanceToSegment(mouseX, mouseY, x1, y1, x2, y2);
    if (!dr.text) return lineDist;
    const size = dr.textSize ?? 11;
    const pricePadding = dr.lineType === "priceNote" ? 9 * size * 0.55 : 0;
    const boxWidth = dr.text.length * size * 0.55 + pricePadding + 20;
    // Grows upward from y2 (textVerticalAlign: "top", set at creation — see commitTextEntry).
    const bottom = y2 - 6;
    const top = bottom - size - 4;
    const clampedX = Math.min(Math.max(mouseX, x2), x2 + boxWidth);
    const clampedY = Math.min(Math.max(mouseY, top), bottom);
    return Math.min(lineDist, Math.hypot(mouseX - clampedX, mouseY - clampedY));
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
    const segments = [handle, spine];
    if (dr.pitchforkShowMedian ?? true) segments.push(median);
    if (dr.pitchforkShowTine1 ?? true) segments.push(tine1);
    if (dr.pitchforkShowTine2 ?? true) segments.push(tine2);
    return Math.min(...segments.map((s) => distanceToSegment(mouseX, mouseY, s.x1, s.y1, s.x2, s.y2)));
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
  if ((dr.lineType === "longPosition" || dr.lineType === "shortPosition") && dr.extraPoints?.length) {
    // Two bounded rectangles (target zone, stop zone), same "inside either one counts as a
    // direct hit" convention "zones" above uses for its own (unbounded) bands — falling back to
    // distance from the 3 boundary lines (entry/target/stop) drawLongShortPositionDrawings.ts
    // actually draws only once the pointer's outside both rects entirely.
    const stopPoint = dr.extraPoints[0];
    const ex = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const ey = zoomedPriceScale(dr.y1);
    const tx = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const ty = zoomedPriceScale(dr.y2);
    const spx = zoomedXScale(indexForDate(stopPoint.x) + 0.5);
    const spy = zoomedPriceScale(stopPoint.y);
    const insideRect = (ax: number, ay: number, bx: number, by: number) =>
      mouseX >= Math.min(ax, bx) && mouseX <= Math.max(ax, bx) && mouseY >= Math.min(ay, by) && mouseY <= Math.max(ay, by);
    if (insideRect(ex, ey, tx, ty) || insideRect(ex, ey, spx, spy)) return 0;
    return Math.min(
      distanceToSegment(mouseX, mouseY, ex, ey, Math.max(tx, spx), ey),
      distanceToSegment(mouseX, mouseY, Math.min(ex, tx), ty, Math.max(ex, tx), ty),
      distanceToSegment(mouseX, mouseY, Math.min(ex, spx), spy, Math.max(ex, spx), spy)
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
