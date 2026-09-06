import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import type { IndicatorBand } from "./interfaces/IndicatorBand.interface";
import type { IndicatorMACD } from "./interfaces/IndicatorMACD.interface";
import type { IndicatorADXPoint } from "./interfaces/IndicatorADXPoint.interface";
import type { IndicatorChandelierPoint } from "./interfaces/IndicatorChandelierPoint.interface";
import type { IndicatorIchimokuPoint } from "./interfaces/IndicatorIchimokuPoint.interface";
import type { IndicatorSRLevel } from "./interfaces/IndicatorSRLevel.interface";
import type { IndicatorPivotPointsPoint } from "./interfaces/IndicatorPivotPointsPoint.interface";
import type { IndicatorSupertrendPoint } from "./interfaces/IndicatorSupertrendPoint.interface";
import type { IndicatorZigZagPoint } from "./interfaces/IndicatorZigZagPoint.interface";
import type { IndicatorGapPoint } from "./interfaces/IndicatorGapPoint.interface";
import type { IndicatorPatternMatch } from "./interfaces/IndicatorPatternMatch.interface";
import type { IndicatorCandleMatch } from "./interfaces/IndicatorCandleMatch.interface";
import { indicatorCatalogEntry } from "./indicatorCatalog";
import { FIBONACCI_LEVELS, FIBONACCI_EXTENSION_LEVELS } from "./drawingCatalog";

/** Priority tiers. When two labels would overlap on screen, the higher tier survives and the
 *  lower one is dropped entirely (see `resolveAxisLabelCollisions`) — so these encode "which
 *  number would I least want to lose while zoomed out", not merely visual importance.
 *
 *  DEFINING is for the values a shape is *made of* and cannot be read back without: a line's own
 *  two endpoints, Fibonacci's 0% and 100% anchors (every other level is interpolated between
 *  them), an indicator's principal line. DERIVED is for everything computed from those — the
 *  intermediate Fib ratios, a band's edges around its middle, a pivot's R/S levels around the
 *  pivot itself. */
export const AXIS_LABEL_PRIORITY_DEFINING = 100;
export const AXIS_LABEL_PRIORITY_DERIVED = 50;

/** One label to place against an axis, in *data* space — the renderer owns the scales, so
 *  nothing here needs to know a pixel. */
export interface AxisLabel {
  /** Unique within its own axis; also the React key. */
  key: string;
  /** Y labels: a value on `valueAxis`'s own scale (a price, a volume, an RSI reading…).
   *  X labels: a bar index into `data` — fractional is fine, the renderer centres on the bar. */
  at: number;
  /** Short name shown ahead of the formatted value ("0.618", "R1", "Tenkan"). Omitted for a
   *  label whose value speaks for itself, like a plain trend line's own endpoint. */
  label?: string;
  /** Overrides the axis' own formatter entirely. Only for values that are not in the axis' own
   *  units — nothing uses it today, but a ratio or a percentage plotted against price would. */
  text?: string;
  priority: number;
}

/** Everything a selected drawing or indicator wants shown on the two axes. Bands are not stored:
 *  they are always "between the extreme labels on that axis", derived at render time, so they
 *  cannot drift out of sync with the labels they bracket (see `axisLabelBand`). */
export interface AxisAnnotations {
  /** Which pane's value scale `y[].at` is expressed in — "price" (the default), "volume", or an
   *  own-pane indicator's own id, exactly the vocabulary `TrendLineDrawing.valueAxis` already
   *  uses and `paneScaleAndOffset` already resolves. */
  valueAxis: string;
  y: AxisLabel[];
  x: AxisLabel[];
  /** The selection's own colour, so its labels read as belonging to it rather than to the
   *  theme's accent. Undefined falls back to the accent in CSS. */
  color?: string;
}

/** The span an axis' own shaded band should cover, or `null` when there is nothing to bracket.
 *
 *  One label never makes a band: the user's own SMA case — a single value on the price axis has
 *  no second edge, and shading from it to *anywhere* would invent a range the indicator does not
 *  have. Two or more, and the band spans the extremes (not each consecutive pair), so Fibonacci's
 *  eleven levels read as one range rather than ten stripes.
 *
 *  Collision-hidden labels are deliberately still counted by the caller: the band describes the
 *  selection's real extent, and letting it shrink because a label happened to be dropped while
 *  zoomed out would make the shaded region lie about the shape. */
