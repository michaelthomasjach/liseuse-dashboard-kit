import type { ScaleLinear } from "d3";
import type { Candle } from "./interfaces/Candle.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { IndicatorSRLevel } from "./interfaces/IndicatorSRLevel.interface";
import { indicatorCatalogEntry } from "./indicatorCatalog";
import { distanceToSegment } from "./drawingGeometry";

/** A point in the space every indicator is actually plotted in: a bar index across, that bar's
 *  own value up. Turning each kind into these, and only then into pixels, is what lets one
 *  distance function serve all thirty-odd of them. */
export interface SeriesPoint {
  index: number;
  value: number;
}

export interface IndicatorHitTestContext {
  dims: { boundedWidth: number };
  zoomedXScale: ScaleLinear<number, number>;
  /** Resolves a value axis ("price", or an own-pane indicator's own id) to that pane's scale and
   *  its vertical offset within the plot — the same function the axis badges already use, so a
   *  click lands on the line exactly where the eye sees it in every pane. */
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: ScaleLinear<number, number>; offset: number };
  /** The last revealed bar. Hidden bars are not hit-testable for the same reason their values are
   *  not labelled: under replay they are not on screen to be clicked. */
  lastIndex: number;
  /** Candle-pattern markers only — they mark bars rather than a value, so their hit target is
   *  the candle they sit against (see `candleRecognition` below). */
  data: Candle[];
}

/** Every polyline an indicator actually draws, in (index, value) space, restricted to `[from,
 *  to]`. The window matters: this runs on every pointer move, and a five-year series would
 *  otherwise walk tens of thousands of points to answer a question about the few hundred bars
 *  currently on screen. */
export function indicatorSeries(
  values: (IndicatorValue | null)[],
  from: number,
  to: number,
  data: Candle[],
): SeriesPoint[][] {
  const lo = Math.max(0, Math.floor(from));
  const hi = Math.min(values.length - 1, Math.ceil(to));
  if (hi < lo) return [];

  // Named sub-series accumulated in parallel across the window, each becoming one polyline. A
  // `null` bar breaks its own line rather than bridging the gap, matching how every renderer here
  // treats a missing value — so a hit test can never succeed on a segment that was never drawn.
  const lines = new Map<string, SeriesPoint[][]>();
  const push = (key: string, index: number, value: number | null | undefined) => {
    let runs = lines.get(key);
    if (!runs) lines.set(key, (runs = [[]]));
    if (value === null || value === undefined || !Number.isFinite(value)) {
      if (runs[runs.length - 1].length > 0) runs.push([]);
      return;
    }
    runs[runs.length - 1].push({ index, value });
  };

  // Shapes that are not a per-bar line at all — horizontal levels, boxes, discrete pivots —
  // collect straight into `extra` as finished polylines.
  const extra: SeriesPoint[][] = [];

  // ZigZag is sparse *and* continuous: it has a value only on its own confirmed pivots, but the
  // line it draws joins consecutive pivots straight across the null bars between them. Collected
  // apart from `lines` for exactly that reason — the null handling there breaks a run at every
  // gap, which would leave ZigZag hit-testable only on its vertices and not on the long segments
  // between them, where most of it actually is.
  const zigzag: SeriesPoint[] = [];

  // Support/resistance levels arrive as a whole array on each bar that has them. The newest array
  // in the window is the live set; taking `values[hi]` directly would find nothing whenever the
  // last visible bar happens not to carry one.
  let levels: IndicatorSRLevel[] | null = null;

  for (let i = lo; i <= hi; i++) {
    const v = values[i];
    if (v === null || v === undefined) {
      for (const key of lines.keys()) push(key, i, null);
      continue;
    }
    if (typeof v === "number") {
      push("v", i, v);
    } else if (Array.isArray(v)) {
      levels = v as IndicatorSRLevel[];
    } else if ("upper" in v && "middle" in v && "lower" in v) {
      push("upper", i, v.upper);
      push("middle", i, v.middle);
      push("lower", i, v.lower);
    } else if ("macd" in v) {
      push("macd", i, v.macd);
      push("signal", i, v.signal);
    } else if ("adx" in v) {
      push("adx", i, v.adx);
      push("plusDI", i, v.plusDI);
      push("minusDI", i, v.minusDI);
    } else if ("longStop" in v) {
      // Only the active stop is stroked, and the line breaks when the trend flips — pushing the
      // inactive one would let a click select the indicator by hitting a line that is not there.
      push("stop", i, v.dir === 1 ? v.longStop : v.shortStop);
    } else if ("conversion" in v) {
      push("conversion", i, v.conversion);
      push("base", i, v.base);
      push("spanA", i, v.spanA);
      push("spanB", i, v.spanB);
      push("chikou", i, v.chikou);
    } else if ("pp" in v) {
      push("pp", i, v.pp);
      push("r1", i, v.r1);
      push("r2", i, v.r2);
      push("r3", i, v.r3);
      push("s1", i, v.s1);
      push("s2", i, v.s2);
      push("s3", i, v.s3);
    } else if ("trend" in v && "value" in v) {
      push("supertrend", i, v.value);
    } else if ("price" in v && "kind" in v) {
      if (Number.isFinite(v.price)) zigzag.push({ index: i, value: v.price });
    } else if ("top" in v && "bottom" in v) {
      extra.push([
        { index: i, value: v.top },
        { index: v.endIndex, value: v.top },
      ]);
      extra.push([
        { index: i, value: v.bottom },
        { index: v.endIndex, value: v.bottom },
      ]);
    } else if ("startIndex" in v && "points" in v) {
      if (v.points.length > 0) extra.push(v.points.map((p) => ({ index: p.index, value: p.price })));
    } else if ("spanIndex" in v) {
      // A candlestick pattern has no value of its own — it annotates bars. Its hit target is the
      // candle it marks, top and bottom, which is where its own badge is drawn.
      const bar = data[v.index];
      if (bar) {
        extra.push([
          { index: v.index, value: bar.high },
          { index: v.index, value: bar.low },
        ]);
      }
    } else if ("multi" in v) {
      for (const [key, sub] of Object.entries(v.multi)) push(key, i, sub === null ? null : typeof sub === "number" ? sub : sub.middle);
    }
  }

  const out: SeriesPoint[][] = extra;
  if (zigzag.length > 0) out.push(zigzag);
  // Each level is a horizontal run from where it was established to the right edge of the
  // window, exactly as drawn.
  for (const lvl of levels ?? []) {
    out.push([
      { index: Math.max(lo, lvl.startIndex), value: lvl.price },
      { index: hi, value: lvl.price },
    ]);
  }
  for (const runs of lines.values()) for (const run of runs) if (run.length > 0) out.push(run);
  return out;
}

