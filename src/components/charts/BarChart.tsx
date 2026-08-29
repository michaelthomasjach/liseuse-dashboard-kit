import { useId, useMemo, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions, type ChartMargin } from "./internal/useChartDimensions";
import { useD3Zoom } from "./internal/useD3Zoom";
import { useAxisDragRescale } from "./internal/useAxisDragRescale";
import { useAxisWheelZoom } from "./internal/useAxisWheelZoom";
import { useFullscreen } from "./internal/useFullscreen";
import { CHART_PALETTE } from "./internal/palette";
import { ChartAxis } from "./ChartAxis";
import { ChartTooltip } from "./ChartTooltip";
import { MaximizeIcon, MinimizeIcon } from "../icons";
import "./charts-shared.css";
import "./BarChart.css";

export interface BarSeriesDef {
  id: string;
  label: string;
  /** CSS color. Defaults to a color cycled from the shared categorical palette, same convention
   *  `LineAreaChart`'s own multi-series `color` fallback already uses. */
  color?: string;
}

export interface BarDatum {
  id: string;
  label: string;
  /** Single-series value — read when `BarChartProps.series` is omitted. Ignored (in favor of
   *  `values` below) once it's set. */
  value?: number;
  /** Multi-series values, keyed by `BarSeriesDef.id` — set together with the chart-level `series`
   *  prop to draw several bars side by side per category instead of one. A category missing an
   *  entry for some series simply draws no bar for it in that group, rather than a zero-height one
   *  (a real "no data for this series here" case, not the same as a reported zero). */
  values?: Record<string, number>;
  /** Single-series color override — ignored in multi-series mode, where color is a per-*series*
   *  concept instead (see `BarSeriesDef.color`). */
  color?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Enables grouped/multi-series mode — several bars side by side per category (each reading
   *  `BarDatum.values[series.id]`) instead of one bar per category (`BarDatum.value`). Omit for
   *  the original single-bar-per-category behavior. */
  series?: BarSeriesDef[];
  /** Shows a legend below the chart, click to show/hide a series — same convention
   *  `LineAreaChart`'s own `showLegend` follows. Only ever rendered when `series` has more than
   *  one entry. Default true. */
  showLegend?: boolean;
  height?: number;
  orientation?: "vertical" | "horizontal";
  formatValue?: (value: number) => string;
  showGrid?: boolean;
  /** Pan/zoom the categorical axis — same drag/wheel/axis-rescale conventions as
   *  `CandlestickChart` and `LineAreaChart`, useful once there are many bars. Default true. */
  zoomable?: boolean;
  /** Shows a fullscreen toggle button in the toolbar. Default true. */
  fullscreenToggle?: boolean;
  margin?: Partial<ChartMargin>;
  className?: string;
  /** Highlight positive/negative bars using the theme's up/down colors instead of a single accent.
   *  Single-series mode only — multi-series bars are always colored by their own series instead. */
  colorByValue?: boolean;
}

const MAX_CATEGORY_TICKS = 24;

/** Categorical bar chart built on the same zoom/pan/axis-rescale primitives as
 *  `CandlestickChart`: the categorical axis is treated as a continuous index
 *  scale so wheel/drag/pinch can zoom into a subset of bars, independently of
 *  the value axis (which rescales the same way the price axis does). */
