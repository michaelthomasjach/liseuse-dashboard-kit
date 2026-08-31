import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

const HATCH_SPACING = 10;

/** Diagonal (45°) hatch lines swept across `[−height, boundedWidth)` at a fixed spacing — anchored
 *  to the *plot's own* coordinate system, not to whatever region the caller is about to clip it
 *  to, so the pattern always lines up the same way regardless of where that region's own edge
 *  happens to land as the chart zooms/pans (a caller clipping to a narrower rect still sees the
 *  same lines, just fewer of them, not a pattern that shifts/reflows). Shared by `drawFutureZone`/
 *  `drawPastZone` below and, during replay, `drawReplayMask.ts`'s own cover — see that file's own
 *  doc for why: its opaque fill would otherwise silently swallow this same hatching drawn earlier
 *  in the same pass, which is exactly what used to make "Zone rayée après la dernière bougie"
 *  silently do nothing while replay was active. Caller owns its own `save`/`clip`/`restore`. */
export function drawHatchLines(ctx: CanvasRenderingContext2D, boundedWidth: number, height: number, style: ChartCanvasStyle) {
  ctx.strokeStyle = style.colorMuted;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let x = -height; x < boundedWidth; x += HATCH_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + height, 0);
    ctx.stroke();
  }
}

/** The "future" marker (see CandlestickChartProps... actually a chart-settings toggle, not a
 *  prop — see useChartAppearance's own futureZoneVisible) — a diagonal-hatched rectangle spanning
 *  the price pane's own full height, from just past the last candle to the plot's own right edge,
 *  marking the boundary between real data and the timeline's unbounded future beyond it. Drawn
 *  first, before candles/drawings/grid, so it reads as a background layer everything else paints
 *  over.
 *
 *  Skipped entirely while replay is active: `drawReplayMask.ts`'s own cover already marks
 *  everything past the *replay* cutoff (which sits before the real last candle) — drawing this
 *  one too would just paint hatching this same pass' own later opaque fill erases right back. */
export function drawFutureZone(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { futureZoneVisible, replayActive, data, zoomedXScale, dims, priceHeight, indexForDate } = params;
  if (!futureZoneVisible || replayActive || data.length === 0) return;

  const lastCandle = data[data.length - 1];
  const zoneLeft = zoomedXScale(indexForDate(lastCandle.date) + 1);
  if (zoneLeft >= dims.boundedWidth) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(zoneLeft, 0, dims.boundedWidth - zoneLeft, priceHeight);
  ctx.clip();
  drawHatchLines(ctx, dims.boundedWidth, priceHeight, style);
  ctx.restore();
}

/** Mirror of `drawFutureZone` above, before the *first* candle instead of after the last — "no
 *  data here either" reads the same in both directions. Unaffected by replay (see
 *  `useReplayState.ts`'s own doc — a cutoff only ever hides the *right* side of the timeline,
 *  never the left), so unlike `drawFutureZone` this needs no `replayActive` guard. */
export function drawPastZone(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { pastZoneVisible, data, zoomedXScale, priceHeight, dims, indexForDate } = params;
  if (!pastZoneVisible || data.length === 0) return;

  const firstCandle = data[0];
  const zoneRight = zoomedXScale(indexForDate(firstCandle.date));
  if (zoneRight <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, zoneRight, priceHeight);
  ctx.clip();
  drawHatchLines(ctx, dims.boundedWidth, priceHeight, style);
  ctx.restore();
}
