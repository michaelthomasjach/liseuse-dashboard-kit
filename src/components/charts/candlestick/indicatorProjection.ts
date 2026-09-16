import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";

/** How the next values are guessed from the ones already drawn.
 *
 *  Four, and they disagree on purpose: an extrapolation is a claim about the future, and offering
 *  only one would present that claim as the answer rather than as one reading among several. The
 *  useful habit is switching between them — where they agree, the shape is in the data; where they
 *  fan apart, it was in the method.
 *
 *  - `linear`  — least squares through the lookback window, extended. Follows a steady slope well
 *                and overshoots a curve that is already flattening.
 *  - `drift`   — the last value plus the average step of the window. A random walk with drift, the
 *                textbook null hypothesis for a price-derived series; quieter than `linear`
 *                because it is anchored on the last point rather than on a fitted line.
 *  - `holt`    — double exponential smoothing: a level and a trend, both updated bar by bar, so
 *                recent behaviour weighs more than the start of the window. The one to reach for
 *                on a series that changed regime inside the lookback.
 *  - `flat`    — hold the last value. Not a joke: for a mean-reverting, bounded series (RSI, CHOP,
 *                ADX) "it stays about here" beats a trend line, and it is the honest baseline the
 *                other three should have to beat. */
export type IndicatorProjectionMethod = "linear" | "drift" | "holt" | "flat";

export interface IndicatorProjectionSettings {
  /** How many bars past the last one to draw. */
  bars: number;
  /** How many past values the method is fitted on. */
  lookback: number;
  method: IndicatorProjectionMethod;
  /** How fast the trend is given up, per projected bar, in [0, 1].
   *
   *  1 keeps the full slope forever, which is what makes a naive extrapolation absurd twenty bars
   *  out; 0 flattens immediately and turns every method into `flat`. Each step's increment is
   *  multiplied by this, so the projection decays toward a level instead of running off the pane —
   *  the same damping Gardner's damped-trend forecasts use, and the reason they beat undamped ones
   *  on almost every real series. Ignored by `flat`, which has no trend to give up. */
  damping: number;
}

export const DEFAULT_PROJECTION: IndicatorProjectionSettings = {
  bars: 12,
  lookback: 30,
  method: "linear",
  damping: 0.85,
};

export function projectionSettingsOf(indicator: Indicator): IndicatorProjectionSettings {
  return {
    bars: Math.max(1, Math.round(indicator.projectionBars ?? DEFAULT_PROJECTION.bars)),
    lookback: Math.max(2, Math.round(indicator.projectionLookback ?? DEFAULT_PROJECTION.lookback)),
    method: indicator.projectionMethod ?? DEFAULT_PROJECTION.method,
    damping: Math.min(1, Math.max(0, indicator.projectionDamping ?? DEFAULT_PROJECTION.damping)),
  };
}

/** The last `lookback` non-null values, in order. Nulls are dropped rather than interpolated: they
 *  are an indicator's warm-up, not a gap in the middle of one, and a series that has not produced
 *  `lookback` values yet is simply fitted on what it has. */
function tail(values: (number | null)[], lookback: number): number[] {
  const out: number[] = [];
  for (let i = values.length - 1; i >= 0 && out.length < lookback; i--) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) out.push(v);
  }
  return out.reverse();
}

/** One series' own next values.
 *
 *  Every method reduces to a starting level and a per-bar step, which is then damped — so the four
 *  differ only in how they read the window, not in how they walk forward, and adding a fifth means
 *  answering two questions rather than writing a loop. */
