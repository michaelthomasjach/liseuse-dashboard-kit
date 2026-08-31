import type { IndicatorKind } from "./IndicatorKind.interface";
import type { CustomIndicatorDef } from "./CustomIndicatorDef.interface";
import type { OverlayDataPoint } from "./TrendLineDrawing.interface";

export interface Indicator {
  id: string;
  kind: IndicatorKind;
  /** Lookback window, in candles. Ignored by "vwap" (a cumulative, unwindowed average) and
   *  "macd"/"ichimoku" (their own multi-period settings below instead). Doubles as "atr"'s and
   *  "supertrend"'s own ATR period, and "supportResistance"'s own detection window. */
  period: number;
  /** Band width, in standard deviations. Only used by "bollinger". Default 2. */
  stdDev?: number;
  /** "macd" only — defaults 12/26/9, the conventional parameters. */
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  /** "macd" only — shows/hides the histogram bars (the MACD/signal lines stay either way).
   *  Default true. */
  macdShowHistogram?: boolean;
  /** "macd" only — histogram bar color above/below zero. Defaults to the chart's own
   *  up/down colors. */
  macdHistogramUpColor?: string;
  macdHistogramDownColor?: string;
  /** "zigzag" only — minimum swing size, as a percentage move from the last confirmed pivot,
   *  before the next one confirms. Default 5. */
  zigzagDeviation?: number;
  /** "zigzag" only — shows each confirmed pivot's HH/HL/LH/LL label (see
   *  `IndicatorZigZagPoint.label`) next to it. Default true. */
  zigzagShowLabels?: boolean;
  /** "supertrend" only — band width, as a multiple of ATR (see `period` above for the ATR period
   *  itself). Default 3. */
  supertrendMultiplier?: number;
  /** "supertrend" only — line color while trend is up/down. Defaults to the chart's own
   *  up/down colors (same as before this existed), so leaving both unset reproduces the exact
   *  prior behavior. */
  supertrendUpColor?: string;
  supertrendDownColor?: string;
  /** "parabolicSar" only — the acceleration factor's own starting value/step per extreme-point
   *  update, and its cap. Defaults 0.02/0.2, the conventional parameters. */
  sarStep?: number;
  sarMax?: number;
  /** "parabolicSar" only — each dot's color by which side of price it's currently on. Defaults
   *  to the chart's own up/down colors. */
  sarUpColor?: string;
  sarDownColor?: string;
  /** "gaps" only — the minimum jump between one candle's high/low and the next's, as a percentage
   *  of the earlier candle's own price, before it counts as a gap at all. Default 0.1. */
  gapsMinPercent?: number;
  /** "patternRecognition"/"candleRecognition" only — recognition only ever looks at a recent
   *  window ending on this date, not the whole dataset (so the chart doesn't fill up with every
   *  historical occurrence) — undefined means the dataset's own last candle, which tracks forward
   *  automatically as new candles arrive rather than freezing at whatever date the indicator
   *  happened to be added on (the "refreshed daily" default). A single-candle pattern
   *  (candleRecognition) only ever evaluates the candles its own shape needs, ending here; a
   *  multi-candle one (patternRecognition) widens that to up to 20 preceding candles — see
   *  `computePatternRecognitionValues`'s own doc for exactly how. */
  recognitionDateLimit?: Date;
  /** "ichimoku" only — defaults 9/26/52/26, the conventional parameters (see
   *  `computeIchimokuValues`'s own doc for what `ichimokuDisplacement` does and its one
   *  limitation). */
  ichimokuConversionPeriod?: number;
  ichimokuBasePeriod?: number;
  ichimokuSpanPeriod?: number;
  ichimokuDisplacement?: number;
  /** "pivotPoints" only — which formula turns the reference period's own high/low/close into
   *  levels (see `computePivotPointsValues`'s own doc for each one's exact math). Default
   *  "classic". */
  pivotType?: "classic" | "fibonacci" | "woodie" | "camarilla";
  /** "pivotPoints" only — which prior period's own high/low/close the current period's levels are
   *  derived from. Default "weekly" — "daily" only reads as useful against intraday data; against
   *  the daily bars most charts here actually show, it produces a new (unreadable) segment every
   *  single candle. */
  pivotPeriod?: "daily" | "weekly" | "monthly";
  /** "pivotPoints" only — draws just the current (most recent) period's own levels instead of the
   *  usual staircase of every past period still in view. Default false. */
  pivotShowLastOnly?: boolean;
  /** "supportResistance" only — how many of the strongest detected levels to keep (see
   *  `computeSupportResistanceValues`'s own doc for how "strongest" is ranked). `period` above
   *  doubles as this indicator's own lookback, in candles. Default 6. */
  srMaxLevels?: number;
  /** "chandelierExit" only — the ATR multiplier both stops are offset by (`period` above doubles
   *  as its own ATR length and the highest/lowest lookback, same reuse `supertrendMultiplier`'s
   *  own doc explains for Supertrend). Default 3, the Pine Script original's own default. */
  chandelierMultiplier?: number;
  /** "chandelierExit" only — highest/lowest *close* over the lookback (the Pine original's own
   *  default) instead of highest high / lowest low, before the ATR offset. Default true. */
  chandelierUseClose?: boolean;
  /** "chandelierExit" only — a pill badge at each direction flip ("Achat"/"Vente"). Default true. */
  chandelierShowLabels?: boolean;
  /** "chandelierExit" only — fills the region between price and whichever stop is currently
   *  active. Default true. */
  chandelierHighlightState?: boolean;
  /** "chandelierExit" only — its stops/fill/labels' own color while long/short. Defaults to the
   *  chart's own up/down colors. */
  chandelierUpColor?: string;
  chandelierDownColor?: string;
  /** "tpo" only — how many minutes each lettered block spans. A real candle finer than this
   *  (several fit in one block) groups the usual way; one coarser than this (the common case
   *  once a single candle already spans a day or more) is instead split into that many
   *  *synthetic* sub-blocks reconstructed from its own OHLC — see `computeTPOSessionProfiles`'s
   *  own doc for why, and exactly how. Default 30. */
  tpoBlockMinutes?: number;
  /** "tpo" only — how many equal price bins each session's own [low, high] is divided into
   *  (independent of block count — more blocks just means more letters landing in the same
   *  rows, not more rows). Default 24. */
  tpoRowCount?: number;
  /** "tpo" only — the percentage of total (block, row) touches the value area (VAH/VAL) must
   *  enclose, expanding outward from POC toward whichever neighboring row has more touches until
   *  it's reached. Default 70. */
  tpoValueAreaPercent?: number;
  /** "tpo" only — each block's own stamp: sequential letters (wrapping past "Z") or plain
   *  numbers. Default "letters". */
  tpoLabelStyle?: "letters" | "numbers";
  /** "tpo" only — a small gap between adjacent letters' own cells, even within the same row, so
   *  distinct blocks read as visually separate rather than one unbroken run. Default true. */
  tpoSplitByBlocks?: boolean;
  /** "tpo" only — how opaque the profile's own cells render, 0-100. A row inside the value area
   *  always renders somewhat more opaque than one outside it (same emphasis Market Profile tools
   *  already give the value area) — this scales *both* rather than replacing that relationship
   *  with a single flat alpha. Default 100 (fully opaque). */
  tpoOpacity?: number;
  /** "rsi" only — the two dashed reference levels drawn across its pane (see
   *  `drawVolumeAndPanes`'s own RSI/CHOP block). Defaults 70/30, the conventional overbought/
   *  oversold thresholds — some traders widen these to 80/20 for a stronger/less noisy signal, or
   *  narrow them for a more sensitive one. */
  rsiOverbought?: number;
  rsiOversold?: number;
  /** "chop" only — same reference-level mechanism as `rsiOverbought`/`rsiOversold` above, against
   *  CHOP's own 0-100 scale. Defaults 61.8/38.2, the conventional Fibonacci-derived thresholds
   *  (above the upper one: choppy/ranging; below the lower one: trending). */
  chopUpperThreshold?: number;
  chopLowerThreshold?: number;
  /** "atr" only — divides each value by that candle's own close (×100) before plotting, so the
   *  pane reads "volatility as a % of price" instead of a raw price-unit amount. Makes ATR
   *  comparable across symbols/timeframes at very different price levels, at the cost of no longer
   *  being directly usable as a stop-distance in the instrument's own price units. Default false
   *  (raw ATR, the original behavior). */
  atrAsPercent?: boolean;
  /** "adx" only — the dashed reference level drawn across its pane (same mechanism as
   *  `rsiOverbought`/`chopUpperThreshold` above), against ADX's own 0-100 scale. Default 25, the
   *  conventional "trend is strong enough to matter" threshold — below it, +DI/-DI crossovers are
   *  generally considered too unreliable to act on. */
  adxThreshold?: number;
  /** "adx" only — +DI/-DI's own line color (see `drawVolumeAndPanes`'s own ADX block for why they
   *  don't read the shared `color` field the way most indicators do). Defaults to the chart's own
   *  up/down colors, same "leaving both unset reproduces the exact prior behavior" convention as
   *  Supertrend/Parabolic SAR/Chandelier Exit's own directional-color pairs. */
  adxPlusColor?: string;
  adxMinusColor?: string;
  /** "correlation" only — the dashed reference levels drawn at +/- this value (see
   *  `drawVolumeAndPanes`'s own correlation block), against its fixed -1..1 scale. Default 0.7, a
   *  common "meaningfully correlated" cutoff — a coefficient beyond either line is generally read
   *  as a strong (positive or negative) relationship, inside them as weak/noise. */
  correlationStrongThreshold?: number;
  /** The eight fundamental kinds only (see `isFundamentalKind`) — plots the year-over-year percent
   *  change between each reported point and the point from ~12 months earlier instead of the raw
   *  reported value itself (see `computeFundamentalValues`'s own doc for exactly how "12 months
   *  earlier" is resolved against irregular reporting dates). Useful for comparing growth *rate*
   *  across companies/metrics whose absolute scale differs wildly (revenue in the billions vs. a
   *  P/E ratio in the tens) — something the raw "value" mode can't do at a glance. Default
   *  "value" (the original behavior, unchanged). */
  fundamentalDisplayMode?: "value" | "yoyChange";
  /** The eight fundamental kinds only — how the pane connects each reported point (see
   *  `drawVolumeAndPanes`'s own fundamentals block). "line" (default, prior behavior) draws a
   *  straight diagonal between consecutive reports, which reads smoothly but visually implies a
   *  gradual change that didn't really happen (the underlying value is actually a step function —
   *  flat between report dates, then a jump). "step" draws that step function literally, more
   *  truthful to how the data actually arrives; "area" fills beneath the line down to zero, useful
   *  for a metric where "how much" reads more naturally as a filled magnitude than a bare line
   *  (Free Cash Flow, Net Income, Total Revenue). */
  fundamentalChartStyle?: "line" | "step" | "area";
  /** Set once this indicator represents a `CustomIndicatorDef` the caller supplied via
   *  `CandlestickChartProps.customIndicators`, rather than one of the library's own built-in
   *  kinds — `kind` itself is meaningless in that case ("custom" exists in `IndicatorKind` purely
   *  to satisfy the type). Carries a full, self-contained copy of that def (not just its id) so
   *  this indicator keeps working correctly even if the caller later removes it from
   *  `customIndicators` or the array identity changes — same reasoning `Indicator` never re-reads
   *  its own settings from a live prop anywhere else either. */
  customData?: CustomIndicatorDef;
  /** "correlation" only — the second symbol its rolling coefficient is computed against, and that
   *  symbol's own fetched price series (same `OverlayDataPoint[]` shape/fetch path — see
   *  `CandlestickChartProps.onAddSymbolOverlay` — the "symbolOverlay" drawing type already uses to
   *  compare an instrument against the main one). Carried directly on the indicator, same
   *  "self-contained, not a second lookup" reasoning `customData` above already follows. */
  correlationSymbol?: string;
  correlationSymbolName?: string;
  correlationData?: OverlayDataPoint[];
  /** CSS color. Defaults to a color cycled from a small built-in palette. Ignored by
   *  "supertrend"/"parabolicSar"/"chandelierExit" (each has its own up/down pair above instead —
   *  a single color can't represent a trend flip) and "supportResistance"/"tpo" (colored by
   *  their own rules, not a single indicator-wide color). */
  color?: string;
  /** When true, the indicator stays in the legend but its line isn't drawn — toggled from the
   *  legend's eye icon. Only meaningful for a `pane: "price"` indicator (see
   *  IndicatorCatalogEntry) — a `pane: "own"` one uses `paneCollapsed` instead, same as the
   *  volume pane. Default false. */
  hidden?: boolean;
  /** A `pane: "own"` indicator's pane, collapsed to a header-only strip — same mechanism/UI as
   *  the volume pane's own collapse. Default false (expanded). */
  paneCollapsed?: boolean;
  /** A `plot.pane(name, { dock: "left"|"right" })` script pane only (see `customData.dock`) —
   *  whether its own price/date axes are drawn in the docked column. Default true; toggled from
   *  the Style tab. Meaningless (ignored) for a `dock: "bottom"`/undocked pane, which already
   *  shares the main plot's own axes. */
  sideAxesVisible?: boolean;
}