export function axisLabelBand(labels: AxisLabel[]): { from: number; to: number } | null {
  if (labels.length < 2) return null;
  let from = labels[0].at;
  let to = labels[0].at;
  for (const l of labels) {
    if (l.at < from) from = l.at;
    if (l.at > to) to = l.at;
  }
  return from === to ? null : { from, to };
}

/** Decides which labels survive when their on-screen positions collide — the zoomed-out case,
 *  where a shape's own labels converge until they overlap into an unreadable pile.
 *
 *  Greedy by priority: the most important label is placed first and always survives, then each
 *  next-most-important one is placed only if it clears everything already standing by `minGap`.
 *  A dropped label is dropped outright rather than nudged aside, because a label on an axis is
 *  read as *a position* first — pushing it to a free slot would keep the number right while
 *  making its height or date wrong, which is the one failure mode worse than not showing it.
 *
 *  Ties break on the order given, so a shape listing its labels in a natural order (0% before
 *  100%, top of the band before the bottom) gets a stable, predictable survivor set rather than
 *  one that flickers between renders.
 *
 *  @param positions Pixel centre of each label, index-aligned with `labels`.
 *  @param sizes Pixel extent of each label along the axis — its height on the value axis, its
 *    width on the date axis, where labels differ in width and a single gap would be wrong for
 *    both a short "12:00" and a long "3 sept. 2026". Two labels clash when their half-extents
 *    overlap, which is exactly when their boxes would.
 *  @returns A visibility flag per label, index-aligned with the input. */
export function resolveAxisLabelCollisions(labels: AxisLabel[], positions: number[], sizes: number[]): boolean[] {
  const visible = labels.map(() => false);
  const order = labels.map((l, i) => ({ i, priority: l.priority })).sort((a, b) => b.priority - a.priority || a.i - b.i);
  const placed: { pos: number; size: number }[] = [];
  for (const { i } of order) {
    const pos = positions[i];
    if (!Number.isFinite(pos)) continue;
    const size = sizes[i];
    if (placed.some((p) => Math.abs(p.pos - pos) < (p.size + size) / 2)) continue;
    placed.push({ pos, size });
    visible[i] = true;
  }
  return visible;
}

function label(key: string, at: number, priority: number, name?: string): AxisLabel | null {
  // A shape whose own point is missing (an indicator series that has not started yet, a band edge
  // an early bar has no value for) contributes nothing rather than a label reading "NaN".
  return Number.isFinite(at) ? { key, at, priority, label: name } : null;
}

function compact(labels: (AxisLabel | null)[]): AxisLabel[] {
  return labels.filter((l): l is AxisLabel => l !== null);
}

/** Bar index of a date, for placing X labels. Mirrors the chart's own `indexForDate`. */
export type IndexForDate = (date: Date) => number;

/** Whether a drawing spans the plot's full width by construction, and so has nothing worth
 *  labelling on the date axis — the user's own SMA rule, applied to drawings: a shape with no
 *  start and no end of its own would only ever put the chart's own first and last dates on the
 *  axis, which the axis already shows. */
function spansFullWidth(dr: TrendLineDrawing): boolean {
  return dr.lineType === "horizontal" || dr.lineType === "symbolOverlay";
}

/** Every point a drawing is actually made of, in click order — x1/y1, x2/y2, then `extraPoints`.
 *  Single-point tools mirror x2/y2 onto x1/y1 by convention (see `TrendLineDrawing.lineType`), so
 *  they are de-duplicated here rather than labelled twice at the same spot. */
function drawingPoints(dr: TrendLineDrawing): { x: Date; y: number }[] {
  const points = [{ x: dr.x1, y: dr.y1 }];
  const mirrored = dr.x2.getTime() === dr.x1.getTime() && dr.y2 === dr.y1;
  if (!mirrored) points.push({ x: dr.x2, y: dr.y2 });
  for (const p of dr.extraPoints ?? []) points.push(p);
  return points;
}

/** The axis labels a selected drawing asks for.
 *
 *  Deliberately driven by the drawing's own points rather than a per-tool table: a shape is
 *  defined by where its handles are, so labelling exactly those is both correct for all 38 tools
 *  and automatically right for one added later. Only the tools whose geometry is *not* its
 *  handles get their own branch below — a Fibonacci's levels are interpolated rather than
 *  clicked, and an axis-constrained line deliberately has no meaningful second coordinate. */
