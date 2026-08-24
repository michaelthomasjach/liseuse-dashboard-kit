import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

// Fixed pixel sizes — unrelated to strokeWidth (see TrendLineDrawing.lineType's own doc), same
// stance arrowUp/arrowDown's own fixed-size triangle already takes.
const PIN_CIRCLE_RADIUS = 7;
const PIN_CIRCLE_OFFSET_Y = 16;
const PIN_INNER_DOT_RADIUS = 2.5;
const FLAG_POLE_HEIGHT = 20;
const FLAG_WIDTH = 14;
const FLAG_HEIGHT = 8;

/** "pin"/"flagMark" (see TrendLineDrawing.lineType's own doc): single-point markers, x1/y1 the
 *  planted point (x2/y2 an unused mirror, same convention arrowUp/arrowDown already use) — a
 *  map-pin teardrop (tip at the point, hollow center punched through with the theme's own
 *  background so it reads as a ring instead of a solid dot) or a flag on a pole (base at the
 *  point). Called from `drawPriceDrawings` while its own price-section clip is still open, same
 *  as every other price-space drawing type. */
export function drawMarkerDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, colorBg } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "pin" && dr.lineType !== "flagMark") continue;
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);
    const color = dr.color ?? colorAccent;
    ctx.save();
    ctx.fillStyle = color;

    if (dr.lineType === "pin") {
      const cy = y - PIN_CIRCLE_OFFSET_Y;
      const tipHalfWidth = PIN_CIRCLE_RADIUS * 0.6;
      ctx.beginPath();
      ctx.arc(x, cy, PIN_CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.moveTo(x - tipHalfWidth, cy + PIN_CIRCLE_RADIUS * 0.55);
      ctx.lineTo(x, y);
      ctx.lineTo(x + tipHalfWidth, cy + PIN_CIRCLE_RADIUS * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, cy, PIN_INNER_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = colorBg;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - FLAG_POLE_HEIGHT);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - FLAG_POLE_HEIGHT);
      ctx.lineTo(x + FLAG_WIDTH, y - FLAG_POLE_HEIGHT + FLAG_HEIGHT / 2);
      ctx.lineTo(x, y - FLAG_POLE_HEIGHT + FLAG_HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
