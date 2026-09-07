import * as d3 from "d3";
import { useMemo } from "react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";
import { tradeAtTime } from "./markedTrade";

export interface StrategyExcursionChartProps {
  trades: StrategyTrade[];
  currency: string;
  width: number;
  /** The vertical room this chart has. Rows divide it between them rather than each taking a fixed
   *  step, so the chart fills its panel instead of overflowing it — see MAX_ROW_HEIGHT for the one
   *  case that is capped. */
  height: number;
  /** A fill on the price chart to call out. This chart has one row per trade rather than a time
   *  axis, so the mark is that trade's own row rather than a vertical rule — a vertical line here
   *  would cross every trade and single out none. */
  markedTime?: number | null;
  markedToleranceMs?: number;
  /** Reports which trades the pointer is over, so the price chart can point at their own fills.
   *  `null` on leaving. The reverse of `markedTime`: that one brings the chart's pointer here,
   *  this one takes this chart's pointer back. */
  onHoverTrades?: (trades: StrategyTrade[] | null) => void;
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
/** A ceiling on how far apart rows may sit. Without it, three trades in a tall panel become three
 *  lines separated by an inch of nothing, which reads as a broken chart rather than a sparse one.
 *  Above roughly a dozen trades the available height is the binding constraint anyway and this
 *  never applies. */
const MAX_ROW_HEIGHT = 22;

export function StrategyExcursionChart({ trades, currency, width, height, markedTime = null, markedToleranceMs = 0, onHoverTrades }: StrategyExcursionChartProps) {
  const margin = { top: 18, right: 12, bottom: 18, left: 12 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  // Rows share out whatever height there is, rather than each claiming a fixed step and the whole
  // chart overflowing its panel. Compressing rather than scrolling is the same trade-off this
  // chart already made at high trade counts (see the doc above): past a point it stops being N
  // readable rows and becomes a shape, and the shape is what carries.
  const available = Math.max(0, height - margin.top - margin.bottom);
  const rowHeight = trades.length === 0 ? 0 : Math.min(MAX_ROW_HEIGHT, available / trades.length);
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

  const markedTrade = tradeAtTime(trades, markedTime, markedToleranceMs);

  return (
    <svg className="lq-strategy__excursion" onMouseLeave={() => onHoverTrades?.(null)} width={width} height={Math.max(height, innerHeight + margin.top + margin.bottom)} role="img" aria-label="Excursions maximales par trade">
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
          const marked = markedTrade !== null && markedTrade.id === trade.id;
          return (
            <g key={trade.id} className={marked ? "lq-strategy__excursion-row--marked" : undefined}>
              {marked && <rect className="lq-strategy__excursion-marked" x={0} width={innerWidth} y={i * rowHeight} height={rowHeight} />}
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
                r={Math.min(4, Math.max(1.5, rowHeight / 3))}
              />
            </g>
          );
        })}

        {/* Drawn last so it reads as the axis every row is measured from, not one more line among
            them. */}
        <line className="lq-strategy__excursion-zero" x1={zero} x2={zero} y1={0} y2={innerHeight} />

        {/* Hover targets, above everything else on purpose. A full-width invisible band per row so
            pointing anywhere along a trade counts, not only the few pixels its dot occupies — and
            last in paint order because anything drawn after them (the zero axis above, each row's
            own dot) would otherwise take the pointer for itself. */}
        {onHoverTrades !== undefined &&
          trades.map((trade, i) => (
            <rect
              key={`hit-${trade.id}`}
              className="lq-strategy__excursion-hit"
              x={0}
              width={innerWidth}
              y={i * rowHeight}
              height={Math.max(1, rowHeight)}
              onMouseEnter={() => onHoverTrades([trade])}
            >
              {/* The row's own tooltip lives here rather than on its dot: this band is on top, so
                  it is what the pointer actually reaches. */}
              <title>{`Trade ${i + 1} · ${trade.direction === "long" ? "long" : "short"} — contre : ${trade.maxAdverse.toFixed(2)} · pour : ${trade.maxFavorable.toFixed(2)} · résultat : ${trade.profit >= 0 ? "+" : "−"}${Math.abs(trade.profit).toFixed(2)} ${currency}`}</title>
            </rect>
          ))}
      </g>
    </svg>
  );
}
