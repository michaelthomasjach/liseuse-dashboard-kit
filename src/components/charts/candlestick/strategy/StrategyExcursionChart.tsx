import * as d3 from "d3";
import { memo, useMemo, useState } from "react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";
import { tradeAtTime } from "./markedTrade";
import { ChartTooltip } from "../../ChartTooltip";

export interface StrategyExcursionChartProps {
  trades: StrategyTrade[];
  currency: string;
  width: number;
  /** The vertical room this chart has. Rows divide it between them rather than each taking a fixed
   *  step, so the chart fills its panel instead of overflowing it — see MAX_ROW_HEIGHT for the one
   *  case that is capped.
   *
   *  Defaulted rather than required: it used to be required and the Storybook stories did not pass
   *  it, which made every row height `NaN` — an SVG with `height="NaN"` and `cy="NaN"` on every dot,
   *  so the chart drew its axis and nothing else. A number that cannot be missing cannot do that. */
  height?: number;
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
 *  what carries at that count. What that costs is the *pointer*: a row under a pixel tall cannot be
 *  aimed at, and the chart used to put one invisible hit rectangle per row and leave the reading to
 *  a native `<title>`, which needs a second of stillness on a target that thin. So the pointer is
 *  resolved arithmetically instead — see the overlay at the bottom of the render — and what it
 *  finds is answered immediately, in a tooltip, with the row it found lit up at a legible size. */
/** A ceiling on how far apart rows may sit. Without it, three trades in a tall panel become three
 *  lines separated by an inch of nothing, which reads as a broken chart rather than a sparse one.
 *  Above roughly a dozen trades the available height is the binding constraint anyway and this
 *  never applies. */
const MAX_ROW_HEIGHT = 22;

/** How tall the highlight behind the hovered row is drawn, at minimum. Rows themselves are allowed
 *  to compress below a pixel; a highlight that compressed with them would confirm nothing, which is
 *  the one thing it is for at that density. */
const MIN_HIGHLIGHT_HEIGHT = 3;

function money(value: number, currency: string): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** What the chart's three marks mean and what to conclude from where they land.
 *
 *  Exported beside the chart rather than written into the panel, because the chart is read in two
 *  places — the strategy tester and Storybook — and an explanation that lives in only one of them
 *  is an explanation that goes stale in the other.
 *
 *  Split into a line that is always there and a disclosure that is not, because of where it is
 *  used: in the tester the chart takes whatever height the text leaves it, so an explanation good
 *  enough to learn from would squeeze the thing it explains down to a strip. The definitions and
 *  the key stay; the reading lesson is one click away and, once read, does not need re-reading. */
export function StrategyExcursionLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <div className="lq-strategy__excursion-legend">
      <p className="lq-strategy__hint">
        Une ligne par trade, mesurée depuis son prix d&apos;entrée — le trait vertical du milieu. <strong>MAE</strong> : jusqu&apos;où
        il est descendu contre vous. <strong>MFE</strong> : le meilleur gain qu&apos;il a affiché.
      </p>
      <ul className="lq-strategy__legend">
        <li>
          <span className="lq-strategy__legend-key lq-strategy__legend-key--adverse" aria-hidden="true" />
          Bras gauche : la chaleur encaissée (MAE)
        </li>
        <li>
          <span className="lq-strategy__legend-key lq-strategy__legend-key--favorable" aria-hidden="true" />
          Bras droit : ce que le trade offrait (MFE)
        </li>
        <li>
          <span className="lq-strategy__legend-key lq-strategy__legend-key--dot" aria-hidden="true" />
          Le point : votre sortie réelle
        </li>
      </ul>
      <details className="lq-strategy__disclosure" open={defaultOpen}>
        <summary>Comment la lire</summary>
        <p className="lq-strategy__hint">
          <em>Maximum adverse excursion</em> et <em>maximum favorable excursion</em> : le pire et le meilleur moment traversés
          pendant que le trade était ouvert. Ni l&apos;un ni l&apos;autre n&apos;apparaît dans le prix d&apos;entrée et de sortie, qui ne
          disent que les deux bouts du trajet — un trade clôturé à +50 après être descendu de 400 et un trade monté tout droit
          ont le même résultat et ne sont pas le même trade.
        </p>
        <p className="lq-strategy__hint">
          Trois lectures. Un point <strong>collé au bout droit</strong> : la sortie prend presque tout ce qui était offert. Un
          point <strong>revenu vers zéro alors que le bras droit est long</strong> : le gain a été rendu — c&apos;est la règle de
          sortie qu&apos;il faut revoir, et ni un P&amp;L total ni un taux de réussite ne le montrent. Un{" "}
          <strong>long bras gauche</strong> : le trade a été sous l&apos;eau avant de fonctionner, et cette distance est la marge
          dont votre stop a besoin pour ne pas le couper.
        </p>
      </details>
    </div>
  );
}

