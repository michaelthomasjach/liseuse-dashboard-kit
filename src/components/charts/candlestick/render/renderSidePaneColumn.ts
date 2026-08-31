import type { SidePaneColumnRenderParams } from "../interfaces/SidePaneColumnRenderParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { snapPixel } from "../drawingGeometry";
import { drawOwnPaneIndicatorSeries } from "./drawOwnPaneIndicatorSeries";

/** Paints one `plot.pane(name, { dock: "left"|"right" })` script pane column — a divider plus
 *  `drawOwnPaneIndicatorSeries` per pane stacked in it, the exact same per-kind rendering the
 *  bottom stack's own `drawVolumeAndPanes.ts` uses (see that shared function's own doc), just
 *  against this column's own narrower `zoomedXScale`/`columnWidth` instead of the main plot's.
 *  Deliberately excludes what the bottom stack still has and this first version doesn't: a hover
 *  crosshair, and "horizontal"/"ray" drawings anchored to one of these panes — a docked column
 *  reads its own series relative to the main chart's candles, but isn't itself an interactive
 *  surface yet. Same canvas-setup shape as `renderCandlestickChart` (DPR scaling, colors read
 *  once off the DOM), just for a much smaller frame. */
export function renderSidePaneColumn(canvas: HTMLCanvasElement, wrapper: HTMLElement, params: SidePaneColumnRenderParams) {
  const { columnWidth, plotBoundedHeight, zoomedXScale, candleWidth, paneIndicators, paneHeights, paneTops, zoomedPaneScales, visibleIndicators, indicators } =
    params;
  if (columnWidth <= 0 || plotBoundedHeight <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = columnWidth * dpr;
  canvas.height = plotBoundedHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, columnWidth, plotBoundedHeight);

  const computed = getComputedStyle(wrapper);
  const style: ChartCanvasStyle = {
    colorUp: computed.getPropertyValue("--lq-color-up").trim(),
    colorDown: computed.getPropertyValue("--lq-color-down").trim(),
    colorBg: computed.getPropertyValue("--lq-color-bg").trim(),
    colorText: computed.getPropertyValue("--lq-color-text").trim(),
    colorMuted: computed.getPropertyValue("--lq-color-text-muted").trim(),
    colorAccent: computed.getPropertyValue("--lq-color-accent").trim(),
    colorGrid: computed.getPropertyValue("--lq-color-border-subtle").trim(),
    fontFamily: computed.getPropertyValue("--lq-font-family").trim() || "sans-serif",
    isEink: wrapper.closest('[data-lq-palette="eink"]') !== null,
  };

  paneIndicators.forEach((ind, idx) => {
    const paneTop = paneTops[idx];
    const paneHeight = paneHeights[idx];

    ctx.save();
    ctx.strokeStyle = style.colorGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const dividerY = snapPixel(paneTop);
    ctx.moveTo(0, dividerY);
    ctx.lineTo(columnWidth, dividerY);
    ctx.stroke();
    ctx.restore();

    if (ind.paneCollapsed) return;

    const entry = visibleIndicators.find((v) => v.indicator.id === ind.id);
    const points = entry?.points ?? [];
    if (points.length === 0) return;

    const scale = zoomedPaneScales[ind.id];
    if (!scale) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, paneTop, columnWidth, paneHeight);
    ctx.clip();
    ctx.translate(0, paneTop);

    drawOwnPaneIndicatorSeries(ctx, ind, points, zoomedXScale, candleWidth, columnWidth, indicators, scale, style);

    ctx.restore();
  });
}
