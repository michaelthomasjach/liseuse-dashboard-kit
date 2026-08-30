import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { snapPixel } from "../drawingGeometry";

/** Replay mode's own "cover" — see CandlestickChartProps.replay and useReplayState's own doc.
 *  While armed (choosing where to cut), a translucent preview follows the pointer
 *  (`replayPreviewIndex`); once committed (`replayCutoffIndex`), the same rectangle turns fully
 *  opaque, erasing every candle/drawing/indicator past that point without touching the data or
 *  scale that positions what's still visible — see useReplayState's own doc for why slicing `data`
 *  itself isn't used instead (it would also re-fit the X domain, snapping every surviving candle
 *  to a new pixel position instead of leaving them exactly where the user was already looking).
 *
 *  Erasing is deliberately not the whole story, though — a flat opaque fill would just as happily
 *  blank out the price gridlines and hover crosshair drawn earlier in the very same pass (they're
 *  canvas-painted too, see drawPriceCandles.ts's own doc on why), which reads as "the chart itself
 *  disappeared," not "the candles disappeared." So after covering the region, this redraws the
 *  price gridlines (`drawPriceCandles.ts`'s own tick loop, byte-for-byte) and both crosshair lines
 *  (`drawPriceCandles.ts`'s horizontal one, `drawVolumeAndPanes.ts`'s vertical one) back on top,
 *  clipped to the masked region — the chart's own structure and the pointer's own crosshair both
 *  stay legible past the cutoff, only the data drawn on top of them is actually gone. (Deliberately
 *  scoped to the price pane's own gridlines/crosshair, not every own-pane indicator's own
 *  reference levels — RSI's 30/70 lines and friends are numerous enough, and specific enough to
 *  the indicator that drew them, that mirroring all of them here would mean re-deriving most of
 *  drawVolumeAndPanes.ts's own indicator-kind branches; not attempted for this first pass.)
 *
 *  Finally, a solid vertical line (not the crosshair's own dashed one) marks the cutoff/preview
 *  position itself — distinct from the crosshair on purpose, so "where the cut actually is" reads
 *  clearly even when the pointer has moved elsewhere.
 *
 *  Drawn LAST in renderChart.ts (after candles/drawings/volume/panes), unlike drawFutureZone's own
 *  background layer, specifically so its cover paints *over* everything else instead of under it —
 *  and across the plot's full height (`plotBoundedHeight`, not just `priceHeight`), so volume and
 *  any own-pane indicator disappear past the cutoff too, not just the price candles. */
export function drawReplayMask(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const {
    replayArmed,
    replayActive,
    replayPreviewIndex,
    replayCutoffIndex,
    zoomedXScale,
    zoomedPriceScale,
    dims,
    plotBoundedHeight,
    priceHeight,
    hovered,
    hoverY,
    hoverIndex,
  } = params;
  const { colorBg, colorGrid, colorMuted, colorAccent } = style;

  const index = replayActive ? replayCutoffIndex : replayArmed ? replayPreviewIndex : null;
  if (index === null) return;

  const maskLeft = Math.max(0, zoomedXScale(index + 1));
  if (maskLeft < dims.boundedWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(maskLeft, 0, dims.boundedWidth - maskLeft, plotBoundedHeight);
    ctx.clip();

    // Erase everything in this strip — translucent while still choosing (the "opacité plus
    // faible" preview), fully opaque once committed.
    ctx.fillStyle = colorBg;
    ctx.globalAlpha = replayActive ? 1 : 0.55;
    ctx.fillRect(maskLeft, 0, dims.boundedWidth - maskLeft, plotBoundedHeight);
    ctx.globalAlpha = 1;

    // Restore the price pane's own gridlines — same ticks(5)/colorGrid/dash pattern as
    // drawPriceCandles.ts's own, which this strip just painted over.
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (const tick of zoomedPriceScale.ticks(5)) {
      const y = snapPixel(zoomedPriceScale(tick));
      ctx.beginPath();
      ctx.moveTo(maskLeft, y);
      ctx.lineTo(dims.boundedWidth, y);
      ctx.stroke();
    }

    // Restore both crosshair lines, same styling as their own originals — otherwise hovering
    // this strip (fully legitimate once replay is active, see useReplayState.ts's own doc on why
    // only the brief arming phase intercepts the pointer) would draw them invisibly underneath
    // this strip's own cover.
    if (hovered && hoverY !== null && hoverY <= priceHeight) {
      ctx.strokeStyle = colorMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(maskLeft, hoverY);
      ctx.lineTo(dims.boundedWidth, hoverY);
      ctx.stroke();
    }
    if (hovered && hoverIndex !== null) {
      const hx = zoomedXScale(hoverIndex + 0.5);
      if (hx >= maskLeft) {
        ctx.strokeStyle = colorMuted;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, plotBoundedHeight);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // The cutoff/preview line itself — solid (not dashed, unlike the crosshair) so it reads as a
  // distinct, deliberate marker rather than another hover indicator. Drawn last, outside the clip
  // above, so it's never itself masked.
  ctx.save();
  ctx.strokeStyle = colorAccent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(maskLeft, 0);
  ctx.lineTo(maskLeft, plotBoundedHeight);
  ctx.stroke();
  ctx.restore();
}
