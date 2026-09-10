import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { SymbolProfileEarningsPoint } from "./workspace/SymbolProfile.interface";
import { observeElementSize } from "../../internal/observeElementSize";
import "./EarningsDotChart.css";

export interface EarningsDotChartProps {
  points: SymbolProfileEarningsPoint[];
  width?: number;
  height?: number;
  /** Radius of each dot, and the padding around the plot. NOT the labels: their size is fixed in
   *  CSS and deliberately so — axis text is sized by the reading distance and the interface around
   *  it, never by how big the drawing it annotates happens to be. Without this the dots stay 4px
   *  across and vanish once the drawing is three times as tall. */
  scale?: number;
  /** Lay the drawing out at whatever width its container actually has, re-measured as that
   *  changes, instead of at the fixed `width`.
   *
   *  Not the same as stretching the svg with CSS: the drawing carries a viewBox, so stretching it
   *  magnifies its own 9px axis labels by the same factor. Measuring lets it *re-lay out* at the
   *  real width — the dots spread across the whole span, the labels stay 9px. `width` is still
   *  used, as the width to draw at until the first measurement arrives. */
  fill?: boolean;
}

/** Small quarterly-EPS dot chart for `SymbolProfilePanel`'s own "Résultats" section — estimate
 *  (hollow) vs. actual (filled) per quarter, plus a light value axis on the right and each
 *  quarter's own date underneath. Not built on `Sparkline` (a continuous line/area through every
 *  point) since this is a fundamentally different shape: two independent, unconnected point
 *  series read by their fill (hollow/solid), not a trend to follow with the eye. */
export function EarningsDotChart({ points, width: fixedWidth = 260, height = 120, scale = 1, fill = false }: EarningsDotChartProps) {
  // Measured rather than read off a prop when `fill` is set — see that prop's own doc. A plain
  // ResizeObserver instead of `useChartDimensions`: this needs one number, not a margin-derived
  // bounded box, and the margins here are scale-dependent and computed below.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!fill || el === null) return;
    return observeElementSize(el, (entry) => {
      const next = Math.round(entry.contentRect.width);
      // Sub-pixel jitter from a flex parent would otherwise re-lay out the whole drawing on every
      // frame of an unrelated resize.
      setMeasuredWidth((current) => (current !== null && Math.abs(current - next) < 1 ? current : next));
    });
    // `points.length` too: the wrapper does not exist while there is nothing to draw (see the
    // early return below), so a chart whose points arrive after mount would otherwise never get
    // an observer at all.
  }, [fill, points.length]);
  const width = fill && measuredWidth !== null && measuredWidth > 0 ? measuredWidth : fixedWidth;

  const margin = { top: 8 * scale, right: 34 * scale, bottom: 16 * scale, left: 4 * scale };
  // Which quarter is currently being read, by index — click a dot (or its column) to select, click
  // it again to clear. State rather than hover: this is used with a finger as much as a mouse, and
  // a tooltip that needs hovering is unreachable there.
  const [selected, setSelected] = useState<number | null>(null);

  const { x, y, ticks, columnWidth } = useMemo(() => {
    const values = points.flatMap((p) => [p.estimateEps, p.actualEps]).filter((v): v is number => v !== undefined);
    const [minValue, maxValue] = values.length > 0 ? (d3.extent(values) as [number, number]) : [0, 1];
    const lo = Math.min(0, minValue);
    const hi = maxValue === lo ? lo + 1 : maxValue;
    const xScale = d3
      .scalePoint<number>()
      .domain(points.map((_, i) => i))
      .range([margin.left, width - margin.right])
      .padding(0.5);
    const yScale = d3
      .scaleLinear()
      .domain([lo, hi])
      .nice(4)
      .range([height - margin.bottom, margin.top]);
    // One column per quarter, splitting the plot evenly — the click target below, and wide enough
    // to hit with a finger at any of the sizes this renders at.
    const plotWidth = width - margin.left - margin.right;
    return { x: xScale, y: yScale, ticks: yScale.ticks(4), columnWidth: points.length > 0 ? plotWidth / points.length : plotWidth };
  }, [points, width, height, margin.bottom, margin.left, margin.right, margin.top]);

  if (points.length === 0) return null;

  const active = selected !== null ? points[selected] : undefined;
  const surprise =
    active && active.estimateEps !== undefined && active.actualEps !== undefined ? active.actualEps - active.estimateEps : undefined;

  return (
    <div ref={wrapperRef} className="lq-earnings-dot-chart-wrapper">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={["lq-earnings-dot-chart", fill && "lq-earnings-dot-chart--fill"].filter(Boolean).join(" ")}
        role="img"
      >
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="lq-earnings-dot-chart__gridline" />
          <text x={width - margin.right + 6} y={y(tick)} className="lq-earnings-dot-chart__tick-label" dominantBaseline="middle">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <g
          key={`${p.date}-${i}`}
          className={["lq-earnings-dot-chart__quarter", selected === i && "lq-earnings-dot-chart__quarter--selected"]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setSelected((current) => (current === i ? null : i))}
        >
          {/* The whole column is the target, not the two 4px dots. A quarter is a column of the
              chart conceptually, and on a phone a dot that size cannot be hit at all. Transparent
              and drawn first, so it sits under the marks it selects. */}
          <rect
            x={x(i)! - columnWidth / 2}
            y={margin.top}
            width={columnWidth}
            height={height - margin.top - margin.bottom}
            className="lq-earnings-dot-chart__hit"
          />
          {selected === i && (
            <line x1={x(i)} x2={x(i)} y1={margin.top} y2={height - margin.bottom} className="lq-earnings-dot-chart__marker" />
          )}
          {p.estimateEps !== undefined && (
            <circle
              cx={x(i)}
              cy={y(p.estimateEps)}
              r={4 * scale}
              className="lq-earnings-dot-chart__point lq-earnings-dot-chart__point--estimate"
            />
          )}
          {p.actualEps !== undefined && (
            <circle cx={x(i)} cy={y(p.actualEps)} r={4 * scale} className="lq-earnings-dot-chart__point lq-earnings-dot-chart__point--actual" />
          )}
          <text x={x(i)} y={height - 2 * scale} className="lq-earnings-dot-chart__date-label" textAnchor="middle">
            {p.date}
          </text>
        </g>
      ))}
      </svg>
      {/* Below the drawing rather than floating over it: the panel is narrow, and a tooltip would
          cover the very dots being compared. Reserved even when nothing is selected, so selecting
          a quarter doesn't shift everything underneath it. */}
      <div className="lq-earnings-dot-chart__readout" aria-live="polite">
        {active ? (
          <>
            <span className="lq-earnings-dot-chart__readout-date">{active.date}</span>
            <span>
              Estimé <strong>{active.estimateEps !== undefined ? active.estimateEps.toFixed(2) : "—"}</strong>
            </span>
            <span>
              Réalisé <strong>{active.actualEps !== undefined ? active.actualEps.toFixed(2) : "—"}</strong>
            </span>
            {surprise !== undefined && (
              <span className={surprise >= 0 ? "lq-earnings-dot-chart__surprise--up" : "lq-earnings-dot-chart__surprise--down"}>
                {surprise >= 0 ? "+" : "−"}
                {Math.abs(surprise).toFixed(2)}
              </span>
            )}
          </>
        ) : (
          <span className="lq-earnings-dot-chart__readout-hint">Touchez un trimestre pour voir le détail</span>
        )}
      </div>
    </div>
  );
}
