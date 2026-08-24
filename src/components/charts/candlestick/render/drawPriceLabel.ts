import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawSpeechBubble } from "../drawingRender";

/** "priceLabel" (see TrendLineDrawing.lineType's own doc): a single-point marker (x1/y1, x2/y2 an
 *  unused mirror, same convention arrowUp/pin/flagMark already use) whose own speech bubble (see
 *  drawSpeechBubble) always shows `dr.y1` itself, formatted — never `dr.text` (there's no live
 *  entry for this tool, nothing was ever typed), and never a value baked in at creation time, so
 *  dragging the point keeps the shown price correct with no extra bookkeeping. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawPriceLabelDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "priceLabel") continue;
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);
    drawSpeechBubble(
      ctx,
      x,
      y,
      dr.y1.toFixed(2),
      dr.textBackgroundColor ?? dr.color ?? colorAccent,
      dr.textColor ?? "#ffffff",
      fontFamily,
      dr.textSize ?? 11,
      dr.textBold !== false,
      dr.textItalic ?? false
    );
  }
}
