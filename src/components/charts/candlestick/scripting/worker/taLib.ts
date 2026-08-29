import { SMA, EMA, RSI, MACD, ATR, BollingerBands, Stochastic, ADX, ROC } from "technicalindicators";

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

export const taApi = {
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
