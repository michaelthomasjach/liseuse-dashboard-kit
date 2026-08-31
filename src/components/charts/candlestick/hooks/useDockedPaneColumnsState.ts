import { useMemo } from "react";
import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import { useDockedPaneColumns } from "./useDockedPaneColumns";
import { usePaneStackScales } from "./usePaneStackScales";
import { computeDateTickValues } from "./useZoomAndScales";
import { SIDE_DOCK_PANE_DEFAULT_WIDTH, SUB_PANE_COLLAPSED_HEIGHT, SIDE_DOCK_HEADER_GAP } from "../constants";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { ChartSidePaneColumnProps } from "../components/ChartSidePaneColumn";

export interface UseDockedPaneColumnsStateArgs {
  leftPaneIndicators: Indicator[];
  leftPaneHeights: number[];
  leftPaneTops: number[];
  rightPaneIndicators: Indicator[];
  rightPaneHeights: number[];
  rightPaneTops: number[];
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  paneYTransform: Record<string, d3.ZoomTransform>;
  zoomedXScale: ScaleLinear<number, number>;
  candleWidth: number;
  boundedWidth: number;
  plotBoundedHeight: number;
  /** Pixel offset from the top of the outer `.lq-chart` flex row down to where `.lq-chart__plot`
   *  actually starts (`headerSpace`, i.e. `showHeader ? HEADER_HEIGHT : 0` — see
   *  CandlestickChart.tsx's own `plotHeight` doc) — a `<ChartSidePaneColumn>` is a flex *sibling*
   *  of `.lq-chart__main`, not a child of it, so it never automatically inherits the room
   *  `.lq-chart__main` reserves above its own plot for `<ChartHeader>` (the timeframe/replay
   *  toolbar); without pushing the column down by this same amount, its own top edge lines up
   *  with the *toolbar's* own top instead of the candles' own top one row below it. */
  topOffset: number;
  /** `dims.margin.bottom` — how far *below* `plotBoundedHeight` the main plot's own date-axis
   *  labels extend (see DEFAULT_MARGIN's own doc; resolved, not the raw default, so a mobile-rail
   *  layout's own taller bottom margin — see CandlestickChart.tsx's own `resolvedMargin` — still
   *  matches exactly). A docked column's own date axis reuses this same amount, *added* beyond its
   *  `plotBoundedHeight` the same way (not carved out of it), so its own bottom edge lines up with
   *  the main plot's — see ChartSidePaneColumn.tsx. */
  marginBottom: number;
  themeTick: number;
  data: Candle[];
  indicators: Indicator[];
  hoverIndex: number | null;
  dateTickFormat: (value: number) => string;
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  commitTargetIndicators: Indicator[];
  commitIndicators: (indicators: Indicator[]) => void;
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onOpenIndicatorInfo: (kind: IndicatorKind | "volume") => void;
  onEditScript?: (scriptId: string) => void;
}

/** Everything `CandlestickChart.tsx` needs to mount its two `<ChartSidePaneColumn>` siblings —
 *  pulled out purely to keep that file under its own 1000-line budget (this bundle plus its own
 *  two ~30-line JSX blocks was pushing it well past it): the column-width state
 *  (`useDockedPaneColumns`), each side's own Y-scale (`usePaneStackScales`, called a fixed two
 *  more times — see that hook's own doc for why this is cheap, not a third pass over every
 *  indicator's own values), each side's own X scale/candle width (see the doc inline below), and
 *  finally two ready-to-spread prop bundles (`null` when that side has nothing docked to it, so
 *  the call site's own JSX is just `{leftColumnProps && <ChartSidePaneColumn {...leftColumnProps} />}`
 *  instead of repeating the same ~20-prop list twice). */
