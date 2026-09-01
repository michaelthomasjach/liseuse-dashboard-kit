import type { ScaleLinear } from "d3";
import type { Candle } from "./Candle.interface";
import type { Indicator } from "./Indicator.interface";
import type { IndicatorValue } from "./IndicatorValue.interface";

/** Everything `renderSidePaneColumn` needs to paint one frame of a `plot.pane(name, { dock:
 *  "left"|"right" })` script pane's own column — the side-column counterpart of
 *  `RenderCandlestickChartParams`, a much smaller bag since a docked column has none of the main
 *  plot's own price/volume/drawings/hover-crosshair concerns (see ChartSidePaneColumn's own doc
 *  for what's deliberately left out of this first version). */
export interface SidePaneColumnRenderParams {
  /** Which edge this column is docked to — a profile's own bars grow from the edge facing the
   *  chart, so they need to know which one that is (see `drawPaneProfile`). */
  side: "left" | "right";
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
  /** The *main chart's* own zoomed price scale (price -> y within the price section). Used only by
   *  a `draw: "profile"` pane, which is drawn against it rather than a scale fitted to its own
   *  data — that shared scale is what lines a profile's peaks up with the candles beside it. */
  zoomedPriceScale: ScaleLinear<number, number>;
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  /** The *full* indicator list (every dock side combined), not just this column's own — color
   *  cycling (`defaultIndicatorColor(indicators.indexOf(ind))`) stays consistent with the same
   *  indicator's own color wherever else it's referenced, same as the bottom stack's own. */
  indicators: Indicator[];
  /** Whether the main chart is currently hovered and, if so, the hovered price's own pixel Y —
   *  `effectiveHoverY`, the exact same clamped value `drawPriceCandles.ts` draws its own
   *  horizontal hover line from. Valid unchanged on this column's own canvas since both share the
   *  identical `zoomedPriceScale` (see that field's own doc) — no re-projection needed, just a
   *  different horizontal extent (`columnWidth` instead of `dims.boundedWidth`). Lets the hover
   *  line (and, in `ChartSidePaneColumn.tsx`, its own price badge) visually continue across this
   *  column so a profile's own bulge can be read against the exact hovered price. */
  hovered: Candle | null;
  hoverY: number | null;
}
