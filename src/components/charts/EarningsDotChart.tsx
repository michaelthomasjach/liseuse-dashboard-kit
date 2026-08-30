import { useMemo } from "react";
import * as d3 from "d3";
import type { SymbolProfileEarningsPoint } from "./workspace/SymbolProfile.interface";
import "./EarningsDotChart.css";

export interface EarningsDotChartProps {
  points: SymbolProfileEarningsPoint[];
  width?: number;
  height?: number;
}

/** Small quarterly-EPS dot chart for `SymbolProfilePanel`'s own "Résultats" section — estimate
 *  (hollow) vs. actual (filled) per quarter, plus a light value axis on the right and each
 *  quarter's own date underneath. Not built on `Sparkline` (a continuous line/area through every
 *  point) since this is a fundamentally different shape: two independent, unconnected point
 *  series read by their fill (hollow/solid), not a trend to follow with the eye. */
export function EarningsDotChart({ points, width = 260, height = 120 }: EarningsDotChartProps) {
  const margin = { top: 8, right: 34, bottom: 16, left: 4 };

  const { x, y, ticks } = useMemo(() => {
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
    return { x: xScale, y: yScale, ticks: yScale.ticks(4) };
  }, [points, width, height, margin.bottom, margin.left, margin.right, margin.top]);

  if (points.length === 0) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="lq-earnings-dot-chart" role="img">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="lq-earnings-dot-chart__gridline" />
          <text x={width - margin.right + 6} y={y(tick)} className="lq-earnings-dot-chart__tick-label" dominantBaseline="middle">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          {p.estimateEps !== undefined && (
            <circle cx={x(i)} cy={y(p.estimateEps)} r={4} className="lq-earnings-dot-chart__point lq-earnings-dot-chart__point--estimate" />
          )}
          {p.actualEps !== undefined && (
            <circle cx={x(i)} cy={y(p.actualEps)} r={4} className="lq-earnings-dot-chart__point lq-earnings-dot-chart__point--actual" />
          )}
          <text x={x(i)} y={height - 2} className="lq-earnings-dot-chart__date-label" textAnchor="middle">
            {p.date}
          </text>
        </g>
      ))}
    </svg>
  );
}
