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
import type { ChartVisibleRange } from "../interfaces/ChartVisibleRange.interface";
import { MAX_EMPTY_FRACTION, AXIS_BADGE_HALF_HEIGHT, MAX_DATE_TICKS, MIN_DATE_TICK_SPACING_PX } from "../constants";
import { computeHeikinAshiCandles, computeRenkoBrickSize, computeRenkoBricks, computeLineBreakBricks, type PriceBrick } from "../chartModes";
import { transformForVisibleRange, visibleRangeOfDomain } from "../visibleRangeSync";
import { useFrozenDomains } from "./usePaneStackScales";
import type { PriceScaleMode } from "../interfaces/PriceScaleMode.interface";

/** Une échelle logarithmique propose jusqu'à neuf graduations par décade (1, 2, … 9 × 10ⁿ) : sur un
 *  long historique, l'axe et la grille en devenaient illisibles. Ne garde alors que les 1-2-5 de
 *  chaque décade, puis seulement les puissances de dix s'il en reste trop. En place sur l'échelle
 *  zoomée, la dernière copie : l'axe (ChartAxis) et la grille du canevas lisent tous deux ses `ticks`. */
function thinLogTicks(scale: d3.ScaleLinear<number, number>): d3.ScaleLinear<number, number> {
  const base = scale.ticks.bind(scale);
  scale.ticks = (count = 10) => {
    // Moins d'une décade à l'écran : d3 n'y trouve que deux ou trois valeurs (80, 90, 100, 200),
    // avec un grand vide entre 100 et 200. Des valeurs rondes à pas constant s'y lisent mieux — leur
    // position reste logarithmique, seul le choix des valeurs change.
    const [d0, d1] = scale.domain();
    const lo = Math.min(d0, d1);
    const hi = Math.max(d0, d1);
    if (lo > 0 && hi / lo < 10) return d3.ticks(lo, hi, count);
    const all = base(count);
    if (all.length <= count * 2) return all;
    const lead = (v: number) => Math.round(v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9)));
    const nice = all.filter((v) => [1, 2, 5].includes(lead(v)));
    if (nice.length <= count * 2) return nice;
    return all.filter((v) => lead(v) === 1);
  };
  return scale;
}

/** Candle indices (offset .5 to land mid-slot, matching every candle's own cx) a date axis
 *  should actually draw a tick at — thinned to at most MAX_DATE_TICKS regardless of how many
 *  candles are currently visible, and further thinned to whatever actually fits `width` at
 *  MIN_DATE_TICK_SPACING_PX per label (a narrower axis — a split-screen panel, a docked side
 *  column — needs fewer ticks long before it needs zero). Extracted out of the `dateTickValues`
 *  memo below so a `plot.pane(name, { dock: "left"|"right" })` script pane's own column
 *  (useDockedPaneColumnsState.ts) can get the exact same thinning against its own, much narrower
 *  width instead of the main plot's `dims.boundedWidth` — same `zoomedXScale` domain either way
 *  (see that hook's own leftZoomedXScale/rightZoomedXScale doc for why the *domain* is shared but
 *  the *range* isn't). Spaced from the scale's own *unclamped* domain, not a pre-clamped
 *  [0, data.length] range — see the call site below for why. */
