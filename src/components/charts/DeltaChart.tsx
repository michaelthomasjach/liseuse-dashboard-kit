import { useId, useMemo, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions, type ChartMargin } from "./internal/useChartDimensions";
import { useD3Zoom } from "./internal/useD3Zoom";
import { useAxisDragRescale } from "./internal/useAxisDragRescale";
import { useAxisWheelZoom } from "./internal/useAxisWheelZoom";
import { useFullscreen } from "./internal/useFullscreen";
import { ChartAxis } from "./ChartAxis";
import { ChartTooltip } from "./ChartTooltip";
import { MaximizeIcon, MinimizeIcon } from "../icons";
import "./charts-shared.css";
import "./DeltaChart.css";

export interface DeltaChartItem {
  id: string;
  label: string;
  /** Signed amount: positive adds to the running total, negative subtracts from it. */
  value: number;
  /** Renders as a full bar from 0 (a running subtotal/result) instead of floating on top of the
   *  previous bar, and resets the running total to this value — e.g. a final "Enterprise value" bar. */
  isTotal?: boolean;
  color?: string;
}

export interface DeltaChartProps {
  items: DeltaChartItem[];
  height?: number;
  formatValue?: (value: number) => string;
  /** Dashed bridging lines between consecutive bars. Default true. */
  showConnectors?: boolean;
  showLegend?: boolean;
  /** Pan/zoom the categorical axis — same drag/wheel/axis-rescale conventions as
   *  `CandlestickChart` and `LineAreaChart`, useful once there are many steps. Default true. */
  zoomable?: boolean;
  /** Shows a fullscreen toggle button in the toolbar. Default true. */
  fullscreenToggle?: boolean;
  /** Drops the chart's own outer border, for a chart that sits inside a container already
   *  drawing one (a card, a panel, a dashboard cell). Same flag and same effect as
   *  `LineAreaChart.embedded`. Default false. */
  embedded?: boolean;
  margin?: Partial<ChartMargin>;
  className?: string;
}

interface ComputedBar {
  item: DeltaChartItem;
  top: number;
  bottom: number;
  cumulativeAfter: number;
}

function computeBars(items: DeltaChartItem[]): ComputedBar[] {
  let cumulative = 0;
  return items.map((item) => {
    if (item.isTotal) {
      cumulative = item.value;
      return { item, top: Math.max(0, item.value), bottom: Math.min(0, item.value), cumulativeAfter: item.value };
    }
    const base = cumulative;
    const next = cumulative + item.value;
    cumulative = next;
    return { item, top: Math.max(base, next), bottom: Math.min(base, next), cumulativeAfter: next };
  });
}

const DEFAULT_MARGIN: Partial<ChartMargin> = { top: 16, right: 16, bottom: 32, left: 64 };
const MAX_CATEGORY_TICKS = 24;

/** Waterfall / bridge chart: shows how a sequence of signed additions and subtractions build up to
 *  one or more totals — e.g. capital structure (market cap + debt + minority interest − cash = enterprise value).
 *  Built on the same index-scale zoom/pan/axis-rescale primitives as `CandlestickChart`. */
