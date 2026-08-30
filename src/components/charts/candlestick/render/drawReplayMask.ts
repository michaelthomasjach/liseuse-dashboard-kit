import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** Replay mode's own "cover" — see CandlestickChartProps.replay and useReplayState's own doc.
 *  While armed (choosing where to cut), a translucent preview follows the pointer
 *  (`replayPreviewIndex`) so the user can see roughly how much history a click would hide before
 *  committing to it; once committed (`replayCutoffIndex`), the same rectangle turns fully opaque,
 *  visually erasing every candle/drawing/indicator past that point without touching the data or
 *  scale that positions what's still visible — see useReplayState's own doc for why slicing `data`
 *  itself isn't used instead (it would also re-fit the X domain, snapping every surviving candle
 *  to a new pixel position instead of leaving them exactly where the user was already looking).
 *
 *  Drawn LAST in renderChart.ts (after candles/drawings/volume/panes), unlike drawFutureZone's own
 *  background layer, specifically so it paints *over* everything else instead of under it — and
 *  across the plot's full height (`plotBoundedHeight`, not just `priceHeight`), so volume and any
 *  own-pane indicator disappear past the cutoff too, not just the price candles. */
export function drawReplayMask(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { replayArmed, replayActive, replayPreviewIndex, replayCutoffIndex, zoomedXScale, dims, plotBoundedHeight } = params;
  const index = replayActive ? replayCutoffIndex : replayArmed ? replayPreviewIndex : null;
  if (index === null) return;

  const maskLeft = Math.max(0, zoomedXScale(index + 1));
  if (maskLeft >= dims.boundedWidth) return;

  ctx.save();
  ctx.fillStyle = style.colorBg;
  // Translucent while still choosing (the "opacité plus faible" preview), fully opaque once
  // committed — the mask itself never changes shape, only how solid it is.
  ctx.globalAlpha = replayActive ? 1 : 0.55;
  ctx.fillRect(maskLeft, 0, dims.boundedWidth - maskLeft, plotBoundedHeight);
  ctx.restore();
}
