import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { IndicatorPatternMatch } from "../interfaces/IndicatorPatternMatch.interface";
import { drawPillLabel } from "../drawingRender";

/** "patternRecognition": one polyline through each detected pattern's own vertices (see
 *  `computePatternRecognitionValues`), colored by direction (up/down/neutral — a symmetrical
 *  triangle or a diamond has no directional bias of its own the way a double top does), a label
 *  at its last point — except "support"/"resistance", which read as a flat level rather than a
 *  shape: drawn as a single horizontal line at the cluster's own average price, from its first
 *  touch out to the plot's own right edge (into "future" space), same convention
 *  `computeSupportResistanceValues`'s own rendering already uses. */
export function drawPatternRecognitionMatches(
  ctx: CanvasRenderingContext2D,
  points: { i: number; value: IndicatorPatternMatch }[],
  params: RenderCandlestickChartParams,
  style: ChartCanvasStyle,
  color: string
) {
  const { zoomedXScale, zoomedPriceScale, dims } = params;
  const { colorUp, colorDown, colorBg, fontFamily } = style;
  for (const { value: match } of points) {
    const lineColor = match.direction === "bullish" ? colorUp : match.direction === "bearish" ? colorDown : color;

    if (match.type === "support" || match.type === "resistance") {
      const avgPrice = match.points.reduce((sum, p) => sum + p.price, 0) / match.points.length;
      const x0 = zoomedXScale(match.points[0].index);
      const y = zoomedPriceScale(avgPrice);
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(dims.boundedWidth, y);
      ctx.stroke();
      ctx.restore();
      drawPillLabel(ctx, x0 + 4, y - 12, match.label, lineColor, colorBg, fontFamily, "right");
      continue;
    }

    const screenPoints = match.points.map((p) => ({ x: zoomedXScale(p.index + 0.5), y: zoomedPriceScale(p.price) }));
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.setLineDash(match.type === "flag" ? [3, 3] : []);
    ctx.beginPath();
    screenPoints.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    for (const p of screenPoints) {
      ctx.moveTo(p.x + 2.5, p.y);
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();

    const last = screenPoints[screenPoints.length - 1];
    drawPillLabel(ctx, last.x, last.y - 18, match.label, lineColor, colorBg, fontFamily, "center");
  }
}
