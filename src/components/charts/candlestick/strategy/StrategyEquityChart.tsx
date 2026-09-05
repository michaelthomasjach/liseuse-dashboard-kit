import * as d3 from "d3";
import { useMemo } from "react";
import type { StrategyEquityPoint, StrategyTrade } from "../interfaces/StrategyResult.interface";

export interface StrategyEquityChartProps {
  equity: StrategyEquityPoint[];
  trades: StrategyTrade[];
  initialCapital: number;
  currency: string;
  width: number;
  height: number;
  formatDate: (date: Date) => string;
}

/** The strategy's own equity curve, drawn as cumulative P&L rather than raw account value: the
 *  question a backtest answers is "what did this make", and a curve starting at 0 answers it
 *  directly instead of asking the reader to subtract the starting capital in their head. The zero
 *  line then means exactly what it looks like — break-even.
 *
 *  Filled to that zero line, in the sign's own colour, so a losing stretch reads as red below the
 *  axis without needing a legend. The running peak is drawn behind it, which turns drawdown from a
 *  number in the metrics grid into the visible gap between the two.
 *
 *  Plain SVG rather than the canvas pipeline the chart itself uses: this is a few hundred points
 *  in a panel, not a zoomable series over the whole history, and SVG keeps it inspectable and
 *  crisp with no device-pixel-ratio handling of its own. */
export function StrategyEquityChart({ equity, trades, initialCapital, currency, width, height, formatDate }: StrategyEquityChartProps) {
  const margin = { top: 8, right: 64, bottom: 20, left: 8 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { yScale, areaAbove, areaBelow, peakLine, ticks } = useMemo(() => {
    const points = equity.map((p) => ({ ...p, pnl: p.equity - initialCapital, peakPnl: p.peak - initialCapital }));
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, points.length - 1)])
      .range([0, innerWidth]);
    const lo = Math.min(0, d3.min(points, (p) => p.pnl) ?? 0);
    const hi = Math.max(0, d3.max(points, (p) => p.peakPnl) ?? 0);
    // A flat curve would otherwise collapse the domain to a single value and put every point on the
    // same pixel row; padding it keeps the zero line visible and the shape honest.
    const pad = (hi - lo) * 0.08 || 1;
    const y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([innerHeight, 0]).nice();
    const zero = y(0);
    // Split at zero so profit and loss can be filled in their own colours: one area clipped to
    // above the line, one to below.
    const above = d3
      .area<(typeof points)[number]>()
      .x((_, i) => x(i))
      .y0(zero)
      .y1((p) => Math.min(zero, y(p.pnl)));
    const below = d3
      .area<(typeof points)[number]>()
      .x((_, i) => x(i))
      .y0(zero)
      .y1((p) => Math.max(zero, y(p.pnl)));
    const peak = d3
      .line<(typeof points)[number]>()
      .x((_, i) => x(i))
      .y((p) => y(p.peakPnl));
    return {
      yScale: y,
      areaAbove: above(points) ?? "",
      areaBelow: below(points) ?? "",
      peakLine: peak(points) ?? "",
      ticks: y.ticks(4),
    };
  }, [equity, initialCapital, innerWidth, innerHeight]);

  if (equity.length < 2 || innerWidth <= 0 || innerHeight <= 0) {
    return <p className="lq-strategy__empty">Pas encore assez de barres rejouées pour tracer une courbe.</p>;
  }

  const zeroY = yScale(0);
  const first = equity[0];
  const last = equity[equity.length - 1];
  const finalPnl = last.equity - initialCapital;

  return (
    <svg className="lq-strategy__equity" width={width} height={height} role="img" aria-label="Courbe de P&L cumulé">
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="lq-strategy__equity-grid" x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} />
            <text className="lq-strategy__equity-tick" x={innerWidth + 6} y={yScale(t)} dy="0.32em">
              {d3.format(",.0f")(t)}
            </text>
          </g>
        ))}
        <path className="lq-strategy__equity-peak" d={peakLine} />
        <path className="lq-strategy__equity-area lq-strategy__equity-area--up" d={areaAbove} />
        <path className="lq-strategy__equity-area lq-strategy__equity-area--down" d={areaBelow} />
        <line className="lq-strategy__equity-zero" x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} />
        {/* The last value, labelled on the axis where the eye already ends up. */}
        <g transform={`translate(${innerWidth}, ${yScale(finalPnl)})`}>
          <circle className={`lq-strategy__equity-last lq-strategy__equity-last--${finalPnl >= 0 ? "up" : "down"}`} r={3} />
        </g>
        {/* One tick per end of the replayed range: a full date axis would need its own thinning
            pass for what is, in a panel this size, two useful labels. */}
        <text className="lq-strategy__equity-date" x={0} y={innerHeight + 14}>
          {formatDate(new Date(first.time))}
        </text>
        <text className="lq-strategy__equity-date lq-strategy__equity-date--end" x={innerWidth} y={innerHeight + 14}>
          {formatDate(new Date(last.time))}
        </text>
      </g>
      <title>{`P&L cumulé : ${finalPnl >= 0 ? "+" : ""}${finalPnl.toFixed(2)} ${currency} sur ${trades.length} trades`}</title>
    </svg>
  );
}
