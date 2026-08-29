/** `math.*` — generic statistics over a plain `number[]` a script already has in hand (typically
 *  from `market.series()`), each reducing it to a single summary value. Distinct from `ta.*`
 *  (taLib.ts), which mirrors named technical indicators and reads as "what's the current XYZ
 *  reading" rather than "what's the statistical property of this array" — the two overlap on
 *  sma/ema by name (matching the platform's own spec, which lists both) but answer different
 *  questions: `math.sma(values, n)` is the mean of the last `n` values, full stop; `ta.sma(values,
 *  n)` (see taLib.ts) is explicitly "the SMA reading right now," which happens to be the same
 *  number here but is conceptually the indicator, not a generic reduction.
 *
 *  Every function returns `null` (never throws, never `NaN`) for an input that can't produce a
 *  meaningful answer — an empty array, a period longer than the data, a zero-variance input to
 *  `zscore`/`correlation` — matching this library's own "null until there's enough to compute"
 *  convention used throughout indicators.ts, and keeping a script's own defensive code simple
 *  (check for `null`, not for several different flavors of "wrong"). */
function last<T>(values: T[], n: number): T[] {
  return n >= values.length ? values : values.slice(values.length - n);
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  return mean(last(values, period));
}

export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let result = mean(values.slice(0, period))!;
  for (let i = period; i < values.length; i++) result = values[i] * k + result * (1 - k);
  return result;
}

export function variance(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

export function std(values: number[]): number | null {
  const v = variance(values);
  return v === null ? null : Math.sqrt(v);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** `p` is 0-100 (e.g. 90 for the 90th percentile), linear-interpolated between the two nearest
 *  ranks — the same convention most statistics libraries default to. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0 || p < 0 || p > 100) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = rank - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

/** How many standard deviations the *last* value in `values` sits from the array's own mean —
 *  not a per-point series, matching "reduce to one summary number" (a script wanting a z-score
 *  at every bar calls this once per bar with that bar's own trailing window, same as any other
 *  `math.*`/`ta.*` function). */
export function zscore(values: number[]): number | null {
  if (values.length === 0) return null;
  const m = mean(values)!;
  const s = std(values);
  if (s === null || s === 0) return null;
  return (values[values.length - 1] - m) / s;
}

export function covariance(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const meanA = mean(a)!;
  const meanB = mean(b)!;
  return a.reduce((sum, v, i) => sum + (v - meanA) * (b[i] - meanB), 0) / a.length;
}

export function correlation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const cov = covariance(a, b);
  const stdA = std(a);
  const stdB = std(b);
  if (cov === null || stdA === null || stdB === null || stdA === 0 || stdB === 0) return null;
  return Math.max(-1, Math.min(1, cov / (stdA * stdB)));
}

export function min(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

export function max(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

/** The plain, always-safe subset of `Math` a script gets directly — no reason to wrap `abs`/
 *  `sqrt`/`pow`/`exp`/`log` in anything of this engine's own, they're exactly `Math`'s own
 *  functions under the names the platform's own spec asks for. */
export const mathApi = {
  sma,
  ema,
  std,
  variance,
  mean,
  median,
  percentile,
  zscore,
  correlation,
  covariance,
  min,
  max,
  abs: Math.abs,
  sqrt: Math.sqrt,
  pow: Math.pow,
  exp: Math.exp,
  log: Math.log,
};
