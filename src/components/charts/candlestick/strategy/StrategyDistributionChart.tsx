import * as d3 from "d3";
import { useMemo } from "react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";
import { tradeAtTime } from "./markedTrade";

export interface StrategyDistributionChartProps {
  trades: StrategyTrade[];
  width: number;
  height?: number;
  /** A fill on the price chart to call out — here that means marking where *that trade's own
   *  result* falls among all the others, which is the question this chart answers. */
  markedTime?: number | null;
  markedToleranceMs?: number;
  /** Reports the trades in the bar under the pointer, so the price chart can point at their fills.
   *  A bin is several trades, so this reports all of them rather than singling one out — which
   *  would be a guess dressed up as an answer. */
  onHoverTrades?: (trades: StrategyTrade[] | null) => void;
}

/** How the trade results are spread, as a histogram of returns with zero in the middle — losers to
 *  its left, winners to its right.
 *
 *  This is what a win rate cannot say. 40% winners is one strategy when the losses are small and
 *  the wins are large, and a different one when it is the other way round; the shape says which at
 *  a glance, and the two dashed marks — the mean and the median — say how far a single outlier is
 *  dragging the average away from the typical trade.
 *
 *  Bin edges are aligned so that one of them falls exactly on zero. Without that a single bin
 *  straddles the axis and mixes small winners with small losers, which is precisely the boundary
 *  the whole chart exists to show. */
export function StrategyDistributionChart({ trades, width, height = 150, markedTime = null, markedToleranceMs = 0, onHoverTrades }: StrategyDistributionChartProps) {
  const margin = { top: 10, right: 12, bottom: 26, left: 12 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { bins, xScale, yScale, mean, median } = useMemo(() => {
    const returns = trades.map((t) => t.profitPercent);
    const lo = Math.min(0, d3.min(returns) ?? 0);
    const hi = Math.max(0, d3.max(returns) ?? 0);
    const span = hi - lo || 1;
    // ~18 bins over the observed range, then snapped so an edge lands on 0.
    const step = span / 18;
    const thresholds: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step; v += step) thresholds.push(v);
    const x = d3.scaleLinear().domain([thresholds[0], thresholds[thresholds.length - 1]]).range([0, innerWidth]);
    const binned = d3.bin<number, number>().domain(x.domain() as [number, number]).thresholds(thresholds)(returns);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(binned, (b) => b.length) ?? 1])
      .range([innerHeight, 0])
      .nice();
    const sorted = [...returns].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return {
      bins: binned,
      xScale: x,
      yScale: y,
      mean: returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : null,
      median: sorted.length === 0 ? null : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
    };
  }, [trades, innerWidth, innerHeight]);

  if (trades.length === 0 || innerWidth <= 0) {
    return <p className="lq-strategy__empty">Aucun trade clôturé : rien à distribuer.</p>;
  }

  return (
    <svg className="lq-strategy__distribution" onMouseLeave={() => onHoverTrades?.(null)} width={width} height={height} role="img" aria-label="Distribution des résultats par trade">
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {bins.map((bin, i) => {
          const x0 = xScale(bin.x0 ?? 0);
          const x1 = xScale(bin.x1 ?? 0);
          // A bin is a loser when its whole span sits below zero — the edge alignment above
          // guarantees none straddles it.
          const losing = (bin.x1 ?? 0) <= 0;
          return (
            <rect
              key={i}
              className={`lq-strategy__distribution-bar lq-strategy__distribution-bar--${losing ? "down" : "up"}`}
              x={x0 + 0.5}
              width={Math.max(0, x1 - x0 - 1)}
              y={yScale(bin.length)}
              height={innerHeight - yScale(bin.length)}
              onMouseEnter={() =>
                onHoverTrades?.(trades.filter((t) => t.profitPercent >= (bin.x0 ?? 0) && t.profitPercent < (bin.x1 ?? 0)))
              }
              onMouseLeave={() => onHoverTrades?.(null)}
            >
              <title>{`${bin.length} trade${bin.length > 1 ? "s" : ""} entre ${(bin.x0 ?? 0).toFixed(2)} % et ${(bin.x1 ?? 0).toFixed(2)} %`}</title>
            </rect>
          );
        })}
        <line className="lq-strategy__distribution-zero" x1={xScale(0)} x2={xScale(0)} y1={0} y2={innerHeight} />
        {(() => {
          const marked = tradeAtTime(trades, markedTime, markedToleranceMs);
          return marked === null ? null : (
            <line
              className="lq-strategy__distribution-marked"
              x1={xScale(marked.profitPercent)}
              x2={xScale(marked.profitPercent)}
              y1={0}
              y2={innerHeight}
            />
          );
        })()}
        {median !== null && (
          <line className="lq-strategy__distribution-mark lq-strategy__distribution-mark--median" x1={xScale(median)} x2={xScale(median)} y1={0} y2={innerHeight} />
        )}
        {mean !== null && (
          <line className="lq-strategy__distribution-mark lq-strategy__distribution-mark--mean" x1={xScale(mean)} x2={xScale(mean)} y1={0} y2={innerHeight} />
        )}
        {xScale.ticks(6).map((t) => (
          <text key={t} className="lq-strategy__distribution-tick" x={xScale(t)} y={innerHeight + 14} textAnchor="middle">
            {t.toFixed(1)} %
          </text>
        ))}
      </g>
    </svg>
  );
}