export function DeltaChart({
  items,
  height = 340,
  formatValue,
  showConnectors = true,
  showLegend = true,
  zoomable = true,
  fullscreenToggle = true,
  margin,
  embedded = false,
  className,
}: DeltaChartProps) {
  const clipId = useId();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [ref, dims] = useChartDimensions(margin ?? DEFAULT_MARGIN, { height: isFullscreen ? undefined : height });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [catTransform, setCatTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [valTransform, setValTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const bars = useMemo(() => computeBars(items), [items]);

  const indexScale = useMemo(
    () => d3.scaleLinear().domain([0, Math.max(1, items.length)]).range([0, dims.boundedWidth]),
    [items.length, dims.boundedWidth]
  );
  const zoomedIndexScale = catTransform.rescaleX(indexScale);

  const valueScale = useMemo(() => {
    const values = bars.flatMap((b) => [b.top, b.bottom, 0]);
    const [min, max] = d3.extent(values) as [number, number];
    const pad = (max - min) * 0.12 || 1;
    return d3
      .scaleLinear()
      .domain([Math.min(0, min - pad), max + pad])
      .nice()
      .range([dims.boundedHeight, 0]);
  }, [bars, dims.boundedHeight]);
  const zoomedValueScale = valTransform.rescaleY(valueScale);

  const { ref: zoomRef, reset: resetCat, setTransform: setCatTransformViaZoom } = useD3Zoom<SVGRectElement>({
    width: dims.boundedWidth,
    height: dims.boundedHeight,
    enabled: zoomable,
    onZoom: setCatTransform,
  });

  const catAxisDrag = useAxisDragRescale({
    axis: "x",
    size: dims.boundedWidth,
    transform: catTransform,
    onChange: setCatTransformViaZoom,
    scaleExtent: [1, 20],
  });
  const valAxisDrag = useAxisDragRescale({
    axis: "y",
    size: dims.boundedHeight,
    transform: valTransform,
    onChange: setValTransform,
  });

  const catAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "x",
    transform: catTransform,
    onChange: setCatTransformViaZoom,
    enabled: zoomable,
    scaleExtent: [1, 20],
    size: dims.boundedWidth,
  });
  const valAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "y",
    transform: valTransform,
    onChange: setValTransform,
    enabled: zoomable,
    size: dims.boundedHeight,
  });

  const isZoomed = catTransform.k !== 1 || catTransform.x !== 0 || valTransform.k !== 1 || valTransform.y !== 0;

  function resetZoom() {
    resetCat();
    setValTransform(d3.zoomIdentity);
  }
  function resetValAxis() {
    setValTransform(d3.zoomIdentity);
  }

  const labelFor = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const colorFor = (bar: ComputedBar) => {
    if (bar.item.color) return bar.item.color;
    if (bar.item.isTotal) return "var(--lq-color-accent)";
    return bar.item.value >= 0 ? "var(--lq-color-up)" : "var(--lq-color-down)";
  };

  const fmt = formatValue ?? ((v: number) => v.toLocaleString("fr-FR"));

  const baseSlot = dims.boundedWidth / Math.max(1, items.length);
  const barThickness = Math.max(4, Math.min(96, baseSlot * catTransform.k * 0.65));

  const visible = useMemo(() => {
    if (bars.length === 0) return [];
    const [i0, i1] = zoomedIndexScale.domain();
    const start = Math.max(0, Math.floor(i0) - 1);
    const end = Math.min(bars.length, Math.ceil(i1) + 1);
    return bars.slice(start, end).map((b, k) => ({ bar: b, i: start + k }));
  }, [bars, zoomedIndexScale]);

  const tickStep = Math.max(1, Math.ceil(visible.length / MAX_CATEGORY_TICKS));
  const catTickValues = visible.filter((_, k) => k % tickStep === 0).map((v) => v.i + 0.5);
  const catTickFormat = (v: number) => labelFor(items[Math.round(v - 0.5)]?.id ?? "");

  const wrapperClass = ["lq-chart", isFullscreen && "lq-chart--fullscreen", embedded && "lq-chart--embedded", className].filter(Boolean).join(" ");

  if (dims.width === 0) return <div ref={ref} className={wrapperClass} style={{ height }} />;
  if (items.length === 0) {
    return (
      <div ref={ref} className={wrapperClass} style={{ height }}>
        <div className="lq-chart__empty">Aucune donnée</div>
      </div>
    );
  }

  const zero = zoomedValueScale(0);
  const hovered = bars.find((b) => b.item.id === hoverId);

  return (
    <div ref={ref} className={wrapperClass}>
      <div className="lq-chart__toolbar">
        {zoomable && isZoomed && (
          <button type="button" className="lq-chart__reset-button" onClick={resetZoom}>
            Réinitialiser le zoom
          </button>
        )}
        {fullscreenToggle && (
          <button
            type="button"
            className="lq-chart__icon-button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>
        )}
      </div>
      <svg className="lq-chart__svg" width={dims.width} height={dims.height} role="img">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={dims.boundedWidth} height={dims.boundedHeight} />
          </clipPath>
        </defs>
        <g transform={`translate(${dims.margin.left}, ${dims.margin.top})`}>
          <ChartAxis scale={zoomedValueScale} orientation="left" grid gridLength={dims.boundedWidth} tickFormat={(v) => fmt(Number(v))} />
          <ChartAxis
            scale={zoomedIndexScale}
            orientation="bottom"
            transform={`translate(0, ${dims.boundedHeight})`}
            tickValues={catTickValues}
            tickFormat={catTickFormat}
          />

          <rect ref={zoomRef} className="lq-chart__overlay" width={dims.boundedWidth} height={dims.boundedHeight} />

          <g clipPath={`url(#${clipId})`}>
            <line className="lq-delta-chart__zero-line" x1={0} x2={dims.boundedWidth} y1={zero} y2={zero} />

            {showConnectors &&
              visible.map(({ bar, i }, idx) => {
                const next = visible[idx + 1];
                if (!next || next.bar.item.isTotal) return null;
                const x1 = zoomedIndexScale(i + 1);
                const x2 = zoomedIndexScale(next.i);
                const y = zoomedValueScale(bar.cumulativeAfter);
                return <line key={bar.item.id} className="lq-delta-chart__connector" x1={x1} x2={x2} y1={y} y2={y} />;
              })}

            {visible.map(({ bar, i }) => {
              const center = zoomedIndexScale(i + 0.5);
              const x = center - barThickness / 2;
              const y = zoomedValueScale(bar.top);
              const barHeight = Math.max(1, zoomedValueScale(bar.bottom) - zoomedValueScale(bar.top));
              return (
                <rect
                  key={bar.item.id}
                  className="lq-delta-chart__bar"
                  x={x}
                  y={y}
                  width={barThickness}
                  height={barHeight}
                  fill={colorFor(bar)}
                  opacity={hoverId === bar.item.id ? 0.8 : 1}
                  style={{ animationDelay: `${Math.min(i, 20) * 45}ms` }}
                  onPointerEnter={() => setHoverId(bar.item.id)}
                  onPointerLeave={() => setHoverId(null)}
                />
              );
            })}
          </g>

          <rect
            ref={valAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--y"
            x={-dims.margin.left}
            y={0}
            width={dims.margin.left}
            height={dims.boundedHeight}
            onPointerDown={valAxisDrag.onPointerDown}
            onPointerMove={valAxisDrag.onPointerMove}
            onPointerUp={valAxisDrag.onPointerUp}
            onDoubleClick={resetValAxis}
          />
          <rect
            ref={catAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--x"
            x={0}
            y={dims.boundedHeight}
            width={dims.boundedWidth}
            height={dims.margin.bottom}
            onPointerDown={catAxisDrag.onPointerDown}
            onPointerMove={catAxisDrag.onPointerMove}
            onPointerUp={catAxisDrag.onPointerUp}
            onDoubleClick={resetCat}
          />
        </g>
      </svg>

      {hovered &&
        (() => {
          const i = items.findIndex((it) => it.id === hovered.item.id);
          const x = dims.margin.left + zoomedIndexScale(i + 0.5);
          const y = dims.margin.top + zoomedValueScale(hovered.top);
          return (
            <ChartTooltip x={x} y={y} visible align={x > dims.width * 0.65 ? "left" : "right"}>
              <div className="lq-chart-tooltip__title">{hovered.item.label}</div>
              <div className="lq-chart-tooltip__row">
                <strong>
                  {!hovered.item.isTotal && hovered.item.value >= 0 ? "+" : ""}
                  {fmt(hovered.item.value)}
                </strong>
              </div>
            </ChartTooltip>
          );
        })()}

      {showLegend && (
        <div className="lq-chart__legend">
          <span className="lq-chart__legend-item">
            <span className="lq-chart__legend-swatch" style={{ backgroundColor: "var(--lq-color-up)" }} />
            Ajout
          </span>
          <span className="lq-chart__legend-item">
            <span className="lq-chart__legend-swatch" style={{ backgroundColor: "var(--lq-color-down)" }} />
            Retrait
          </span>
          <span className="lq-chart__legend-item">
            <span className="lq-chart__legend-swatch" style={{ backgroundColor: "var(--lq-color-accent)" }} />
            Total
          </span>
        </div>
      )}
    </div>
  );
}
