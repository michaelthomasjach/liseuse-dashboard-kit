import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions, type ChartMargin } from "./internal/useChartDimensions";
import { useD3Zoom } from "./internal/useD3Zoom";
import { useAxisDragRescale } from "./internal/useAxisDragRescale";
import { useAxisWheelZoom } from "./internal/useAxisWheelZoom";
import { useFullscreen } from "./internal/useFullscreen";
import { ChartAxis } from "./ChartAxis";
import { ChartTooltip } from "./ChartTooltip";
import { CHART_PALETTE } from "./internal/palette";
import { splitAtReference, splitBetweenSeries } from "./internal/areaFillSegments";
import { MaximizeIcon, MinimizeIcon } from "../icons";
import "./charts-shared.css";
import "./LineAreaChart.css";

export interface ChartPoint {
  x: Date | number;
  y: number;
}

export interface ChartSeries {
  id: string;
  label?: string;
  /** CSS color. Defaults to a color cycled from the theme's categorical palette. */
  color?: string;
  /** Fill the area under this series. Falls back to the chart-level `area` prop. */
  area?: boolean;
  /** Line thickness in px. Default 2 — bump it to make one series (e.g. the current, in-progress
   *  year in SeasonalityView's "années indépendantes" mode) stand out among several others. */
  strokeWidth?: number;
  /** Draws a persistent dot at this series' own last defined point, not just while hovered — for
   *  a series that legitimately ends partway through the shared X domain (an in-progress year
   *  whose data simply stops at "today", short of every other series' full range) so that stop
   *  point reads as "still going, paused here" rather than an unexplained dangling line end. */
  endDot?: boolean;
  /** Fills the area between this series and the chart-level `referenceLineY` (which must also be
   *  set — a no-op without it), split at every point the line actually crosses it: segments above
   *  use `positiveColor`, segments below use `negativeColor` (see SeasonalityView's own "colorer
   *  l'aire sous la courbe" setting — green/red relative to 0%). Independent of `area`/the
   *  chart-level `area` prop (a flat single-color fill down to the plot's own bottom edge
   *  regardless of sign) — this one fills toward the reference line specifically, in one of two
   *  colors depending on which side of it the curve currently sits on. */
  fillSignedAtReference?: { positiveColor: string; negativeColor: string };
  data: ChartPoint[];
}

