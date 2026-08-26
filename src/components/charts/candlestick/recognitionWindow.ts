import type { Candle } from "./interfaces/Candle.interface";

/** Shared by `computePatternRecognitionValues` and `computeCandleRecognitionValues` — resolves
 *  `Indicator.recognitionDateLimit` (see its own doc) to a candle index: the last candle at or
 *  before that date, or the dataset's own last index once `dateLimit` is undefined or falls past
 *  every candle (both the "not set yet" and "still the same day as the last candle" cases collapse
 *  to the same answer this way, with no special-casing needed for either). */
export function recognitionDateLimitIndex(data: Candle[], dateLimit: Date | undefined): number {
  const n = data.length;
  if (n === 0) return -1;
  if (!dateLimit) return n - 1;
  const limitMs = dateLimit.getTime();
  for (let i = n - 1; i >= 0; i--) {
    if (data[i].date.getTime() <= limitMs) return i;
  }
  return 0;
}

/** The up-to-`maxCandles` window a multi-candle pattern is allowed to look back across, ending at
 *  (and including) `limitIndex` — clamped to the dataset's own start, same as any lookback window
 *  elsewhere in this file (e.g. `computeSupportResistanceValues`'s own `lookback`). */
export function recognitionWindowStart(limitIndex: number, maxCandles: number): number {
  return Math.max(0, limitIndex - (maxCandles - 1));
}
