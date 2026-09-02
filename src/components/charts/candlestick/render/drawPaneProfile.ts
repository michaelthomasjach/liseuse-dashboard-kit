import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** The profile's own value/magnitude scale — `[0, maxValue]` mapped onto the column's width,
 *  measured from the edge facing *away* from the chart inward (see this file's own doc on why):
 *  a right-docked column ranges `[columnWidth, 0]` so value 0 sits at its own right edge and
 *  `maxValue` reaches toward the chart, a left-docked one the mirror `[0, columnWidth]`. Shared by
 *  the canvas draw below and `ChartSidePaneColumn.tsx`'s own bottom axis for this pane, so both
 *  agree on exactly the same mapping — built fresh from `profile` each call rather than memoized
 *  here since it's cheap (one reduce over however many grid points the script produced) and the
 *  caller already re-renders on every relevant change anyway. Returns null for an empty/degenerate
 *  profile (nothing to scale against) or a collapsed column, same guard `drawPaneProfile` itself
 *  uses.
 *
 *  `headroom` stretches the domain past the profile's own maximum by that fraction (0.08 = 8%
 *  wider), which is the only way to stop the tallest peak from landing exactly on the column's
 *  inner edge: the domain's top is the data's own max by construction, so no rescaling a script
 *  applies to its values can move its own argmax off that edge — the max is always the max. A
 *  script asks for the gap via `pane.profile(..., { headroom })` (see `PlotProfileOptions`); 0, the
 *  default, is the original edge-to-edge behaviour. Deliberately a fraction of the data range
 *  rather than a pixel inset so the bottom axis's own ticks stay honest — the axis reads the very
 *  same scale, and a domain that stops short of a tick would put that tick outside the column. */
export function computeProfileValueScale(
  profile: { price: number; value: number }[],
  side: "left" | "right",
  columnWidth: number,
  headroom = 0
): d3.ScaleLinear<number, number> | null {
  if (columnWidth <= 0) return null;
  const maxValue = profile.reduce((max, entry) => Math.max(max, entry.value), 0);
  if (maxValue <= 0) return null;
  const domainMax = maxValue * (1 + Math.max(0, headroom));
  return d3.scaleLinear().domain([0, domainMax]).range(side === "right" ? [columnWidth, 0] : [0, columnWidth]);
}

/** Paints one `pane.profile(name, values, prices)` series — the market-profile shape, drawn
 *  transposed as a single continuous curve. Two things make it different from every other pane
 *  series, and both come from the same fact — a profile is not a time series:
 *
 *  - Y comes from `priceScale`, the *main chart's own* zoomed price scale, not from a scale fitted
 *    to this pane's data. That is what puts a bulge at exactly the height of the price it
 *    describes, lining it up with the candles beside it. It also means the curve only occupies the
 *    vertical span the price section occupies — the rest of the column stays empty, which is
 *    correct: there is no price down there to align with.
 *  - X is the value, measured from the column's *outer* edge inward, so the curve's baseline sits
 *    against the outside of the chart and its bulges reach toward the price action. That is the
 *    orientation every market-profile tool uses, and it is what makes a peak read as pointing at
 *    the price level it marks rather than away from it.
 *
 *  A curve rather than one bar per level: the density this draws is continuous by construction
 *  (a kernel estimate is a smooth function sampled on a grid, not a set of discrete buckets), so
 *  a stroked outline is the honest shape for it. A grid fine enough to be worth plotting is
 *  already dense enough that a plain polyline reads as smooth — no spline needed. */
export function drawPaneProfile(
  ctx: CanvasRenderingContext2D,
  indicator: Indicator,
  side: "left" | "right",
  columnWidth: number,
  priceScale: (price: number) => number,
  style: ChartCanvasStyle
) {
  const profile = indicator.customData?.profile ?? [];
  if (profile.length < 2 || columnWidth <= 0) return;

  const valueScale = computeProfileValueScale(profile, side, columnWidth, indicator.customData?.profileHeadroom);
  if (!valueScale) return;

  // Sorted by price so the polyline walks the grid from one end to the other rather than jumping
  // around in whatever order the script pushed its own points.
  const sorted = [...profile].sort((a, b) => a.price - b.price);

  ctx.save();
  ctx.strokeStyle = indicator.color ?? indicator.customData?.color ?? style.colorAccent;
  ctx.lineWidth = indicator.customData?.lineWidth ?? 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();

  let started = false;
  for (const entry of sorted) {
    const y = priceScale(entry.price);
    if (!Number.isFinite(y)) continue;
    const x = valueScale(entry.value);
    if (started) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  if (started) ctx.stroke();

  ctx.restore();
}