export function drawingAxisAnnotations(dr: TrendLineDrawing, indexForDate: IndexForDate): AxisAnnotations {
  const valueAxis = dr.valueAxis && dr.valueAxis !== "price" ? dr.valueAxis : "price";
  const base: Omit<AxisAnnotations, "y" | "x"> = { valueAxis, color: dr.color };

  // Fibonacci: y1 is the 0% anchor and y2 the 100% anchor, every other level interpolated between
  // them (matching drawFibonacci's own convention). The two anchors are DEFINING — lose them and
  // the tool cannot be read at all — while the ratios between are DERIVED, so a zoomed-out
  // retracement collapses to its own two ends rather than to an arbitrary middle pair.
  if (dr.lineType === "fibonacci" || dr.lineType === "fibonacciExtension") {
    const isExtension = dr.lineType === "fibonacciExtension";
    const levels = isExtension ? FIBONACCI_EXTENSION_LEVELS : FIBONACCI_LEVELS;
    // Both price formulas are lifted from drawPriceDrawings' own level loops rather than
    // re-derived, so an axis label can never disagree with the line it is pointing at: a
    // retracement measures its own y1-y2 leg from y1, an extension re-applies that same leg from
    // its third point (extraPoints[0], the "C" click).
    const legDelta = dr.y2 - dr.y1;
    const anchor = isExtension ? dr.extraPoints?.[0]?.y : dr.y1;
    const y =
      anchor === undefined
        ? []
        : compact(
            levels.map((ratio) =>
              label(
                `fib-${ratio}`,
                anchor + legDelta * ratio,
                // 0 and 1 are the anchors the whole tool is built from — every other level is
                // interpolated between them — so a zoomed-out retracement collapses to its own
                // two ends rather than to whichever middle pair happened to be listed first.
                ratio === 0 || ratio === 1 ? AXIS_LABEL_PRIORITY_DEFINING : AXIS_LABEL_PRIORITY_DERIVED,
                `${(ratio * 100).toFixed(1)}%`,
              ),
            ),
          );
    const x = compact(drawingPoints(dr).map((p, i) => label(`fib-x-${i}`, indexForDate(p.x), AXIS_LABEL_PRIORITY_DEFINING)));
    return { ...base, y, x };
  }

  // A vertical line has no price of its own (it spans the whole height); a horizontal one has no
  // date of its own (it spans the whole width). Each contributes to exactly one axis.
  if (dr.lineType === "vertical") {
    return { ...base, y: [], x: compact([label("v-x", indexForDate(dr.x1), AXIS_LABEL_PRIORITY_DEFINING)]) };
  }
  if (dr.lineType === "horizontal") {
    return { ...base, y: compact([label("h-y", dr.y1, AXIS_LABEL_PRIORITY_DEFINING)]), x: [] };
  }

  // A comparison overlay's own x1/y1/x2/y2 are placeholders (see `TrendLineDrawing.overlayData`)
  // — nothing reads them, its real series is rebased from `overlayData` — so labelling them would
  // put two prices on the axis matching no line on screen. Better to annotate nothing.
  if (dr.lineType === "symbolOverlay") return { ...base, y: [], x: [] };

  const points = drawingPoints(dr);

  // A freehand stroke keeps every sampled point, none of them a handle anyone placed. Labelling
  // all of them would be noise; what the stroke actually occupies is its own extent.
  if (dr.lineType === "brush" && points.length > 2) {
    const prices = points.map((p) => p.y);
    const indices = points.map((p) => indexForDate(p.x));
    return {
      ...base,
      y: compact([
        label("brush-hi", Math.max(...prices), AXIS_LABEL_PRIORITY_DEFINING),
        label("brush-lo", Math.min(...prices), AXIS_LABEL_PRIORITY_DEFINING),
      ]),
      x: compact([
        label("brush-xs", Math.min(...indices), AXIS_LABEL_PRIORITY_DEFINING),
        label("brush-xe", Math.max(...indices), AXIS_LABEL_PRIORITY_DEFINING),
      ]),
    };
  }

  const y = compact(points.map((p, i) => label(`y-${i}`, p.y, AXIS_LABEL_PRIORITY_DEFINING)));
  const x = spansFullWidth(dr) ? [] : compact(points.map((p, i) => label(`x-${i}`, indexForDate(p.x), AXIS_LABEL_PRIORITY_DEFINING)));
  return { ...base, y, x };
}

