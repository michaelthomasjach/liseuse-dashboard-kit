import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawDrawingText } from "../drawingRender";

// "comment"'s own speech-bubble — padding/radius/tail size, not configurable (the reference
// "iPhone message" look this is modeled on doesn't vary these either).
const BUBBLE_PAD_X = 10;
const BUBBLE_PAD_Y = 7;
const BUBBLE_RADIUS = 10;
const BUBBLE_TAIL_WIDTH = 10;
const BUBBLE_TAIL_HEIGHT = 8;

/** "text"/"comment" (see TrendLineDrawing.lineType's own doc): single-point markers, x1/y1 the
 *  anchor (x2/y2 an unused mirror, same convention arrowUp/arrowDown already use). "text" is
 *  exactly `drawDrawingText` — the plain label every other tool's own `text` already renders
 *  through — anchored at a single point instead of along a line. "comment" draws a rounded
 *  speech-bubble instead, its own tail pointing at the anchor and its body sitting up-and-right
 *  of it, filled with `textBackgroundColor` (falling back to the theme's accent rather than no
 *  fill at all — unlike a plain label, a comment reads as broken without a bubble around it) and
 *  its text in `textColor` (falling back to white, matching the reference "iPhone message" bubble
 *  this is modeled on rather than any particular theme's contrast rules). Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawTextAndCommentDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "text" && dr.lineType !== "comment") continue;
    if (!dr.text) continue;
    const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y = zoomedPriceScale(dr.y1);

    if (dr.lineType === "text") {
      drawDrawingText(ctx, dr, x, y, x, y, dr.color ?? colorAccent, fontFamily);
      continue;
    }

    const size = dr.textSize ?? 11;
    const weight = dr.textBold === false ? 400 : 600;
    const fontStyle = dr.textItalic ? "italic" : "normal";
    ctx.save();
    ctx.font = `${fontStyle} ${weight} ${size}px ${fontFamily}`;
    const textWidth = ctx.measureText(dr.text).width;
    const boxWidth = textWidth + BUBBLE_PAD_X * 2;
    const boxHeight = size + BUBBLE_PAD_Y * 2;
    const left = x;
    const bottom = y - BUBBLE_TAIL_HEIGHT;
    const top = bottom - boxHeight;
    const bg = dr.textBackgroundColor ?? colorAccent;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(left, top, boxWidth, boxHeight, BUBBLE_RADIUS);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(left + BUBBLE_RADIUS + 2, bottom);
    ctx.lineTo(x, y);
    ctx.lineTo(left + BUBBLE_RADIUS + 2 + BUBBLE_TAIL_WIDTH, bottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = dr.textColor ?? "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dr.text, left + BUBBLE_PAD_X, top + boxHeight / 2);
    ctx.restore();
  }
}
