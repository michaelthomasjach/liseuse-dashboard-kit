import * as d3 from "d3";
import { memo, useMemo, useState } from "react";
import type { StrategyEquityPoint, StrategyTrade } from "../interfaces/StrategyResult.interface";

/** How near a fill the pointer has to be, in pixels along the curve, to be reading it. Beyond this
 *  the pointer is on the curve generally rather than on any one trade, and reporting the nearest
 *  fill anyway would light up the price chart for a gesture that meant nothing. */
const FILL_HOVER_DISTANCE = 8;

/** Gap between the plot's right edge and the tick labels sitting beside it. Also part of how wide
 *  the gutter holding them has to be — see where it is computed. */
const TICK_LABEL_OFFSET = 6;

/** The narrowest an active trade's band is allowed to be drawn. A trade that opened and closed on
 *  the same bar is a real and common case, and at zero width its highlight is not a thin band, it
 *  is nothing at all. */
const MIN_SPAN_WIDTH = 3;

/** The equity sample nearest a moment.
 *
 *  A bisection rather than the linear scan the hover path uses: this one runs once per trade on
 *  every layout, and a linear scan would make that trades x bars of work on each resize. The
 *  equity series is sampled per bar and in order, which is what makes the bisection valid. */
function nearestEquityIndex(equity: { time: number }[], at: number): number {
  if (equity.length === 0) return -1;
  let lo = 0;
  let hi = equity.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (equity[mid].time < at) lo = mid + 1;
    else hi = mid;
  }
  // `lo` is the first sample at or after `at`; the one before it can still be the nearer of the two.
  const prev = Math.max(0, lo - 1);
  return Math.abs(equity[prev].time - at) <= Math.abs(equity[lo].time - at) ? prev : lo;
}

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
  /** One trade to show the *span* of — from its entry to its exit — rather than the single moment
   *  `markedTime` marks. Everything outside it is dimmed, which is the only way to answer "how much
   *  of this curve is that trade" on a series where one trade can be two pixels wide.
   *
   *  Separate from `markedTime` on purpose: that one comes from the price chart and points at a
   *  fill, a moment; this comes from inside the panel — the trade strip below the curve — and a
   *  trade there is a period. `null` when nothing is being pointed at. */
  activeTrade?: StrategyTrade | null;
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
function StrategyEquityChartImpl({ equity, trades, initialCapital, currency, width, height, formatDate, markedTime = null, activeTrade = null, onHoverTrades }: StrategyEquityChartProps) {
  // Where the pointer is inside the plot, in the group's own coordinates. Null when it is outside.
  // Declared up here with the other hooks: there is an early return further down for a run with
  // too few bars to draw, and a hook after it would not run on every render.
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const margin = { top: 8, bottom: 20, left: 8 };
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { yScale, xScale, areaAbove, areaBelow, peakLine, ticks, innerWidth, axisGutter, tradeMarks, markRadius } = useMemo(() => {
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
    // One dot per trade, sitting on the curve at the bar where that trade closed — the point at
    // which its result actually entered the account, and so the step the dot is explaining.
    //
    // Placed on the nearest equity sample rather than interpolated between two: the curve is
    // sampled per bar and a fill happens on a bar, so the sample *is* the moment; interpolating
    // would put the dot at a value the run never had, slightly off its own curve.
    const marks = points.length === 0
      ? []
      : trades.map((trade) => {
          const index = nearestEquityIndex(points, trade.exitTime);
          return { id: trade.id, x: x(index), y: y(points[index].pnl), up: trade.profit >= 0 };
        });
    // Shrunk when the trades crowd, instead of dropping any: the reader asked for a dot per trade,
    // and a run of three hundred should read as a dotted curve rather than either a smear or a
    // silently thinned sample. Measured on the average room per dot across the plot — the honest
    // figure for "is there space", where a single pair of near-simultaneous exits would otherwise
    // shrink every dot on the chart.
    const room = innerW / Math.max(1, marks.length);
    const radius = room >= 10 ? 2.6 : room >= 5 ? 2 : 1.4;
    return {
      tradeMarks: marks,
      markRadius: radius,
      yScale: y,
      xScale: x,
      areaAbove: above(points) ?? "",
      areaBelow: below(points) ?? "",
      peakLine: peak(points) ?? "",
      ticks: tickValues,
      innerWidth: innerW,
      axisGutter: gutter,
    };
  }, [equity, trades, initialCapital, width, margin.left, innerHeight]);

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

  /** The band the active trade occupies, in pixels along the curve.
   *
   *  Both ends land on the equity sample nearest their own moment, the same rule the per-trade dots
   *  use, so the band's right edge and that trade's dot are the same place rather than two answers
   *  to the same question. A trade opened and closed on one bar would otherwise be a band of zero
   *  width — invisible, and a reader would conclude the highlight was broken rather than that the
   *  trade was that short — so it is widened to a couple of pixels around its own centre. */
  const activeSpan = (() => {
    if (activeTrade === null || equity.length === 0) return null;
    const from = xScale(nearestEquityIndex(equity, activeTrade.entryTime));
    const to = xScale(nearestEquityIndex(equity, activeTrade.exitTime));
    const left = Math.min(from, to);
    const right = Math.max(from, to);
    const pad = right - left < MIN_SPAN_WIDTH ? (MIN_SPAN_WIDTH - (right - left)) / 2 : 0;
    return {
      left: Math.max(0, left - pad),
      right: Math.min(innerWidth, right + pad),
      entryLabel: formatDate(new Date(activeTrade.entryTime)),
      exitLabel: formatDate(new Date(activeTrade.exitTime)),
    };
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
        {/* Over the filled areas, so a dot inside a coloured stretch is still a dot: its outline is
            the panel's own background, which is what separates it from the fill underneath. */}
        {tradeMarks.map((mark) => (
          <circle
            key={mark.id}
            className={`lq-strategy__equity-trade lq-strategy__equity-trade--${mark.up ? "up" : "down"}`}
            cx={mark.x}
            cy={mark.y}
            r={markRadius}
          />
        ))}
        {/* Over the curve rather than under it: it answers "where am I pointing", which has to win
            against the thing it is pointing at. */}
        {markedX !== null && <line className="lq-strategy__equity-mark" x1={markedX} x2={markedX} y1={0} y2={innerHeight} />}
        {/* The last value, labelled on the axis where the eye already ends up. */}
        <g transform={`translate(${innerWidth}, ${yScale(finalPnl)})`}>
          <circle className={`lq-strategy__equity-last lq-strategy__equity-last--${finalPnl >= 0 ? "up" : "down"}`} r={3} />
        </g>
        {/* The active trade's own stretch of the run. Drawn as two veils over everything *outside*
            it rather than as a tint inside it: a tint would have to sit under the curve to be read
            as a background, and under the curve is exactly where a filled area already is. Veiling
            the rest leaves the trade's own stretch untouched — the curve, its dots and the grid all
            at full strength — and needs no colour of its own to say which part is the answer.

            Above everything the plot draws and below the crosshair, which measures whatever is
            under the pointer and has to stay legible over a dimmed stretch. */}
        {activeSpan !== null && (
          <g className="lq-strategy__equity-span">
            <rect className="lq-strategy__equity-veil" x={0} y={0} width={Math.max(0, activeSpan.left)} height={innerHeight} />
            <rect
              className="lq-strategy__equity-veil"
              x={activeSpan.right}
              y={0}
              width={Math.max(0, innerWidth - activeSpan.right)}
              height={innerHeight}
            />
            {/* The two fills themselves. Without them the band has edges but no *meaning*: this is
                where the trade was opened and this is where it was closed, which is the half of the
                question the veil alone does not answer. */}
            <line className="lq-strategy__equity-span-edge" x1={activeSpan.left} x2={activeSpan.left} y1={0} y2={innerHeight} />
            <line className="lq-strategy__equity-span-edge" x1={activeSpan.right} x2={activeSpan.right} y1={0} y2={innerHeight} />
            {/* Named only when the band is wide enough to hold both without them colliding or
                spilling over its own edges. Below that the band is a sliver and the dates it would
                carry belong to the strip's own readout, which is already showing them. */}
            {activeSpan.right - activeSpan.left >= 96 && (
              <>
                <text className="lq-strategy__equity-span-label" x={activeSpan.left + 4} y={10}>
                  Entrée {activeSpan.entryLabel}
                </text>
                <text className="lq-strategy__equity-span-label" x={activeSpan.right - 4} y={10} textAnchor="end">
                  Sortie {activeSpan.exitLabel}
                </text>
              </>
            )}
          </g>
        )}

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

/** Re-renders only when its own inputs change, `markedTime` among them; the point is that it no longer re-renders when a *sibling*'s do.
 *
 *  A shallow prop comparison is enough: every prop here is either a primitive or an array/object
 *  the panel already holds stable across renders (it comes from the run result, which only changes
 *  when the script re-runs). */
export const StrategyEquityChart = memo(StrategyEquityChartImpl);
