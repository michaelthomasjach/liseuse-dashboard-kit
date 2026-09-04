import type { SidePaneColumnRenderParams } from "../interfaces/SidePaneColumnRenderParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { snapPixel } from "../drawingGeometry";
import { drawOwnPaneIndicatorSeries } from "./drawOwnPaneIndicatorSeries";
import { computeProfileBoxValueScale, drawPaneProfile } from "./drawPaneProfile";

/** Paints one `plot.pane(name, { dock: "left"|"right" })` script pane column — an inter-pane
 *  divider (see the `idx > 0` guard below) plus `drawOwnPaneIndicatorSeries` per pane stacked in it, the exact same per-kind rendering the
 *  bottom stack's own `drawVolumeAndPanes.ts` uses (see that shared function's own doc), just
 *  against this column's own narrower `zoomedXScale`/`columnWidth` instead of the main plot's.
 *  Deliberately excludes what the bottom stack still has and this first version doesn't: a hover
 *  crosshair, and "horizontal"/"ray" drawings anchored to one of these panes — a docked column
 *  reads its own series relative to the main chart's candles, but isn't itself an interactive
 *  surface yet. Same canvas-setup shape as `renderCandlestickChart` (DPR scaling, colors read
 *  once off the DOM), just for a much smaller frame. */
export function renderSidePaneColumn(canvas: HTMLCanvasElement, wrapper: HTMLElement, params: SidePaneColumnRenderParams) {
  const {
    side,
    columnWidth,
    plotBoundedHeight,
    zoomedXScale,
    candleWidth,
    paneIndicators,
    paneHeights,
    paneTops,
    zoomedPaneScales,
    zoomedPriceScale,
    visibleIndicators,
    indicators,
    hovered,
    hoverY,
    paneStackOrder,
  } = params;
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

  // Counts panes actually painted, which is what "is this the first one?" has to mean for the
  // divider below — a plain index would be wrong the moment the pane above is folded away.
  let painted = 0;

  // Which panes share each box, as runs of consecutive indices — `stackSidePanes` guarantees a
  // box's members are adjacent, and `paneStackOrder === 0` marks where each run starts. Used for
  // the one value scale a box of superimposed profiles shares.
  const boxOfPane = new Map<number, number[]>();
  let currentRun: number[] = [];
  paneIndicators.forEach((_, idx) => {
    if ((paneStackOrder[idx] ?? 0) === 0) currentRun = [];
    currentRun.push(idx);
    for (const member of currentRun) boxOfPane.set(member, currentRun);
  });

  paneIndicators.forEach((ind, idx) => {
    // A folded pane is not in this column's own vertical stack at all: it renders as its own
    // vertical band beside this canvas (see SideDockCollapsedStrip) and stackSidePanes gives it
    // height 0 here, so there is nothing to paint and no divider to draw for it.
    if (ind.paneCollapsed) return;

    const paneTop = paneTops[idx];
    const paneHeight = paneHeights[idx];

    // Divider *between* two stacked panes only — never above the topmost one. In the bottom stack
    // that same top-of-pane line is load-bearing (drawVolumeAndPanes.ts draws it for every pane,
    // first included: it's what separates that stack from the price chart above it). Here the
    // topmost pane's own top is always 0 — a side column is made entirely of these panes, with
    // nothing above them — so drawing it lands a line flush against the column's own top edge,
    // immediately under `.lq-chart__header`'s own `border-bottom` and in that very same
    // `--lq-color-border-subtle`, reading as one doubled 2px rule. That header border already
    // delimits the top of the column (it spans this column's own width too, see
    // ChartSidePaneColumn.tsx's own doc), so the canvas has nothing left to draw there.
    if (painted > 0 && (paneStackOrder[idx] ?? 0) === 0) {
      ctx.save();
      ctx.strokeStyle = style.colorGrid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const dividerY = snapPixel(paneTop);
      ctx.moveTo(0, dividerY);
      ctx.lineTo(columnWidth, dividerY);
      ctx.stroke();
      ctx.restore();
    }
    painted += 1;

    // A profile is not a time series and does not go through visibleIndicators/zoomedPaneScales at
    // all — it carries its own (price, value) pairs and is drawn against the main chart's own price
    // scale. Deliberately *not* clipped to the pane's own box below: it spans whatever vertical
    // range the price section spans, which is the whole point of aligning it with the candles.
    if (ind.customData?.draw === "profile") {
      // Superimposed profiles are drawn against one shared magnitude scale, so the taller of two
      // reads as taller instead of both filling the column edge to edge.
      const box = (boxOfPane.get(idx) ?? [idx]).filter((i) => paneIndicators[i].customData?.draw === "profile");
      const sharedScale =
        box.length > 1
          ? computeProfileBoxValueScale(
              box.map((i) => ({
                profile: paneIndicators[i].customData?.profile ?? [],
                headroom: paneIndicators[i].customData?.profileHeadroom,
              })),
              side,
              columnWidth
            )
          : null;
      drawPaneProfile(ctx, ind, side, columnWidth, (price) => zoomedPriceScale(price), style, sharedScale);
      return;
    }

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

  // The main chart's own horizontal hover line, continued across this column at the same pixel
  // Y — see this file's own `hoverY` doc. Drawn last (on top of every pane painted above), same as
  // drawPriceCandles.ts's own copy draws after its candles.
  if (hovered && hoverY !== null) {
    ctx.save();
    ctx.strokeStyle = style.colorMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, hoverY);
    ctx.lineTo(columnWidth, hoverY);
    ctx.stroke();
    ctx.restore();
  }
}
