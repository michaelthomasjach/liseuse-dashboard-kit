import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

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

  const maxValue = profile.reduce((max, entry) => Math.max(max, entry.value), 0);
  if (maxValue <= 0) return;

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
    const depth = (entry.value / maxValue) * columnWidth;
    // Anchored to the edge facing *away* from the chart, growing back toward it: a right-docked
    // column measures leftward from its own right edge, a left-docked one rightward from its left.
    const x = side === "right" ? columnWidth - depth : depth;
    if (started) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  if (started) ctx.stroke();

  ctx.restore();
}
