import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawDrawingText } from "../drawingRender";

/** "note"/"priceNote" (see TrendLineDrawing.lineType's own doc): a plain 2-point line from the
 *  anchor (x1/y1, marked with a small filled dot — never itself labeled, same convention
 *  rangeForecast's own start point already uses) to the note's own label
 *  (x2/y2), drawn through the exact same `drawDrawingText` every other tool's label already uses.
 *  "priceNote" only differs in *what* text that draws — never `dr.text` verbatim, always a shallow
 *  clone with the anchor's own current price (recomputed from `dr.y1` every render, so dragging it
 *  keeps the shown price correct with no extra bookkeeping) prefixed onto it, same "derive, don't
 *  trust a stored snapshot" stance rangeForecast's own Avg/% labels already take. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawNoteDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if ((dr.lineType !== "note" && dr.lineType !== "priceNote") || !dr.text) continue;
    const x1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y1 = zoomedPriceScale(dr.y1);
    const x2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const y2 = zoomedPriceScale(dr.y2);
    const lineColor = dr.color ?? colorAccent;

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x1, y1, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.restore();

    const labelSource = dr.lineType === "priceNote" ? { ...dr, text: `${dr.y1.toFixed(2)}  ${dr.text}` } : dr;
    drawDrawingText(ctx, labelSource, x2, y2, x2, y2, lineColor, fontFamily);
  }
}
