import type { ScaleLinear } from "d3";
import type { Indicator } from "./Indicator.interface";
import type { IndicatorValue } from "./IndicatorValue.interface";

/** Everything `renderSidePaneColumn` needs to paint one frame of a `plot.pane(name, { dock:
 *  "left"|"right" })` script pane's own column — the side-column counterpart of
 *  `RenderCandlestickChartParams`, a much smaller bag since a docked column has none of the main
 *  plot's own price/volume/drawings/hover-crosshair concerns (see ChartSidePaneColumn's own doc
 *  for what's deliberately left out of this first version). */
export interface SidePaneColumnRenderParams {
  columnWidth: number;
  plotBoundedHeight: number;
  /** This column's own zoomed X scale — the *same* pan/zoom `transform` as the main chart,
   *  rescaling a scale whose `range` is `[0, columnWidth]` instead of the main plot's own
   *  `dims.boundedWidth`, so the same visible bar indices land proportionally at the same
   *  fractional position, just projected onto this column's own (independently resizable)
   *  width — see ChartSidePaneColumn's own doc. */
  zoomedXScale: ScaleLinear<number, number>;
  candleWidth: number;
  paneIndicators: Indicator[];
  paneHeights: number[];
  paneTops: number[];
  zoomedPaneScales: Record<string, ScaleLinear<number, number>>;
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  /** The *full* indicator list (every dock side combined), not just this column's own — color
   *  cycling (`defaultIndicatorColor(indicators.indexOf(ind))`) stays consistent with the same
   *  indicator's own color wherever else it's referenced, same as the bottom stack's own. */
  indicators: Indicator[];
}
