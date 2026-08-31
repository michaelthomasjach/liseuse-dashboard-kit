import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawFutureZone, drawPastZone } from "./drawFutureZone";
import { drawPriceCandles } from "./drawPriceCandles";
import { drawPriceDrawings } from "./drawPriceDrawings";
import { drawVolumeAndPanes } from "./drawVolumeAndPanes";
import { drawReplayMask } from "./drawReplayMask";

export type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";

/** Imperatively paints the whole price/volume/indicator-panes canvas — candles (or whichever
 *  display mode is active), drawings, live indicator lines, hover crosshair, and every
 *  in-progress drawing-tool preview. Pulled out of CandlestickChart's own draw `useEffect` as a
 *  pure function (reads `params`, paints `canvas` — no state of its own, no React) purely to keep
 *  every file in this codebase under its 1000-line budget; the call site (still a `useEffect`, now
 *  just a thin wrapper around this) is unchanged in behavior.
 *
 *  Split into five phases, called in this fixed order: `drawFutureZone`/`drawPastZone` paint their
 *  own hatched background markers first (see their own doc), entirely independent of the clip
 *  stack the other three share; `drawPriceCandles` opens the price section's own clip and paints
 *  candles/
 *  gridlines/price-overlay indicators, leaving the clip open; `drawPriceDrawings` continues inside
 *  that same clip (every drawing type, tool previews, the live-price line, symbol overlays) and
 *  closes it; `drawVolumeAndPanes` paints outside the clip (volume, each "own"-pane indicator's
 *  own clipped strip, "vertical" drawings, the crosshair's vertical line); `drawReplayMask` paints
 *  last of all, over everything above, covering replay's own "future" from wherever it's currently
 *  cut (see its own doc). Splitting this way
 *  (rather than each phase re-opening its own independent clip) mirrors the source exactly as it
 *  always flowed as one function — the three clip-sharing phases share one canvas
 *  `save()`/`clip()`/`restore()` stack across the (synchronous, always same-order) calls below,
 *  not three independent ones. */
export function renderCandlestickChart(canvas: HTMLCanvasElement, wrapper: HTMLElement, params: RenderCandlestickChartParams) {
  const { dims, plotBoundedHeight, upColorOverride, downColorOverride } = params;
  if (dims.boundedWidth <= 0 || plotBoundedHeight <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = dims.boundedWidth * dpr;
  canvas.height = plotBoundedHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dims.boundedWidth, plotBoundedHeight);

  const computed = getComputedStyle(wrapper);
  const style: ChartCanvasStyle = {
    colorUp: upColorOverride ?? computed.getPropertyValue("--lq-color-up").trim(),
    colorDown: downColorOverride ?? computed.getPropertyValue("--lq-color-down").trim(),
    colorBg: computed.getPropertyValue("--lq-color-bg").trim(),
    colorText: computed.getPropertyValue("--lq-color-text").trim(),
    colorMuted: computed.getPropertyValue("--lq-color-text-muted").trim(),
    colorAccent: computed.getPropertyValue("--lq-color-accent").trim(),
    colorGrid: computed.getPropertyValue("--lq-color-border-subtle").trim(),
    fontFamily: computed.getPropertyValue("--lq-font-family").trim() || "sans-serif",
    isEink: wrapper.closest('[data-lq-palette="eink"]') !== null,
  };

  drawFutureZone(ctx, params, style);
  drawPastZone(ctx, params, style);
  drawPriceCandles(ctx, params, style);
  drawPriceDrawings(ctx, params, style);
  drawVolumeAndPanes(ctx, params, style);
  drawReplayMask(ctx, params, style);
}
