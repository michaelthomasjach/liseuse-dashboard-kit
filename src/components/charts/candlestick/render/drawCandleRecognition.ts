import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { IndicatorCandleMatch } from "../interfaces/IndicatorCandleMatch.interface";
import { drawPillLabel } from "../drawingRender";

/** "candleRecognition": a small pill label at the candle its own match completes on (see
 *  `computeCandleRecognitionValues`), below the candle's own low for a bullish signal, above its
 *  own high for a bearish one (a neutral one, doji, splits the difference — no direction to favor)
 *  — the usual "arrow/label pointing at what actually reverses" convention every charting platform
 *  uses for these. A thin dashed bracket underneath ties the label back to every candle the
 *  pattern's own shape spans (`spanIndex` through `index`) when that's more than the one candle
 *  the label itself sits on. */
export function drawCandleRecognitionMatches(
  ctx: CanvasRenderingContext2D,
  points: { i: number; value: IndicatorCandleMatch }[],
  params: RenderCandlestickChartParams,
  style: ChartCanvasStyle
) {
  const { zoomedXScale, zoomedPriceScale, data } = params;
  const { colorUp, colorDown, colorMuted, colorBg, fontFamily } = style;
  for (const { value: match } of points) {
    const candle = data[match.index];
    if (!candle) continue;
    const lineColor = match.direction === "bullish" ? colorUp : match.direction === "bearish" ? colorDown : colorMuted;
    const bullish = match.direction !== "bearish";
    const anchorX = zoomedXScale(match.index + 0.5);
    const anchorY = zoomedPriceScale(bullish ? candle.low : candle.high) + (bullish ? 20 : -20);

    if (match.spanIndex !== match.index) {
      const spanX = zoomedXScale(match.spanIndex + 0.5);
      const y = zoomedPriceScale(bullish ? candle.low : candle.high) + (bullish ? 8 : -8);
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(spanX, y);
      ctx.lineTo(anchorX, y);
      ctx.stroke();
      ctx.restore();
    }

    drawPillLabel(ctx, anchorX, anchorY, match.label, lineColor, colorBg, fontFamily, "center");
  }
}
