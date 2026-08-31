import type { ScaleLinear } from "d3";
import type { ChartDimensions } from "../../internal/useChartDimensions";
import type { Candle } from "./Candle.interface";
import type { TrendLineDrawing } from "./TrendLineDrawing.interface";
import type { DataPoint } from "./DataPoint.interface";
import type { Indicator } from "./Indicator.interface";
import type { IndicatorValue } from "./IndicatorValue.interface";
import type { ChartDisplayMode } from "./ChartDisplayMode.interface";
import type { DrawingToolType } from "./DrawingToolType.interface";
import type { PriceBrick } from "../chartModes";
import type { TpoOverlay } from "../hooks/useTpoOverlay";

/** Every value `renderCandlestickChart` (and the drawPriceCandles/drawPriceDrawings/
 *  drawVolumeAndPanes phase functions it calls) needs to paint one frame — a plain data bag, not
 *  a class, so the canvas draw effect in CandlestickChart.tsx can build a fresh one from its own
 *  render's state/memos on every call with no lifecycle of its own. */
export interface RenderCandlestickChartParams {
  dims: ChartDimensions;
  plotBoundedHeight: number;
  visible: { d: Candle; i: number }[];
  zoomedXScale: ScaleLinear<number, number>;
  zoomedPriceScale: ScaleLinear<number, number>;
  candleWidth: number;
  chartDisplayMode: ChartDisplayMode;
  heikinAshiCandles: Candle[] | null;
  renkoBricks: PriceBrick[];
  lineBreakBricks: PriceBrick[];
  tpoOverlays: TpoOverlay[];
  data: Candle[];
  visibleRange: { start: number; end: number };
  upColorOverride: string | undefined;
  downColorOverride: string | undefined;
  volumeUpColorOverride: string | undefined;
  volumeDownColorOverride: string | undefined;
  volumeVisible: boolean;
  volumeCollapsed: boolean;
  zoomedVolumeScale: ScaleLinear<number, number>;
  volumeHeight: number;
  volumeTop: number;
  priceHeight: number;
  ownPaneIndicators: Indicator[];
  indicatorPaneHeights: number[];
  indicatorPaneTops: number[];
  zoomedOwnPaneScales: Record<string, ScaleLinear<number, number>>;
  indicators: Indicator[];
  overlayProjections: {
    drawing: TrendLineDrawing;
    mainReference: number;
    points: { i: number; price: number; open?: number; high?: number; low?: number }[];
    /** Only set when `drawing.overlayDisplayMode === "heikinAshi"` (and `points` has OHLC) —
     *  `points` transformed the same way `useChartDisplayMode`'s own `heikinAshiCandles` derives
     *  from `data`, just applied to the overlay's already-rebased series instead. */
    haPoints?: { i: number; price: number; open: number; high: number; low: number }[];
    /** Only set when `drawing.overlayDisplayMode` is "renko"/"lineBreak" (and `points` has OHLC)
     *  — same `PriceBrick` shape `useChartDisplayMode`'s own renkoBricks/lineBreakBricks use for
     *  `data`, just computed from the overlay's own rebased series, with `startIndex`/`endIndex`
     *  already remapped from positions in that series to real `data`-aligned indices (via
     *  `indexForDate`) so bricks land in the right place on the shared X scale. */
    bricks?: PriceBrick[];
  }[];
  symbolOverlays: TrendLineDrawing[];
  hovered: Candle | null;
  hoverY: number | null;
  hoverVolumeY: number | null;
  hoverIndicatorPaneId: string | null;
  hoverIndicatorPaneY: number | null;
  hoverIndex: number | null;
  visibleDrawings: TrendLineDrawing[];
  hoveredDrawingId: string | null;
  activeTool: DrawingToolType | null;
  pendingPoint: DataPoint | null;
  previewPoint: DataPoint | null;
  pendingSecondPoint: DataPoint | null;
  pendingExtraPoints: DataPoint[];
  brushPreview: DataPoint[] | null;
  measurePoints: { p1: DataPoint; p2: DataPoint } | null;
  livePrice: boolean;
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  indexForDate: (d: Date) => number;
  /** Draws a diagonal-hatched marker over the price pane's own "future" — from just past the last
   *  candle to the plot's right edge — see drawFutureZone.ts. A chart-settings toggle, not a
   *  prop; default false. */
  futureZoneVisible: boolean;
  /** Mirror of `futureZoneVisible` — see `drawPastZone.ts`'s own doc (in `drawFutureZone.ts`). */
  pastZoneVisible: boolean;
  /** Replay mode — see CandlestickChartProps.replay, useReplayState.ts, and drawReplayMask.ts's
   *  own doc. `replayPreviewIndex` drives the translucent preview while `replayArmed` (choosing
   *  a cutoff); `replayCutoffIndex` drives the opaque cover once `replayActive` (committed). */
  replayArmed: boolean;
  replayActive: boolean;
  replayPreviewIndex: number | null;
  replayCutoffIndex: number | null;
}
