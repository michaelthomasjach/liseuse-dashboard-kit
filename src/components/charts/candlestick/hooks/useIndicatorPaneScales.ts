import { useMemo } from "react";
import * as d3 from "d3";
import type { Candle } from "../interfaces/Candle.interface";
import type { FundamentalDataPoint } from "../interfaces/FundamentalDataPoint.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { computeIndicatorValues } from "../indicators";
import { indicatorLabel } from "../indicatorCatalog";
import { usePaneStackScales } from "./usePaneStackScales";

export interface UseIndicatorPaneScalesArgs {
  data: Candle[];
  fundamentals: FundamentalDataPoint[] | undefined;
  indicators: Indicator[];
  ownPaneIndicators: Indicator[];
  indicatorPaneHeights: number[];
  indicatorPaneTops: number[];
  paneYTransform: Record<string, d3.ZoomTransform>;
  visibleRange: { start: number; end: number };
  zoomedPriceScale: d3.ScaleLinear<number, number>;
  zoomedVolumeScale: d3.ScaleLinear<number, number>;
  volumeVisible: boolean;
  volumeTop: number;
  volumeHeight: number;
  priceHeight: number;
}

/** Every indicator's own computed values (full + windowed to the visible range) and, for
 *  "own"-pane ones (RSI/CHOP/MACD/fundamentals), their own Y-scale — plus the small helpers that
 *  resolve a drawing's `valueAxis` (price/volume/an indicator's own pane id) to the right scale
 *  and pixel offset, used both to place a drawing on the pane the user clicked and to read one
 *  back for rendering/hit-testing. */
export function useIndicatorPaneScales({
  data,
  fundamentals,
  indicators,
  ownPaneIndicators,
  indicatorPaneHeights,
  indicatorPaneTops,
  paneYTransform,
  visibleRange,
  zoomedPriceScale,
  zoomedVolumeScale,
  volumeVisible,
  volumeTop,
  volumeHeight,
  priceHeight,
}: UseIndicatorPaneScalesArgs) {
  // Expensive (O(data.length) per indicator) — recomputed only when the data or the indicator
  // list itself changes, never on pan/zoom (which would otherwise redo this every frame).
  const indicatorValues = useMemo(
    () => indicators.map((indicator) => ({ indicator, values: computeIndicatorValues(data, indicator, fundamentals) })),
    [data, indicators, fundamentals]
  );

  // Cheap: slices the precomputed arrays down to the same padded visible window `visible` uses,
  // dropping the null (warm-up period) entries.
  const visibleIndicators = useMemo(() => {
    const start = Math.max(0, visibleRange.start - 2);
    const end = Math.min(data.length, visibleRange.end + 2);
    return indicatorValues.map(({ indicator, values }) => {
      const points: { i: number; value: IndicatorValue }[] = [];
      for (let i = start; i < end; i++) {
        const v = values[i];
        if (v !== null) points.push({ i, value: v });
      }
      return { indicator, points };
    });
  }, [indicatorValues, data.length, visibleRange]);

  // One Y-scale per "own"-pane indicator, shared between the canvas draw effect and the SVG axis
  // ticks below it (computed once here instead of duplicated in both places, which would risk
  // the two drifting out of sync). RSI/CHOP are always 0-100 by definition; MACD and every
  // fundamental indicator auto-fit to whatever's currently visible, same spirit as YAutoScaling
  // for price — a fundamental's own unit varies wildly by metric (revenue in the billions, a P/E
  // ratio in the tens) and by company, so no fixed domain could ever make sense for it. See
  // usePaneStackScales.ts's own doc for why this one stack's own scale computation is a call into
  // a shared hook instead of being inlined here — a `plot.pane(..., {dock})` script pane's own
  // left/right column needs the exact same logic for its own (separate) stack of indicators.
  const { ownPaneScales, zoomedOwnPaneScales } = usePaneStackScales({ ownPaneIndicators, indicatorPaneHeights, visibleIndicators, paneYTransform });

  // Resolves a drawing's own `valueAxis` (undefined/"price", "volume", or an own-pane
  // indicator's id) to that pane's current zoomed scale plus its vertical offset within the
  // plot's overall (untranslated) canvas coordinate space — the same space toDataPoint/the
  // drawing-rendering effect already work in for price, just generalized to reach any pane.
  // Falls back to price if `valueAxis` names a pane that's gone (indicator removed, volume
  // hidden) rather than crashing — the drawing just renders using the price scale until edited.
  function paneScaleAndOffset(valueAxis: string | undefined): { scale: d3.ScaleLinear<number, number>; offset: number } {
    if (!valueAxis || valueAxis === "price") return { scale: zoomedPriceScale, offset: 0 };
    if (valueAxis === "volume" && volumeVisible) return { scale: zoomedVolumeScale, offset: priceHeight + volumeTop };
    const idx = ownPaneIndicators.findIndex((ind) => ind.id === valueAxis);
    if (idx !== -1) return { scale: zoomedOwnPaneScales[valueAxis], offset: priceHeight + indicatorPaneTops[idx] };
    return { scale: zoomedPriceScale, offset: 0 };
  }

  // A "horizontal"/"ray" drawing's own y1, converted to a pixel Y in the plot's overall
  // (untranslated) coordinate space via paneScaleAndOffset — the one-liner every rendering/
  // hit-testing/handle-positioning site for these two lineTypes needs, spelled out once instead
  // of repeating the same scale-then-offset pair at each call site.
  function pixelYForDrawing(dr: TrendLineDrawing): number {
    const { scale, offset } = paneScaleAndOffset(dr.valueAxis);
    return offset + scale(dr.y1);
  }

  // Human-readable name for a valueAxis value, for the edit modal's own field label.
  function valueAxisLabel(valueAxis: string | undefined): string {
    if (!valueAxis || valueAxis === "price") return "Prix";
    if (valueAxis === "volume") return "Volume";
    const ind = ownPaneIndicators.find((i) => i.id === valueAxis);
    return ind ? indicatorLabel(ind) : "Prix";
  }

  // The inverse: given a mouseY (relative to the plot's own top, e.clientY - rect.top — same
  // convention as toDataPoint), which pane it's currently over — used when a new "horizontal"/
  // "ray"/free two-point line is first placed, to decide which pane it gets anchored to.
  function resolveValueAxisAtY(mouseY: number): string {
    if (mouseY <= priceHeight) return "price";
    if (volumeVisible && mouseY > priceHeight + volumeTop && mouseY <= priceHeight + volumeTop + volumeHeight) return "volume";
    const relY = mouseY - priceHeight;
    const idx = indicatorPaneTops.findIndex((top, i) => relY >= top && relY < top + indicatorPaneHeights[i]);
    return idx !== -1 ? ownPaneIndicators[idx].id : "price";
  }

  return {
    indicatorValues,
    visibleIndicators,
    ownPaneScales,
    zoomedOwnPaneScales,
    paneScaleAndOffset,
    pixelYForDrawing,
    valueAxisLabel,
    resolveValueAxisAtY,
  };
}