/* ── Indicators ─────────────────────────────────────────────────────────────────────────────
 *
 * Two rules decide everything below, both taken straight from the user-facing spec:
 *
 *  1. The Y axis gets the indicator's values *as of the last revealed bar* — its "closing"
 *     reading — one label per series it actually draws. Not per series it computes: Chandelier
 *     Exit computes both stops every bar but only ever strokes the active one (see
 *     drawPriceCandles' own `strokeStop`), and labelling the invisible one would put a number on
 *     the axis with no line to belong to.
 *
 *  2. The X axis gets labels only from an indicator with a real start and end of its own. A
 *     moving average runs the full width of the chart, so its date labels could only ever repeat
 *     the axis' own first and last ticks. Pattern matches, gaps and pivot periods are genuinely
 *     bounded, and those do get dates.
 */

function isBand(v: IndicatorValue): v is IndicatorBand {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "upper" in v && "middle" in v && "lower" in v;
}
function isMACD(v: IndicatorValue): v is IndicatorMACD {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "macd" in v;
}
function isADX(v: IndicatorValue): v is IndicatorADXPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "adx" in v;
}
function isChandelier(v: IndicatorValue): v is IndicatorChandelierPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "longStop" in v;
}
function isIchimoku(v: IndicatorValue): v is IndicatorIchimokuPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "conversion" in v;
}
function isPivot(v: IndicatorValue): v is IndicatorPivotPointsPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "pp" in v;
}
function isSupertrend(v: IndicatorValue): v is IndicatorSupertrendPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "trend" in v && "value" in v;
}
function isZigZag(v: IndicatorValue): v is IndicatorZigZagPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "price" in v && "kind" in v;
}
function isGap(v: IndicatorValue): v is IndicatorGapPoint {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "top" in v && "bottom" in v;
}
function isPattern(v: IndicatorValue): v is IndicatorPatternMatch {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "startIndex" in v && "points" in v;
}
function isCandleMatch(v: IndicatorValue): v is IndicatorCandleMatch {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "spanIndex" in v;
}
function isMultiSeries(v: IndicatorValue): v is { multi: Record<string, number | IndicatorBand | null> } {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "multi" in v;
}

/** The indicator's own value on the last bar it has one for, at or before `lastIndex`.
 *
 *  Searching backwards rather than reading `values[lastIndex]` matters for two independent
 *  reasons: a forward-filled series can be `null` on its most recent bars (an indicator whose
 *  own warm-up has not finished), and a *sparse* one (ZigZag's confirmed pivots) only ever has a
 *  value on the handful of bars it fired on. Both want "the latest reading that exists". */
function latestValue(values: (IndicatorValue | null)[], lastIndex: number): { value: IndicatorValue; index: number } | null {
  for (let i = Math.min(lastIndex, values.length - 1); i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) return { value: v, index: i };
  }
  return null;
}

/** Every bar carrying a value at or before `lastIndex`, newest first — the sparse "this fired
 *  here" indicators (gaps, pattern matches, candle matches), which annotate every occurrence
 *  rather than only their latest. Newest first so priority can fall off with age below, letting
 *  collision resolution surface the recent ones when a zoomed-out chart cannot fit them all. */
function occurrences(values: (IndicatorValue | null)[], lastIndex: number): { value: IndicatorValue; index: number }[] {
  const out: { value: IndicatorValue; index: number }[] = [];
  for (let i = Math.min(lastIndex, values.length - 1); i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) out.push({ value: v, index: i });
  }
  return out;
}

/** Priority for the nth-most-recent occurrence of a repeating indicator. Stays strictly above
 *  DERIVED for the newest few so a gap's own edges outrank, say, a Bollinger band's shoulder in
 *  a shared pane, then decays — the ordering collision resolution needs, without a cliff. */
function recencyPriority(rank: number): number {
  return AXIS_LABEL_PRIORITY_DEFINING - rank;
}

/** The axis labels a selected indicator asks for. `lastIndex` is the last *revealed* bar — under
 *  replay that is the cutoff, not `data.length - 1`, for exactly the reason the last-close badge
 *  takes the same care: printing a value computed from hidden candles would hand back what the
 *  replay is deliberately withholding. */