export interface LineAreaChartProps {
  series: ChartSeries[];
  /** Fixed height in px. Fills 100% of the container's width regardless. */
  height?: number;
  area?: boolean;
  /** How each series' own line (and its plain `area`/`s.area` fill, if any) connects consecutive
   *  points — "monotone" (default, unchanged from before this existed) smooths through them with
   *  a Catmull-Rom-like spline, still visibly rounding/overshooting real peaks and troughs even
   *  at a high point count; "linear" connects them with plain straight segments instead, so every
   *  visible kink is a real data point and nothing in between is invented by the curve fit — a
   *  traditional "close line" reading (see SeasonalityView's own use, which wants exactly that
   *  now that its curve is dense enough for smoothing to actively hide real day-to-day detail
   *  rather than just prettify sparse points). The conditional area-fill segments
   *  (`fillSignedAtReference`/`fillBetween`) already always use `curveLinear` regardless of this
   *  prop — see their own generators' doc for why. */
  curveType?: "monotone" | "linear";
  xType?: "time" | "linear";
  zoomable?: boolean;
  formatX?: (x: Date | number) => string;
  formatY?: (y: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  /** Shows a fullscreen toggle button in the toolbar. Default true. */
  fullscreenToggle?: boolean;
  /** Which side the Y axis (and its own drag-to-rescale strip) renders on. Default "left"; pass
   *  "right" to match `CandlestickChart`'s own price-axis convention when embedding this as a
   *  sub-chart alongside it (see SeasonalityView). */
  yAxisOrientation?: "left" | "right";
  /** Drops this chart's own border/background chrome — for embedding inside another `.lq-chart`
   *  that already provides it (see SeasonalityView), so the two don't stack into a visible
   *  double border. Default false (a standalone LineAreaChart keeps its own border). */
  embedded?: boolean;
  /** A solid, slightly darker horizontal line at this Y value — same "meaningful threshold, not
   *  just a scale tick" treatment as the main CandlestickChart's own 0% compare-mode line (see
   *  SeasonalityView, which passes 0 to mark flat/breakeven performance). Omit for no line. */
  referenceLineY?: number;
  /** Hides the built-in "Réinitialiser le zoom" button from this chart's own toolbar — for a
   *  caller that renders its own reset button elsewhere (its own header, say) driven by
   *  `onZoomChange`/the imperative `resetZoom()` handle instead. Default true (shown). */
  showZoomReset?: boolean;
  /** Fires whenever the zoomed-in/panned state changes — lets a caller that set `showZoomReset`
   *  to false know when to show its own reset control. */
  onZoomChange?: (isZoomed: boolean) => void;
  /** Swaps the floating `ChartTooltip` box for a pair of axis-pinned value badges instead (same
   *  `.lq-chart__axis-value` treatment `CandlestickChart`'s own crosshair uses) — one under the X
   *  axis showing the hovered point's own X label, one per visible series on the Y axis (right
   *  edge when `yAxisOrientation="right"`, left edge otherwise) showing that series' own value,
   *  colored to match its line. For a chart embedded alongside another one that already reads its
   *  X/Y readout that way (see SeasonalityView) — a second, differently-shaped floating tooltip
   *  box would read as a visual inconsistency next to it. Default false (floating tooltip). */
  axisHoverLabels?: boolean;
  /** Only meaningful alongside `axisHoverLabels` — swaps its one-Y-badge-per-series stack for a
   *  single badge showing the plain average of every visible series' own value at the hovered X
   *  (see SeasonalityView's own "années indépendantes" hover-average toggle: a badge per year
   *  reads fine for a couple of lines but becomes an unreadable stack once several years are all
   *  shown at once, and unlike "current" mode there's no explicit average *series* already on the
   *  chart to read off instead). Default false (the existing per-series stack). */
  hoverAverage?: boolean;
  /** Roughly how many ticks to request on each axis — a hint, not an exact count (d3's own
   *  `.ticks(n)` rounds to whichever "nice" step lands closest to it, same as ChartAxis's own
   *  default already works). Default 5 (ChartAxis's own default) for both when omitted. Ignored
   *  on the X axis when `xTickValues` is set (explicit positions override the automatic count). */
  xTicks?: number;
  yTicks?: number;
  /** Explicit X-axis tick positions, overriding `xTicks`'s automatic count — e.g. one per
   *  week-bucket on a finer-resolution curve while only some of them get a real label via
   *  `xTickFormat` returning "" for the rest (see SeasonalityView's own month-only labeling). */
  xTickValues?: (Date | number)[];
  /** X-axis tick label formatter, distinct from `formatX` (which also drives the hover
   *  crosshair/tooltip's own, typically denser, per-point label) — falls back to `formatX` when
   *  omitted. Split out so a caller can label the axis sparsely (e.g. only 12 of 52 ticks) while
   *  still giving every individual point hovered/measured its own full label. */
  xTickFormat?: (x: Date | number) => string;
  /** Extends the X domain beyond the data's own min/max by this many x-units on each side (same
   *  units as the data — index/bucket units for a "linear" xType, milliseconds for "time"),
   *  rendered as a diagonal-hatched background matching CandlestickChart's own "future zone"
   *  hatching — for a caller that wants dedicated empty margin before/after its real data rather
   *  than the domain hugging it exactly (see SeasonalityView's own space before January/after
   *  December). Omit for no padding. */
  xDomainPadding?: { start: number; end: number };
  /** Fills the region between two named series (by `ChartSeries.id`), colored by which one is
   *  currently higher — `aAboveColor` wherever `seriesIdA`'s own value exceeds `seriesIdB`'s at
   *  that x, `aBelowColor` wherever it's under (see SeasonalityView's own "colorer l'aire entre
   *  les deux courbes" setting). Only fills the x-range both series actually share an *exact*
   *  matching x for — both need to already sit on the same x grid (true for two seasonality
   *  buckets series, not a general cross-grid interpolation). */
  fillBetween?: { seriesIdA: string; seriesIdB: string; aAboveColor: string; aBelowColor: string };
  /** Click-to-place ruler: the first click on the plot area sets a start point, the second sets
   *  an end point and shows the delta between them (each point's own formatted X, plus the Y
   *  delta) — a third click starts a new measurement instead of adding a third point. Neither
   *  point snaps to any series' own data (unlike the regular hover crosshair) — this measures
   *  between any two points on the plot itself, same as a physical ruler would. Suppresses the
   *  regular hover crosshair/tooltip while active so the two don't compete for the same space,
   *  and clears whatever was measured the moment it goes back to false. The caller owns both this
   *  value and its own toggle button (see SeasonalityView's own rail) — same "caller decides, this
   *  chart just renders accordingly" shape as `axisHoverLabels`. Default false. */
  measureActive?: boolean;
  margin?: Partial<ChartMargin>;
  className?: string;
}

export interface LineAreaChartHandle {
  /** Same as clicking the built-in "Réinitialiser le zoom" button — for a caller that hid it via
   *  `showZoomReset={false}` and rendered its own trigger elsewhere. */
  resetZoom: () => void;
}

export const LineAreaChart = forwardRef<LineAreaChartHandle, LineAreaChartProps>(function LineAreaChart({
  series,
  height = 320,
  area = false,
  curveType = "monotone",
  xType = "time",
  zoomable = true,
  formatX,
  formatY,
  showGrid = true,
  showLegend = true,
  fullscreenToggle = true,
  yAxisOrientation = "left",
  embedded = false,
  referenceLineY,
  showZoomReset = true,
  onZoomChange,
  axisHoverLabels = false,
  hoverAverage = false,
  xTicks,
  yTicks,
  xTickValues,
  xTickFormat,
  xDomainPadding,
  fillBetween,
  measureActive = false,
  margin,
  className,
}, handleRef) {
  const clipId = useId();
  const hatchId = useId();
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [yTransform, setYTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // `anchorX` is the actual data-space X value under the cursor — the closest snapped point in
  // `allXValues` (the union of every visible series' own X's, see its own doc), not any one
  // series' data (no single series is guaranteed to cover the full domain — see allXValues' own
  // doc for why that matters). Every series then looks up its own closest point to this shared
  // `anchorX` independently (see closestPointInSeries), and the X-axis label/tooltip title reads
  // `anchorX` directly rather than any one series' own point, so it always names whatever's
  // actually under the cursor even where a particular series has no data of its own.
  const [hover, setHover] = useState<{ index: number; mouseX: number; anchorX: Date | number } | null>(null);
  // Raw pixel cursor position, tracked independently of `hover` above (which snaps to the nearest
  // *data point*) — the ruler measures between any two points on the plot itself, not points
  // necessarily lying on a series' own line, so it needs the cursor's own unsnapped position.
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [measureStart, setMeasureStart] = useState<ChartPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<ChartPoint | null>(null);

  // Whatever was mid-measurement (or already completed) shouldn't reappear the next time
  // `measureActive` flips back on — same "starting the tool over" reasoning re-selecting any
  // other tool already resets its own in-progress state elsewhere in this library.
  useEffect(() => {
    if (!measureActive) {
      setMeasureStart(null);
      setMeasureEnd(null);
    }
  }, [measureActive]);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [ref, dims] = useChartDimensions(margin, { height: isFullscreen ? undefined : height });

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id));

  // Every unique X across every visible series, sorted — what the crosshair itself snaps to (see
  // handlePointerMove), instead of just one series' own data. A single reference series only
  // covers the whole domain when every series shares the exact same X's, which isn't true here:
  // SeasonalityView's own per-year lines are each only defined for the buckets that year actually
  // has an occurrence in (e.g. a year whose data starts partway through the reference year), so
  // picking whichever series happens to be first left every X before its own first point
  // impossible to hover — the crosshair just snapped to that series' first point instead of
  // moving. Each series still looks up its own closest point independently (closestPointInSeries)
  // once the shared X is picked.
  const allXValues = useMemo(() => {
    const byValue = new Map<number, Date | number>();
    for (const s of visibleSeries) {
      for (const p of s.data) byValue.set(+p.x, p.x);
    }
    return Array.from(byValue.values()).sort((a, b) => +a - +b);
  }, [visibleSeries]);

  // The data's own raw extent, before xDomainPadding widens it — also what the hatch rendering
  // below reads to know where "real data" ends and its own padding zones begin, in the same
  // units xScale's domain uses (a Date for "time", a plain number for "linear").
  const dataExtent = useMemo(() => {
    const allX = visibleSeries.flatMap((s) => s.data.map((d) => d.x));
    return xType === "time" ? (d3.extent(allX as Date[]) as [Date, Date]) : (d3.extent(allX as number[]) as [number, number]);
  }, [visibleSeries, xType]);

  const xScale = useMemo(() => {
    const padStart = xDomainPadding?.start ?? 0;
    const padEnd = xDomainPadding?.end ?? 0;
    if (xType === "time") {
      const [min, max] = dataExtent as [Date, Date];
      const domain: [Date, Date] = min && max ? [new Date(min.getTime() - padStart), new Date(max.getTime() + padEnd)] : [new Date(), new Date()];
      return d3.scaleTime().domain(domain).range([0, dims.boundedWidth]);
    }
    const [min, max] = dataExtent as [number, number];
    const domain: [number, number] = min !== undefined ? [min - padStart, max + padEnd] : [0, 1];
    return d3.scaleLinear().domain(domain).range([0, dims.boundedWidth]);
  }, [dataExtent, xType, dims.boundedWidth, xDomainPadding?.start, xDomainPadding?.end]);

  const zoomedXScale = transform.rescaleX(xScale as unknown as d3.ScaleLinear<number, number>);

  const yScale = useMemo(() => {
    const allY = visibleSeries.flatMap((s) => s.data.map((d) => d.y));
    const [min, max] = d3.extent(allY) as [number, number];
    const pad = (max - min) * 0.1 || 1;
    return d3
      .scaleLinear()
      .domain([min - pad, max + pad])
      .range([dims.boundedHeight, 0])
      .nice();
  }, [visibleSeries, dims.boundedHeight]);

  const zoomedYScale = yTransform.rescaleY(yScale);

  const { ref: zoomRef, reset: resetX, setTransform: setXTransformViaZoom } = useD3Zoom<SVGRectElement>({
    width: dims.boundedWidth,
    height: dims.boundedHeight,
    enabled: zoomable,
    onZoom: setTransform,
  });

  const xAxisDrag = useAxisDragRescale({
    axis: "x",
    size: dims.boundedWidth,
    transform,
    onChange: setXTransformViaZoom,
  });
  const yAxisDrag = useAxisDragRescale({
    axis: "y",
    size: dims.boundedHeight,
    transform: yTransform,
    onChange: setYTransform,
  });

  const xAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "x",
    transform,
    onChange: setXTransformViaZoom,
    enabled: zoomable,
    size: dims.boundedWidth,
  });
  const yAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "y",
    transform: yTransform,
    onChange: setYTransform,
    enabled: zoomable,
    size: dims.boundedHeight,
  });

  const isZoomed = transform.k !== 1 || transform.x !== 0 || yTransform.k !== 1 || yTransform.y !== 0;

  const resetZoom = useCallback(() => {
    resetX();
    setYTransform(d3.zoomIdentity);
  }, [resetX]);

  function resetYAxis() {
    setYTransform(d3.zoomIdentity);
  }

  useImperativeHandle(handleRef, () => ({ resetZoom }), [resetZoom]);

  useEffect(() => {
    onZoomChange?.(isZoomed);
  }, [isZoomed, onZoomChange]);

  const curveFactory = curveType === "linear" ? d3.curveLinear : d3.curveMonotoneX;

  const lineGen = d3
    .line<ChartPoint>()
    .x((d) => zoomedXScale(d.x as never))
    .y((d) => zoomedYScale(d.y))
    .curve(curveFactory);

  const areaGen = d3
    .area<ChartPoint>()
    .x((d) => zoomedXScale(d.x as never))
    .y0(dims.boundedHeight)
    .y1((d) => zoomedYScale(d.y))
    .curve(curveFactory);

  // Toward `referenceLineY` (not the plot's own bottom edge like `areaGen` above) — used by
  // `fillSignedAtReference`'s own per-segment fills. `curveLinear`, not `curveMonotoneX` like
  // every other generator here: each segment is only ever a handful of points bounded by an
  // exact interpolated crossing (see splitAtReference's own doc on why linear is close enough
  // and avoids kinks a re-started monotone curve would introduce right at that boundary).
  const referenceAreaGen = d3
    .area<ChartPoint>()
    .x((d) => zoomedXScale(d.x as never))
    .y0(() => zoomedYScale(referenceLineY ?? 0))
    .y1((d) => zoomedYScale(d.y))
    .curve(d3.curveLinear);

  // Between two series' own values directly (not a fixed reference) — used by `fillBetween`'s
  // own per-segment fills. Same curveLinear reasoning as referenceAreaGen above.
  const betweenAreaGen = d3
    .area<{ x: Date | number; yA: number; yB: number }>()
    .x((d) => zoomedXScale(d.x as never))
    .y0((d) => zoomedYScale(d.yB))
    .y1((d) => zoomedYScale(d.yA))
    .curve(d3.curveLinear);

  const colorFor = (s: ChartSeries, i: number) => s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setPointerPos({ x: mouseX, y: mouseY });
    if (allXValues.length === 0) return;
    const bisect = d3.bisector<Date | number, number>((d) => +d).left;
    const xValue = zoomedXScale.invert(mouseX);
    const i = bisect(allXValues, +xValue);
    const index =
      i <= 0 ? 0 : i >= allXValues.length ? allXValues.length - 1 : +xValue - +allXValues[i - 1] <= +allXValues[i] - +xValue ? i - 1 : i;
    setHover({ index, mouseX: zoomedXScale(allXValues[index] as never), anchorX: allXValues[index] });
  }

  // Places the ruler's own start/end points — never snapped to a series' own data (unlike `hover`
  // above), so it reads pixel position straight off the click itself rather than reusing anything
  // `handlePointerMove` already bisected. A 3rd click (both points already set) starts over
  // instead of doing nothing, so re-measuring never requires first hunting for a "clear" control.
  function handleMeasureClick(e: React.MouseEvent<SVGRectElement>) {
    if (!measureActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point: ChartPoint = {
      x: zoomedXScale.invert(e.clientX - rect.left) as unknown as Date | number,
      y: zoomedYScale.invert(e.clientY - rect.top),
    };
    if (!measureStart || measureEnd) {
      setMeasureStart(point);
      setMeasureEnd(null);
    } else {
      setMeasureEnd(point);
    }
  }

  // The ruler's own live end point while only `measureStart` has been placed yet — the raw cursor
  // position converted through the same scales a completed `measureEnd` would already be in, so
  // the preview line reads identically to the committed one the moment the 2nd click lands.
  const measureLivePoint: ChartPoint | null =
    measureActive && measureStart && !measureEnd && pointerPos
      ? { x: zoomedXScale.invert(pointerPos.x) as unknown as Date | number, y: zoomedYScale.invert(pointerPos.y) }
      : null;

  // A series' own closest point to `xValue` — bisecting *that series' own* data instead of
  // reusing another series' array index (see hover.anchorX's own doc): two series only share an
  // index-to-point mapping when their data arrays are the exact same length with no gaps of their
  // own, which independently-computed series (e.g. SeasonalityView's own per-year lines, each
  // only defined for the buckets that year actually has an occurrence in) can't be assumed to be.
  // Clamps to the nearest end past either edge, same "closest available" reading a hover past a
  // shorter series' own last point already gets from its permanent endDot.
  function closestPointInSeries(data: ChartPoint[], xValue: Date | number): ChartPoint | undefined {
    if (data.length === 0) return undefined;
    const bisect = d3.bisector<ChartPoint, number>((d) => +d.x).left;
    const i = bisect(data, +xValue);
    if (i <= 0) return data[0];
    if (i >= data.length) return data[data.length - 1];
    const prev = data[i - 1];
    const next = data[i];
    return +xValue - +prev.x <= +next.x - +xValue ? prev : next;
  }

  if (dims.width === 0 || series.length === 0 || series.every((s) => s.data.length === 0)) {
    return (
      <div
        ref={ref}
        className={["lq-chart", isFullscreen && "lq-chart--fullscreen", embedded && "lq-chart--embedded", className].filter(Boolean).join(" ")}
        style={{ height }}
      >
        {series.length === 0 && <div className="lq-chart__empty">Aucune donnée</div>}
      </div>
    );
  }

  // `series.indexOf(s)` (this series' own stable position in the *full*, unfiltered list), not
  // its position within `visibleSeries` — hiding an earlier series shifts every later one's own
  // index within the filtered array, silently reassigning it a different color than the one still
  // shown for it in the legend below (which colors off the same stable full-array index).
  const hoverPoint = hover
    ? visibleSeries.map((s) => ({ series: s, color: colorFor(s, series.indexOf(s)), point: closestPointInSeries(s.data, hover.anchorX) }))
    : null;

  return (
    <div ref={ref} className={["lq-chart", isFullscreen && "lq-chart--fullscreen", embedded && "lq-chart--embedded", className].filter(Boolean).join(" ")}>
      <div className="lq-chart__toolbar">
        {zoomable && isZoomed && showZoomReset && (
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
          {/* Same diagonal-hatch look as CandlestickChart's own "future zone" (see
              drawFutureZone.ts) — that one's canvas-drawn, this one's the SVG-pattern equivalent
              for xDomainPadding's own two margin zones below. */}
          {xDomainPadding && (
            <pattern id={hatchId} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={10} className="lq-chart__hatch-line" />
            </pattern>
          )}
        </defs>
        <g transform={`translate(${dims.margin.left}, ${dims.margin.top})`}>
          <ChartAxis
            scale={zoomedYScale}
            orientation={yAxisOrientation}
            transform={yAxisOrientation === "right" ? `translate(${dims.boundedWidth}, 0)` : undefined}
            grid={showGrid}
            gridLength={dims.boundedWidth}
            tickFormat={formatY ? (v) => formatY(Number(v)) : undefined}
            ticks={yTicks}
          />
          {/* d3's own X-axis domain line only spans its scale's range ([0, boundedWidth]) — with
              the Y axis moved into a right-side margin column, that left it short of the chart's
              actual right edge, same gap CandlestickChart's own axis-line-extension already
              fixes for its date axis. */}
          {yAxisOrientation === "right" && (
            <line
              className="lq-chart__axis-line-extension"
              x1={dims.boundedWidth}
              x2={dims.boundedWidth + dims.margin.right}
              y1={dims.boundedHeight}
              y2={dims.boundedHeight}
            />
          )}
          <ChartAxis
            scale={zoomedXScale}
            orientation="bottom"
            transform={`translate(0, ${dims.boundedHeight})`}
            tickFormat={
              xTickFormat || formatX
                ? (v) => (xTickFormat ?? formatX!)(xType === "time" ? (v as Date) : Number(v))
                : undefined
            }
            ticks={xTicks}
            tickValues={xTickValues}
          />

          <g clipPath={`url(#${clipId})`}>
            {/* xDomainPadding's own two margin zones — drawn first, before the reference
                line/series/everything else, so they read as a background layer everything
                else paints over (same convention as CandlestickChart's own future zone). Only
                the gap between the plot's own edge and where real data starts/ends is hatched;
                a Math.max(0, …) width keeps a fully zoomed/panned-out view (where the padding
                itself might scroll off-screen entirely) from ever going negative. */}
            {xDomainPadding &&
              dataExtent[0] !== undefined &&
              (() => {
                const dataStartPx = zoomedXScale(dataExtent[0] as never);
                const dataEndPx = zoomedXScale(dataExtent[1] as never);
                return (
                  <>
                    <rect x={0} y={0} width={Math.max(0, dataStartPx)} height={dims.boundedHeight} fill={`url(#${hatchId})`} />
                    <rect
                      x={dataEndPx}
                      y={0}
                      width={Math.max(0, dims.boundedWidth - dataEndPx)}
                      height={dims.boundedHeight}
                      fill={`url(#${hatchId})`}
                    />
                  </>
                );
              })()}

            {referenceLineY !== undefined && (
              <line
                className="lq-chart__reference-line"
                x1={0}
                x2={dims.boundedWidth}
                y1={zoomedYScale(referenceLineY)}
                y2={zoomedYScale(referenceLineY)}
              />
            )}

            {/* The region between two named series, colored by which one is on top at each x —
                drawn before every series' own line/fill below so both lines' own strokes sit
                crisply on top of it. */}
            {fillBetween &&
              (() => {
                const dataA = series.find((s) => s.id === fillBetween.seriesIdA)?.data;
                const dataB = series.find((s) => s.id === fillBetween.seriesIdB)?.data;
                if (!dataA || !dataB) return null;
                return splitBetweenSeries(dataA, dataB).map((segment, i) => (
                  <path
                    key={i}
                    d={betweenAreaGen(segment.points) ?? undefined}
                    fill={segment.aAbove ? fillBetween.aAboveColor : fillBetween.aBelowColor}
                    fillOpacity={0.25}
                    stroke="none"
                  />
                ));
              })()}

            {visibleSeries.map((s) => {
              // Same stable-full-array-index reasoning as hoverPoint's own doc above.
              const color = colorFor(s, series.indexOf(s));
              const fillArea = s.area ?? area;
              return (
                <g key={s.id}>
                  {fillArea && <path d={areaGen(s.data) ?? undefined} fill={color} fillOpacity={0.12} stroke="none" />}
                  {s.fillSignedAtReference &&
                    referenceLineY !== undefined &&
                    splitAtReference(s.data, referenceLineY).map((segment, i) => (
                      <path
                        key={i}
                        d={referenceAreaGen(segment.points) ?? undefined}
                        fill={segment.positive ? s.fillSignedAtReference!.positiveColor : s.fillSignedAtReference!.negativeColor}
                        fillOpacity={0.25}
                        stroke="none"
                      />
                    ))}
                  <path d={lineGen(s.data) ?? undefined} fill="none" stroke={color} strokeWidth={s.strokeWidth ?? 2} />
                  {s.endDot &&
                    s.data.length > 0 &&
                    (() => {
                      const last = s.data[s.data.length - 1];
                      return (
                        <circle
                          className="lq-chart__dot lq-chart__dot--end"
                          cx={zoomedXScale(last.x as never)}
                          cy={zoomedYScale(last.y)}
                          r={5}
                          fill={color}
                        />
                      );
                    })()}
                </g>
              );
            })}

            {!measureActive &&
              hover &&
              hoverPoint &&
              (() => {
                return (
                  <>
                    <line
                      className="lq-chart__crosshair-line"
                      x1={hover.mouseX}
                      x2={hover.mouseX}
                      y1={0}
                      y2={dims.boundedHeight}
                    />
                    {/* One per series, not the single muted line CandlestickChart's own
                        hover price line is (see drawPriceCandles.ts) — that convention fits a
                        single price series with nothing to tell apart; several simultaneous
                        series here each need their own to actually trace back to the axis-value
                        badge/dot that share its own color, or overlapping identical gray dashed
                        lines would be indistinguishable. Only drawn in axisHoverLabels mode —
                        the one other caller (PortfolioSummaryWidget) uses the floating tooltip
                        instead and never asked for this. */}
                    {axisHoverLabels &&
                      hoverPoint.map(({ series: s, color, point }) =>
                        point ? (
                          <line
                            key={`hline-${s.id}`}
                            className="lq-chart__crosshair-line"
                            x1={0}
                            x2={dims.boundedWidth}
                            y1={zoomedYScale(point.y)}
                            y2={zoomedYScale(point.y)}
                            // A plain `stroke` attribute loses to the class's own stylesheet rule
                            // (SVG presentation attributes sit below any stylesheet in the cascade,
                            // even a class selector) — `style` doesn't.
                            style={{ stroke: color }}
                          />
                        ) : null
                      )}
                    {hoverPoint.map(({ series: s, color, point }) =>
                      point ? (
                        <circle
                          key={s.id}
                          className="lq-chart__dot"
                          cx={zoomedXScale(point.x as never)}
                          cy={zoomedYScale(point.y)}
                          r={4}
                          fill={color}
                        />
                      ) : null
                    )}
                  </>
                );
              })()}

            {/* The ruler's own translucent box + line + endpoints — same visual recipe as
                CandlestickChart's own Measure tool (see drawPriceDrawings.ts): a translucent
                up/down-colored rect spanning the two points, a dashed line the same color
                connecting them, and open-ring handles (not solid dots) at each end. `end` is
                whichever of measureEnd (committed) or measureLivePoint (still tracking the
                cursor) currently applies; nothing draws until there's at least a start and
                *some* end to draw toward. */}
            {measureActive &&
              measureStart &&
              (() => {
                const end = measureEnd ?? measureLivePoint;
                if (!end) return null;
                const x1 = zoomedXScale(measureStart.x as never);
                const y1 = zoomedYScale(measureStart.y);
                const x2 = zoomedXScale(end.x as never);
                const y2 = zoomedYScale(end.y);
                const up = end.y >= measureStart.y;
                const colorVar = `var(${up ? "--lq-color-up" : "--lq-color-down"})`;
                return (
                  <>
                    <rect
                      className="lq-chart__measure-box"
                      x={Math.min(x1, x2)}
                      y={Math.min(y1, y2)}
                      width={Math.abs(x2 - x1)}
                      height={Math.abs(y2 - y1)}
                      fill={colorVar}
                      fillOpacity={0.15}
                    />
                    <line className="lq-chart__measure-line" x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: colorVar }} />
                    <circle className="lq-chart__measure-dot" cx={x1} cy={y1} r={5} style={{ stroke: colorVar }} />
                    <circle className="lq-chart__measure-dot" cx={x2} cy={y2} r={5} style={{ stroke: colorVar }} />
                  </>
                );
              })()}
          </g>

          <rect
            ref={zoomRef}
            className={["lq-chart__overlay", measureActive && "lq-chart__overlay--measuring"].filter(Boolean).join(" ")}
            width={dims.boundedWidth}
            height={dims.boundedHeight}
            onPointerMove={handlePointerMove}
            onPointerLeave={(e) => {
              // Same touch-pin reasoning as CandlestickChart's own plot overlay: "leave" fires
              // the instant a finger lifts, so clearing here would make the hover
              // crosshair/tooltip exist only while actively touching — pin it at its last
              // position instead (mouse still clears normally) so it stays readable after lift.
              // A tap anywhere else already recomputes it at the new position via
              // handlePointerMove, so nothing else is needed to let the user move it.
              if (e.pointerType === "touch") return;
              setHover(null);
              setPointerPos(null);
            }}
            onClick={handleMeasureClick}
          />

          <rect
            ref={yAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--y"
            x={yAxisOrientation === "right" ? dims.boundedWidth : -dims.margin.left}
            y={0}
            width={yAxisOrientation === "right" ? dims.margin.right : dims.margin.left}
            height={dims.boundedHeight}
            onPointerDown={yAxisDrag.onPointerDown}
            onPointerMove={yAxisDrag.onPointerMove}
            onPointerUp={yAxisDrag.onPointerUp}
            onDoubleClick={resetYAxis}
          />
          <rect
            ref={xAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--x"
            x={0}
            y={dims.boundedHeight}
            width={dims.boundedWidth}
            height={dims.margin.bottom}
            onPointerDown={xAxisDrag.onPointerDown}
            onPointerMove={xAxisDrag.onPointerMove}
            onPointerUp={xAxisDrag.onPointerUp}
            onDoubleClick={resetX}
          />
        </g>
      </svg>

      {!measureActive &&
        hover &&
        hoverPoint &&
        (axisHoverLabels ? (
          (() => {
            // The hovered X itself — not any one series' own closest point (see hover.anchorX's
            // own doc): a series that doesn't happen to have a point exactly here (e.g. a year
            // whose own data doesn't reach back to January) would otherwise leak its own nearest
            // point in as if it were what's actually under the cursor.
            const formattedX = formatX
              ? formatX(hover.anchorX)
              : xType === "time"
                ? d3.timeFormat("%d %b %Y")(hover.anchorX as Date)
                : String(hover.anchorX);
            return (
              <>
                <div
                  className="lq-chart__axis-value lq-chart__axis-value--x"
                  style={{ left: dims.margin.left + hover.mouseX, top: dims.margin.top + dims.boundedHeight }}
                >
                  <span className="lq-chart__axis-value-text">{formattedX}</span>
                </div>
                {hoverAverage
                  ? (() => {
                      // Plain mean of whatever's actually defined here (a series that doesn't
                      // reach this far back/forward — an in-progress year, say — simply doesn't
                      // count toward it, same "gaps are omitted, not zeroed" reading every other
                      // per-series lookup in this file already gives a missing point).
                      const values = hoverPoint.flatMap(({ point }) => (point ? [point.y] : []));
                      if (values.length === 0) return null;
                      const avgY = values.reduce((sum, y) => sum + y, 0) / values.length;
                      return (
                        <div
                          className="lq-chart__axis-value lq-chart__axis-value--y lq-chart__axis-value--average"
                          style={{
                            top: dims.margin.top + zoomedYScale(avgY),
                            ...(yAxisOrientation === "right"
                              ? { left: dims.margin.left + dims.boundedWidth, minWidth: dims.margin.right }
                              : { left: 0, width: dims.margin.left, justifyContent: "flex-end" }),
                          }}
                        >
                          <span className="lq-chart__axis-value-text">Moy. {formatY ? formatY(avgY) : avgY}</span>
                        </div>
                      );
                    })()
                  : hoverPoint.map(({ series: s, color, point }) =>
                      point ? (
                        <div
                          key={s.id}
                          className="lq-chart__axis-value lq-chart__axis-value--y"
                          style={{
                            top: dims.margin.top + zoomedYScale(point.y),
                            backgroundColor: color,
                            ...(yAxisOrientation === "right"
                              ? { left: dims.margin.left + dims.boundedWidth, minWidth: dims.margin.right }
                              : { left: 0, width: dims.margin.left, justifyContent: "flex-end" }),
                          }}
                        >
                          <span className="lq-chart__axis-value-text">{formatY ? formatY(point.y) : point.y}</span>
                        </div>
                      ) : null
                    )}
              </>
            );
          })()
        ) : (
          (() => {
            const nearRightEdge = hover.mouseX > dims.boundedWidth * 0.65;
            return (
              <ChartTooltip
                x={dims.margin.left + hover.mouseX}
                y={dims.margin.top}
                visible
                align={nearRightEdge ? "left" : "right"}
              >
                <div className="lq-chart-tooltip__title">
                  {formatX
                    ? formatX(hover.anchorX)
                    : xType === "time"
                      ? d3.timeFormat("%d %b %Y")(hover.anchorX as Date)
                      : String(hover.anchorX)}
                </div>
                {hoverPoint.map(({ series: s, color, point }) => (
                  <div key={s.id} className="lq-chart-tooltip__row">
                    <span className="lq-chart-tooltip__swatch" style={{ backgroundColor: color }} />
                    {s.label ?? s.id}: <strong>{point ? (formatY ? formatY(point.y) : point.y) : "—"}</strong>
                  </div>
                ))}
              </ChartTooltip>
            );
          })()
        ))}

      {/* The ruler's own readout — a plain bordered stats box, not the floating/edge-flipping
          `ChartTooltip` the regular hover uses — same recipe as CandlestickChart's own canvas-
          drawn measure box (solid background, border colored to match the line/box above,
          anchored past the bounding box's own top-right corner, no edge-flip). Each point's own
          formatted X, plus the raw Y delta — CandlestickChart's own box also shows a % change, a
          bar count, and a calendar-day count; % change is skipped here on purpose rather than
          copied over: it divides the delta by the start point's own Y value, which only reads as
          a meaningful "percent change" when Y is itself a price (always positive) — LineAreaChart
          can't assume that (SeasonalityView's own Y is already a %, so a "percent of a percent"
          relative to a start value that can itself be negative or near zero produces nonsense
          like "+-140%", not a real second measurement). Bar/day counts have no clean equivalent
          either — the ruler's own points are raw, unsnapped positions, not indices into anything
          countable (see measureLivePoint's own doc). */}
      {measureActive &&
        measureStart &&
        (() => {
          const end = measureEnd ?? measureLivePoint;
          if (!end) return null;
          const x1 = zoomedXScale(measureStart.x as never);
          const y1 = zoomedYScale(measureStart.y);
          const x2 = zoomedXScale(end.x as never);
          const y2 = zoomedYScale(end.y);
          const up = end.y >= measureStart.y;
          const colorVar = `var(${up ? "--lq-color-up" : "--lq-color-down"})`;
          const delta = end.y - measureStart.y;
          const formatPoint = (x: Date | number) =>
            formatX ? formatX(x) : xType === "time" ? d3.timeFormat("%d %b %Y")(x as Date) : String(x);
          return (
            <div
              className="lq-chart__measure-stats"
              style={{
                left: dims.margin.left + Math.max(x1, x2) + 8,
                top: dims.margin.top + Math.min(y1, y2),
                borderColor: colorVar,
                color: colorVar,
              }}
            >
              <div>
                {formatPoint(measureStart.x)} → {formatPoint(end.x)}
              </div>
              <div>{formatY ? formatY(delta) : `${delta >= 0 ? "+" : ""}${delta}`}</div>
            </div>
          );
        })()}

      {showLegend && series.length > 1 && (
        <div className="lq-chart__legend">
          {series.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="lq-chart__legend-item"
              style={{ opacity: hiddenIds.has(s.id) ? 0.4 : 1 }}
              onClick={() =>
                setHiddenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
            >
              <span className="lq-chart__legend-swatch" style={{ backgroundColor: colorFor(s, i) }} />
              {s.label ?? s.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
