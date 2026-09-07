import { SMA, EMA, RSI, MACD, ATR, BollingerBands, Stochastic, ADX, ROC, WMA } from "technicalindicators";

/** `ta.*` — named technical-indicator readings, computed on demand from a plain array a script
 *  already has (typically `market.series(...)`), answering "what's the current XYZ reading"
 *  rather than `chart.indicator()`'s "what's already on this chart" (a script can compute an RSI
 *  the user never actually added as a visible indicator, at whatever period it wants). Every
 *  function here is a thin wrapper around this library's own already-installed
 *  `technicalindicators` dependency — the exact same package `indicators.ts` already uses for the
 *  chart's own built-in RSI/MACD/ATR/Bollinger/ADX, just re-exported under the platform's own
 *  spec'd names, not reimplemented.
 *
 *  `.calculate()` trims its own warm-up period off the *front* of its result instead of null-
 *  padding it (e.g. 10 closes at period 5 comes back as 6 values, not 10 — the same convention
 *  every `compute*Values` function in indicators.ts already documents and works around) — every
 *  function below reads its result from the *end*, so that trimming is invisible here: "the
 *  current reading" is always `result[result.length - 1]`, which exists once there's been enough
 *  history regardless of how much got trimmed off the front. Not enough history yet, or a period
 *  that can't produce a result at all, returns `null` — never throws, matching every other
 *  accessor in this engine. */

function lastOrNull<T>(values: T[]): T | null {
  return values.length === 0 ? null : values[values.length - 1];
}

/** Rolling weighted moving average over a whole array, oldest first — the shape HMA needs, which
 *  wants a *series* of WMAs to average again rather than just the latest one. `WMA.calculate`
 *  trims its own warm-up off the front, so the result is shorter than the input by `period - 1`
 *  and its last entry lines up with the input's last entry. */
function wmaSeries(values: number[], period: number): number[] {
  if (!Number.isFinite(period) || period < 1 || values.length < period) return [];
  return WMA.calculate({ period: Math.floor(period), values });
}

export const taApi = {
  /** Weighted moving average: the newest value counts `period` times, the oldest once. */
  wma: (values: number[], period: number) => lastOrNull(wmaSeries(values, period)),

  /** Hull moving average — `wma(2·wma(n/2) − wma(n), √n)`. Much faster to turn than a plain WMA of
   *  the same length, at the cost of overshooting a sharp reversal. Needs `period + √period` bars
   *  before it reads, since it averages a series that is itself already trimmed. */
  hma: (values: number[], period: number) => {
    const n = Math.floor(period);
    if (!Number.isFinite(n) || n < 2) return null;
    const half = wmaSeries(values, Math.max(1, Math.floor(n / 2)));
    const full = wmaSeries(values, n);
    if (half.length === 0 || full.length === 0) return null;
    // Both series end on the same bar but start on different ones; line them up from the end.
    const overlap = Math.min(half.length, full.length);
    const raw: number[] = [];
    for (let i = 0; i < overlap; i++) {
      raw.push(2 * half[half.length - overlap + i] - full[full.length - overlap + i]);
    }
    return lastOrNull(wmaSeries(raw, Math.max(1, Math.round(Math.sqrt(n)))));
  },

  /** Arnaud Legoux moving average: a Gaussian window whose peak sits `offset` of the way along it.
   *  `offset` 1 puts the peak on the newest bar (most responsive, least smooth), 0 on the oldest;
   *  `sigma` is how sharply the weight falls away from that peak — bigger is narrower, so a bigger
   *  sigma follows price more closely. */
  alma: (values: number[], period: number, offset = 0.85, sigma = 6) => {
    const n = Math.floor(period);
    if (!Number.isFinite(n) || n < 1 || values.length < n || sigma <= 0) return null;
    const window = values.slice(values.length - n);
    const m = offset * (n - 1);
    const s = n / sigma;
    let weighted = 0;
    let total = 0;
    // `i` runs oldest to newest, matching `market.series`' own order — the same direction Pine's
    // own implementation walks its window in, so the peak lands on the same end.
    for (let i = 0; i < n; i++) {
      const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
      weighted += window[i] * w;
      total += w;
    }
    return total === 0 ? null : weighted / total;
  },

  /** Symmetrically weighted moving average: the last four values at 1/6, 2/6, 2/6, 1/6. A fixed
   *  four-bar window by definition — it takes no period. */
  swma: (values: number[]) => {
    if (values.length < 4) return null;
    const [a, b, c, d] = values.slice(values.length - 4);
    return (a + 2 * b + 2 * c + d) / 6;
  },

  /** Volume-weighted moving average: each price counted in proportion to the volume traded at it,
   *  so a quiet bar moves it less than a busy one. `values` and `volumes` must line up bar for
   *  bar — pass `market.series("close", n)` and `market.series("volume", n)`. */
  vwma: (values: number[], volumes: number[], period: number) => {
    const n = Math.floor(period);
    if (!Number.isFinite(n) || n < 1 || values.length < n || volumes.length < n) return null;
    let weighted = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const price = values[values.length - n + i];
      const volume = volumes[volumes.length - n + i];
      weighted += price * volume;
      total += volume;
    }
    return total === 0 ? null : weighted / total;
  },

  /** Zero-lag EMA: an EMA of `2·price − price[lag]`, where `lag` is half the period. The
   *  subtraction pre-compensates for the lag an EMA introduces, so it turns sooner — and
   *  overshoots when price reverses, which is the trade being made. */
  zlema: (values: number[], period: number) => {
    const n = Math.floor(period);
    if (!Number.isFinite(n) || n < 1) return null;
    const lag = Math.floor((n - 1) / 2);
    if (values.length < lag + 1) return null;
    const compensated: number[] = [];
    for (let i = lag; i < values.length; i++) compensated.push(2 * values[i] - values[i - lag]);
    return lastOrNull(EMA.calculate({ period: n, values: compensated }));
  },

  sma: (values: number[], period: number) => lastOrNull(SMA.calculate({ period, values })),
  ema: (values: number[], period: number) => lastOrNull(EMA.calculate({ period, values })),
  rsi: (values: number[], period: number) => lastOrNull(RSI.calculate({ period, values })),
  roc: (values: number[], period: number) => lastOrNull(ROC.calculate({ period, values })),
  atr: (high: number[], low: number[], close: number[], period: number) => lastOrNull(ATR.calculate({ high, low, close, period })),
  macd: (values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    const result = lastOrNull(
      MACD.calculate({ values, fastPeriod, slowPeriod, signalPeriod, SimpleMAOscillator: false, SimpleMASignal: false })
    );
    return result ? { macd: result.MACD ?? null, signal: result.signal ?? null, histogram: result.histogram ?? null } : null;
  },
  bollinger: (values: number[], period = 20, stdDev = 2) => {
    const result = lastOrNull(BollingerBands.calculate({ period, stdDev, values }));
    return result ? { upper: result.upper, middle: result.middle, lower: result.lower } : null;
  },
  stochastic: (high: number[], low: number[], close: number[], period = 14, signalPeriod = 3) => {
    const result = lastOrNull(Stochastic.calculate({ high, low, close, period, signalPeriod }));
    return result ? { k: result.k, d: result.d } : null;
  },
  adx: (high: number[], low: number[], close: number[], period = 14) => {
    const result = lastOrNull(ADX.calculate({ high, low, close, period }));
    return result ? { adx: result.adx, plusDI: result.pdi, minusDI: result.mdi } : null;
  },
};