export function indicatorAxisAnnotations(
  indicator: Indicator,
  values: (IndicatorValue | null)[],
  lastIndex: number,
  color: string | undefined,
): AxisAnnotations {
  const entry = indicatorCatalogEntry(indicator);
  // An own-pane indicator's numbers belong on that pane's own scale, addressed by its id —
  // exactly the vocabulary a drawing's `valueAxis` already uses, so the renderer needs no second
  // resolution path for indicators.
  const valueAxis = entry.pane === "own" ? indicator.id : "price";
  const base: Omit<AxisAnnotations, "y" | "x"> = { valueAxis, color };
  const empty = { ...base, y: [], x: [] };
  if (values.length === 0) return empty;

  // ── Sparse, bounded indicators: every occurrence gets both its prices and its own date span.
  const first = latestValue(values, lastIndex);
  if (first === null) return empty;

  if (isGap(first.value)) {
    const y: AxisLabel[] = [];
    const x: AxisLabel[] = [];
    occurrences(values, lastIndex).forEach((o, rank) => {
      if (!isGap(o.value)) return;
      const p = recencyPriority(rank);
      y.push(...compact([label(`gap-t-${o.index}`, o.value.top, p), label(`gap-b-${o.index}`, o.value.bottom, p)]));
      x.push(...compact([label(`gap-xs-${o.index}`, o.index, p), label(`gap-xe-${o.index}`, o.value.endIndex, p)]));
    });
    return { ...base, y, x };
  }

  if (isPattern(first.value)) {
    const y: AxisLabel[] = [];
    const x: AxisLabel[] = [];
    occurrences(values, lastIndex).forEach((o, rank) => {
      if (!isPattern(o.value) || o.value.points.length === 0) return;
      const p = recencyPriority(rank);
      // A pattern's own vertices can be a dozen points; its two price extremes are what the
      // shape actually occupies, and are what a band between them should bracket.
      const prices = o.value.points.map((pt) => pt.price);
      y.push(
        ...compact([
          label(`pat-hi-${o.index}`, Math.max(...prices), p, o.value.label),
          label(`pat-lo-${o.index}`, Math.min(...prices), p),
        ]),
      );
      x.push(...compact([label(`pat-xs-${o.index}`, o.value.startIndex, p), label(`pat-xe-${o.index}`, o.value.endIndex, p)]));
    });
    return { ...base, y, x };
  }

  if (isCandleMatch(first.value)) {
    // A candlestick pattern marks bars, not a price level — it has a date span and nothing
    // meaningful to put on the value axis, so it annotates one axis only. The mirror image of a
    // moving average, which annotates the other.
    const x: AxisLabel[] = [];
    occurrences(values, lastIndex).forEach((o, rank) => {
      if (!isCandleMatch(o.value)) return;
      const p = recencyPriority(rank);
      x.push(...compact([label(`cdl-xs-${o.index}`, o.value.spanIndex, p, o.value.label), label(`cdl-xe-${o.index}`, o.value.index, p)]));
    });
    return { ...base, y: [], x };
  }

  // ── Dense indicators: the latest reading of each series it draws, on the value axis only.
  const v = first.value;

  if (Array.isArray(v)) {
    // Support/resistance: horizontal levels running to the right edge, so they are the
    // `horizontal` drawing's case exactly — a value each, no dates. A level touched more often is
    // the one to keep when they crowd together.
    const levels = v as IndicatorSRLevel[];
    const maxTouches = Math.max(1, ...levels.map((l) => l.touchCount));
    return {
      ...base,
      y: compact(levels.map((l, i) => label(`sr-${i}`, l.price, AXIS_LABEL_PRIORITY_DERIVED + (l.touchCount / maxTouches) * AXIS_LABEL_PRIORITY_DERIVED))),
      x: [],
    };
  }

  if (isBand(v)) {
    return {
      ...base,
      y: compact([
        label("band-m", v.middle, AXIS_LABEL_PRIORITY_DEFINING),
        label("band-u", v.upper, AXIS_LABEL_PRIORITY_DERIVED),
        label("band-l", v.lower, AXIS_LABEL_PRIORITY_DERIVED),
      ]),
      x: [],
    };
  }

  if (isMACD(v)) {
    // The histogram is deliberately left out: it is macd minus signal, already the *distance*
    // between two labels this puts on the axis, and a third badge for it would crowd a narrow
    // pane with a number the other two already state.
    return {
      ...base,
      y: compact([
        label("macd", v.macd, AXIS_LABEL_PRIORITY_DEFINING, "MACD"),
        v.signal === null ? null : label("macd-s", v.signal, AXIS_LABEL_PRIORITY_DERIVED, "Signal"),
      ]),
      x: [],
    };
  }

  if (isADX(v)) {
    return {
      ...base,
      y: compact([
        label("adx", v.adx, AXIS_LABEL_PRIORITY_DEFINING, "ADX"),
        label("adx-p", v.plusDI, AXIS_LABEL_PRIORITY_DERIVED, "+DI"),
        label("adx-m", v.minusDI, AXIS_LABEL_PRIORITY_DERIVED, "−DI"),
      ]),
      x: [],
    };
  }

  if (isChandelier(v)) {
    // Only the stop matching `dir` is ever stroked (drawPriceCandles' own `strokeStop`), so only
    // that one is labelled — the other is computed but invisible.
    return { ...base, y: compact([label("ce", v.dir === 1 ? v.longStop : v.shortStop, AXIS_LABEL_PRIORITY_DEFINING)]), x: [] };
  }

  if (isIchimoku(v)) {
    return {
      ...base,
      y: compact([
        label("ich-c", v.conversion ?? NaN, AXIS_LABEL_PRIORITY_DEFINING, "Tenkan"),
        label("ich-b", v.base ?? NaN, AXIS_LABEL_PRIORITY_DEFINING, "Kijun"),
        label("ich-a", v.spanA ?? NaN, AXIS_LABEL_PRIORITY_DERIVED, "Senkou A"),
        label("ich-sb", v.spanB ?? NaN, AXIS_LABEL_PRIORITY_DERIVED, "Senkou B"),
        label("ich-ch", v.chikou ?? NaN, AXIS_LABEL_PRIORITY_DERIVED, "Chikou"),
      ]),
      x: [],
    };
  }

  if (isPivot(v)) {
    // Pivot levels are recomputed per period, so this one set is bounded in time: it starts at
    // its own `periodStart` and runs to the last revealed bar.
    return {
      ...base,
      y: compact([
        label("pp", v.pp, AXIS_LABEL_PRIORITY_DEFINING, "PP"),
        label("pp-r1", v.r1, AXIS_LABEL_PRIORITY_DERIVED, "R1"),
        label("pp-r2", v.r2, AXIS_LABEL_PRIORITY_DERIVED, "R2"),
        label("pp-r3", v.r3, AXIS_LABEL_PRIORITY_DERIVED, "R3"),
        label("pp-s1", v.s1, AXIS_LABEL_PRIORITY_DERIVED, "S1"),
        label("pp-s2", v.s2, AXIS_LABEL_PRIORITY_DERIVED, "S2"),
        label("pp-s3", v.s3, AXIS_LABEL_PRIORITY_DERIVED, "S3"),
      ]),
      x: compact([label("pp-xs", v.periodStart, AXIS_LABEL_PRIORITY_DEFINING), label("pp-xe", first.index, AXIS_LABEL_PRIORITY_DEFINING)]),
    };
  }

  if (isSupertrend(v)) return { ...base, y: compact([label("st", v.value, AXIS_LABEL_PRIORITY_DEFINING)]), x: [] };

  if (isZigZag(v)) {
    // The latest *confirmed* pivot — ZigZag has no reading on the bars between its pivots, and
    // `latestValue` already walked back to the most recent one that exists.
    return { ...base, y: compact([label("zz", v.price, AXIS_LABEL_PRIORITY_DEFINING, v.label ?? undefined)]), x: [] };
  }

  if (isMultiSeries(v)) {
    // A script pane declaring several named series: one label each, under the script's own key,
    // since nothing here knows which of them the author considers principal.
    return {
      ...base,
      y: compact(
        Object.entries(v.multi).map(([key, sub]) =>
          sub === null ? null : label(`ms-${key}`, typeof sub === "number" ? sub : sub.middle, AXIS_LABEL_PRIORITY_DEFINING, key),
        ),
      ),
      x: [],
    };
  }

  if (typeof v === "number") return { ...base, y: compact([label("v", v, AXIS_LABEL_PRIORITY_DEFINING)]), x: [] };

  return empty;
}
