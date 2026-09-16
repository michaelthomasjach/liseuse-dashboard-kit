import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { defaultIndicatorColor } from "../indicatorCatalog";

/** Dash pattern for a projected line. Long enough to read as a line rather than a dotted rule, open
 *  enough that nobody mistakes it for the solid one it continues. */
const DASH = [5, 4];

/** How much of its colour a secondary line keeps. A band's two edges, MACD's signal, ±DI: they are
 *  context for the line being read, and at full strength three dashed lines in the same space read
 *  as three claims instead of one. */
const SECONDARY_ALPHA = 0.45;

/** Where the indicators go once the candles run out.
 *
 *  Drawn as a pass of its own rather than inside the renderers that draw the real lines, because
 *  the two answer different questions. Those iterate the visible window of data that exists; this
 *  one lives past the last bar, in the empty space the chart already reserves there — the same
 *  space Ichimoku's displaced cloud and the hatched "future" marker occupy.
 *
 *  Dashed, always, and never in a colour of its own. A projection that looked like a measurement
 *  would be one, to a reader glancing at it; the dash is the whole of what says "this is where the
 *  line is heading, not where it went". */
export function drawIndicatorProjections(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const {
    indicatorProjections,
    indicators,
    zoomedXScale,
    zoomedPriceScale,
    zoomedOwnPaneScales,
    ownPaneIndicators,
    indicatorPaneHeights,
    indicatorPaneTops,
    dims,
    priceHeight,
    replayActive,
  } = params;
  // Nothing during replay. The whole point of a replay is that the future is hidden; drawing a
  // projection into it would be drawing over the one thing the reader asked not to see.
  if (indicatorProjections.length === 0 || replayActive) return;

  for (const projection of indicatorProjections) {
    const { indicator } = projection;
    if (indicator.hidden === true) continue;
    const ownPaneIndex = ownPaneIndicators.findIndex((entry) => entry.id === indicator.id);
    const onOwnPane = ownPaneIndex !== -1;
    if (onOwnPane && indicator.paneCollapsed === true) continue;

    const yScale = onOwnPane ? zoomedOwnPaneScales[indicator.id] : zoomedPriceScale;
    if (yScale === undefined) continue;

    const color = indicator.color ?? defaultIndicatorColor(indicators.indexOf(indicator));

    ctx.save();
    if (onOwnPane) {
      // Clipped to its own pane and shifted into it, the same way every other pane-drawn series is
      // — a projection is allowed to run off the top of its pane, not over the one above it.
      ctx.beginPath();
      ctx.rect(0, indicatorPaneTops[ownPaneIndex], dims.boundedWidth, indicatorPaneHeights[ownPaneIndex]);
      ctx.clip();
      ctx.translate(0, indicatorPaneTops[ownPaneIndex]);
    } else {
      ctx.beginPath();
      ctx.rect(0, 0, dims.boundedWidth, priceHeight);
      ctx.clip();
    }

    ctx.setLineDash(DASH);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    for (const line of projection.lines) {
      ctx.globalAlpha = line.emphasis === "primary" ? 1 : SECONDARY_ALPHA;
      ctx.strokeStyle = color;
      ctx.beginPath();
      line.points.forEach((point, index) => {
        const x = zoomedXScale(point.i);
        const y = yScale(point.value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // A tick at the far end, so the projection has a visible end rather than fading into the edge
    // of the plot, and so the reader can see how far forward it actually claims to go.
    const primary = projection.lines.find((line) => line.emphasis === "primary") ?? projection.lines[0];
    const last = primary.points[primary.points.length - 1];
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const endX = zoomedXScale(last.i);
    if (endX >= 0 && endX <= dims.boundedWidth) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(endX, yScale(last.value), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // Referenced so the style contract stays explicit: this pass deliberately takes every colour from
  // the indicator itself rather than from the theme, since a projection has to be recognisable as
  // *that* indicator's own line.
  void style;
}