export function computeDateTickValues(zoomedXScale: d3.ScaleLinear<number, number>, dataLength: number, width: number): number[] {
  const [i0, i1] = zoomedXScale.domain();
  const domainCount = i1 - i0;
  if (domainCount <= 0 || dataLength === 0) return [];
  const maxTicksForWidth = Math.max(2, Math.floor(width / MIN_DATE_TICK_SPACING_PX));
  const maxTicks = Math.min(MAX_DATE_TICKS, maxTicksForWidth);
  const step = Math.max(1, Math.ceil(domainCount / maxTicks));
  const values: number[] = [];
  for (let i = Math.floor(i0); i < i1; i += step) {
    const value = i + 0.5;
    if (value >= 0 && value < dataLength) values.push(value);
  }
  return values;
}

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
  /** Touch point placement owns the plot's gestures while a marker is staged (see
   *  useMobilePointPlacement) — a drag then belongs to the marker, so every pan/zoom drag is
   *  refused for the same reason `replayArmed` refuses one while a cutoff is being chosen. */
  placementActive: boolean;
  hoveredDrawingIdRef: RefObject<string | null>;
  /** Whether the pointer is currently over the measure tool's own rectangle body — same reason
   *  hoveredDrawingIdRef is checked below: kept live by useDrawingInteractions' own
   *  handlePointerMove so it's already correct by the time a *later* pointerdown needs it to
   *  decide whether to start a whole-body drag instead of this hook's own pan. */
  measureBodyHoveredRef: RefObject<boolean>;
  /** Le pointeur est sur la courbe d'un indicateur ou sur une barre de volume : le double-clic y ouvre ses
   *  paramètres (useDrawingInteractions), d3-zoom ne doit donc pas le prendre pour un zoom avant. */
  dblClickTargetRef?: RefObject<boolean>;
  /** Bars of empty room to keep on the right, past the last candle, as part of the plot itself
   *  rather than as somewhere to pan to.
   *
   *  Normally 0, and the empty-space allowance below (see MAX_EMPTY_FRACTION) is the only way into
   *  the future. It is non-zero for exactly one reason: an indicator is projecting, and a
   *  projection drawn where nobody can see it without dragging is a feature nobody will find. The
   *  slot count is fixed on purpose here — it is the projection's own horizon, not a general
   *  margin, so it should not scale with the zoom. */
  futureBars: number;
  yAutoScalingState: boolean;
  /** Échelle de l'axe des prix (voir PriceScaleMode). Seul `log` change l'échelle elle-même ; `percent`
   *  ne change que la lecture de l'axe (CandlestickChart). Défaut `linear`. */
  priceScaleMode?: PriceScaleMode;
  zoomable: boolean;
  initialVisibleCandles: number | undefined;
  /** Voir CandlestickChartProps.initialVisibleRange : la vue de départ, par dates, si l'hôte en a une. */
  initialVisibleRange?: ChartVisibleRange | null;
  /** See CandlestickChartProps.viewResetKey: a change re-applies the initial view to the new data. */
  viewResetKey?: string | number;
  /** Whether replay is currently active (a cutoff has been chosen — see useReplayState.ts's own
   *  `active`) and, if so, its `cutoffIndex` — the last candle actually revealed, everything past
   *  it still sitting in `data` but painted over by drawReplayMask.ts. `YAutoScaling`'s own auto-fit
   *  effect below caps the visible range it fits to at this cutoff so it never stretches to
   *  accommodate a masked future candle's high/low — without this, revealed history wouldn't
   *  necessarily fill the pane's full vertical space the way "hover dims, click cuts" implies it
   *  should, since a wide, still-hidden swing later in `data` (but within the current X zoom
   *  window) would otherwise still count toward the fit. Default `false`/`null` (no replay) leaves
   *  the fit exactly as before. */
  replayActive: boolean;
  replayCutoffIndex: number | null;
  /** Bumped by useReplayState on every explicit replay move (Lecture, a step, a date, a new start,
   *  « Suivre »): the auto-follow below, suspended by the user's own pan/zoom, resumes on it. */
  replayFollowKey: number;
  /** Voir CandlestickChartProps.syncedVisibleRange : la plage qu'un graphique lié vient de montrer,
   *  que celui-ci reproduit (en suiveur) dès qu'elle change. */
  syncedVisibleRange: ChartVisibleRange | null | undefined;
  /** Voir CandlestickChartProps.onVisibleRangeChange : appelé pour chaque changement de la fenêtre
   *  visible venu d'un geste de l'utilisateur sur ce graphique, jamais pour un changement appliqué
   *  par programme (vue initiale, redimensionnement, replay, synchronisation reçue). */
  onVisibleRangeChange: ((range: ChartVisibleRange) => void) | undefined;
  /** Chaque déplacement de la plage de dates mené par ce graphique (geste, molette, nombre de bougies…). */
  onXZoom?: () => void;
  /** Remet chaque sous-panneau (volume, indicateurs) sur son échelle automatique — appelé quand ce
   *  graphique suit la plage d'un autre, pour que leurs valeurs restent visibles comme les prix. */
  resetSubPaneYAxes: () => void;
  /** Marges au-dessus du plus haut et sous le plus bas visibles quand l'axe des prix s'ajuste aux bougies
   *  (fractions de l'amplitude, réglage « Toile » des paramètres). Défaut 0,08 chacune. */
  pricePadding?: { top: number; bottom: number };
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
  placementActive,
  hoveredDrawingIdRef,
  measureBodyHoveredRef,
  dblClickTargetRef,
  futureBars,
  yAutoScalingState,
  priceScaleMode = "linear",
  zoomable,
  initialVisibleCandles,
  initialVisibleRange,
  viewResetKey,
  replayActive,
  replayCutoffIndex,
  replayFollowKey,
  syncedVisibleRange,
  onVisibleRangeChange,
  onXZoom,
  resetSubPaneYAxes,
  pricePadding,
}: UseZoomAndScalesArgs) {
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  // Mirrors `transform` for the replay auto-follow effect below, which deliberately does NOT list
  // `transform` itself as a dependency (see that effect's own doc) — read via this ref instead so
  // it always sees the *current* transform without re-running on every manual pan/zoom too.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const [yTransform, setYTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  // Set the moment the user manually zooms/pans the Y axis themselves (wheel/drag on the axis,
  // or the Y component of the 2D plot-drag) — while true, `YAutoScaling` stops overwriting their
  // adjustment. Cleared by resetZoom/resetYAxis, which re-engages auto-fit.
  const [yManuallyAdjusted, setYManuallyAdjusted] = useState(false);
  // Vrai tant que ce graphique suit la plage d'un graphique lié (voir l'effet de synchronisation plus
  // bas) : l'axe des prix s'ajuste alors aux bougies visibles même si `YAutoScaling` est coupé, pour
  // que le prix reste à l'écran quoi que le meneur fasse. Retombe au premier geste de l'utilisateur
  // sur ce graphique-ci (il redevient maître de sa vue, avec son comportement habituel) ou à la remise
  // à zéro de l'axe des prix. Un réglage manuel de l'axe (`yManuallyAdjusted`) l'emporte toujours.
  const [syncFit, setSyncFit] = useState(false);
  // Incrémenté par resetZoom/resetYAxis pour relancer l'ajustement automatique du prix même quand
  // rien d'autre n'a changé (double-clic sur un axe déjà en automatique : sans lui, la remise à
  // l'identité de `yTransform` restait affichée — tout l'historique — au lieu des bougies visibles).
  const [yFitNonce, setYFitNonce] = useState(0);

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
  // `futureBars` widens the domain rather than being handled by the pan allowance, which is the
  // one exception to the paragraph above: every index — candles, drawings, indicators — maps
  // through this same scale, so widening it moves all of them together and nothing can disagree
  // about where a bar is. What it costs is a slightly narrower candle; what it buys is that the
  // projection is *there*, without a drag nobody would know to perform.
  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, Math.max(1, data.length + Math.max(0, futureBars))]).range([0, dims.boundedWidth]),
    [data.length, futureBars, dims.boundedWidth]
  );

  // Memoized: a fresh scale per render (every mouse move) cascaded into every memo keyed on it —
  // visible range, visible candles, pane scales, indicator points — and into the canvas redraw.
  const zoomedXScale = useMemo(() => transform.rescaleX(xScale), [transform, xScale]);

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
  //
  // Logarithmique (`priceScaleMode === "log"`) : une d3.scaleLog, typée comme la linéaire qu'attend
  // tout le reste du graphique — elle en a l'usage (appel, invert, domain, range, ticks, copy), et
  // `ZoomTransform.rescaleY` agit en pixels, donc le zoom et le glisser de l'axe restent justes. Pas
  // possible avec un plus bas nul ou négatif (une série qui n'est pas un cours) : linéaire alors.
  const logPrice = priceScaleMode === "log" && data.length > 0 && (d3.min(data, (d) => d.low) ?? 0) > 0;
  const priceScale = useMemo(() => {
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const min = d3.min(lows) ?? 0;
    const max = d3.max(highs) ?? 1;
    if (logPrice) {
      const f = Math.pow(max / min, 0.08) || 1.01;
      return d3.scaleLog().domain([min / f, max * f]).range([priceHeight, 0]) as unknown as d3.ScaleLinear<number, number>;
    }
    const pad = (max - min) * 0.08 || 1;
    return d3.scaleLinear().domain([min - pad, max + pad]).range([priceHeight, 0]);
  }, [data, priceHeight, logPrice]);

  // Échelle en % : la référence est la clôture de la première bougie visible (comme sur les plateformes
  // de marché), et les graduations tombent sur des % ronds (0 %, +2 %, +4 %…) au lieu de prix ronds
  // relus en % (« +3.7 % »). La comparaison de symboles garde sa propre référence et ses graduations.
  const percentReference =
    priceScaleMode === "percent" && !compareMode && data.length > 0 ? data[Math.min(data.length - 1, Math.max(0, visibleRange.start))].close : null;
  const zoomedPriceScale = useMemo(() => {
    const zoomed = yTransform.rescaleY(priceScale);
    if (logPrice) thinLogTicks(zoomed);
    if (percentReference !== null && percentReference > 0) {
      const ref = percentReference;
      const pct = (v: number) => (v / ref - 1) * 100;
      zoomed.ticks = (count = 10) => {
        const [a, b] = zoomed.domain();
        return d3.ticks(pct(Math.min(a, b)), pct(Math.max(a, b)), count).map((p) => ref * (1 + p / 100));
      };
    }
    return zoomed;
  }, [yTransform, priceScale, logPrice, percentReference]);

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
  // `syncFit` (ce graphique suit un graphique lié) force l'ajustement même avec `YAutoScaling` coupé ;
  // un réglage manuel fait depuis reste respecté.
  useEffect(() => {
    if (data.length === 0) return;
    if (!compareMode && (yManuallyAdjusted || (!yAutoScalingState && !syncFit))) return;
    // Replay reveals candles [0, cutoffIndex] — everything past that is still in `data` (see
    // useReplayState.ts's own doc on why it never slices `data`) but painted over by
    // drawReplayMask.ts, so it shouldn't count toward what the visible price window fits to.
    const fitEnd = replayActive && replayCutoffIndex !== null ? Math.min(visibleRange.end, replayCutoffIndex + 1) : visibleRange.end;
    const slice = data.slice(Math.max(0, visibleRange.start), Math.min(data.length, fitEnd));
    const source = slice.length > 0 ? slice : data;
    const highs = source.map((d) => d.high);
    const lows = source.map((d) => d.low);
    if (compareMode) {
      for (const { drawing: dr, points, haPoints, bricks } of overlayProjections) {
        if (dr.overlayDisplayMode === "heikinAshi" && haPoints) {
          for (const p of haPoints) {
            if (p.i >= visibleRange.start && p.i <= fitEnd) {
              highs.push(p.high);
              lows.push(p.low);
            }
          }
        } else if (bricks) {
          // "renko"/"lineBreak" — a brick spans a whole index *range*, not one point, so it
          // counts as visible whenever that range overlaps the visible one at all, not just when
          // its own single index would.
          for (const b of bricks) {
            if (b.endIndex >= visibleRange.start && b.startIndex <= fitEnd) {
              highs.push(Math.max(b.open, b.close));
              lows.push(Math.min(b.open, b.close));
            }
          }
        } else {
          for (const p of points) {
            if (p.i >= visibleRange.start && p.i <= fitEnd) {
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
    // Même marge de 8 %, mais en rapport sur une échelle log (elle y a alors la même hauteur en haut et en bas).
    const logFactor = logPrice && min > 0 ? Math.pow(max / min, 0.08) || 1.01 : null;
    const pad = (max - min) * 0.08 || 1;
    // Marges réglables (Toile → Marges) : sans réglage, les 8 % ci-dessus.
    const padTop = pricePadding && max > min ? (max - min) * pricePadding.top : pad;
    const padBottom = pricePadding && max > min ? (max - min) * pricePadding.bottom : pad;
    const logTop = logFactor !== null && pricePadding ? Math.pow(max / min, pricePadding.top) : logFactor;
    const logBottom = logFactor !== null && pricePadding ? Math.pow(max / min, pricePadding.bottom) : logFactor;
    const targetMin = logBottom !== null ? min / logBottom : min - padBottom;
    const targetMax = logTop !== null ? max * logTop : max + padTop;
    const denom = priceScale(targetMin) - priceScale(targetMax);
    if (denom <= 0) return;
    const k = priceHeight / denom;
    const y = -k * priceScale(targetMax);
    setYTransform(new d3.ZoomTransform(k, 0, y));
  }, [
    yAutoScalingState,
    yManuallyAdjusted,
    syncFit,
    data,
    visibleRange.start,
    visibleRange.end,
    priceScale,
    priceHeight,
    compareMode,
    overlayProjections,
    replayActive,
    replayCutoffIndex,
    yFitNonce,
    logPrice,
    pricePadding?.top,
    pricePadding?.bottom,
  ]);

  // Changer d'échelle (linéaire ↔ log) rend sans objet le réglage manuel de l'axe, fait sur l'autre
  // échelle : l'axe repart en automatique (ou sur tout l'historique si l'ajustement est coupé).
  const logPriceMountedRef = useRef(false);
  useEffect(() => {
    if (!logPriceMountedRef.current) {
      logPriceMountedRef.current = true;
      return;
    }
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
    setYFitNonce((n) => n + 1);
  }, [logPrice]);

  // Vrai tant que l'axe des prix suit les bougies visibles (voir l'effet ci-dessus) : c'est le mode
  // « automatique » de cet axe, celui que le double-clic rétablit. Faux une fois réglé à la main, ou
  // quand `YAutoScaling` est coupé (l'axe garde alors l'échelle fixe de tout l'historique).
  const priceYAuto = compareMode || (!yManuallyAdjusted && (yAutoScalingState || syncFit));

  // 10% headroom on top of the tallest bar, so it doesn't reach all the way up to the
  // price/volume divider — leaves a small visual gap between the bars and the line.
  // Ajusté aux seules bougies visibles en X (de 0 au plus haut volume visible), comme l'axe des prix :
  // calé sur tout l'historique, un seul jour de volume exceptionnel (une introduction, un
  // fractionnement) écrasait toutes les barres du reste du graphique sous un axe jusqu'à « 1B ».
  // Figé dès que l'utilisateur règle cet axe à la main (voir useFrozenDomains), rendu à
  // l'automatique par le double-clic sur l'axe (resetPaneYAxis("volume")).
  const volumeFitEnd = replayActive && replayCutoffIndex !== null ? Math.min(visibleRange.end, replayCutoffIndex + 1) : visibleRange.end;
  const volumeAutoDomain = useMemo(() => {
    let max = 0;
    const end = Math.min(data.length, volumeFitEnd);
    for (let i = Math.max(0, visibleRange.start); i < end; i++) {
      const v = data[i].volume ?? 0;
      if (v > max) max = v;
    }
    return { volume: [0, (max || 1) * 1.1] as [number, number] };
  }, [data, visibleRange.start, volumeFitEnd]);
  const volumeDomain = useFrozenDomains(volumeAutoDomain, paneYTransform).volume;
  const volumeScale = useMemo(() => d3.scaleLinear().domain(volumeDomain).range([volumeHeight, 0]), [volumeDomain, volumeHeight]);
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

  // Replay auto-follow (see the effect further down), and whether the user has taken the view away
  // from it. A pan or zoom of their own during a replay suspends it — the next revealed candle no
  // longer drags the view back to the cutoff, which is what made a drag into the past during
  // playback snap back on every tick, as if the chart could not be moved. It resumes on any
  // explicit replay move (`replayFollowKey`), « Suivre » included. State as well as ref: the header
  // shows « Suivre » only while it is suspended.
  const replayFollowRef = useRef(true);
  const [replayFollowSuspended, setReplayFollowSuspended] = useState(false);
  function suspendReplayFollow() {
    if (!replayActive || !replayFollowRef.current) return;
    replayFollowRef.current = false;
    setReplayFollowSuspended(true);
  }

  // Vrai le temps d'un `setXTransformSilently` (plus bas) : la transformation qui arrive alors dans
  // `handleZoom` vient du graphique lui-même (vue initiale, redimensionnement, replay) ou d'une
  // synchronisation reçue, pas d'un geste de l'utilisateur, et ne doit pas être annoncée. Un drapeau
  // suffit : `setXTransformViaZoom` rappelle `onZoom` de façon synchrone, avant de rendre la main.
  const silentZoomRef = useRef(false);
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  onVisibleRangeChangeRef.current = onVisibleRangeChange;
  const onXZoomRef = useRef(onXZoom);
  onXZoomRef.current = onXZoom;
  const lastReportedRangeRef = useRef<{ start: number; end: number } | null>(null);
  // La dernière transformation passée par `handleZoom`, quelle qu'en soit l'origine.
  const lastZoomRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Toute nouvelle transformation X passe par ici (geste sur le tracé, axe des dates, molette,
  // remise à zéro animée, nombre de bougies, zoom sur une zone, replay au hasard…). Hors
  // `setXTransformSilently`, c'est l'utilisateur qui vient de déplacer la vue : ce graphique mène.
  // Il cesse alors de suivre un graphique lié (`syncFit`) et annonce sa nouvelle plage de dates à
  // chaque image, sans attendre la fin du geste, pour que ceux qui le suivent glissent avec lui.
  function handleZoom(t: d3.ZoomTransform) {
    const previous = lastZoomRef.current;
    lastZoomRef.current = t;
    setTransform(t);
    if (silentZoomRef.current) {
      // La vue a bougé sans ce graphique : son prochain geste doit être annoncé même s'il le ramène
      // exactement sur la dernière plage qu'il avait annoncée (une remise à zéro, par exemple).
      lastReportedRangeRef.current = null;
      return;
    }
    // Un glisser purement vertical (dans un sous-panneau, ou sur le prix) passe aussi par d3-zoom,
    // qui rappelle `onZoom` à chaque mouvement sans rien changer en X : ce n'est pas un déplacement
    // de la plage de dates, ni une raison de cesser de suivre le groupe.
    if (t.k === previous.k && t.x === previous.x) return;
    onXZoomRef.current?.();
    if (syncFit) setSyncFit(false);
    const report = onVisibleRangeChangeRef.current;
    if (!report) return;
    const range = visibleRangeOfDomain(data, t.rescaleX(xScale).domain());
    if (!range) return;
    const start = range.start.getTime();
    const end = range.end.getTime();
    const last = lastReportedRangeRef.current;
    if (last && last.start === start && last.end === end) return;
    lastReportedRangeRef.current = { start, end };
    report(range);
  }

  const {
    ref: zoomRef,
    reset: resetX,
    setTransform: setXTransformViaZoom,
    setTransformAnimated: setXTransformAnimated,
  } = useD3Zoom<SVGRectElement>({
    width: dims.boundedWidth,
    height: plotBoundedHeight,
    enabled: zoomable && activeTool === null,
    scaleExtent: [1, maxXZoom],
    onZoom: handleZoom,
    // Wheel-zoom stays allowed even while `replayArmed` (confirmed bug report: "le scroll out/in
    // ne fonctionne pas" — zooming in to precisely target a candle before clicking its own cutoff
    // is exactly when it's most useful) — only a *drag* is rejected then, which is the actual
    // gesture that would shift the view out from under the hover-preview line while choosing.
    filter: (event: Event) =>
      (!replayArmed || event.type === "wheel") &&
      !placementActive &&
      hoveredDrawingIdRef.current === null &&
      !measureBodyHoveredRef.current &&
      // d3-zoom avale le double-clic (zoom ×2, propagation arrêtée) : sur un indicateur, il n'atteignait jamais
      // handleOverlayDoubleClick, qui ouvre ses paramètres.
      !(event.type === "dblclick" && dblClickTargetRef?.current),
    constrain: constrainXPan,
    onUserZoom: suspendReplayFollow,
  });

  // `setXTransformViaZoom` pour les changements de vue qui ne viennent pas d'un geste de
  // l'utilisateur : ils ne sont pas annoncés aux graphiques liés (voir `handleZoom`). Une plage reçue
  // d'un graphique lié passe par ici, ce qui interdit qu'elle soit renvoyée au groupe en écho.
  const setXTransformSilently = useCallback(
    (t: d3.ZoomTransform) => {
      silentZoomRef.current = true;
      try {
        setXTransformViaZoom(t);
      } finally {
        silentZoomRef.current = false;
      }
    },
    [setXTransformViaZoom]
  );

  // Replay's own auto-follow: each newly-revealed candle (`replayCutoffIndex`, advanced by
  // useReplayState.ts's own play interval) that would land at or past the currently visible
  // window's own right edge pans the chart forward just enough to bring it back into view —
  // without this, playback keeps revealing candles behind a mask edge that's already scrolled
  // past what's on screen, invisible until the user manually pans (confirmed bug report). Only
  // `x` shifts, at the same zoom level; `setXTransformViaZoom` (not raw `setTransform`) keeps
  // d3-zoom's own internally-tracked transform in sync, same reason resetZoom below uses it too.
  //
  // Deliberately keyed only on `replayCutoffIndex`/`replayActive` — reading the *current*
  // transform via transformRef rather than depending on `transform`/`zoomedXScale` themselves, so
  // a manual pan while replay is merely paused (reviewing already-revealed history) never gets
  // silently snapped back forward on its own; only an actual new reveal does.
  //
  // Skipped while the user has taken the view (see replayFollowRef); an explicit replay move bumps
  // `replayFollowKey`, which hands the view back to the follow and brings the cutoff into view now.
  const replayFollowKeyRef = useRef(replayFollowKey);
  useEffect(() => {
    if (replayFollowKeyRef.current !== replayFollowKey) {
      replayFollowKeyRef.current = replayFollowKey;
      replayFollowRef.current = true;
      setReplayFollowSuspended(false);
    }
    if (!replayActive) {
      replayFollowRef.current = true;
      setReplayFollowSuspended(false);
      return;
    }
    if (replayCutoffIndex === null || !replayFollowRef.current) return;
    const current = transformRef.current;
    const [, i1] = current.rescaleX(xScale).domain();
    const revealedEdge = replayCutoffIndex + 1;
    if (revealedEdge <= i1) return;
    const dxIndex = revealedEdge - i1;
    const dxPixels = current.k * (xScale(dxIndex) - xScale(0));
    const next = constrainXPan(new d3.ZoomTransform(current.k, current.x - dxPixels, current.y), [
      [0, 0],
      [dims.boundedWidth, plotBoundedHeight],
    ]);
    // Silencieux : c'est la lecture qui avance, pas l'utilisateur qui déplace la vue.
    setXTransformSilently(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayActive, replayCutoffIndex, replayFollowKey]);

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
      // The room kept on the right (futureBars: a projection) belongs to the opening view too — otherwise it starts
      // exactly where the last candle ends and the projection drawn there is off screen until the user pans.
      const x1 = xScale(data.length + Math.max(0, futureBars));
      if (x1 - x0 <= 0) return null;
      const k = Math.min(maxXZoom, Math.max(1, dims.boundedWidth / (x1 - x0)));
      return new d3.ZoomTransform(k, -k * x0, 0);
    },
    [dims.boundedWidth, data.length, xScale, maxXZoom, futureBars]
  );

  // The scope the chart opened at, kept as the *intent* (how many candles) rather than the pixel
  // transform that expressed it — `null` for "no initial narrowing", i.e. reset dezooms fully.
  //
  // A `d3.ZoomTransform` only means anything against the exact `xScale`/`dims.boundedWidth` it was
  // derived from: `k` and `x` are pixel quantities. Store one at mount and it silently rots the
  // moment either changes — the plot getting wider or narrower (opening the script editor, dragging
  // a workspace panel, resizing the window — the same class of change the width-preservation effect
  // below exists for), or `data.length` changing under a symbol/timeframe switch. Reset would then
  // still animate somewhere confidently, just to a set of candles nobody asked for: replaying a
  // 500-candle-wide transform captured at 600px onto a 1000px plot of 2976 candles lands on
  // 1486→1986 instead of 2476→2976. Recomputing from the current scale at reset time is
  // width- and length-independent by construction.
  const initialVisibleCountRef = useRef<number | null>(null);

  // Applied once, the first time the plot has a real measured width (and the zoom behavior
  // above is attached) — not on every resize, which would otherwise keep yanking the user back
  // to the last-N-candles view whenever the window changes size.
  const initialViewAppliedRef = useRef(false);
  // `viewResetKey` changed (the host swapped `data` in place — a timeframe or symbol switch): the
  // current transform is pixel math against the *previous* dataset and would now frame an arbitrary
  // stretch of the new one, so start over from the whole dataset and let the effect below apply the
  // initial scope again — exactly what a remount would have done, minus losing everything else.
  // Declared before that effect so it runs first in the same commit.
  const viewResetKeyRef = useRef(viewResetKey);
  useEffect(() => {
    if (viewResetKeyRef.current === viewResetKey) return;
    viewResetKeyRef.current = viewResetKey;
    initialViewAppliedRef.current = false;
    initialVisibleCountRef.current = null;
    setXTransformSilently(d3.zoomIdentity);
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
  }, [viewResetKey, setXTransformSilently]);
  // Lue au moment où la vue initiale s'applique (pas une dépendance : une nouvelle plage enregistrée
  // par l'hôte à chaque geste ne doit pas ramener la vue en arrière).
  const initialVisibleRangeRef = useRef(initialVisibleRange);
  initialVisibleRangeRef.current = initialVisibleRange;
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    if (dims.boundedWidth <= 0 || data.length === 0) return;
    initialViewAppliedRef.current = true;
    // Vue enregistrée par l'hôte (rechargement de la page, retour sur ce symbole) : ses dates d'abord.
    const saved = initialVisibleRangeRef.current;
    if (saved) {
      const first = data[0]!.date.getTime();
      const last = data[data.length - 1]!.date.getTime();
      const inData = saved.end.getTime() >= first && saved.start.getTime() <= last && saved.end.getTime() > saved.start.getTime();
      const restored = inData
        ? transformForVisibleRange({
            data,
            range: saved,
            xScale,
            width: dims.boundedWidth,
            maxZoom: maxXZoom,
            constrain: (t) =>
              constrainXPan(t, [
                [0, 0],
                [dims.boundedWidth, plotBoundedHeight],
              ]),
          })
        : null;
      if (restored) {
        setXTransformSilently(restored);
        return;
      }
    }
    if (!initialVisibleCandles || initialVisibleCandles <= 0 || initialVisibleCandles >= data.length) return;

    const t = transformForVisibleCount(initialVisibleCandles);
    if (!t) return;
    initialVisibleCountRef.current = initialVisibleCandles;
    setXTransformSilently(t);
  }, [dims.boundedWidth, data.length, initialVisibleCandles, transformForVisibleCount, setXTransformSilently, viewResetKey]);

  // Preserves whatever candle range was actually visible across a *width* change — e.g. dragging
  // ChartWorkspace's own watchlist panel wider/narrower shrinks/grows this chart's own
  // dims.boundedWidth as a flex sibling, same as the tools rail/side panel toggling does. Without
  // this, `transform` (a fixed pixel scale/translate) stays byte-for-byte the same while the pixel
  // space it's applied to changes size — the exact same k/x then silently maps to a *different*
  // set of candles the instant boundedWidth is different, which read as the chart panning/zooming
  // on its own while only the panel was being dragged (exigence : « le contenu de la chart qui se
  // déplace quand je resize le panneau de droite »). Recomputes a fresh transform that keeps the
  // *same* [i0, i1] domain on screen under the new width, via the identical derivation
  // `transformForVisibleCount` already uses for its own "exactly N candles, flush right" case —
  // just anchored to whatever the previous domain actually was instead of always the dataset's own
  // last N. Gated on `initialViewAppliedRef` so it never fights that effect's own first-ever
  // width measurement; the `prevWidth === dims.boundedWidth` guard makes every other dependency
  // change (panning/zooming also touches `transform`) a harmless no-op run rather than something
  // that needs excluding from the dependency list.
  const prevBoundedWidthRef = useRef(dims.boundedWidth);
  useEffect(() => {
    const prevWidth = prevBoundedWidthRef.current;
    prevBoundedWidthRef.current = dims.boundedWidth;
    if (!initialViewAppliedRef.current) return;
    if (prevWidth <= 0 || dims.boundedWidth <= 0 || prevWidth === dims.boundedWidth || data.length === 0) return;

    const oldXScale = d3.scaleLinear().domain([0, Math.max(1, data.length)]).range([0, prevWidth]);
    const [i0, i1] = transform.rescaleX(oldXScale).domain();
    const x0 = xScale(i0);
    const x1 = xScale(i1);
    if (x1 - x0 <= 0) return;
    const k = Math.min(maxXZoom, Math.max(1, dims.boundedWidth / (x1 - x0)));
    // Silencieux : la plage de dates ne change pas, seule la largeur qui la montre.
    setXTransformSilently(new d3.ZoomTransform(k, -k * x0, 0));
  }, [dims.boundedWidth, data.length, xScale, maxXZoom, transform, setXTransformSilently]);

  // Synchronisation reçue d'un graphique lié (voir CandlestickChartProps.syncedVisibleRange) : chaque
  // nouvelle plage est reproduite ici, calée par date sur les bougies de ce graphique (voir
  // `transformForVisibleRange` pour ce qui se passe quand ses données ne couvrent pas la plage), puis
  // l'axe des prix et ceux des sous-panneaux reviennent en ajustement automatique sur les bougies
  // visibles — réglage manuel compris, et même `YAutoScaling` coupé (`syncFit`) — pour que le prix
  // reste toujours à l'écran. Appliquée en silence : jamais renvoyée au groupe.
  //
  // Déclaré après la vue initiale et le maintien de largeur pour passer après eux dans le même
  // commit : un graphique monté (ou rechargé par `viewResetKey`) au milieu d'un groupe déjà déplacé
  // rejoint la plage du groupe au lieu de garder sa vue de départ. Volontairement relancé seulement
  // quand la plage change, quand le graphique devient affichable ou quand ses données sont
  // remplacées (`viewResetKey`) — pas à chaque nouvelle bougie ou nouvelle largeur, que les effets
  // ci-dessus gèrent déjà sans changer les dates montrées.
  const syncStartMs = syncedVisibleRange ? syncedVisibleRange.start.getTime() : null;
  const syncEndMs = syncedVisibleRange ? syncedVisibleRange.end.getTime() : null;
  const syncReady = data.length > 0 && dims.boundedWidth > 0;
  const resetSubPaneYAxesRef = useRef(resetSubPaneYAxes);
  resetSubPaneYAxesRef.current = resetSubPaneYAxes;
  useEffect(() => {
    if (syncStartMs === null || syncEndMs === null || !syncReady) return;
    const next = transformForVisibleRange({
      data,
      range: { start: new Date(syncStartMs), end: new Date(syncEndMs) },
      xScale,
      width: dims.boundedWidth,
      maxZoom: maxXZoom,
      constrain: (t) =>
        constrainXPan(t, [
          [0, 0],
          [dims.boundedWidth, plotBoundedHeight],
        ]),
    });
    if (!next) return;
    setXTransformSilently(next);
    setYManuallyAdjusted(false);
    setSyncFit(true);
    resetSubPaneYAxesRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStartMs, syncEndMs, syncReady, viewResetKey]);

  const xAxisDrag = useAxisDragRescale({
    axis: "x",
    size: dims.boundedWidth,
    transform,
    // The date axis strip is the user moving the view too — same suspension as a plot gesture.
    onChange: (t) => {
      suspendReplayFollow();
      setXTransformViaZoom(t);
    },
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
    onChange: (t) => {
      suspendReplayFollow();
      setXTransformViaZoom(t);
    },
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

  // Deliberately targets this chart's own INITIAL scope (`initialVisibleCountRef`), not `resetX()`
  // (which would always dezoom all the way out to the full dataset) — the "loupe -" button is
  // meant to undo the user's own zooming/panning, not discard the scope the chart opened with.
  //
  // While replay is active, that initial scope means nothing — it was computed against the whole
  // dataset, most of which is still masked — so this targets the *revealed* candles instead
  // ([0, cutoffIndex], flush left, filling the width) exactly like the confirmed bug report asked:
  // "le zoom rescale la chart en fonction des bougies qu'affiche le mode replay". Same
  // fit-to-width math `transformForVisibleCount` below uses, just anchored to the dataset's own
  // start instead of a fixed candle count counted back from its end.
  function resetZoom() {
    // Recomputed here, never replayed from mount — see initialVisibleCountRef's own doc.
    const count = initialVisibleCountRef.current;
    let target = (count === null ? null : transformForVisibleCount(count)) ?? d3.zoomIdentity;
    if (replayActive && replayCutoffIndex !== null && dims.boundedWidth > 0) {
      const x0 = xScale(0);
      const x1 = xScale(replayCutoffIndex + 1);
      if (x1 - x0 > 0) {
        const k = Math.min(maxXZoom, Math.max(1, dims.boundedWidth / (x1 - x0)));
        target = new d3.ZoomTransform(k, -k * x0, 0);
      }
    }
    setXTransformAnimated(target);
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
    setSyncFit(false);
    setYFitNonce((n) => n + 1);
  }

  // Space bar — same effect as clicking the "loupe -" toolbar button, the way a video player's own
  // spacebar shortcut stands in for a visible button rather than introducing a separate concept.
  // Skipped while a text input has focus (typing a space in the script editor or a symbol-search
  // box shouldn't also reset the zoom), same guard/reasoning usePaneLayout's own Ctrl/Cmd+C/V
  // shortcut already uses. `e.preventDefault()` both to stop the page's own default space-scrolls-
  // down behavior and (a focused button/checkbox) space-activates-it behavior from also firing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const active = document.activeElement;
      const isEditableFocused = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isEditableFocused) return;
      e.preventDefault();
      resetZoom();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function setVisibleCandleCount(count: number) {
    const t = transformForVisibleCount(count);
    if (t) setXTransformAnimated(t);
  }

  /** Boutons de navigation : zoom en X d'un facteur (> 1 rapproche), le bord droit du tracé restant en place. */
  function zoomXBy(factor: number) {
    const current = transformRef.current;
    const w = dims.boundedWidth;
    if (w <= 0) return;
    const k = Math.min(maxXZoom, Math.max(1, current.k * factor));
    if (k === current.k) return;
    const x = w - ((w - current.x) * k) / current.k;
    setXTransformAnimated(constrainXPan(new d3.ZoomTransform(k, x, current.y), [[0, 0], [w, plotBoundedHeight]]));
  }

  /** Boutons de navigation : fait défiler la vue de `bars` bougies (positif : vers les plus récentes). */
  function scrollXBy(bars: number) {
    const current = transformRef.current;
    const w = dims.boundedWidth;
    if (w <= 0) return;
    const dx = bars * current.k * (xScale(1) - xScale(0));
    setXTransformAnimated(constrainXPan(new d3.ZoomTransform(current.k, current.x - dx, current.y), [[0, 0], [w, plotBoundedHeight]]));
  }

  /** Double-clic sur l'axe des prix : le rend à l'automatique — il suit de nouveau les bougies
   *  visibles à chaque déplacement en X (et pas un simple recalage unique). `YAutoScaling` coupé, il
   *  revient sur l'échelle fixe de tout l'historique. */
  function resetYAxis() {
    setYTransform(d3.zoomIdentity);
    setYManuallyAdjusted(false);
    setSyncFit(false);
    setYFitNonce((n) => n + 1);
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
  const dateTickValues = useMemo(
    () => computeDateTickValues(zoomedXScale, data.length, dims.boundedWidth),
    [zoomedXScale, data.length, dims.boundedWidth]
  );

  return {
    transform,
    setTransform,
    yTransform,
    setYTransform,
    yManuallyAdjusted,
    setYManuallyAdjusted,
    priceYAuto,
    percentReference,
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
    zoomXBy,
    scrollXBy,
    resetYAxis,
    zoomedSlotCount,
    candleWidth,
    dateTickValues,
    replayFollowSuspended,
  };
}
