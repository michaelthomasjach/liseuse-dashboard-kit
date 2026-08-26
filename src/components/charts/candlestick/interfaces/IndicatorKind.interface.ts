export type IndicatorKind =
  | "sma"
  | "ema"
  | "wma"
  | "vwap"
  | "bollinger"
  | "rsi"
  | "chop"
  | "macd"
  | "zigzag"
  | "atr"
  | "supertrend"
  | "parabolicSar"
  | "gaps"
  /** Auto-detects classic chart patterns (double top/bottom, head & shoulders, triangles, flag,
   *  cup & handle, diamond, wolfe wave) within a recent window — see
   *  `Indicator.recognitionDateLimit` and `computePatternRecognitionValues`'s own doc. */
  | "patternRecognition"
  /** Auto-detects classic candlestick patterns (hammer, engulfing, morning/evening star, three
   *  inside up/down, doji…) at/just before `Indicator.recognitionDateLimit` — see
   *  `computeCandleRecognitionValues`'s own doc. */
  | "candleRecognition"
  | "ichimoku"
  | "pivotPoints"
  /** Auto-detected horizontal support/resistance levels — see `Indicator.srMaxLevels` and
   *  `computeSupportResistanceValues`'s own doc. */
  | "supportResistance"
  | "adx"
  | "chandelierExit"
  /** Time Price Opportunities / Market Profile — see `Indicator.tpoBlockMinutes` and
   *  `computeTPOSessionProfiles`'s own doc (in `chartModes.ts`) for the full mechanics. An
   *  overlay like S/R or Pivot Points, not a `chartDisplayMode` — it draws its own profile
   *  alongside ordinary candles rather than replacing them. */
  | "tpo"
  /** Rolling Pearson correlation coefficient (-1 to +1) against a second, user-picked symbol —
   *  see `Indicator.correlationSymbol`/`correlationData`. */
  | "correlation"
  /** Reserved for an `Indicator` carrying its own `customData` (see that field's own doc) — this
   *  value itself is never actually read for those, just needed to satisfy the type. */
  | "custom"
  | "freeCashFlow"
  | "netIncome"
  | "totalRevenue"
  | "netMargin"
  | "grossMargin"
  | "peRatio"
  | "eps"
  | "debtToEquity";
