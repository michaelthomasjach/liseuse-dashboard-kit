import { useMemo } from "react";
import * as d3 from "d3";
import { useChartDimensions } from "../../../internal/useChartDimensions";
import type { ScriptXYChartOutput } from "../interfaces/ScriptRunResult.interface";
import "./ScriptXYChart.css";

export interface ScriptXYChartProps {
  chart: ScriptXYChartOutput;
  /** Fixed width in px — omit (the notebook cell-output's own usage) to fill the wrapper's own
   *  available width instead, measured live via `useChartDimensions` (same ResizeObserver-based
   *  approach the real `CandlestickChart` already uses for its own responsive sizing). */
  width?: number;
  height?: number;
}

/** `plot.xy(...)`'s own rendering — a free-standing X/Y chart (a function's own curve, or a
 *  scatter of independent measurements), never tied to bar index/date the way every other
 *  `plot.*` output is. Only ever shown inline as a notebook cell's own output (see
 *  `ScriptEditorCodeMirror.tsx`'s own cell-output widget) — this deliberately never touches the
 *  real candlestick chart's own panes/indicators. Same small hand-rolled `<svg>` + `d3.scaleLinear`
 *  shape as `EarningsDotChart.tsx` (`charts/EarningsDotChart.tsx`) rather than a charting library,
 *  just with both axes free instead of one fixed to a quarter index. */
export function ScriptXYChart({ chart, width: widthProp, height = 180 }: ScriptXYChartProps) {
  const [dimsRef, dims] = useChartDimensions({ top: 0, right: 0, bottom: 0, left: 0 }, { width: widthProp, height });
  const width = dims.width || widthProp || 260;
  const margin = { top: chart.title ? 20 : 6, right: 10, bottom: chart.xLabel ? 30 : 18, left: chart.yLabel ? 38 : 30 };

  const { x, y, xTicks, yTicks, path } = useMemo(() => {
    const [xLo, xHi] = chart.x.length > 0 ? (d3.extent(chart.x) as [number, number]) : [0, 1];
    const [yLo, yHi] = chart.y.length > 0 ? (d3.extent(chart.y) as [number, number]) : [0, 1];
    const xScale = d3
      .scaleLinear()
      .domain([xLo, xHi === xLo ? xLo + 1 : xHi])
      .nice(4)
      .range([margin.left, width - margin.right]);
    const yScale = d3
      .scaleLinear()
      .domain([yLo, yHi === yLo ? yLo + 1 : yHi])
      .nice(4)
      .range([height - margin.bottom, margin.top]);
    const lineGen = d3
      .line<number>()
      .x((_, i) => xScale(chart.x[i]))
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);
    return { x: xScale, y: yScale, xTicks: xScale.ticks(4), yTicks: yScale.ticks(4), path: lineGen(chart.y) ?? "" };
  }, [chart, width, height, margin.bottom, margin.left, margin.right, margin.top]);

  if (chart.x.length === 0) return null;

  const color = chart.color ?? "var(--lq-color-accent)";
  const draw = chart.draw ?? "line";

  return (
    <div className="lq-script-xy-chart" ref={dimsRef}>
      {chart.title && <span className="lq-script-xy-chart__title">{chart.title}</span>}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="lq-script-xy-chart__gridline" />
            <text x={margin.left - 4} y={y(tick)} className="lq-script-xy-chart__tick-label" textAnchor="end" dominantBaseline="middle">
              {tick}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={`x-${tick}`} x={x(tick)} y={height - margin.bottom + 12} className="lq-script-xy-chart__tick-label" textAnchor="middle">
            {tick}
          </text>
        ))}
        {draw === "line" && <path d={path} fill="none" stroke={color} strokeWidth={1.5} />}
        {draw === "scatter" &&
          chart.x.map((xValue, i) => <circle key={i} cx={x(xValue)} cy={y(chart.y[i])} r={3} fill={color} className="lq-script-xy-chart__point" />)}
        {chart.yLabel && (
          <text
            x={10}
            y={(margin.top + (height - margin.bottom)) / 2}
            className="lq-script-xy-chart__axis-label"
            textAnchor="middle"
            transform={`rotate(-90, 10, ${(margin.top + (height - margin.bottom)) / 2})`}
          >
            {chart.yLabel}
          </text>
        )}
        {chart.xLabel && (
          <text x={(margin.left + (width - margin.right)) / 2} y={height - 2} className="lq-script-xy-chart__axis-label" textAnchor="middle">
            {chart.xLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