export function projectSeries(values: (number | null)[], settings: IndicatorProjectionSettings): number[] {
  const window = tail(values, settings.lookback);
  if (window.length === 0) return [];
  const last = window[window.length - 1];
  if (window.length < 2 || settings.method === "flat") return Array.from({ length: settings.bars }, () => last);

  let level = last;
  let step: number;
  if (settings.method === "drift") {
    step = (window[window.length - 1] - window[0]) / (window.length - 1);
  } else if (settings.method === "holt") {
    // Conventional starting values: the first observation as the level, the first difference as
    // the trend. The smoothing constants are fixed rather than exposed — a fourth number to tune
    // would buy less than the choice of method already does, and 0.5/0.3 is the middle of the
    // range every reference recommends.
    const alpha = 0.5;
    const beta = 0.3;
    let l = window[0];
    let b = window[1] - window[0];
    for (let i = 1; i < window.length; i++) {
      const previousLevel = l;
      l = alpha * window[i] + (1 - alpha) * (l + b);
      b = beta * (l - previousLevel) + (1 - beta) * b;
    }
    level = l;
    step = b;
  } else {
    // Least squares on (index, value). Anchored on the fitted line's own end rather than on the
    // last observation, which is the point of fitting one: a single noisy last bar should not move
    // the whole projection.
    const n = window.length;
    const meanX = (n - 1) / 2;
    const meanY = window.reduce((sum, v) => sum + v, 0) / n;
    let cov = 0;
    let varX = 0;
    for (let i = 0; i < n; i++) {
      cov += (i - meanX) * (window[i] - meanY);
      varX += (i - meanX) * (i - meanX);
    }
    step = varX === 0 ? 0 : cov / varX;
    level = meanY + step * (n - 1 - meanX);
  }

  const out: number[] = [];
  let value = level;
  let increment = step;
  for (let i = 0; i < settings.bars; i++) {
    value += increment;
    increment *= settings.damping;
    out.push(value);
  }
  return out;
}

/** One line of an indicator, pulled out of whatever shape its values take. `emphasis` says which
 *  of an indicator's lines is the one being read — the projection draws that one at full strength
 *  and the rest faded, so a three-line projection stays one idea rather than three. */
export interface ProjectableSeries {
  key: string;
  label: string;
  values: (number | null)[];
  emphasis: "primary" | "secondary";
}

/** Reads a number out of one point of one series, or null when that shape carries none.
 *
 *  This is the whole of what makes the projection generic: everything downstream works on plain
 *  numbers, so a new indicator kind needs a line here and nothing else. A shape that is an *event*
 *  rather than a level — a zigzag pivot, a gap, a detected pattern, a support level — deliberately
 *  has no entry: "the next pattern" is not something a curve fit can answer, and offering it would
 *  be inventing signals. See `supportsProjection`. */
function numbersFor(values: (IndicatorValue | null)[], read: (value: IndicatorValue) => number | null): (number | null)[] {
  return values.map((value) => (value === null ? null : read(value)));
}

function isBand(value: IndicatorValue): value is { upper: number; middle: number; lower: number } {
  return typeof value === "object" && value !== null && "upper" in value && "middle" in value && "lower" in value;
}
function isMacd(value: IndicatorValue): value is { macd: number; signal: number | null; histogram: number | null } {
  return typeof value === "object" && value !== null && "macd" in value && "signal" in value;
}
function isAdx(value: IndicatorValue): value is { adx: number; plusDI: number; minusDI: number } {
  return typeof value === "object" && value !== null && "adx" in value && "plusDI" in value;
}
function isMulti(value: IndicatorValue): value is { multi: Record<string, number | { upper: number; middle: number; lower: number } | null> } {
  return typeof value === "object" && value !== null && "multi" in value;
}

/** The kinds whose values are a level that continues, as opposed to an event that either happens or
 *  does not. Only these get the option at all — a "Projection" toggle on a pattern detector would
 *  be a promise the maths cannot keep. */
const PROJECTABLE_KINDS = new Set([
  "sma", "ema", "wma", "vwap", "bollinger", "rsi", "chop", "macd", "atr", "adx", "correlation",
]);

export function supportsProjection(indicator: Indicator): boolean {
  // A script's own pane or overlay: projectable when what it plots is a number or a band, which is
  // what `multiSeries`/a plain value already means. Its first bar decides, same as everywhere else
  // this library asks "what shape is this series".
  if (indicator.customData !== undefined) return true;
  return PROJECTABLE_KINDS.has(indicator.kind);
}

