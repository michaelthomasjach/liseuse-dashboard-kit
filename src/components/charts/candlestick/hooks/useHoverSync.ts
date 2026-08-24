import { useEffect, useRef } from "react";
import type * as d3 from "d3";
import type { Candle } from "../interfaces/Candle.interface";

export interface UseHoverSyncArgs {
  data: Candle[];
  hoverIndex: number | null;
  indexForDate: (date: Date) => number;
  dateForIndex: (index: number) => Date;
  syncedHoverDate: Date | null | undefined;
  onHoverDateChange: ((date: Date | null) => void) | undefined;
  hoverY: number | null;
  zoomedPriceScale: d3.ScaleLinear<number, number>;
  clampToPriceAxis: (y: number) => number;
  syncedHoverPrice: number | null | undefined;
  onHoverPriceChange: ((price: number | null) => void) | undefined;
}

/** Cross-chart crosshair sync (see `CandlestickChartProps.syncedHoverDate`'s own doc) — the real
 *  cursor always wins over a synced-in date, so a chart being actively hovered never has its own
 *  crosshair hijacked by whatever another linked chart (see `ChartWorkspace`) last reported.
 *  `effectiveHoverIndex`/`effectiveHovered` are what every purely *visual* hover consumer reads
 *  instead of raw `hoverIndex`/`hovered` — interaction-driven code (adding a line at hover,
 *  hit-testing a drawing to drag) keeps reading the raw pair, since those should only ever act on
 *  where the cursor genuinely is. Also reports this chart's own real hover back out via
 *  `onHoverDateChange` — deliberately off the raw index, not the effective one: a synced chart
 *  must never re-broadcast the date it just *received* right back out as if it were its own. */
export function useHoverSync({
  data,
  hoverIndex,
  indexForDate,
  dateForIndex,
  syncedHoverDate,
  onHoverDateChange,
  hoverY,
  zoomedPriceScale,
  clampToPriceAxis,
  syncedHoverPrice,
  onHoverPriceChange,
}: UseHoverSyncArgs) {
  // indexForDate itself now extrapolates past data's own edges rather than clamping (see its own
  // doc) — needed so a stored *drawing* point still positions correctly once dragged into the
  // empty future/past space, but this call needs an actual `data[]` index, so it clamps the
  // synced-in fallback right back to a valid one itself (a synced date from a *different* panel
  // can easily fall outside this chart's own range entirely — different symbol, different history).
  const effectiveHoverIndex =
    hoverIndex !== null ? hoverIndex : syncedHoverDate ? Math.min(data.length - 1, Math.max(0, Math.round(indexForDate(syncedHoverDate)))) : null;
  const effectiveHovered = effectiveHoverIndex !== null ? data[effectiveHoverIndex] : null;

  // Mirrors effectiveHoverIndex/effectiveHovered above, but for the horizontal price line: a
  // *price* (not a raw pixel) is what actually carries meaning across panels, since a pixel Y
  // from one chart's own price scale means nothing on another's (different symbol, zoom, or
  // Y-auto-scaling state) — each panel re-projects that shared price through its OWN
  // zoomedPriceScale, same idea as indexForDate re-resolving a shared date against this chart's
  // own candles. `??` (not `||`/truthy) so a real price of exactly 0 isn't mistaken for "no sync".
  // clampToPriceAxis keeps the resulting pixel inside the visible pane instead of drawing
  // off-canvas when a linked panel's price sits outside this one's own current range — deliberately
  // *not* threaded through as a separate "true" value for the badge text the way the live-price
  // badge keeps its own real close price even while clamped: that works there because the value is
  // this same chart's own data, just scrolled out of view, whereas a price synced in from a
  // different panel (different symbol entirely, e.g. linking AAPL and MSFT) has no meaning on this
  // chart's own axis once clamped — re-deriving the badge text from wherever the line actually
  // landed keeps every panel's own badge self-consistent with its own axis, always.
  const effectiveHoverPrice = hoverY !== null ? zoomedPriceScale.invert(hoverY) : (syncedHoverPrice ?? null);
  const effectiveHoverY = effectiveHoverPrice !== null ? clampToPriceAxis(zoomedPriceScale(effectiveHoverPrice)) : null;

  // `onHoverDateChange` read through a ref (kept in sync during render, same reasoning
  // usePaneLayout's own reorderPanesRef is), not listed as an effect dependency directly: a
  // `ChartWorkspace` syncing several charts hands each of them a fresh callback closure on every
  // one of *its own* re-renders (it has no reason to memoize one per panel), and depending on that
  // reference directly here would re-fire this effect — re-reporting the same hover date — every
  // time any sibling chart's hover changes, not just this chart's own. That, plus a plain `useMemo`
  // fallback, is itself enough to snowball into a render loop across every synced chart in the
  // group. Depending only on `hoverIndex`/`dateForIndex` (both genuinely local to this chart)
  // means this only ever fires when *this* chart's own hover actually changes.
  const onHoverDateChangeRef = useRef(onHoverDateChange);
  onHoverDateChangeRef.current = onHoverDateChange;
  useEffect(() => {
    onHoverDateChangeRef.current?.(hoverIndex !== null ? dateForIndex(hoverIndex) : null);
  }, [hoverIndex, dateForIndex]);

  // Same ref trick as onHoverDateChangeRef above, for the same reason, plus one for
  // zoomedPriceScale itself: unlike dateForIndex it isn't memoized (a fresh d3 scale every
  // render), so listing it as a dependency directly would re-fire this on every render of every
  // synced chart rather than only when this chart's own real hover actually changes.
  const onHoverPriceChangeRef = useRef(onHoverPriceChange);
  onHoverPriceChangeRef.current = onHoverPriceChange;
  const zoomedPriceScaleRef = useRef(zoomedPriceScale);
  zoomedPriceScaleRef.current = zoomedPriceScale;
  useEffect(() => {
    onHoverPriceChangeRef.current?.(hoverY !== null ? zoomedPriceScaleRef.current.invert(hoverY) : null);
  }, [hoverY]);

  return { effectiveHoverIndex, effectiveHovered, effectiveHoverY };
}
