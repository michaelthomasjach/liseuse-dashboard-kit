import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawCalloutLabel, drawSpeechBubble } from "../drawingRender";
import { isOffsetPriceLabel, priceLabelText } from "../drawingGeometry";

/** "priceLabel" (see TrendLineDrawing.lineType's own doc). Placed in two clicks: a dot on its anchor (x1/y1),
 *  a leader line, and a label box centred on the second point (x2/y2) — so labels of nearby points can be set
 *  apart instead of piling up on each other. Every leader line is drawn before any label, so a label always
 *  reads on top of a neighbour's line. A label whose two points coincide (the original single-click marker)
 *  keeps its speech bubble on the point itself. Either way it shows `priceLabelText`: the anchor's own price
 *  (`dr.y1`, recomputed every render, so dragging the anchor keeps it correct) unless the drawing carries a
 *  `text`. Called from `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawPriceLabelDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate, hoveredDrawingId } = params;
  const { colorAccent, fontFamily } = style;
  const labels = visibleDrawings.filter((dr) => dr.lineType === "priceLabel");
  const fillOf = (dr: (typeof labels)[number]) => dr.textBackgroundColor ?? dr.color ?? colorAccent;

  // 1. Leader lines and anchor dots.
  for (const dr of labels) {
    if (!isOffsetPriceLabel(dr)) continue;
    const ax = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const ay = zoomedPriceScale(dr.y1);
    const lx = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const ly = zoomedPriceScale(dr.y2);
    ctx.save();
    ctx.strokeStyle = dr.color ?? fillOf(dr);
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.setLineDash(dr.lineStyle === "dashed" ? [6, 4] : dr.lineStyle === "dotted" ? [2, 3] : []);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = dr.color ?? fillOf(dr);
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Labels, on top of every line.
  for (const dr of labels) {
    const fg = dr.textColor ?? "#ffffff";
    const size = dr.textSize ?? 11;
    const text = priceLabelText(dr);
    const bold = dr.textBold !== false;
    const italic = dr.textItalic ?? false;
    if (isOffsetPriceLabel(dr)) {
      drawCalloutLabel(ctx, zoomedXScale(indexForDate(dr.x2) + 0.5), zoomedPriceScale(dr.y2), text, fillOf(dr), fg, fontFamily, size, bold, italic);
    } else {
      drawSpeechBubble(ctx, zoomedXScale(indexForDate(dr.x1) + 0.5), zoomedPriceScale(dr.y1), text, fillOf(dr), fg, fontFamily, size, bold, italic);
    }
  }
}
