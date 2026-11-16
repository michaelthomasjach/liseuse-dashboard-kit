import { useMemo, useRef, useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import { computeHeikinAshiCandles, computeRenkoBrickSize, computeRenkoBricks, computeLineBreakBricks } from "../chartModes";

export interface UseChartDisplayModeArgs {
  data: Candle[];
  visibleRange: { start: number; end: number };
  renkoAtrPeriod: number;
  /** Line Break : lignes à dépasser pour un renversement (défaut 3). */
  lineBreakLines?: number;
  defaultChartDisplayMode: ChartDisplayMode | undefined;
}

/** How the price series itself is drawn (candle/line/Heikin Ashi/Renko/Line Break) — see
 *  `CandlestickChartProps.defaultChartDisplayMode`/`onChartDisplayModeChange` — plus every
 *  display-mode-specific transform of `data` the canvas draw effect actually paints from. */
export function useChartDisplayMode({ data, visibleRange, renkoAtrPeriod, lineBreakLines = 3, defaultChartDisplayMode }: UseChartDisplayModeArgs) {
  const [chartDisplayMode, setChartDisplayMode] = useState<ChartDisplayMode>(defaultChartDisplayMode ?? "candle");
  const [displayModeOpen, setDisplayModeOpen] = useState(false);
  const displayModeAnchorRef = useRef<HTMLButtonElement>(null);

  // Each entry carries its absolute index in `data` (not just its position within this slice)
  // — that's what positions it on the index-based `zoomedXScale` (as `i + 0.5`, the slot center).
  const visible = useMemo(() => {
    if (data.length === 0) return [];
    const start = Math.max(0, visibleRange.start - 2);
    const end = Math.min(data.length, visibleRange.end + 2);
    return data.slice(start, end).map((d, k) => ({ d, i: start + k }));
  }, [data, visibleRange]);

  // Gated on the active mode (not just `data`) so the other two never do their O(n) pass while
  // unused — cheap to flip back and forth since switching modes just recomputes the one that's
  // now active instead of paying for all three on every data change.
  const heikinAshiCandles = useMemo(
    () => (chartDisplayMode === "heikinAshi" ? computeHeikinAshiCandles(data) : null),
    [data, chartDisplayMode]
  );
  const renkoBricks = useMemo(() => {
    if (chartDisplayMode !== "renko") return [];
    const brickSize = computeRenkoBrickSize(data, Math.max(1, Math.round(renkoAtrPeriod)));
    return computeRenkoBricks(data, brickSize);
  }, [data, chartDisplayMode, renkoAtrPeriod]);
  const lineBreakBricks = useMemo(
    () => (chartDisplayMode === "lineBreak" ? computeLineBreakBricks(data, Math.max(2, Math.round(lineBreakLines))) : []),
    [data, chartDisplayMode, lineBreakLines]
  );

  return {
    chartDisplayMode,
    setChartDisplayMode,
    displayModeOpen,
    setDisplayModeOpen,
    displayModeAnchorRef,
    visible,
    heikinAshiCandles,
    renkoBricks,
    lineBreakBricks,
  };
}
