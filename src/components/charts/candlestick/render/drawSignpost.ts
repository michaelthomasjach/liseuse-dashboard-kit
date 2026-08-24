import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawDrawingText } from "../drawingRender";

// Same "nearest candle" snap magnetSnapPrice already uses elsewhere — index i is candle i's own
// body, spanning [i, i+1) in the scale's own domain, so the candle *under* a raw index needs the
// same -0.5 correction before rounding.
function candleAt(data: RenderCandlestickChartParams["data"], indexForDate: (d: Date) => number, x: Date) {
  const idx = Math.min(data.length - 1, Math.max(0, Math.round(indexForDate(x) - 0.5)));
  return data[idx];
}

/** "signpost" (see TrendLineDrawing.lineType's own doc): a single-point label (x1/y1, exactly
 *  like "text") with a dashed vertical connector down to whichever candle's own close sits at its
 *  date — never a stored point, always looked up fresh here so dragging the label along the date
 *  axis keeps the connector attached to the candle actually under it. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawSignpostDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, data, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "signpost" || !dr.text || data.length === 0) continue;
    const candle = candleAt(data, indexForDate, dr.x1);
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const labelY = zoomedPriceScale(dr.y1);
    const closeY = zoomedPriceScale(candle.close);
    const color = dr.color ?? colorAccent;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, labelY);
    ctx.lineTo(x, closeY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, closeY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    drawDrawingText(ctx, dr, x, labelY, x, labelY, color, fontFamily);
  }
}