/** Every continuable line an indicator draws, in the order it draws them. */
export function projectableSeries(values: (IndicatorValue | null)[]): ProjectableSeries[] {
  const first = values.find((value) => value !== null) ?? null;
  if (first === null) return [];
  if (typeof first === "number") {
    return [{ key: "value", label: "", values: numbersFor(values, (v) => (typeof v === "number" ? v : null)), emphasis: "primary" }];
  }
  if (isBand(first)) {
    return [
      { key: "middle", label: "Moyenne", values: numbersFor(values, (v) => (isBand(v) ? v.middle : null)), emphasis: "primary" },
      { key: "upper", label: "Haute", values: numbersFor(values, (v) => (isBand(v) ? v.upper : null)), emphasis: "secondary" },
      { key: "lower", label: "Basse", values: numbersFor(values, (v) => (isBand(v) ? v.lower : null)), emphasis: "secondary" },
    ];
  }
  if (isMacd(first)) {
    return [
      { key: "macd", label: "MACD", values: numbersFor(values, (v) => (isMacd(v) ? v.macd : null)), emphasis: "primary" },
      { key: "signal", label: "Signal", values: numbersFor(values, (v) => (isMacd(v) ? v.signal : null)), emphasis: "secondary" },
    ];
  }
  if (isAdx(first)) {
    return [
      { key: "adx", label: "ADX", values: numbersFor(values, (v) => (isAdx(v) ? v.adx : null)), emphasis: "primary" },
      { key: "plusDI", label: "+DI", values: numbersFor(values, (v) => (isAdx(v) ? v.plusDI : null)), emphasis: "secondary" },
      { key: "minusDI", label: "−DI", values: numbersFor(values, (v) => (isAdx(v) ? v.minusDI : null)), emphasis: "secondary" },
    ];
  }
  if (isMulti(first)) {
    // Every sub-series a script declared, each read on its own. A band inside one contributes its
    // middle alone: projecting three lines of a band nobody asked about would triple the ink for a
    // series the script drew as one idea.
    return Object.keys(first.multi).map((key, index) => ({
      key,
      label: key,
      values: numbersFor(values, (v) => {
        if (!isMulti(v)) return null;
        const entry = v.multi[key];
        if (entry === null || entry === undefined) return null;
        return typeof entry === "number" ? entry : entry.middle;
      }),
      emphasis: index === 0 ? "primary" : "secondary",
    }));
  }
  return [];
}

/** One indicator's projection, ready to draw: where it starts on the x axis, and each of its lines
 *  as the last real point followed by the projected ones.
 *
 *  The last real point is included on purpose. Without it the dashed run starts one bar away from
 *  the solid line it continues, which reads as a second, unrelated series floating in the future
 *  rather than as the same line carrying on. */
export interface IndicatorProjection {
  indicator: Indicator;
  /** Index of the last real bar the projection hangs off. */
  fromIndex: number;
  lines: { key: string; emphasis: "primary" | "secondary"; points: { i: number; value: number }[] }[];
}

export function computeIndicatorProjection(
  indicator: Indicator,
  values: (IndicatorValue | null)[],
  dataLength: number
): IndicatorProjection | null {
  if (indicator.projection !== true || !supportsProjection(indicator) || dataLength === 0) return null;
  const settings = projectionSettingsOf(indicator);
  const lines: IndicatorProjection["lines"] = [];
  for (const series of projectableSeries(values)) {
    const projected = projectSeries(series.values, settings);
    if (projected.length === 0) continue;
    // Where this line actually last had a value, which is not always the last bar: a sub-series a
    // script stopped writing, or an indicator still in its warm-up at the right edge.
    let lastIndex = -1;
    for (let i = series.values.length - 1; i >= 0; i--) {
      const v = series.values[i];
      if (v !== null && Number.isFinite(v)) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) continue;
    const points = [{ i: lastIndex, value: series.values[lastIndex] as number }];
    projected.forEach((value, step) => points.push({ i: dataLength + step, value }));
    lines.push({ key: series.key, emphasis: series.emphasis, points });
  }
  return lines.length === 0 ? null : { indicator, fromIndex: dataLength - 1, lines };
}
