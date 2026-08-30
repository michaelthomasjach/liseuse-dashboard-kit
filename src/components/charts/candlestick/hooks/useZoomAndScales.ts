import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { RefObject } from "react";
import { useD3Zoom } from "../../internal/useD3Zoom";
import { useAxisDragRescale } from "../../internal/useAxisDragRescale";
import { useAxisWheelZoom } from "../../internal/useAxisWheelZoom";
import type { ChartDimensions } from "../../internal/useChartDimensions";
import type { Candle } from "../interfaces/Candle.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { MAX_EMPTY_FRACTION, AXIS_BADGE_HALF_HEIGHT, MAX_DATE_TICKS, MIN_DATE_TICK_SPACING_PX } from "../constants";
import { computeHeikinAshiCandles, computeRenkoBrickSize, computeRenkoBricks, computeLineBreakBricks, type PriceBrick } from "../chartModes";

export interface UseZoomAndScalesArgs {
  data: Candle[];
  dims: ChartDimensions;
  plotBoundedHeight: number;
  priceHeight: number;
  volumeHeight: number;
  paneYTransform: Record<string, d3.ZoomTransform>;
  drawings: TrendLineDrawing[];
  activeTool: DrawingToolType | null;
  /** True while choosing where to cut for replay mode (see useReplayState.ts) — suspends pan/zoom
   *  the same way an active drawing tool already does below, so a drag meant to place the cutoff
   *  can't also pan the chart out from under it. Not set once replay is merely *active* (a cutoff
   *  already chosen, playing or paused) — panning/zooming the visible history is normal then. */
  replayArmed: boolean;
  hoveredDrawingIdRef: RefObject<string | null>;
  /** Whether the pointer is currently over the measure tool's own rectangle body — same reason
   *  hoveredDrawingIdRef is checked below: kept live by useDrawingInteractions' own
   *  handlePointerMove so it's already correct by the time a *later* pointerdown needs it to
   *  decide whether to start a whole-body drag instead of this hook's own pan. */
  measureBodyHoveredRef: RefObject<boolean>;
  yAutoScalingState: boolean;
  zoomable: boolean;
  initialVisibleCandles: number | undefined;
}

/** The chart's whole coordinate system: X/Y transforms (pan/zoom), the index-based X scale and
 *  its Date<->index bridging (indexForDate/dateForIndex), the visible candle-index range those
 *  drive, the price scale (+YAutoScaling's auto-fit effect), the volume scale, and every
 *  zoom/pan/axis-drag/wheel mechanism built on top of them. Also owns the symbol-comparison
 *  overlay projection (`overlayProjections`/`compareMode`) even though the *drawings* it projects
 *  live in `useDrawingState` — this is fundamentally a scales concern (rebasing a second series
 *  onto the main one's price space) that the price-scale auto-fit effect right below it directly
 *  consumes, so splitting them into different hooks would only mean threading the same few values
 *  back and forth between two hooks that both need them on nearly every line. */