function StrategyExcursionChartImpl({ trades, currency, width, height = 180, markedTime = null, markedToleranceMs = 0, onHoverTrades }: StrategyExcursionChartProps) {
  // Which row the pointer is on, and where it is. Declared above the early return below so it runs
  // on every render, empty trade list included.
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);
  const margin = { top: 18, right: 12, bottom: 20, left: 12 };
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
  const hoveredTrade = hover === null ? null : (trades[hover.index] ?? null);

  /** The row under the pointer, by arithmetic rather than by hit-testing a rectangle per row.
   *
   *  This is what makes the chart usable at two hundred trades: the row is found by dividing, so it
   *  is found just as precisely when it is half a pixel tall as when it is twenty, and there is one
   *  element taking pointer events instead of one per trade. */
  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const index = Math.max(0, Math.min(trades.length - 1, Math.floor(y / Math.max(rowHeight, 0.0001))));
    setHover((current) => (current !== null && current.index === index && Math.abs(current.x - x) < 0.5 ? current : { index, x }));
    onHoverTrades?.([trades[index]]);
  }

  function handleLeave() {
    setHover(null);
    onHoverTrades?.(null);
  }

  const svgHeight = Math.max(height, innerHeight + margin.top + margin.bottom);
  // Where the pointer sits in money, which is what the vertical rule is for: the arms are lengths,
  // and a length is only readable against a number.
  const pointerValue = hover === null ? 0 : Math.abs(xScale.invert(hover.x));

  return (
    <div className="lq-strategy__excursion-wrap">
      <svg className="lq-strategy__excursion" width={width} height={svgHeight} role="img" aria-label="Excursions maximales par trade">
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
            const lit = hover !== null && hover.index === i;
            return (
              <g
                key={trade.id}
                className={`lq-strategy__excursion-row${marked ? " lq-strategy__excursion-row--marked" : ""}${lit ? " lq-strategy__excursion-row--hovered" : ""}`}
              >
                {/* The marked band keeps the row's own height; the hovered one has a floor, because
                    at this chart's densest it is confirming a row too thin to see. Both are centred
                    on the row so the highlight and the line it explains stay the same place. */}
                {marked && <rect className="lq-strategy__excursion-marked" x={0} width={innerWidth} y={i * rowHeight} height={rowHeight} />}
                {lit && (
                  <rect
                    className="lq-strategy__excursion-hovered"
                    x={0}
                    width={innerWidth}
                    y={y - Math.max(rowHeight, MIN_HIGHLIGHT_HEIGHT) / 2}
                    height={Math.max(rowHeight, MIN_HIGHLIGHT_HEIGHT)}
                  />
                )}
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
                  // The hovered row's dot is drawn at a size it can be seen at whatever the row
                  // height, for the same reason its band has a floor.
                  r={lit ? Math.max(3, Math.min(4, rowHeight / 3)) : Math.min(4, Math.max(1.5, rowHeight / 3))}
                />
              </g>
            );
          })}

          {/* Drawn last so it reads as the axis every row is measured from, not one more line among
              them. */}
          <line className="lq-strategy__excursion-zero" x1={zero} x2={zero} y1={0} y2={innerHeight} />

          {/* The pointer's own position, in money. The arms are lengths and the top ticks are five
              numbers; this is what turns "that arm is long" into "that arm is 140". */}
          {hover !== null && (
            <g className="lq-strategy__excursion-pointer">
              <line className="lq-strategy__excursion-pointer-line" x1={hover.x} x2={hover.x} y1={0} y2={innerHeight} />
              <g transform={`translate(${hover.x}, ${innerHeight})`}>
                {(() => {
                  const label = d3.format(",.0f")(pointerValue).replace(/,/g, " ");
                  const boxWidth = label.length * 6.6 + 12;
                  // Pulled back inside the plot at either end rather than centred regardless: at the
                  // extremes of the axis a centred badge hangs half outside the chart.
                  const left = Math.max(0, Math.min(innerWidth - boxWidth, hover.x - boxWidth / 2)) - hover.x;
                  return (
                    <>
                      <rect className="lq-strategy__excursion-badge" x={left} y={2} width={boxWidth} height={15} rx={2} />
                      <text className="lq-strategy__excursion-badge-text" x={left + boxWidth / 2} y={12.5} textAnchor="middle">
                        {label}
                      </text>
                    </>
                  );
                })()}
              </g>
            </g>
          )}

          {/* One overlay for the whole plot, rather than one hit rectangle per row. `fill:
              transparent` is not optional: an SVG rect with no fill paints solid black, which would
              cover the very chart it exists to make hoverable. */}
          <rect
            className="lq-strategy__excursion-hit"
            x={0}
            y={0}
            width={innerWidth}
            height={Math.max(1, innerHeight)}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
          />
        </g>
      </svg>

      {/* Answers immediately, where the native per-row `<title>` needed a second of stillness on a
          target that could be half a pixel tall. */}
      {hoveredTrade !== null && hover !== null && (
        <ChartTooltip
          x={margin.left + hover.x}
          y={margin.top + Math.min(innerHeight, hover.index * rowHeight + rowHeight / 2)}
          visible
          align={hover.x > innerWidth * 0.6 ? "left" : "right"}
        >
          <div className="lq-chart-tooltip__title">
            Trade {hover.index + 1} · {hoveredTrade.direction === "long" ? "long" : "short"}
          </div>
          <div className="lq-chart-tooltip__row">
            <span className="lq-chart-tooltip__swatch lq-strategy__legend-key--adverse" />
            <span>Contre vous (MAE)</span>
            <strong>{money(hoveredTrade.maxAdverse, currency)}</strong>
          </div>
          <div className="lq-chart-tooltip__row">
            <span className="lq-chart-tooltip__swatch lq-strategy__legend-key--favorable" />
            <span>Pour vous (MFE)</span>
            <strong>{money(hoveredTrade.maxFavorable, currency)}</strong>
          </div>
          <div className="lq-chart-tooltip__row">
            <span className={`lq-chart-tooltip__swatch lq-strategy__legend-key--${hoveredTrade.profit >= 0 ? "up" : "down"}`} />
            <span>Sortie</span>
            <strong>
              {hoveredTrade.profit >= 0 ? "+" : "−"}
              {money(Math.abs(hoveredTrade.profit), currency)}
            </strong>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}

/** Same: only its own inputs, not every render of the panel around it.
 *
 *  A shallow prop comparison is enough: every prop here is either a primitive or an array/object
 *  the panel already holds stable across renders (it comes from the run result, which only changes
 *  when the script re-runs). */
export const StrategyExcursionChart = memo(StrategyExcursionChartImpl);
