import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawDrawingText, drawSpeechBubble } from "../drawingRender";

/** "text"/"comment" (see TrendLineDrawing.lineType's own doc): single-point markers, x1/y1 the
 *  anchor (x2/y2 an unused mirror, same convention arrowUp/arrowDown already use). "text" is
 *  exactly `drawDrawingText` — the plain label every other tool's own `text` already renders
 *  through — anchored at a single point instead of along a line. "comment" draws a rounded
 *  speech-bubble instead (see drawSpeechBubble), filled with `textBackgroundColor` (falling back
 *  to the theme's accent rather than no fill at all — unlike a plain label, a comment reads as
 *  broken without a bubble around it) and its text in `textColor` (falling back to white, matching
 *  the reference "iPhone message" bubble this is modeled on rather than any particular theme's
 *  contrast rules). Called from `drawPriceDrawings` while its own price-section clip is still
 *  open, same as every other price-space drawing type. */
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

    drawSpeechBubble(
      ctx,
      x,
      y,
      dr.text,
      dr.textBackgroundColor ?? colorAccent,
      dr.textColor ?? "#ffffff",
      fontFamily,
      dr.textSize ?? 11,
      dr.textBold !== false,
      dr.textItalic ?? false
    );
  }
}
