import * as d3 from "d3";
import { useMemo } from "react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";

export interface StrategyExcursionChartProps {
  trades: StrategyTrade[];
  currency: string;
  width: number;
}

/** MAE / MFE, one row per trade: a horizontal span from how far the trade went *against* you (left
 *  of the centre line) to how far it went *for* you (right of it), with a dot where you actually
 *  got out.
 *
 *  Chosen over the conventional MAE-versus-outcome scatter because it shows three things at once
 *  where the scatter shows two, and the third is the interesting one. A scatter answers "how much
 *  heat did I take for this result"; this also answers "how much of what the trade offered did I
 *  keep", which is the question that changes an exit rule. Reading it takes no training: a dot far
 *  left of its own span means the trade was given back, a long left arm means it was underwater
 *  before it worked, and a wall of dots hugging the right edge means the exits are well placed.
 *
 *  Rows compress rather than scroll as trades pile up — at two hundred trades this stops being two
 *  hundred readable rows and becomes a shape, which is still the honest thing to show: the shape is
 *  what carries at that count. */
export function StrategyExcursionChart({ trades, currency, width }: StrategyExcursionChartProps) {
  const margin = { top: 18, right: 12, bottom: 18, left: 12 };
  const rowHeight = trades.length > 60 ? 2 : trades.length > 25 ? 5 : 11;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = trades.length * rowHeight;

  const { xScale, ticks } = useMemo(() => {
    const extent = d3.max(trades, (t) => Math.max(t.maxAdverse, t.maxFavorable, Math.abs(t.profit))) ?? 1;
    // Symmetric on purpose: the centre line is the entry, and an adverse move of 100 has to look
    // exactly as far from it as a favourable one of 100 or the chart lies about which was bigger.
    const x = d3.scaleLinear().domain([-extent, extent]).range([0, innerWidth]).nice();
    return { xScale: x, ticks: x.ticks(5) };
  }, [trades, innerWidth]);

  if (trades.length === 0 || innerWidth <= 0) {
    return <p className="lq-strategy__empty">Aucun trade clôturé : rien à représenter.</p>;
  }

  const zero = xScale(0);
  const height = innerHeight + margin.top + margin.bottom;

  return (
    <svg className="lq-strategy__excursion" width={width} height={height} role="img" aria-label="Excursions maximales par trade">
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="lq-strategy__excursion-grid" x1={xScale(t)} x2={xScale(t)} y1={0} y2={innerHeight} />
            <text className="lq-strategy__excursion-tick" x={xScale(t)} y={-6} textAnchor="middle">
              {d3.format(",.0f")(Math.abs(t))}
            </text>
          </g>
        ))}
        <text className="lq-strategy__excursion-axis-label" x={zero - 8} y={-6} textAnchor="end">
          ← contre vous
        </text>
        <text className="lq-strategy__excursion-axis-label" x={zero + 8} y={-6} textAnchor="start">
          pour vous →
        </text>

        {trades.map((trade, i) => {
          const y = i * rowHeight + rowHeight / 2;
          return (
            <g key={trade.id}>
              <line
                className="lq-strategy__excursion-span lq-strategy__excursion-span--adverse"
                x1={xScale(-trade.maxAdverse)}
                x2={zero}
                y1={y}
                y2={y}
              />
              <line
                className="lq-strategy__excursion-span lq-strategy__excursion-span--favorable"
                x1={zero}
                x2={xScale(trade.maxFavorable)}
                y1={y}
                y2={y}
              />
              <circle
                className={`lq-strategy__excursion-dot lq-strategy__excursion-dot--${trade.profit >= 0 ? "up" : "down"}`}
                cx={xScale(trade.profit)}
                cy={y}
                r={Math.max(1.5, rowHeight / 3)}
              >
                <title>{`Trade ${i + 1} · ${trade.direction === "long" ? "long" : "short"} — contre : ${trade.maxAdverse.toFixed(2)} · pour : ${trade.maxFavorable.toFixed(2)} · résultat : ${trade.profit >= 0 ? "+" : "−"}${Math.abs(trade.profit).toFixed(2)} ${currency}`}</title>
              </circle>
            </g>
          );
        })}

        {/* Drawn last so it reads as the axis every row is measured from, not one more line among
            them. */}
        <line className="lq-strategy__excursion-zero" x1={zero} x2={zero} y1={0} y2={innerHeight} />
      </g>
    </svg>
  );
}
