export type CandleMatchType =
  | "hammer"
  | "invertedHammer"
  | "hangingMan"
  | "shootingStar"
  | "bullishEngulfing"
  | "bearishEngulfing"
  | "morningStar"
  | "eveningStar"
  | "threeInsideUp"
  | "threeInsideDown"
  | "doji";

/** One auto-detected candlestick pattern (see `computeCandleRecognitionValues`'s own doc) — stored
 *  at `index` (the candle it completes on, e.g. the 3rd candle of a morning star) only, null
 *  everywhere else, same "one-off event, not an ongoing state" reasoning `IndicatorPatternMatch`
 *  itself already follows. `spanIndex` is how many candles back the pattern's own shape actually
 *  starts (0 for a single-candle one like hammer/doji, 1 for a 2-candle engulfing, 2 for a
 *  3-candle morning/evening star or three inside up/down) — enough for the renderer to know which
 *  earlier candles are part of the same match without carrying their own full OHLC here too. */
export interface IndicatorCandleMatch {
  type: CandleMatchType;
  label: string;
  index: number;
  spanIndex: number;
  direction: "bullish" | "bearish" | "neutral";
}