export function useDockedPaneColumnsState({
  leftPaneIndicators,
  leftPaneHeights,
  leftPaneTops,
  rightPaneIndicators,
  rightPaneHeights,
  rightPaneTops,
  visibleIndicators,
  paneYTransform,
  zoomedXScale,
  candleWidth,
  boundedWidth,
  plotBoundedHeight,
  topOffset,
  marginBottom,
  themeTick,
  data,
  indicators,
  hoverIndex,
  dateTickFormat,
  startPaneResize,
  commitTargetIndicators,
  commitIndicators,
  indicatorLabel,
  openIndicatorSettings,
  removeIndicator,
  indicatorValues,
  onOpenIndicatorInfo,
  onEditScript,
}: UseDockedPaneColumnsStateArgs) {
  const dockedPaneColumns = useDockedPaneColumns();

  const headerReserve = SUB_PANE_COLLAPSED_HEIGHT + SIDE_DOCK_HEADER_GAP;

  const { zoomedOwnPaneScales: zoomedLeftPaneScales } = usePaneStackScales({
    ownPaneIndicators: leftPaneIndicators,
    indicatorPaneHeights: leftPaneHeights,
    visibleIndicators,
    paneYTransform,
    headerReserve,
  });
  const { zoomedOwnPaneScales: zoomedRightPaneScales } = usePaneStackScales({
    ownPaneIndicators: rightPaneIndicators,
    indicatorPaneHeights: rightPaneHeights,
    visibleIndicators,
    paneYTransform,
    headerReserve,
  });

  const leftColumnWidth = dockedPaneColumns.widths.left ?? SIDE_DOCK_PANE_DEFAULT_WIDTH;
  const rightColumnWidth = dockedPaneColumns.widths.right ?? SIDE_DOCK_PANE_DEFAULT_WIDTH;

  // Deliberately NOT `transform.rescaleX(a scale ranged to the column's own width)` — `transform`'s
  // own k/x were calibrated against the *main* plot's own pixel space (dims.boundedWidth), so
  // inverting the column's own [0, columnWidth] range through it doesn't mean what it looks like
  // it should (confirmed empirically: shipped once, silently plotted every point thousands of
  // pixels off-canvas). Reusing the *domain* the main plot's own `zoomedXScale` already resolved
  // (which candle indices are visible) and re-ranging it onto this column's own width is both
  // simpler and correct — same visible bars, proportionally placed, no transform math duplicated.
  const leftZoomedXScale = useMemo(
    () => d3.scaleLinear().domain(zoomedXScale.domain()).range([0, leftColumnWidth]),
    [zoomedXScale, leftColumnWidth]
  );
  const rightZoomedXScale = useMemo(
    () => d3.scaleLinear().domain(zoomedXScale.domain()).range([0, rightColumnWidth]),
    [zoomedXScale, rightColumnWidth]
  );
  // Same ratio the main plot's own candleWidth already is relative to dims.boundedWidth — a
  // narrower column just means proportionally narrower candles/bars within it, not a different
  // zoom level (the number of bars actually visible is identical either way).
  const leftCandleWidth = boundedWidth > 0 ? candleWidth * (leftColumnWidth / boundedWidth) : 0;
  const rightCandleWidth = boundedWidth > 0 ? candleWidth * (rightColumnWidth / boundedWidth) : 0;

  // Same thinning the main plot's own date axis uses (computeDateTickValues, see its own doc),
  // just against this column's own — much narrower — width instead of dims.boundedWidth, so a
  // handful of labels are shown rather than the main axis's own dozen crammed into 220px.
  const leftDateTickValues = useMemo(
    () => computeDateTickValues(leftZoomedXScale, data.length, leftColumnWidth),
    [leftZoomedXScale, data.length, leftColumnWidth]
  );
  const rightDateTickValues = useMemo(
    () => computeDateTickValues(rightZoomedXScale, data.length, rightColumnWidth),
    [rightZoomedXScale, data.length, rightColumnWidth]
  );

  const shared = {
    plotBoundedHeight,
    topOffset,
    marginBottom,
    themeTick,
    indicators,
    data,
    hoverIndex,
    startPaneResize,
    commitTargetIndicators,
    commitIndicators,
    indicatorLabel,
    openIndicatorSettings,
    removeIndicator,
    indicatorValues,
    onOpenIndicatorInfo,
    onEditScript,
    dateTickFormat,
  };

  const leftColumnProps: ChartSidePaneColumnProps | null =
    leftPaneIndicators.length > 0
      ? {
          ...shared,
          side: "left",
          panelRef: dockedPaneColumns.leftRef,
          widthPx: dockedPaneColumns.widths.left,
          defaultWidthPx: SIDE_DOCK_PANE_DEFAULT_WIDTH,
          startResize: dockedPaneColumns.startResize("left"),
          columnWidth: leftColumnWidth,
          zoomedXScale: leftZoomedXScale,
          candleWidth: leftCandleWidth,
          paneIndicators: leftPaneIndicators,
          paneHeights: leftPaneHeights,
          paneTops: leftPaneTops,
          zoomedPaneScales: zoomedLeftPaneScales,
          visibleIndicators,
          dateTickValues: leftDateTickValues,
        }
      : null;

  const rightColumnProps: ChartSidePaneColumnProps | null =
    rightPaneIndicators.length > 0
      ? {
          ...shared,
          side: "right",
          panelRef: dockedPaneColumns.rightRef,
          widthPx: dockedPaneColumns.widths.right,
          defaultWidthPx: SIDE_DOCK_PANE_DEFAULT_WIDTH,
          startResize: dockedPaneColumns.startResize("right"),
          columnWidth: rightColumnWidth,
          zoomedXScale: rightZoomedXScale,
          candleWidth: rightCandleWidth,
          paneIndicators: rightPaneIndicators,
          paneHeights: rightPaneHeights,
          paneTops: rightPaneTops,
          zoomedPaneScales: zoomedRightPaneScales,
          visibleIndicators,
          dateTickValues: rightDateTickValues,
        }
      : null;

  return { leftColumnProps, rightColumnProps };
}