export function BarChart({
  data,
  series,
  showLegend = true,
  height = 320,
  orientation = "vertical",
  formatValue,
  showGrid = true,
  zoomable = true,
  fullscreenToggle = true,
  margin,
  className,
  colorByValue = false,
}: BarChartProps) {
  const clipId = useId();
  const defaultMargin =
    orientation === "horizontal"
      ? { top: 8, right: 24, bottom: 24, left: 96 }
      : { top: 8, right: 8, bottom: 32, left: 48 };
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [ref, dims] = useChartDimensions(margin ?? defaultMargin, { height: isFullscreen ? undefined : height });
  // `seriesId` set in multi-series mode (one category id alone isn't enough to identify which of
  // its own several bars is hovered) — a structured pair rather than a joined string key, so
  // neither id needs escaping/parsing back apart regardless of what characters a caller's own ids
  // happen to contain.
  const [hover, setHover] = useState<{ catId: string; seriesId?: string } | null>(null);
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<Set<string>>(new Set());

  const catAxis: "x" | "y" = orientation === "vertical" ? "x" : "y";
  const valAxis: "x" | "y" = orientation === "vertical" ? "y" : "x";
  const catSize = orientation === "vertical" ? dims.boundedWidth : dims.boundedHeight;
  const valSize = orientation === "vertical" ? dims.boundedHeight : dims.boundedWidth;

  const [catTransform, setCatTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [valTransform, setValTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const visibleSeries = useMemo(() => (series ?? []).filter((s) => !hiddenSeriesIds.has(s.id)), [series, hiddenSeriesIds]);
  const seriesColor = (s: BarSeriesDef, i: number) => s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];

  const colorFor = (d: BarDatum) => {
    if (d.color) return d.color;
    if (colorByValue) return (d.value ?? 0) >= 0 ? "var(--lq-color-up)" : "var(--lq-color-down)";
    return "var(--lq-color-accent)";
  };

  // One bar per category (`d.value`) in single-series mode, or one per *visible* series that
  // actually has an entry in `d.values` (see BarDatum.values' own doc on why a missing entry
  // draws nothing rather than a zero-height bar) in multi-series mode — the one place both render
  // branches below read from, so vertical/horizontal orientation don't each need their own copy
  // of this branching.
  function barsFor(d: BarDatum): { key: string; seriesId?: string; value: number; color: string }[] {
    if (series) {
      if (!d.values) return [];
      const values = d.values;
      return visibleSeries
        .map((s, si) => (values[s.id] !== undefined ? { key: `${d.id}:${s.id}`, seriesId: s.id, value: values[s.id], color: seriesColor(s, si) } : null))
        .filter((b): b is { key: string; seriesId: string; value: number; color: string } => b !== null);
    }
    return d.value !== undefined ? [{ key: d.id, value: d.value, color: colorFor(d) }] : [];
  }

  const indexScale = useMemo(() => d3.scaleLinear().domain([0, Math.max(1, data.length)]).range([0, catSize]), [data.length, catSize]);
  const zoomedIndexScale = catAxis === "x" ? catTransform.rescaleX(indexScale) : catTransform.rescaleY(indexScale);

  const valueScale = useMemo(() => {
    const values = series
      ? data.flatMap((d) => visibleSeries.map((s) => d.values?.[s.id]).filter((v): v is number => v !== undefined))
      : data.map((d) => d.value ?? 0);
    const [min, max] = d3.extent(values) as [number, number];
    const domain = [Math.min(0, min ?? 0), Math.max(0, max ?? 0)];
    return d3
      .scaleLinear()
      .domain(domain)
      .nice()
      .range(orientation === "vertical" ? [valSize, 0] : [0, valSize]);
  }, [data, series, visibleSeries, orientation, valSize]);
  const zoomedValueScale = valAxis === "y" ? valTransform.rescaleY(valueScale) : valTransform.rescaleX(valueScale);

  const { ref: zoomRef, reset: resetCat, setTransform: setCatTransformViaZoom } = useD3Zoom<SVGRectElement>({
    width: dims.boundedWidth,
    height: dims.boundedHeight,
    enabled: zoomable,
    onZoom: setCatTransform,
  });

  const catAxisDrag = useAxisDragRescale({
    axis: catAxis,
    size: catSize,
    transform: catTransform,
    onChange: setCatTransformViaZoom,
    scaleExtent: [1, 20],
  });
  const valAxisDrag = useAxisDragRescale({
    axis: valAxis,
    size: valSize,
    transform: valTransform,
    onChange: setValTransform,
  });

  const catAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: catAxis,
    transform: catTransform,
    onChange: setCatTransformViaZoom,
    enabled: zoomable,
    scaleExtent: [1, 20],
    size: catSize,
  });
  const valAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: valAxis,
    transform: valTransform,
    onChange: setValTransform,
    enabled: zoomable,
    size: valSize,
  });

  const isZoomed = catTransform.k !== 1 || catTransform.x !== 0 || catTransform.y !== 0 || valTransform.k !== 1 || valTransform.x !== 0 || valTransform.y !== 0;

  function resetZoom() {
    resetCat();
    setValTransform(d3.zoomIdentity);
  }
  function resetValAxis() {
    setValTransform(d3.zoomIdentity);
  }

  // In multi-series mode, each category's own slot has to fit `groupSize` bars side by side
  // (plus a small gap between them) instead of just one — everything below scales the same
  // zoom-responsive sizing single-series mode already had, just divided across the group.
  const groupSize = series ? Math.max(1, visibleSeries.length) : 1;
  const barGap = 2;
  const baseSlot = catSize / Math.max(1, data.length);
  const groupWidthCap = Math.min(64 * groupSize, baseSlot * catTransform.k * 0.7);
  const barThickness = Math.max(1, (groupWidthCap - (groupSize - 1) * barGap) / groupSize);
  const groupWidth = groupSize * barThickness + (groupSize - 1) * barGap;

  const visible = useMemo(() => {
    if (data.length === 0) return [];
    const [i0, i1] = zoomedIndexScale.domain();
    const start = Math.max(0, Math.floor(i0) - 1);
    const end = Math.min(data.length, Math.ceil(i1) + 1);
    return data.slice(start, end).map((d, k) => ({ d, i: start + k }));
  }, [data, zoomedIndexScale]);

  const tickStep = Math.max(1, Math.ceil(visible.length / MAX_CATEGORY_TICKS));
  const catTickValues = visible.filter((_, k) => k % tickStep === 0).map((v) => v.i + 0.5);
  const catTickFormat = (v: number) => data[Math.round(v - 0.5)]?.label ?? "";

  const wrapperClass = ["lq-chart", isFullscreen && "lq-chart--fullscreen", className].filter(Boolean).join(" ");

  const toolbar = (
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
  );

  if (dims.width === 0) return <div ref={ref} className={wrapperClass} style={{ height }} />;
  if (data.length === 0) {
    return (
      <div ref={ref} className={wrapperClass} style={{ height }}>
        {toolbar}
        <div className="lq-chart__empty">Aucune donnée</div>
      </div>
    );
  }

  const zeroline = zoomedValueScale(0);
  // Resolves the current hover (category + optionally which series) into one flat shape the
  // tooltip below reads regardless of mode — `seriesLabel` stays undefined in single-series mode,
  // where the category's own label already says everything the tooltip needs to.
  const hoveredInfo = (() => {
    if (!hover) return null;
    const categoryIndex = data.findIndex((d) => d.id === hover.catId);
    if (categoryIndex === -1) return null;
    const d = data[categoryIndex];
    if (series && hover.seriesId !== undefined) {
      const seriesIndex = visibleSeries.findIndex((s) => s.id === hover.seriesId);
      const s = visibleSeries[seriesIndex];
      const value = s ? d.values?.[s.id] : undefined;
      if (!s || value === undefined) return null;
      return { categoryIndex, categoryLabel: d.label, seriesLabel: s.label, value, color: seriesColor(s, seriesIndex) };
    }
    if (d.value === undefined) return null;
    return { categoryIndex, categoryLabel: d.label, seriesLabel: undefined as string | undefined, value: d.value, color: colorFor(d) };
  })();

  return (
    <div ref={ref} className={wrapperClass}>
      {toolbar}
      <svg className="lq-chart__svg" width={dims.width} height={dims.height} role="img">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={dims.boundedWidth} height={dims.boundedHeight} />
          </clipPath>
        </defs>
        <g transform={`translate(${dims.margin.left}, ${dims.margin.top})`}>
          {orientation === "vertical" ? (
            <>
              <ChartAxis scale={zoomedValueScale} orientation="left" grid={showGrid} gridLength={dims.boundedWidth} tickFormat={formatValue ? (v) => formatValue(Number(v)) : undefined} />
              <ChartAxis
                scale={zoomedIndexScale}
                orientation="bottom"
                transform={`translate(0, ${dims.boundedHeight})`}
                tickValues={catTickValues}
                tickFormat={catTickFormat}
              />
            </>
          ) : (
            <>
              <ChartAxis scale={zoomedValueScale} orientation="bottom" transform={`translate(0, ${dims.boundedHeight})`} grid={showGrid} gridLength={dims.boundedHeight} tickFormat={formatValue ? (v) => formatValue(Number(v)) : undefined} />
              <ChartAxis scale={zoomedIndexScale} orientation="left" tickValues={catTickValues} tickFormat={catTickFormat} />
            </>
          )}

          <rect ref={zoomRef} className="lq-chart__overlay" width={dims.boundedWidth} height={dims.boundedHeight} />

          <g clipPath={`url(#${clipId})`}>
            {visible.flatMap(({ d, i }) => {
              const center = zoomedIndexScale(i + 0.5);
              const groupStart = center - groupWidth / 2;
              return barsFor(d).map((bar, j) => {
                const isHover = hover?.catId === d.id && hover?.seriesId === bar.seriesId;
                const offset = groupStart + j * (barThickness + barGap);
                if (orientation === "vertical") {
                  const y = bar.value >= 0 ? zoomedValueScale(bar.value) : zeroline;
                  const barHeight = Math.abs(zoomedValueScale(bar.value) - zeroline);
                  return (
                    <rect
                      key={bar.key}
                      x={offset}
                      y={y}
                      width={barThickness}
                      height={barHeight}
                      fill={bar.color}
                      opacity={isHover ? 0.75 : 1}
                      onPointerEnter={() => setHover({ catId: d.id, seriesId: bar.seriesId })}
                      onPointerLeave={() => setHover(null)}
                    />
                  );
                }
                const x = bar.value >= 0 ? zeroline : zoomedValueScale(bar.value);
                const barWidth = Math.abs(zoomedValueScale(bar.value) - zeroline);
                return (
                  <rect
                    key={bar.key}
                    x={x}
                    y={offset}
                    width={barWidth}
                    height={barThickness}
                    fill={bar.color}
                    opacity={isHover ? 0.75 : 1}
                    onPointerEnter={() => setHover({ catId: d.id, seriesId: bar.seriesId })}
                    onPointerLeave={() => setHover(null)}
                  />
                );
              });
            })}
          </g>

          <rect
            ref={valAxisWheelRef}
            className={`lq-chart__axis-drag lq-chart__axis-drag--${valAxis}`}
            x={valAxis === "y" ? -dims.margin.left : 0}
            y={valAxis === "y" ? 0 : dims.boundedHeight}
            width={valAxis === "y" ? dims.margin.left : dims.boundedWidth}
            height={valAxis === "y" ? dims.boundedHeight : dims.margin.bottom}
            onPointerDown={valAxisDrag.onPointerDown}
            onPointerMove={valAxisDrag.onPointerMove}
            onPointerUp={valAxisDrag.onPointerUp}
            onDoubleClick={resetValAxis}
          />
          <rect
            ref={catAxisWheelRef}
            className={`lq-chart__axis-drag lq-chart__axis-drag--${catAxis}`}
            x={catAxis === "y" ? -dims.margin.left : 0}
            y={catAxis === "y" ? 0 : dims.boundedHeight}
            width={catAxis === "y" ? dims.margin.left : dims.boundedWidth}
            height={catAxis === "y" ? dims.boundedHeight : dims.margin.bottom}
            onPointerDown={catAxisDrag.onPointerDown}
            onPointerMove={catAxisDrag.onPointerMove}
            onPointerUp={catAxisDrag.onPointerUp}
            onDoubleClick={resetCat}
          />
        </g>
      </svg>

      {hoveredInfo &&
        (() => {
          const center = zoomedIndexScale(hoveredInfo.categoryIndex + 0.5);
          const x = orientation === "vertical" ? dims.margin.left + center : dims.margin.left + zoomedValueScale(Math.max(0, hoveredInfo.value));
          const y = orientation === "vertical" ? dims.margin.top + zoomedValueScale(hoveredInfo.value) : dims.margin.top + center;
          return (
            <ChartTooltip x={x} y={y} visible align={x > dims.width * 0.65 ? "left" : "right"}>
              <div className="lq-chart-tooltip__title">{hoveredInfo.categoryLabel}</div>
              <div className="lq-chart-tooltip__row">
                <span className="lq-chart-tooltip__swatch" style={{ backgroundColor: hoveredInfo.color }} />
                {hoveredInfo.seriesLabel && <span>{hoveredInfo.seriesLabel}</span>}
                <strong>{formatValue ? formatValue(hoveredInfo.value) : hoveredInfo.value}</strong>
              </div>
            </ChartTooltip>
          );
        })()}

      {showLegend && series && series.length > 1 && (
        <div className="lq-chart__legend">
          {series.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="lq-chart__legend-item"
              style={{ opacity: hiddenSeriesIds.has(s.id) ? 0.4 : 1 }}
              onClick={() =>
                setHiddenSeriesIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
            >
              <span className="lq-chart__legend-swatch" style={{ backgroundColor: seriesColor(s, i) }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
