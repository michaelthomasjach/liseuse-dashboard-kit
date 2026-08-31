import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { snapPixel } from "../drawingGeometry";
import { drawHatchLines } from "./drawFutureZone";

/** Replay mode's own "cover" — see CandlestickChartProps.replay and useReplayState's own doc.
 *  While armed (choosing where to cut), a translucent preview follows the pointer
 *  (`replayPreviewIndex`); once committed (`replayCutoffIndex`), the same rectangle turns fully
 *  opaque, erasing every candle/drawing/indicator past that point without touching the data or
 *  scale that positions what's still visible — see useReplayState's own doc for why slicing `data`
 *  itself isn't used instead (it would also re-fit the X domain, snapping every surviving candle
 *  to a new pixel position instead of leaving them exactly where the user was already looking).
 *
 *  Once committed, an opaque fill would just as happily blank out the price gridlines and hover
 *  crosshair drawn earlier in the very same pass (they're canvas-painted too, see
 *  drawPriceCandles.ts's own doc on why), which reads as "the chart itself disappeared," not "the
 *  candles disappeared." So the opaque branch below redraws the price gridlines
 *  (drawPriceCandles.ts's own tick loop, byte-for-byte) and both crosshair lines
 *  (drawPriceCandles.ts's horizontal one, drawVolumeAndPanes.ts's vertical one) back on top,
 *  clipped to the masked region — the chart's own structure and the pointer's own crosshair both
 *  stay legible past the cutoff, only the data drawn on top of them is actually gone. (Deliberately
 *  scoped to the price pane's own gridlines/crosshair, not every own-pane indicator's own
 *  reference levels — RSI's 30/70 lines and friends are numerous enough, and specific enough to
 *  the indicator that drew them, that mirroring all of them here would mean re-deriving most of
 *  drawVolumeAndPanes.ts's own indicator-kind branches; not attempted for this first pass.)
 *
 *  While still armed, the translucent fill alone already lets the gridlines drawn underneath show
 *  faintly through (alpha < 1 blends rather than replaces), so no restoration is needed there —
 *  only a single dashed vertical line marks the candidate cutoff, same style as the normal hover
 *  crosshair's own vertical line, so it reads as "the crosshair, narrowed to just an X position"
 *  rather than a new marker of its own. Deliberately no horizontal line and no solid line here
 *  (exigence : « je veux juste garder le trait vertical du curseur ») — while still choosing where
 *  to cut, a price crosshair has nothing to add that picking a date doesn't already need, unlike
 *  once replay is actually showing real history again (see the opaque branch above).
 *
 *  Drawn LAST in renderChart.ts (after candles/drawings/volume/panes), unlike drawFutureZone's own
 *  background layer, specifically so its cover paints *over* everything else instead of under it —
 *  and across the plot's full height (`plotBoundedHeight`, not just `priceHeight`), so volume and
 *  any own-pane indicator disappear past the cutoff too, not just the price candles.
 *
 *  When `futureZoneVisible` is also on, the opaque fill gets `drawFutureZone.ts`'s own hatch
 *  pattern drawn back on top of it (full `plotBoundedHeight`, not just `priceHeight` — every pane
 *  has a "hidden future" during replay, not only price) — otherwise the option would silently do
 *  nothing while replay is active: `drawFutureZone` itself skips entirely then (its own zone,
 *  measured from the *real* last candle, sits at/past this cover's own left edge and would just be
 *  erased right back by the fill above), so this is the one place that actually has to draw it. */
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
    hovered,
    hoverY,
    hoverIndex,
    futureZoneVisible,
  } = params;
  const { colorBg, colorGrid, colorMuted } = style;

  const index = replayActive ? replayCutoffIndex : replayArmed ? replayPreviewIndex : null;
  if (index === null) return;

  const maskLeft = Math.max(0, zoomedXScale(index + 1));
  if (maskLeft < dims.boundedWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(maskLeft, 0, dims.boundedWidth - maskLeft, plotBoundedHeight);
    ctx.clip();

    ctx.fillStyle = colorBg;
    ctx.globalAlpha = replayActive ? 1 : 0.55;
    ctx.fillRect(maskLeft, 0, dims.boundedWidth - maskLeft, plotBoundedHeight);
    ctx.globalAlpha = 1;

    if (replayActive && futureZoneVisible) drawHatchLines(ctx, dims.boundedWidth, plotBoundedHeight, style);

    if (replayActive) {
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

      if (hovered && hoverY !== null) {
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
    }

    ctx.restore();
  }

  if (replayArmed) {
    ctx.save();
    ctx.strokeStyle = colorMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(maskLeft, 0);
    ctx.lineTo(maskLeft, plotBoundedHeight);
    ctx.stroke();
    ctx.restore();
  }
}