/** Pixel distance from the cursor to the nearest line an indicator actually draws, or `Infinity`
 *  when it draws nothing hit-testable (a TPO profile, a custom indicator with no values yet).
 *
 *  A single-point run still answers: a lone pivot or a one-bar pattern is a dot on screen, and
 *  `distanceToSegment` on a zero-length segment degrades to point distance, so those stay
 *  clickable without a second code path. */
export function distanceToIndicator(
  indicator: Indicator,
  values: (IndicatorValue | null)[],
  mouseX: number,
  mouseY: number,
  ctx: IndicatorHitTestContext,
): number {
  if (indicator.hidden || values.length === 0) return Infinity;
  const entry = indicatorCatalogEntry(indicator);
  const valueAxis = entry.pane === "own" ? indicator.id : "price";
  const { scale, offset } = ctx.paneScaleAndOffset(valueAxis);

  // Only the bars actually on screen, widened by one so a segment entering from off-screen is
  // still tested along the part of it that is visible.
  const from = ctx.zoomedXScale.invert(0) - 1;
  const to = Math.min(ctx.lastIndex, ctx.zoomedXScale.invert(ctx.dims.boundedWidth) + 1);
  const series = indicatorSeries(values, from, to, ctx.data);

  let best = Infinity;
  for (const run of series) {
    let px = ctx.zoomedXScale(run[0].index + 0.5);
    let py = offset + scale(run[0].value);
    if (run.length === 1) {
      best = Math.min(best, Math.hypot(mouseX - px, mouseY - py));
      continue;
    }
    for (let i = 1; i < run.length; i++) {
      const nx = ctx.zoomedXScale(run[i].index + 0.5);
      const ny = offset + scale(run[i].value);
      const d = distanceToSegment(mouseX, mouseY, px, py, nx, ny);
      if (d < best) best = d;
      px = nx;
      py = ny;
    }
  }
  return best;
}
