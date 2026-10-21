import { useId, useMemo, useState } from "react";
import * as d3 from "d3";
import { useAxisLabelWidth } from "./internal/useAxisLabelWidth";
import { useChartDimensions, type ChartMargin } from "./internal/useChartDimensions";
import { useD3Zoom } from "./internal/useD3Zoom";
import { useAxisDragRescale } from "./internal/useAxisDragRescale";
import { useAxisWheelZoom } from "./internal/useAxisWheelZoom";
import { useFullscreen } from "./internal/useFullscreen";
import { CHART_PALETTE } from "./internal/palette";
import { ChartAxis } from "./ChartAxis";
import { ChartTooltip } from "./ChartTooltip";
import { MaximizeIcon, MinimizeIcon, ZoomOutIcon } from "../icons";
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
  /** Uncertainty range of the single-series value, `[low, high]` — drawn as a vertical error bar
   *  (whisker with caps) over the bar. */
  error?: [number, number];
  /** Same, per series (multi-series mode), keyed by `BarSeriesDef.id`. */
  errors?: Record<string, [number, number]>;
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
  /** Drops the chart's own outer border, for a chart that sits inside a container already
   *  drawing one (a card, a panel, a dashboard cell). Same flag and same effect as
   *  `LineAreaChart.embedded`. Default false. */
  embedded?: boolean;
  margin?: Partial<ChartMargin>;
  className?: string;
  /** Highlight positive/negative bars using the theme's up/down colors instead of a single accent.
   *  Single-series mode only — multi-series bars are always colored by their own series instead. */
  colorByValue?: boolean;
  /** Writes each bar's value just past its end (above an error bar when there is one), formatted
   *  with `formatValue`. Default false. */
  showValueLabels?: boolean;
  /** Shows the value axis (labels and axis line). `false` keeps only the grid; values stay readable in the hover
   *  tooltip — pair it with a smaller `margin` on that side. Default true. */
  showValueAxis?: boolean;
  /** Hides the vertical (Y) axis *line* while keeping its value labels and grid; the X axis line then runs on to
   *  the SVG's own left edge (under the labels), as on a borderless card. Default false. */
  hideYAxisLine?: boolean;
  /** Shows the vertical (Y) axis *line*. `false` hides only that line — values and grid stay, the X axis line is left
   *  as is (see `extendXAxisLine` to run it on). Default true. */
  showYAxisLine?: boolean;
  /** Runs the X axis line on past the Y axis, under its value labels, to the SVG's own left edge — with or without the
   *  Y axis line. Default false. */
  extendXAxisLine?: boolean;
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
  embedded = false,
  className,
  colorByValue = false,
  showValueLabels = false,
  showValueAxis = true,
  hideYAxisLine = false,
  showYAxisLine = true,
  extendXAxisLine = false,
}: BarChartProps) {
  // `hideYAxisLine` is the shorthand for both: Y axis line hidden and X axis line run on to the left edge.
  const yAxisLineHidden = hideYAxisLine || !showYAxisLine;
  const xAxisLineExtended = hideYAxisLine || extendXAxisLine;
  const clipId = useId();
  const defaultMargin =
    orientation === "horizontal"
      ? { top: 8, right: 24, bottom: 24, left: 96 }
      : { top: 8, right: 8, bottom: 32, left: 48 };
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  // Left margin fitted to the Y axis labels once drawn (no fixed reserve beside them); an explicit `margin.left` wins.
  const [yAxisRef, yLabelWidth] = useAxisLabelWidth();
  const [ref, dims] = useChartDimensions(
    { ...defaultMargin, ...margin, left: margin?.left ?? yLabelWidth ?? defaultMargin.left },
    { height: isFullscreen ? undefined : height },
  );
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
  function barsFor(d: BarDatum): { key: string; seriesId?: string; value: number; color: string; error?: [number, number] }[] {
    if (series) {
      if (!d.values) return [];
      const values = d.values;
      const errs = d.errors;
      // `series.indexOf(s)` (this series' own stable position in the *full*, unfiltered list),
      // not its position within `visibleSeries` — hiding an earlier series shifts every later
      // one's own index within the filtered array, which would otherwise silently reassign it a
      // different color than the one still shown for it in the legend (which colors off the same
      // stable full-array index — see its own render below).
      return visibleSeries
        .map((s) =>
          values[s.id] !== undefined
            ? { key: `${d.id}:${s.id}`, seriesId: s.id, value: values[s.id] as number, color: seriesColor(s, series.indexOf(s)), ...(errs?.[s.id] ? { error: errs[s.id] } : {}) }
            : null,
        )
        .filter((b): b is { key: string; seriesId: string; value: number; color: string; error?: [number, number] } => b !== null);
    }
    return d.value !== undefined ? [{ key: d.id, value: d.value, color: colorFor(d), ...(d.error ? { error: d.error } : {}) }] : [];
  }

  const indexScale = useMemo(() => d3.scaleLinear().domain([0, Math.max(1, data.length)]).range([0, catSize]), [data.length, catSize]);
  const zoomedIndexScale = catAxis === "x" ? catTransform.rescaleX(indexScale) : catTransform.rescaleY(indexScale);

  const valueScale = useMemo(() => {
    const values = series
      ? data.flatMap((d) => visibleSeries.map((s) => d.values?.[s.id]).filter((v): v is number => v !== undefined))
      : data.map((d) => d.value ?? 0);
    // Error bars widen the axis so their whiskers are never cut off.
    for (const d of data) {
      if (d.error) values.push(...d.error);
      if (series && d.errors) for (const s of visibleSeries) if (d.errors[s.id]) values.push(...(d.errors[s.id] as [number, number]));
    }
    const [min, max] = d3.extent(values) as [number, number];
    const domain = [Math.min(0, min ?? 0), Math.max(0, max ?? 0)];
    // Room for the value labels (and an error bar's cap) past the tallest bar: ~22 px of the axis.
    if (showValueLabels && valSize > 0) {
      const span = domain[1] - domain[0] || 1;
      const pad = (span * 22) / Math.max(40, valSize - 22);
      if (domain[1] > 0) domain[1] += pad;
      if (domain[0] < 0) domain[0] -= pad;
    }
    return d3
      .scaleLinear()
      .domain(domain)
      .nice()
      .range(orientation === "vertical" ? [valSize, 0] : [0, valSize]);
  }, [data, series, visibleSeries, orientation, valSize, showValueLabels]);
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

  const wrapperClass = ["lq-chart", isFullscreen && "lq-chart--fullscreen", embedded && "lq-chart--embedded", className].filter(Boolean).join(" ");

  const toolbar = (
    <div className="lq-chart__toolbar">
      {zoomable && isZoomed && (
        <button type="button" className="lq-chart__icon-button" onClick={resetZoom} aria-label="Réinitialiser le zoom" title="Réinitialiser le zoom">
          <ZoomOutIcon size={14} />
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
      const s = visibleSeries.find((s) => s.id === hover.seriesId);
      const value = s ? d.values?.[s.id] : undefined;
      if (!s || value === undefined) return null;
      // Same stable-full-array-index reasoning as barsFor's own doc above — the hovered series'
      // own position within the currently-visible subset isn't its color identity.
      return { categoryIndex, categoryLabel: d.label, seriesLabel: s.label, value, color: seriesColor(s, series.indexOf(s)) };
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
              <g ref={yAxisRef}>
                <ChartAxis
                  className={[showValueAxis ? null : "lq-chart__axis--hidden", yAxisLineHidden ? "lq-chart__axis--no-line" : null].filter(Boolean).join(" ") || undefined}
                  scale={zoomedValueScale}
                  orientation="left"
                  grid={showGrid}
                  gridLength={dims.boundedWidth}
                  tickFormat={formatValue ? (v) => formatValue(Number(v)) : undefined}
                />
              </g>
              {/* Y axis line hidden: d3's own X axis line runs on under the labels to the SVG's left edge
                  (same path, stroke and half-pixel offset as the rest of the line). */}
              <ChartAxis
                scale={zoomedIndexScale}
                orientation="bottom"
                transform={`translate(0, ${dims.boundedHeight})`}
                domainExtent={xAxisLineExtended ? [-dims.margin.left, dims.boundedWidth] : undefined}
                tickValues={catTickValues}
                tickFormat={catTickFormat}
              />
            </>
          ) : (
            <>
              <ChartAxis className={showValueAxis ? undefined : "lq-chart__axis--hidden"} scale={zoomedValueScale} orientation="bottom" transform={`translate(0, ${dims.boundedHeight})`} domainExtent={xAxisLineExtended ? [-dims.margin.left, dims.boundedWidth] : undefined} grid={showGrid} gridLength={dims.boundedHeight} tickFormat={formatValue ? (v) => formatValue(Number(v)) : undefined} />
              <g ref={yAxisRef}>
                <ChartAxis
                  className={yAxisLineHidden ? "lq-chart__axis--no-line" : undefined}
                  scale={zoomedIndexScale}
                  orientation="left"
                  tickValues={catTickValues}
                  tickFormat={catTickFormat}
                />
              </g>
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
                  const cx = offset + barThickness / 2;
                  const cap = Math.min(10, barThickness * 0.35);
                  const eLow = bar.error ? zoomedValueScale(Math.min(...bar.error)) : null;
                  const eHigh = bar.error ? zoomedValueScale(Math.max(...bar.error)) : null;
                  const labelY = Math.min(y, eHigh ?? y) - 6;
                  return (
                    <g key={bar.key}>
                      <rect
                        x={offset}
                        y={y}
                        width={barThickness}
                        height={barHeight}
                        fill={bar.color}
                        opacity={isHover ? 0.75 : 1}
                        onPointerEnter={() => setHover({ catId: d.id, seriesId: bar.seriesId })}
                        onPointerLeave={() => setHover(null)}
                      />
                      {eLow !== null && eHigh !== null && (
                        <g className="lq-bar-chart__error" aria-hidden="true">
                          <line x1={cx} x2={cx} y1={eLow} y2={eHigh} />
                          <line x1={cx - cap} x2={cx + cap} y1={eHigh} y2={eHigh} />
                          <line x1={cx - cap} x2={cx + cap} y1={eLow} y2={eLow} />
                        </g>
                      )}
                      {showValueLabels && (
                        <text className="lq-bar-chart__value" x={cx} y={labelY} textAnchor="middle">
                          {formatValue ? formatValue(bar.value) : bar.value}
                        </text>
                      )}
                    </g>
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
          // No Math.max(0, ...) clamp here — unlike the old version of this line, which anchored
          // a negative bar's own tooltip at the zero line instead of its actual (further-left)
          // tip, inconsistent with the vertical case just below, which has never clamped.
          const x = orientation === "vertical" ? dims.margin.left + center : dims.margin.left + zoomedValueScale(hoveredInfo.value);
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
