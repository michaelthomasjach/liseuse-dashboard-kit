import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { HEAD_SHOULDERS_VERTEX_LABELS } from "../drawingCatalog";
import { extendSegmentToEdges } from "../drawingGeometry";
import { FILL_ALPHA } from "../drawingFills";
import { drawPillLabel, drawDrawingText } from "../drawingRender";

// Which of the pattern's own 7 vertices get a named pill badge, keyed by index into the 7-point
// array this file builds everywhere below — French, matching this tool's own name ("ETE :
// Épaule-Tête-Épaule") rather than the English wording a reference chart might show.
const PEAK_LABELS: Record<number, string> = { 1: "Épaule gauche", 3: "Tête", 5: "Épaule droite" };

/** "headShoulders" (see TrendLineDrawing.lineType's own doc): the pattern's own 7 vertices drawn
 *  as one connected polyline, every point numbered, the three peaks additionally named with a
 *  pill badge; a dashed horizontal line at the head's own price level; a dotted "neckline"
 *  through points 1 and 5 (never a stored point of its own — always derived from them, same
 *  "computed, not clicked" idea disjointChannel's own 4th point already uses) extended
 *  indefinitely rightward past point 7 unless point 7 itself has already closed below it, in
 *  which case it stops extending right there instead of projecting into an already-resolved
 *  pattern; and the region between the polyline and the neckline filled. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawHeadShouldersDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorDown, colorMuted, colorAccent, colorBg, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "headShoulders" || (dr.extraPoints?.length ?? 0) < 5) continue;
    const [d3Point, d4Point, d5Point, d6Point, d7Point] = dr.extraPoints!;
    const toScreen = (p: { x: Date; y: number }) => ({ x: zoomedXScale(indexForDate(p.x) + 0.5), y: zoomedPriceScale(p.y) });
    const points = [{ x: dr.x1, y: dr.y1 }, { x: dr.x2, y: dr.y2 }, d3Point, d4Point, d5Point, d6Point, d7Point].map(toScreen);
    const [p1, p2, p3, p4, p5, p6, p7] = points;
    const lineColor = dr.color ?? colorAccent;

    // A confirmed breakout (point 7 already closed below the neckline) — checked in data space,
    // interpolating by bar index between points 1 and 5 the same way channelOffsetFromClick
    // already does for "channel"/"disjointChannel", not by raw calendar-date arithmetic (which
    // would skew unevenly across weekends/holidays the index positions don't have).
    const x1i = indexForDate(dr.x1);
    const x5i = indexForDate(d5Point.x);
    const x7i = indexForDate(d7Point.x);
    const necklineYAtX7 = x5i === x1i ? dr.y1 : dr.y1 + (d5Point.y - dr.y1) * ((x7i - x1i) / (x5i - x1i));
    const broken = d7Point.y < necklineYAtX7;
    // The neckline's own far endpoint, in screen space — point 7 itself once broken (the neckline
    // stops extending there instead of projecting into an already-resolved pattern), otherwise the
    // plot's own right edge, both normalized to the same {x, y} shape regardless of which branch
    // produced it.
    const necklineEnd = broken
      ? p7
      : (() => {
          const extended = extendSegmentToEdges(p1.x, p1.y, p5.x, p5.y, 0, dims.boundedWidth, "right");
          return { x: extended.x2, y: extended.y2 };
        })();

    // Filled region between the polyline and the neckline — closes back to p1 via the neckline's
    // own point directly under p7 (not a straight p7→p1 chord), so the fill's own lower edge
    // actually follows the neckline even where point 7 has drifted away from it.
    ctx.save();
    ctx.fillStyle = dr.fillColor ?? lineColor;
    ctx.globalAlpha = FILL_ALPHA;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    for (const p of [p2, p3, p4, p5, p6, p7]) ctx.lineTo(p.x, p.y);
    ctx.lineTo(necklineEnd.x, necklineEnd.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The pattern's own polyline, through all 7 vertices in order.
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();

    // Resistance line at the head's own price level — a neutral color (not the pattern's own),
    // so it reads as a generic reference level rather than one more part of the shape itself.
    ctx.save();
    ctx.strokeStyle = colorMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, p4.y);
    ctx.lineTo(dims.boundedWidth, p4.y);
    ctx.stroke();
    ctx.restore();

    // The neckline itself — dotted, through points 1 and 5, extended to the plot's own right edge
    // for as long as the pattern hasn't resolved, stopping exactly at point 7 once it has (see
    // `broken` above).
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = dr.strokeWidth ?? 1.5;
    ctx.setLineDash([1.5, 3]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(necklineEnd.x, necklineEnd.y);
    ctx.stroke();
    ctx.restore();

    // Every vertex numbered (1-7, in the theme's own "down" red — distinct from the pattern's own
    // line color, matching how a plain number reads as an annotation rather than part of the
    // shape) plus a small persistent dot, then the three peaks additionally named with their own
    // pill badge, floating clear above their own number.
    ctx.save();
    ctx.font = `700 10px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colorDown;
    points.forEach((p, i) => ctx.fillText(HEAD_SHOULDERS_VERTEX_LABELS[i] ?? "", p.x, p.y - 8));
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    for (const p of points) {
      ctx.moveTo(p.x + 3, p.y);
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    }
    ctx.fill();

    points.forEach((p, i) => {
      const label = PEAK_LABELS[i];
      if (label) drawPillLabel(ctx, p.x, p.y - 26, label, lineColor, colorBg, fontFamily, "center");
    });

    // The user's own label, anchored across the figure's first and last vertices — the same
    // `drawDrawingText` every other tool goes through. It was never called here, so the Texte tab
    // accepted a label for this pattern and then nothing appeared.
    drawDrawingText(ctx, dr, points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y, lineColor, fontFamily);
  }
}