export function useZoomAndScales({
  data,
  dims,
  plotBoundedHeight,
  priceHeight,
  volumeHeight,
  paneYTransform,
  drawings,
  activeTool,
  replayArmed,
  hoveredDrawingIdRef,
  measureBodyHoveredRef,
  yAutoScalingState,
  zoomable,
  initialVisibleCandles,
}: UseZoomAndScalesArgs) {
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [yTransform, setYTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  // Set the moment the user manually zooms/pans the Y axis themselves (wheel/drag on the axis,
  // or the Y component of the 2D plot-drag) — while true, `YAutoScaling` stops overwriting their
  // adjustment. Cleared by resetZoom/resetYAxis, which re-engages auto-fit.
  const [yManuallyAdjusted, setYManuallyAdjusted] = useState(false);

  // Positions candles by INDEX, not by literal calendar time — each candle i occupies the slot
  // [i, i+1], centered at i+0.5. A real d3.scaleTime() (mapping actual elapsed time to pixels)
  // was tried first, but real trading data has uneven gaps (weekends, holidays): time-proportional
  // spacing left visible empty gaps between Friday and Monday, clustering weekday candles
  // together instead of the flush, evenly-spaced rendering every trading platform actually uses.
  // Same index-scale approach as BarChart/DeltaChart's categorical axis. The [0, n] domain (vs.
  // [0, n-1]) reserves half a slot on each edge for free, so the first/last candle isn't clipped
  // — no separate padding step needed, unlike the old time-scale version. Panning past [0, n]
  // into "future"/"past" empty space is handled separately (see MAX_EMPTY_FRACTION and the
  // custom zoom `constrain` below) rather than baked into this domain — that keeps `xScale`
  // itself a simple, stable 1:1 mapping of the real data, and the empty-space allowance adaptive
  // to zoom level instead of a fixed slot count.
  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, Math.max(1, data.length)]).range([0, dims.boundedWidth]),
    [data.length, dims.boundedWidth]
  );

  const zoomedXScale = transform.rescaleX(xScale);

  // Bridges the index-space scale above and the Date-based coordinates drawings/indicators are
  // actually stored in (a real Date is meaningful to consumers of the public API in a way a raw
  // index isn't — defaultDrawings, onDrawingsChange, etc. all deal in dates). indexForDate is
  // used at render time (a stored date -> where it sits among today's candles); dateForIndex at
  // interaction time (a pixel position, inverted to a fractional index -> the nearest candle's
  // actual date, to store).
  //
  // Extrapolates linearly past data[0]/data[last]'s own date instead of clamping to their index —
  // a drawing dragged into the empty future/past space (see MAX_EMPTY_FRACTION) still needs a
  // pixel position proportional to how far out it actually is. Clamping both ends of a 2-point
  // drawing to the *same* boundary index the moment they're both out of range collapses its own
  // on-screen width to zero regardless of how far apart their real dates still are — confirmed bug
  // report: the "table" tool's own grid shrinking away entirely once dragged past the data's edge,
  // in either direction. Callers that index `data[]` directly with this result (there's only ever
  // been the one, see useHoverSync's own effectiveHoverIndex) still need to clamp it themselves —
  // this only fixes *positioning* math (zoomedXScale(indexForDate(x) + 0.5) and friends), not
  // array access.
  const indexForDate = useCallback(
    (date: Date): number => {
      if (data.length === 0) return 0;
      const first = data[0].date;
      const last = data[data.length - 1].date;
      if (data.length > 1 && (date.getTime() < first.getTime() || date.getTime() > last.getTime())) {
        // Average spacing across the *whole* dataset, not just the two edge candles — an
        // irregular gap right at one edge (e.g. a holiday) shouldn't skew the extrapolated rate.
        const avgSpacingMs = (last.getTime() - first.getTime()) / (data.length - 1);
        if (avgSpacingMs > 0) {
          return date.getTime() < first.getTime()
            ? (date.getTime() - first.getTime()) / avgSpacingMs
            : data.length - 1 + (date.getTime() - last.getTime()) / avgSpacingMs;
        }
      }
      const idx = d3.bisector<Candle, Date>((d) => d.date).left(data, date);
      return Math.min(data.length - 1, Math.max(0, idx));
    },
    [data]
  );

  // The exact inverse of indexForDate's own extrapolation above — same reasoning, same
  // avgSpacingMs, needed for the same reason: every whole-body/handle drag of a stored drawing
  // point round-trips a pixel through `zoomedXScale.invert` then this to get the date to store,
  // and clamping it back to data's own first/last date the moment it crosses into the empty
  // future/past space (see MAX_EMPTY_FRACTION) is what actually collapsed a 2-point drawing's own
  // width once *both* its points were dragged out there — not indexForDate alone, which only
  // fixed the read side of the same round-trip. Kept as the exact algebraic inverse (verified: a
  // date this function's own extrapolated branch produces, fed back through indexForDate's,
  // returns the identical continuous index) so dragging a point already out there and dragging it
  // right back lands on the same date, not a slightly different extrapolated one each time.
  const dateForIndex = useCallback(
    (rawIndex: number): Date => {
      if (data.length === 0) return new Date();
      const rawEdgeIndex = rawIndex - 0.5;
      if (data.length > 1 && (rawEdgeIndex < 0 || rawEdgeIndex > data.length - 1)) {
        const first = data[0].date;
        const last = data[data.length - 1].date;
        const avgSpacingMs = (last.getTime() - first.getTime()) / (data.length - 1);
        if (avgSpacingMs > 0) {
          const ms = rawEdgeIndex < 0 ? first.getTime() + rawEdgeIndex * avgSpacingMs : last.getTime() + (rawEdgeIndex - (data.length - 1)) * avgSpacingMs;
          return new Date(ms);
        }
      }
      const clamped = Math.min(data.length - 1, Math.max(0, Math.round(rawEdgeIndex)));
      return data[clamped].date;
    },
    [data]
  );

  // Precise (unpadded) index range of candles actually inside the zoomed domain — used to size
  // candles (see `visible`, which pads a couple extra candles on each side so partially-visible
  // edge candles still render instead of popping in/out) and to drive `YAutoScaling` (see below).
  const visibleRange = useMemo(() => {
    if (data.length === 0) return { start: 0, end: 0 };
    const [i0, i1] = zoomedXScale.domain();
    return { start: Math.max(0, Math.floor(i0)), end: Math.min(data.length, Math.ceil(i1)) };
  }, [data.length, zoomedXScale]);

  const symbolOverlays = useMemo(() => drawings.filter((d) => d.lineType === "symbolOverlay"), [drawings]);
  // Comparing against at least one other symbol switches the whole price axis to a % reading —
  // cleared back to plain price the moment the last overlay is removed, not a separate toggle of
  // its own.
  const compareMode = symbolOverlays.length > 0;

  // Each overlay projected onto the *main* series' own price space — not a fresh %-domain scale
  // of its own, which would mean threading a whole parallel code path through candles/indicators/
  // price-anchored drawings/every display mode just to render one extra line. Instead: rebase the
  // overlay to a % change from its own first-*visible*-point reference (exactly like the main
  // series already implicitly is one, relative to its own reference, whenever an axis reads
  // "% from here"), then project that % onto the main reference's price — `mainReference *
  // (1 + pctChange)`. Feeding that "equivalent price" through the completely unmodified
  // `zoomedPriceScale` lands it exactly where a real instrument trading at that price would sit —
  // candles, indicators, and every price-anchored drawing stay 100% untouched, only the axis
  // *label* (see the price ChartAxis' own tickFormat) reinterprets the same pixels as %. Recomputed
  // on every pan/zoom (visibleRange.start moving) since "from the first visible point" is by
  // definition a moving target, same spirit as YAutoScaling.
  const overlayProjections = useMemo(() => {
    if (symbolOverlays.length === 0 || data.length === 0) return [];
    const refIdx = Math.max(0, Math.min(data.length - 1, visibleRange.start));
    const mainReference = data[refIdx].close;
    const refTime = data[refIdx].date.getTime();
    return symbolOverlays.map((dr) => {
      const series = [...(dr.overlayData ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime());
      if (series.length === 0)
        return { drawing: dr, mainReference, points: [] as { i: number; price: number; open?: number; high?: number; low?: number }[] };
      // The overlay's own reference: its last point on or before the main series' first-visible
      // date, falling back to the overlay's own first point when its history starts later (its
      // comparison then simply begins wherever its own data actually does).
      let overlayReference = series[0].value;
      for (const p of series) {
        if (p.date.getTime() > refTime) break;
        overlayReference = p.value;
      }
      // Same "rebase to a % change from overlayReference, project onto mainReference" formula as
      // `price` below, applied to open/high/low too (when the caller actually supplied them —
      // see overlayDisplayMode's own doc) so a candle-mode overlay's whole OHLC bar lands
      // consistently in the same projected price space its close already does.
      const rebase = (v: number) => (overlayReference !== 0 ? mainReference * (v / overlayReference) : mainReference);
      const points = series.map((p) => ({
        i: indexForDate(p.date),
        price: rebase(p.value),
        open: p.open !== undefined ? rebase(p.open) : undefined,
        high: p.high !== undefined ? rebase(p.high) : undefined,
        low: p.low !== undefined ? rebase(p.low) : undefined,
      }));

      // Heikin Ashi/Renko/Line Break all need a full rebased Candle[] to run the very same
      // transforms `useChartDisplayMode` runs on `data` itself — computed on the *rebased* series
      // (not the overlay's own raw prices) purely so the output already sits in the main series'
      // price space, with no further rebasing needed once these functions have run: every one of
      // them is scale-covariant (a plain `k = mainReference/overlayReference` multiplier commutes
      // with HA's own averaging and with every brick threshold comparison, which only ever checks
      // one side of `>=`/`<=` against the other), so the results are identical either way.
      const hasOHLC = points.every((p) => p.open !== undefined && p.high !== undefined && p.low !== undefined);
      let haPoints: { i: number; price: number; open: number; high: number; low: number }[] | undefined;
      let bricks: PriceBrick[] | undefined;
      if (hasOHLC && dr.overlayDisplayMode && dr.overlayDisplayMode !== "line" && dr.overlayDisplayMode !== "candle") {
        const rebasedCandles: Candle[] = series.map((p) => ({
          date: p.date,
          open: rebase(p.open!),
          high: rebase(p.high!),
          low: rebase(p.low!),
          close: rebase(p.value),
        }));
        if (dr.overlayDisplayMode === "heikinAshi") {
          haPoints = computeHeikinAshiCandles(rebasedCandles).map((c, k) => ({
            i: points[k].i,
            price: c.close,
            open: c.open,
            high: c.high,
            low: c.low,
          }));
        } else {
          // "renko"/"lineBreak" — same ATR(14)/3-line settings as the main series' own defaults
          // (see TrendLineDrawing.overlayDisplayMode's own doc); startIndex/endIndex come back as
          // positions *within* rebasedCandles, remapped here to the real data-aligned indices
          // `points` already computed so bricks land correctly on the shared X scale.
          const rawBricks =
            dr.overlayDisplayMode === "renko"
              ? computeRenkoBricks(rebasedCandles, computeRenkoBrickSize(rebasedCandles, 14))
              : computeLineBreakBricks(rebasedCandles, 3);
          bricks = rawBricks.map((b) => ({ ...b, startIndex: points[b.startIndex].i, endIndex: points[b.endIndex].i }));
        }
      }

      return { drawing: dr, mainReference, points, haPoints, bricks };
    });
  }, [symbolOverlays, data, visibleRange.start, indexForDate]);

  // Always the full dataset's own domain — deliberately NOT reactive to pan/zoom, so it stays a
  // stable base for `zoomedPriceScale` below. `YAutoScaling` doesn't change this scale itself;
  // instead a separate effect derives an equivalent `yTransform` that makes the *zoomed* scale
  // fit the currently visible candles, leaving this one untouched (see below).
  const priceScale = useMemo(() => {
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const min = d3.min(lows) ?? 0;
    const max = d3.max(highs) ?? 1;
    const pad = (max - min) * 0.08 || 1;
    return d3.scaleLinear().domain([min - pad, max + pad]).range([priceHeight, 0]);
  }, [data, priceHeight]);

  const zoomedPriceScale = yTransform.rescaleY(priceScale);

  // Permanent price-axis badges (live price, indicator values, horizontal/ray drawing lines)
  // are positioned from a *value*, not from the mouse — unlike the hover badge, which can never
  // leave the pane because it's driven by a pointer position already inside it. Once the price
  // axis is zoomed/panned far enough that a value's pixel position falls outside the price
  // pane, its badge would otherwise render past the axis (over the toolbar above, or into the
  // volume/indicator panes below) instead of pinned to the edge like every trading platform
  // does. `AXIS_BADGE_HALF_HEIGHT` keeps the (vertically centered, `translateY(-50%)`) badge
  // fully inside the pane at the clamp, not just its center pixel.
  const clampToPriceAxis = (y: number) => Math.min(priceHeight - AXIS_BADGE_HALF_HEIGHT, Math.max(AXIS_BADGE_HALF_HEIGHT, y));

  // When YAutoScaling is on and the user hasn't manually adjusted the Y axis themselves (see
  // yManuallyAdjusted, set by yAxisDrag/yAxisWheelRef/the 2D-pan-Y handler, and cleared by
  // resetZoom/resetYAxis), continuously fit the Y axis to whatever candles are currently visible
  // on X — recomputing a `yTransform` that makes `priceScale.rescaleY(...)` land exactly on that
  // range, rather than changing `priceScale` itself. Depends on the visible *indices*
  // (`visibleRange.start`/`.end`, plain numbers) rather than `zoomedXScale` itself, which is a
  // fresh object every render (even ones triggered by unrelated state like hover) — indices only
  // actually change on a real pan/zoom, so this skips needless recomputation the rest of the time.
  // While comparing (compareMode), this fit runs unconditionally — ignoring yAutoScalingState/
  // yManuallyAdjusted — and folds in every overlay's own visible (rebased) range alongside the
  // candles': a fixed or manually-set axis wouldn't mean anything once it's showing a comparison,
  // same reasoning MACD's own pane never respects YAutoScaling either. Manual Y-axis
  // dragging/wheel is effectively a no-op for as long as any overlay is present, since this
  // effect immediately recomputes over it on the next render.
  useEffect(() => {
    if (data.length === 0) return;
    if (!compareMode && (!yAutoScalingState || yManuallyAdjusted)) return;
    const slice = data.slice(Math.max(0, visibleRange.start), Math.min(data.length, visibleRange.end));
    const source = slice.length > 0 ? slice : data;
    const highs = source.map((d) => d.high);
    const lows = source.map((d) => d.low);
    if (compareMode) {
      for (const { drawing: dr, points, haPoints, bricks } of overlayProjections) {
        if (dr.overlayDisplayMode === "heikinAshi" && haPoints) {
          for (const p of haPoints) {
            if (p.i >= visibleRange.start && p.i <= visibleRange.end) {
              highs.push(p.high);
              lows.push(p.low);
            }
          }
        } else if (bricks) {
          // "renko"/"lineBreak" — a brick spans a whole index *range*, not one point, so it
          // counts as visible whenever that range overlaps the visible one at all, not just when
          // its own single index would.
          for (const b of bricks) {
            if (b.endIndex >= visibleRange.start && b.startIndex <= visibleRange.end) {
              highs.push(Math.max(b.open, b.close));
              lows.push(Math.min(b.open, b.close));
            }
          }
        } else {
          for (const p of points) {
            if (p.i >= visibleRange.start && p.i <= visibleRange.end) {
              // A candle-mode overlay's own high/low, when present, fit the axis to its whole bar
              // rather than just its close — otherwise a tall wick could render clipped against a
              // range that only ever accounted for `price` (the close).
              highs.push(p.high ?? p.price);
              lows.push(p.low ?? p.price);
            }
          }
        }
      }
    }
    const min = d3.min(lows) ?? 0;
    const max = d3.max(highs) ?? 1;
    const pad = (max - min) * 0.08 || 1;
    const targetMin = min - pad;
    const targetMax = max + pad;
    const denom = priceScale(targetMin) - priceScale(targetMax);
    if (denom <= 0) return;
    const k = priceHeight / denom;
    const y = -k * priceScale(targetMax);
    setYTransform(new d3.ZoomTransform(k, 0, y));
  }, [yAutoScalingState, yManuallyAdjusted, data, visibleRange.start, visibleRange.end, priceScale, priceHeight, compareMode, overlayProjections]);

  // 10% headroom on top of the tallest bar, so it doesn't reach all the way up to the
  // price/volume divider — leaves a small visual gap between the bars and the line.
  const volumeScale = useMemo(() => {
    const max = d3.max(data, (d) => d.volume ?? 0) ?? 0;
    return d3.scaleLinear().domain([0, (max || 1) * 1.1]).range([volumeHeight, 0]);
  }, [data, volumeHeight]);
  // Manually rescaled view of volumeScale (see paneYTransform) — every rendering/hit-test/
  // drawing-placement site reads this instead of the base scale, same "zoomedX wraps X"
  // convention as zoomedPriceScale/priceScale; volumeScale itself stays the un-rescaled source of
  // truth the transform is applied on top of.
  const zoomedVolumeScale = useMemo(() => (paneYTransform["volume"] ?? d3.zoomIdentity).rescaleY(volumeScale), [paneYTransform, volumeScale]);

  // High enough that zooming all the way in leaves roughly one candle's slot filling the
  // viewport, regardless of how many candles are in `data` (a fixed cap like 20 would only
  // ever reveal ~20 candles at max zoom on a large dataset).
  const maxXZoom = Math.max(20, data.length);

  // Lets panning reveal empty space past the data's own edges (index 0 and data.length), capped
  // at MAX_EMPTY_FRACTION of the *current* viewport width on either side — derived by requiring
  // zoomedXScale(0) (the screen x where index 0 sits) to stay within [0, W] such that at most
  // MAX_EMPTY_FRACTION*W of empty space is visible to its left, and symmetrically for
  // zoomedXScale(data.length) and empty space to its right. Since zoomedXScale(v) = k*xScale(v)+tx
  // and xScale(0)=0, xScale(data.length)=W (by construction), both conditions reduce to plain
  // bounds on tx alone — a fixed d3-zoom translateExtent can't express this (it clamps in
  // constant world units, so the same padding would be a tiny sliver zoomed out and enormous
  // zoomed in), hence the custom constrain instead of relying on useD3Zoom's default.
  function constrainXPan(t: d3.ZoomTransform, extent: [[number, number], [number, number]]): d3.ZoomTransform {
    const w = extent[1][0] - extent[0][0];
    if (w <= 0) return t;
    const maxTx = w * MAX_EMPTY_FRACTION;
    const minTx = -(t.k - 1 + MAX_EMPTY_FRACTION) * w;
    const tx = Math.min(maxTx, Math.max(minTx, t.x));
    return new d3.ZoomTransform(t.k, tx, t.y);
  }

  const {
    ref: zoomRef,
    reset: resetX,
    setTransform: setXTransformViaZoom,
    setTransformAnimated: setXTransformAnimated,
  } = useD3Zoom<SVGRectElement>({
    width: dims.boundedWidth,
    height: plotBoundedHeight,
    enabled: zoomable && activeTool === null && !replayArmed,
    scaleExtent: [1, maxXZoom],
    onZoom: setTransform,
    filter: () => hoveredDrawingIdRef.current === null && !measureBodyHoveredRef.current,
    constrain: constrainXPan,
  });

  // The transform that shows exactly the last `count` candles, flush against the right edge —
  // shared by the initial-view effect below, `resetZoom` (reset targets this chart's own
  // initial scope, not a full dezoom), and `setVisibleCandleCount` (the header's bar-count
  // dropdown driving the same "show the last N candles" gesture on demand). Memoized so the
  // initial-view effect below can safely list it as a dependency without re-running on every
  // render.
  const transformForVisibleCount = useCallback(
    (count: number): d3.ZoomTransform | null => {
      if (!count || count <= 0 || dims.boundedWidth <= 0 || data.length === 0) return null;
      const start = Math.max(0, data.length - Math.min(count, data.length));
      const x0 = xScale(start);
      const x1 = xScale(data.length);
      if (x1 - x0 <= 0) return null;
      const k = Math.min(maxXZoom, Math.max(1, dims.boundedWidth / (x1 - x0)));
      return new d3.ZoomTransform(k, -k * x0, 0);
    },
    [dims.boundedWidth, data.length, xScale, maxXZoom]
  );

  // Whatever transform the chart actually opened with — `d3.zoomIdentity` (full dezoom) unless
  // `initialVisibleCandles` narrows it below, captured once so `resetZoom` can return to *this*
  // instead of always dezooming all the way out.
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Applied once, the first time the plot has a real measured width (and the zoom behavior
  // above is attached) — not on every resize, which would otherwise keep yanking the user back
  // to the last-N-candles view whenever the window changes size.
  const initialViewAppliedRef = useRef(false);
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    if (dims.boundedWidth <= 0 || data.length === 0) return;
    initialViewAppliedRef.current = true;
    if (!initialVisibleCandles || initialVisibleCandles <= 0 || initialVisibleCandles >= data.length) return;

    const t = transformForVisibleCount(initialVisibleCandles);
    if (!t) return;
    initialTransformRef.current = t;
    setXTransformViaZoom(t);
  }, [dims.boundedWidth, data.length, initialVisibleCandles, transformForVisibleCount, setXTransformViaZoom]);

  const xAxisDrag = useAxisDragRescale({
    axis: "x",
    size: dims.boundedWidth,
    transform,
    onChange: setXTransformViaZoom,
    scaleExtent: [1, maxXZoom],
  });
  // Wraps setYTransform for the axis's own drag/wheel controls specifically — these are always
  // a deliberate manual Y adjustment, so they also flag `yManuallyAdjusted` to stop
  // `YAutoScaling` from overwriting them (see the effect above). The 2D-pan-Y handler (in
  // useDrawingInteractions) sets the flag itself instead, since it isn't a plain onChange
  // callback.
  function handleManualYChange(t: d3.ZoomTransform) {
    setYManuallyAdjusted(true);
    setYTransform(t);
  }

  const yAxisDrag = useAxisDragRescale({
    axis: "y",
    size: priceHeight,
    transform: yTransform,
    onChange: handleManualYChange,
  });

  const xAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "x",
    transform,
    onChange: setXTransformViaZoom,
    enabled: zoomable,
    scaleExtent: [1, maxXZoom],
    size: dims.boundedWidth,
  });
  const yAxisWheelRef = useAxisWheelZoom<SVGRectElement>({
    axis: "y",
    transform: yTransform,
    onChange: handleManualYChange,
    enabled: zoomable,
    size: priceHeight,
  });

  // While YAutoScaling drives yTransform on its own, that alone shouldn't count as "zoomed" —
  // otherwise the reset button would stay permanently visible even without the user ever
  // touching the Y axis. It only counts once they've manually overridden it.
  const yIsZoomed = yAutoScalingState ? yManuallyAdjusted : yTransform.k !== 1 || yTransform.y !== 0;
  const isZoomed = transform.k !== 1 || transform.x !== 0 || yIsZoomed;

  // Deliberately targets this chart's own INITIAL scope (`initialTransformRef`), not `resetX()`
  // (which would always dezoom all the way out to the full dataset) — the "loupe -" button is
  // meant to undo the user's own zooming/panning, not discard the scope the chart opened with.
  function resetZoom() {
    setXTransformAnimated(initialTransformRef.current);
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
  }

  function setVisibleCandleCount(count: number) {
    const t = transformForVisibleCount(count);
    if (t) setXTransformAnimated(t);
  }

  function resetYAxis() {
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
  }

  // Every candle fills up to 80% of the space actually available to it at the current zoom — with
  // a single candle visible, that's 80% of the whole plot width. Deliberately no minimum pixel
  // floor: with many candles crammed into a narrow view (e.g. fully zoomed out on a 10,000-candle
  // dataset), 80% of their slot is still less than the slot itself, so neighbors never overlap — a
  // floor like `max(1, ...)` would force overlap once the slot itself was narrower than that
  // floor. Sized off the zoomed scale's own (unclamped) domain span rather than `visibleRange`
  // (which clamps to `data.length`) — otherwise, panned into the reserved future space with only a
  // few real candles peeking in from the left, `visibleRange` would undercount the visible slots
  // and render those candles too wide for the current zoom level.
  const zoomedSlotCount = useMemo(() => {
    const [i0, i1] = zoomedXScale.domain();
    return Math.max(1, i1 - i0);
  }, [zoomedXScale]);
  const candleWidth = Math.max(0.1, (dims.boundedWidth / zoomedSlotCount) * 0.8);

  // Candle indices (offset .5 to land mid-slot, matching every candle's own cx) the date axis
  // should actually draw a tick at — thinned to at most MAX_DATE_TICKS regardless of how many
  // candles are currently visible, so labels never overlap into unreadable clutter at low zoom,
  // *and* further thinned to whatever actually fits dims.boundedWidth at MIN_DATE_TICK_SPACING_PX
  // per label — MAX_DATE_TICKS alone assumes a full-width chart; a narrower one (a split-screen
  // panel, a docked side panel eating into the grid) needs fewer ticks long before it needs zero,
  // or the same fixed count just overlaps into unreadable clutter at a different cause than the
  // one this was already thinning for.
  //
  // Spaced from zoomedXScale's own *unclamped* domain (i0/i1 below), not visibleRange (which
  // clamps both ends to [0, data.length]) — panned into the reserved past/future empty space
  // (see MAX_EMPTY_FRACTION), that clamped range can be far narrower than what's actually on
  // screen, e.g. a domain of [2200, 2900] with only 2500 real candles: clamping *before* spacing
  // ticks out would cram all of them into however much of dims.boundedWidth that first ~43% of
  // the domain happens to occupy, overlapping into unreadable clutter even with few enough ticks
  // to otherwise fit — the same visual symptom as too many ticks, different actual cause. Instead,
  // step through the real (unclamped) domain — keeping every tick's spacing correct relative to
  // the pixels it actually maps to via zoomedXScale — and only *then* drop whichever land outside
  // real data, rather than narrowing the range first and evenly spacing what's left of it.
  const dateTickValues = useMemo(() => {
    const [i0, i1] = zoomedXScale.domain();
    const domainCount = i1 - i0;
    if (domainCount <= 0 || data.length === 0) return [];
    const maxTicksForWidth = Math.max(2, Math.floor(dims.boundedWidth / MIN_DATE_TICK_SPACING_PX));
    const maxTicks = Math.min(MAX_DATE_TICKS, maxTicksForWidth);
    const step = Math.max(1, Math.ceil(domainCount / maxTicks));
    const values: number[] = [];
    for (let i = Math.floor(i0); i < i1; i += step) {
      const value = i + 0.5;
      if (value >= 0 && value < data.length) values.push(value);
    }
    return values;
  }, [zoomedXScale, data.length, dims.boundedWidth]);

  return {
    transform,
    setTransform,
    yTransform,
    setYTransform,
    yManuallyAdjusted,
    setYManuallyAdjusted,
    xScale,
    zoomedXScale,
    indexForDate,
    dateForIndex,
    visibleRange,
    symbolOverlays,
    compareMode,
    overlayProjections,
    priceScale,
    zoomedPriceScale,
    clampToPriceAxis,
    volumeScale,
    zoomedVolumeScale,
    maxXZoom,
    zoomRef,
    resetX,
    setXTransformViaZoom,
    setXTransformAnimated,
    xAxisDrag,
    handleManualYChange,
    yAxisDrag,
    xAxisWheelRef,
    yAxisWheelRef,
    isZoomed,
    resetZoom,
    setVisibleCandleCount,
    resetYAxis,
    zoomedSlotCount,
    candleWidth,
    dateTickValues,
  };
}
