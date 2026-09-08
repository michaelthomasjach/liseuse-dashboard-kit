import * as d3 from "d3";
import { useMemo, useState } from "react";
import type { StrategyEquityPoint, StrategyTrade } from "../interfaces/StrategyResult.interface";

/** How near a fill the pointer has to be, in pixels along the curve, to be reading it. Beyond this
 *  the pointer is on the curve generally rather than on any one trade, and reporting the nearest
 *  fill anyway would light up the price chart for a gesture that meant nothing. */
const FILL_HOVER_DISTANCE = 8;

/** Gap between the plot's right edge and the tick labels sitting beside it. Also part of how wide
 *  the gutter holding them has to be — see where it is computed. */
const TICK_LABEL_OFFSET = 6;

export interface StrategyEquityChartProps {
  equity: StrategyEquityPoint[];
  trades: StrategyTrade[];
  initialCapital: number;
  currency: string;
  width: number;
  height: number;
  formatDate: (date: Date) => string;
  /** A moment on the chart above to call out here — the timestamp of a fill the user is pointing
   *  at or has clicked. Drawn as a vertical rule so "this trade" and "this point on the curve" are
   *  the same place on screen instead of two things to correlate by eye. `null` when nothing is
   *  being pointed at. */
  markedTime?: number | null;
  /** Reports the fill the pointer is on, so the price chart can point at it. `null` whenever the
   *  pointer is on the curve but not near any fill. */
  onHoverTrades?: (trades: StrategyTrade[] | null) => void;
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
export function StrategyEquityChart({ equity, trades, initialCapital, currency, width, height, formatDate, markedTime = null, onHoverTrades }: StrategyEquityChartProps) {
  // Where the pointer is inside the plot, in the group's own coordinates. Null when it is outside.
  // Declared up here with the other hooks: there is an early return further down for a run with
  // too few bars to draw, and a hook after it would not run on every render.
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const margin = { top: 8, bottom: 20, left: 8 };
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { yScale, xScale, areaAbove, areaBelow, peakLine, ticks, innerWidth, axisGutter } = useMemo(() => {
    const points = equity.map((p) => ({ ...p, pnl: p.equity - initialCapital, peakPnl: p.peak - initialCapital }));
    const lo = Math.min(0, d3.min(points, (p) => p.pnl) ?? 0);
    const hi = Math.max(0, d3.max(points, (p) => p.peakPnl) ?? 0);
    // A flat curve would otherwise collapse the domain to a single value and put every point on the
    // same pixel row; padding it keeps the zero line visible and the shape honest.
    const pad = (hi - lo) * 0.08 || 1;
    const y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([innerHeight, 0]).nice();
    const tickValues = y.ticks(4);
    // The right gutter is sized to the labels that actually go in it rather than fixed: at a flat
    // 64px a chart whose ticks read "100" left nearly forty pixels of nothing between the widest
    // label and the panel's own edge, which is visible as a gap once the panel spans the full
    // width. Estimated from the string lengths at this font rather than measured — being a pixel
    // out moves a tick label a pixel, which is not worth a layout pass per render.
    const longest = Math.max(1, ...tickValues.map((t) => d3.format(",.0f")(t).length));
    const gutter = Math.max(24, Math.round(longest * 6.2) + TICK_LABEL_OFFSET);
    const innerW = Math.max(0, width - margin.left - gutter);
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, points.length - 1)])
      .range([0, innerW]);
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
      xScale: x,
      areaAbove: above(points) ?? "",
      areaBelow: below(points) ?? "",
      peakLine: peak(points) ?? "",
      ticks: tickValues,
      innerWidth: innerW,
      axisGutter: gutter,
    };
  }, [equity, initialCapital, width, margin.left, innerHeight]);

  if (equity.length < 2 || innerWidth <= 0 || innerHeight <= 0) {
    return <p className="lq-strategy__empty">Pas encore assez de barres rejouées pour tracer une courbe.</p>;
  }

  // Deliberately outside the memo above: this changes on every pointer move over the chart, and
  // rebuilding the areas and the peak line for it would redo the whole curve sixty times a second
  // to move one line.
  //
  // The curve is indexed by bar, not by time, so the mark lands on the equity point nearest the
  // moment asked for — a fill always has one, since the equity series is sampled per bar and a
  // fill happens on a bar.
  const markedX = (() => {
    if (markedTime === null || equity.length === 0) return null;
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < equity.length; i++) {
      const d = Math.abs(equity[i].time - markedTime);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best === -1 ? null : xScale(best);
  })();

  /** Which trade's fill sits under the pointer, by x along the curve. The curve is indexed by bar
   *  while a fill knows only its own timestamp, so both are converted to a pixel and compared
   *  there — one mapping instead of two that could disagree. */
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left - margin.left;
    const y = e.clientY - box.top - margin.top;
    // Only inside the plot: a crosshair tracking the pointer across the axis gutters would put its
    // own labels on values that are not there.
    setCrosshair(x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight ? { x, y } : null);
    if (onHoverTrades === undefined) return;
    let best: StrategyTrade | null = null;
    let bestDistance = FILL_HOVER_DISTANCE;
    for (const trade of trades) {
      for (const at of [trade.entryTime, trade.exitTime]) {
        // Nearest equity sample to that moment, then that sample's own x.
        let index = 0;
        let closest = Infinity;
        for (let i = 0; i < equity.length; i++) {
          const d = Math.abs(equity[i].time - at);
          if (d < closest) {
            closest = d;
            index = i;
          }
        }
        const d = Math.abs(xScale(index) - x);
        if (d < bestDistance) {
          bestDistance = d;
          best = trade;
        }
      }
    }
    onHoverTrades(best === null ? null : [best]);
  }

  /** The trade the hovered moment belongs to, as a 1-based number.
   *
   *  The curve is indexed by bar while trades are events on it, so "which trade is this" is
   *  answered by how many have finished: the last one whose exit is at or before this point. That
   *  is also the one whose result the curve is standing on — the step under the cursor is the one
   *  that trade produced. `null` before the first exit, where the honest answer is "none yet". */
  function tradeNumberAt(time: number): number | null {
    let n = 0;
    for (const t of trades) if (t.exitTime <= time) n++;
    return n === 0 ? null : n;
  }

  const zeroY = yScale(0);
  const first = equity[0];
  const last = equity[equity.length - 1];
  const finalPnl = last.equity - initialCapital;

  return (
    <svg
      className="lq-strategy__equity"
      width={width}
      height={height}
      role="img"
      aria-label="Courbe de P&L cumulé"
      onMouseMove={handleMove}
      onMouseLeave={() => {
        setCrosshair(null);
        onHoverTrades?.(null);
      }}
    >
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="lq-strategy__equity-grid" x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} />
            {/* Anchored to the *right* edge of the gutter rather than started at its left: the
                gutter's own width is an estimate, and ending the labels flush means an
                over-estimate moves the plot's edge instead of leaving a visible strip of nothing
                between the numbers and the panel's edge. */}
            <text className="lq-strategy__equity-tick" x={innerWidth + axisGutter} y={yScale(t)} dy="0.32em" textAnchor="end">
              {d3.format(",.0f")(t)}
            </text>
          </g>
        ))}
        <path className="lq-strategy__equity-peak" d={peakLine} />
        <path className="lq-strategy__equity-area lq-strategy__equity-area--up" d={areaAbove} />
        <path className="lq-strategy__equity-area lq-strategy__equity-area--down" d={areaBelow} />
        <line className="lq-strategy__equity-zero" x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} />
        {/* Over the curve rather than under it: it answers "where am I pointing", which has to win
            against the thing it is pointing at. */}
        {markedX !== null && <line className="lq-strategy__equity-mark" x1={markedX} x2={markedX} y1={0} y2={innerHeight} />}
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

        {/* Crosshair, in the price chart's own idiom: a thin rule on each axis with the reading it
            points at pinned to that axis. Drawn last so it sits over the curve it is measuring. */}
        {crosshair !== null &&
          (() => {
            // The bar under the pointer, hence its own moment — the x scale maps equity index to
            // pixels, so inverting it is what turns a cursor position into a point in the run.
            const index = Math.max(0, Math.min(equity.length - 1, Math.round(xScale.invert(crosshair.x))));
            const tradeNumber = tradeNumberAt(equity[index].time);
            // Labelled with the *account*, not the P&L the ticks show: "how much do I have here"
            // is the question a horizontal line invites, and the two differ only by the starting
            // capital.
            const account = initialCapital + yScale.invert(crosshair.y);
            const xLabel = tradeNumber === null ? "avant le 1er trade" : `Trade ${tradeNumber}`;
            // Same locale formatting as the panel's own header and metric tiles — d3's default
            // grouping would put an English comma in the middle of a French figure.
            const yLabel = `${account.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
            return (
              <g className="lq-strategy__crosshair">
                <line className="lq-strategy__crosshair-line" x1={crosshair.x} x2={crosshair.x} y1={0} y2={innerHeight} />
                <line className="lq-strategy__crosshair-line" x1={0} x2={innerWidth} y1={crosshair.y} y2={crosshair.y} />
                {/* Widths are estimated from the string at this font rather than measured: a
                    badge one pixel wide of perfect is not worth a layout pass per pointer move. */}
                <g transform={`translate(${crosshair.x}, ${innerHeight})`}>
                  <rect className="lq-strategy__crosshair-badge" x={-(xLabel.length * 3.3 + 6)} y={2} width={xLabel.length * 6.6 + 12} height={15} rx={2} />
                  <text className="lq-strategy__crosshair-badge-text" x={0} y={12.5} textAnchor="middle">
                    {xLabel}
                  </text>
                </g>
                <g transform={`translate(${innerWidth + axisGutter}, ${crosshair.y})`}>
                  <rect className="lq-strategy__crosshair-badge" x={-(yLabel.length * 6.6 + 12)} y={-7.5} width={yLabel.length * 6.6 + 12} height={15} rx={2} />
                  <text className="lq-strategy__crosshair-badge-text" x={-6} y={3} textAnchor="end">
                    {yLabel}
                  </text>
                </g>
              </g>
            );
          })()}
      </g>
      <title>{`P&L cumulé : ${finalPnl >= 0 ? "+" : ""}${finalPnl.toFixed(2)} ${currency} sur ${trades.length} trades`}</title>
    </svg>
  );
}
