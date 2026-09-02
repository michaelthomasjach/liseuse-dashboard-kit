import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import { formatCompactNumber } from "./formatting";

/** The eight fundamental `IndicatorKind`s, in one place — `computeIndicatorValues` reads
 *  `fundamentals` through this, the picker/axis/hover-readout use it to pick a formatter (see
 *  `formatFundamentalValue`). Kept as its own array (rather than checking `kind` against each
 *  catalog entry's `category` at every call site) since two of these call sites run on every
 *  frame of a pan/zoom and a plain array membership check is cheaper than re-deriving it from
 *  the catalog each time. */
export const FUNDAMENTAL_INDICATOR_KINDS: IndicatorKind[] = [
  "freeCashFlow",
  "netIncome",
  "totalRevenue",
  "netMargin",
  "grossMargin",
  "peRatio",
  "eps",
  "debtToEquity",
];

export function isFundamentalKind(kind: IndicatorKind): boolean {
  return FUNDAMENTAL_INDICATOR_KINDS.includes(kind);
}

/** How a fundamental indicator's own value reads — money (compact, e.g. "$1.20B", see
 *  `formatCompactNumber`), a percentage (one decimal, e.g. "21.5%"), or a plain ratio (two
 *  decimals, e.g. "24.30" for a P/E). RSI/CHOP/MACD keep their own existing plain `.toFixed(2)`
 *  wherever they're formatted — this is only reached for the eight kinds above. `displayMode`
 *  "yoyChange" (see `Indicator.fundamentalDisplayMode`'s own doc) overrides every kind's own
 *  normal unit with a plain percentage instead — the value at that point is already a % change,
 *  not money/a ratio, regardless of what the underlying metric itself is normally read in. */
export function formatFundamentalValue(kind: IndicatorKind, value: number, displayMode: "value" | "yoyChange" = "value"): string {
  if (displayMode === "yoyChange") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  switch (kind) {
    case "freeCashFlow":
    case "netIncome":
    case "totalRevenue":
      return `$${formatCompactNumber(value)}`;
    case "netMargin":
    case "grossMargin":
      return `${value.toFixed(1)}%`;
    case "eps":
      return `$${value.toFixed(2)}`;
    default:
      return value.toFixed(2);
  }
}

export interface IndicatorCatalogEntry {
  kind: IndicatorKind;
  label: string;
  shortLabel: string;
  defaultPeriod: number;
  hasPeriod: boolean;
  hasStdDev: boolean;
  /** "price": overlaid on the price section, in the top-left legend (SMA/EMA/WMA/VWAP/Bollinger).
   *  "own": gets its own sub-pane below price/volume, with a pane header instead of a legend
   *  entry — an oscillator like RSI/CHOP/MACD isn't on the same scale as price at all. */
  pane: "price" | "own";
  /** Grouping shown in the picker modal — purely a display grouping, doesn't affect anything
   *  about how the indicator itself behaves. Every built-in entry uses one of "Moyennes
   *  mobiles"/"Volatilité"/"Momentum"/"Tendance"/"Structure"/"Fondamentaux" — a plain `string`
   *  (not a closed union of those) only so a custom indicator's own freeform `section` (see
   *  `CustomIndicatorDef`) can be synthesized into one of these too, in `indicatorCatalogEntry`. */
  category: string;
}

export const INDICATOR_CATALOG: IndicatorCatalogEntry[] = [
  {
    kind: "sma",
    label: "Moyenne mobile simple (SMA)",
    shortLabel: "SMA",
    defaultPeriod: 20,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Moyennes mobiles",
  },
  {
    kind: "ema",
    label: "Moyenne mobile exponentielle (EMA)",
    shortLabel: "EMA",
    defaultPeriod: 20,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Moyennes mobiles",
  },
  {
    kind: "wma",
    label: "Moyenne mobile pondérée (WMA)",
    shortLabel: "WMA",
    defaultPeriod: 20,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Moyennes mobiles",
  },
  {
    kind: "vwap",
    label: "Volume Weighted Average Price (VWAP)",
    shortLabel: "VWAP",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Moyennes mobiles",
  },
  {
    kind: "bollinger",
    label: "Bandes de Bollinger",
    shortLabel: "BB",
    defaultPeriod: 20,
    hasPeriod: true,
    hasStdDev: true,
    pane: "price",
    category: "Volatilité",
  },
  {
    kind: "rsi",
    label: "Relative Strength Index (RSI)",
    shortLabel: "RSI",
    defaultPeriod: 14,
    hasPeriod: true,
    hasStdDev: false,
    pane: "own",
    category: "Momentum",
  },
  {
    kind: "chop",
    label: "Choppiness Index (CHOP)",
    shortLabel: "CHOP",
    defaultPeriod: 14,
    hasPeriod: true,
    hasStdDev: false,
    pane: "own",
    category: "Volatilité",
  },
  { kind: "macd", label: "MACD", shortLabel: "MACD", defaultPeriod: 0, hasPeriod: false, hasStdDev: false, pane: "own", category: "Momentum" },
  // Its own value shape (IndicatorZigZagPoint, not a plain number/IndicatorBand) and its own
  // settings (zigzagDeviation/zigzagShowLabels on Indicator, not period/stdDev) — hasPeriod/
  // hasStdDev both false the same way vwap/macd's own extra settings sit outside them.
  {
    kind: "zigzag",
    label: "Zig Zag",
    shortLabel: "ZigZag",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Tendance",
  },
  {
    kind: "atr",
    label: "Average True Range (ATR)",
    shortLabel: "ATR",
    defaultPeriod: 14,
    hasPeriod: true,
    hasStdDev: false,
    pane: "own",
    category: "Volatilité",
  },
  // Its own value shape (IndicatorSupertrendPoint) and its own settings (period doubles as the
  // ATR period, supertrendMultiplier instead of stdDev) — hasStdDev false the same reasoning as
  // every other non-Bollinger indicator here.
  {
    kind: "supertrend",
    label: "Supertrend",
    shortLabel: "Supertrend",
    defaultPeriod: 10,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Tendance",
  },
  {
    kind: "parabolicSar",
    label: "Parabolic SAR",
    shortLabel: "PSAR",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Tendance",
  },
  // Own value shape (IndicatorGapPoint — a set of rectangles, not a line) and own setting
  // (gapsMinPercent, not period/stdDev). Filed under "Structure" alongside the manually-configured
  // structure tools (pivots, S/R, TPO) rather than under a "Structure Recognition" category of its
  // own with the other two auto-detection indicators (pattern/candle): the split was real but too
  // fine to be worth two adjacent picker tabs a user has to check both of to find one indicator —
  // whether a level was configured by hand or detected automatically isn't what someone is
  // filtering by when they're looking for it.
  {
    kind: "gaps",
    label: "Gaps Recognition",
    shortLabel: "Gaps",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Own value shape (IndicatorPatternMatch, one per detected occurrence — see
  // computePatternRecognitionValues) and own setting (recognitionDateLimit, not period/stdDev —
  // this indicator's own "how far back" is a fixed 20-candle cap, not a user-tunable count).
  {
    kind: "patternRecognition",
    label: "Pattern Recognition",
    shortLabel: "Patterns",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Same reasoning as patternRecognition just above, own value shape IndicatorCandleMatch instead.
  {
    kind: "candleRecognition",
    label: "Candle Recognition",
    shortLabel: "Bougies",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Own value shape (IndicatorIchimokuPoint — five components, one of them a filled cloud) and
  // its own four settings (ichimokuConversionPeriod/ichimokuBasePeriod/ichimokuSpanPeriod/
  // ichimokuDisplacement, not period/stdDev).
  {
    kind: "ichimoku",
    label: "Ichimoku Kinko Hyo",
    shortLabel: "Ichimoku",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Tendance",
  },
  // Own value shape (IndicatorPivotPointsPoint — a fixed set of horizontal levels, not a line)
  // and its own two settings (pivotType/pivotPeriod, not period/stdDev) — same "hasPeriod/
  // hasStdDev both false" reasoning as every other indicator here with its own bespoke settings.
  {
    kind: "pivotPoints",
    label: "Points Pivots",
    shortLabel: "Pivots",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Own value shape (IndicatorSRLevel[] — a flat, ranked list of levels, not a line) — `period`
  // is reused as-is for its own lookback window (hasPeriod true), its only other setting
  // (srMaxLevels, how many of the strongest levels to keep) not being stdDev either.
  {
    kind: "supportResistance",
    label: "Support/Résistance (auto)",
    shortLabel: "S/R",
    defaultPeriod: 100,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Own value shape (a TpoSessionProfile per session, computed range-aware — see
  // computeTPOSessionProfiles' own doc — rather than one value per candle) and its own five
  // settings (tpoBlockMinutes/tpoRowCount/tpoValueAreaPercent/tpoLabelStyle/tpoSplitByBlocks, not
  // period/stdDev) — hasPeriod/hasStdDev both false, same reasoning as pivotPoints/ichimoku.
  {
    kind: "tpo",
    label: "Time Price Opportunities (TPO)",
    shortLabel: "TPO",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "price",
    category: "Structure",
  },
  // Own value shape (IndicatorADXPoint — the ADX line plus +DI/-DI) but no settings beyond the
  // one shared `period` field (its own ATR/DMI lookback) — hasPeriod true, hasStdDev false, same
  // as RSI/CHOP/ATR above it.
  {
    kind: "adx",
    label: "Average Directional Index (ADX)",
    shortLabel: "ADX",
    defaultPeriod: 14,
    hasPeriod: true,
    hasStdDev: false,
    pane: "own",
    category: "Tendance",
  },
  // Own value shape (IndicatorChandelierPoint — two ratcheting stops, only one ever actually
  // drawn per bar) and its own four settings beyond `period` (chandelierMultiplier/
  // chandelierUseClose/chandelierShowLabels/chandelierHighlightState, not stdDev).
  {
    kind: "chandelierExit",
    label: "Chandelier Exit",
    shortLabel: "CE",
    defaultPeriod: 22,
    hasPeriod: true,
    hasStdDev: false,
    pane: "price",
    category: "Tendance",
  },
  // The one built-in kind that can't just be added with catalog defaults — it needs a second
  // symbol's own price series first (see Indicator.correlationSymbol/correlationData's own doc),
  // so picking it opens a setup modal instead of calling addIndicator directly (see
  // IndicatorModals.tsx's own picker special-case). `defaultPeriod` still applies once it's added.
  {
    kind: "correlation",
    label: "Coefficient de corrélation",
    shortLabel: "Corr",
    defaultPeriod: 20,
    hasPeriod: true,
    hasStdDev: false,
    pane: "own",
    category: "Statistiques",
  },
  // Fundamentals: reported-period figures (see `FundamentalDataPoint`), not computed from `data`
  // at all — `hasPeriod`/`hasStdDev` both false, same as VWAP/MACD, since there's no rolling
  // window to configure on a raw reported number.
  {
    kind: "freeCashFlow",
    label: "Free Cash Flow",
    shortLabel: "FCF",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "netIncome",
    label: "Net Income",
    shortLabel: "Net Income",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "totalRevenue",
    label: "Total Revenue",
    shortLabel: "Revenue",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "netMargin",
    label: "Net Margin",
    shortLabel: "Net Margin",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "grossMargin",
    label: "Gross Margin",
    shortLabel: "Gross Margin",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "peRatio",
    label: "Price/Earnings (PER)",
    shortLabel: "P/E",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "eps",
    label: "Earnings Per Share (EPS)",
    shortLabel: "EPS",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
  {
    kind: "debtToEquity",
    label: "Debt/Equity",
    shortLabel: "D/E",
    defaultPeriod: 0,
    hasPeriod: false,
    hasStdDev: false,
    pane: "own",
    category: "Fondamentaux",
  },
];

// Accepts either a plain `IndicatorKind` (every existing call site, unaffected) or a full
// `Indicator` — only the latter can actually detect a custom one (`customData` lives on the
// `Indicator`, not on `kind` alone) and synthesize a matching entry on the fly, since a custom
// series was never added to the static `INDICATOR_CATALOG` array in the first place. A call site
// that only ever has a bare `kind` in scope (nothing custom-aware needs it) keeps working exactly
// as before; one that has the full indicator should pass that instead to get custom-aware pane/
// label/category — see the doc on `Indicator.customData` for why "custom" itself is never looked
// up by kind.
export function indicatorCatalogEntry(indicator: Indicator | IndicatorKind): IndicatorCatalogEntry {
  if (typeof indicator !== "string" && indicator.customData) {
    const def = indicator.customData;
    return {
      kind: "custom",
      label: def.label,
      shortLabel: def.shortLabel ?? def.label,
      defaultPeriod: 0,
      hasPeriod: false,
      hasStdDev: false,
      pane: def.type === "overlay" ? "price" : "own",
      category: def.section,
    };
  }
  const kind = typeof indicator === "string" ? indicator : indicator.kind;
  return INDICATOR_CATALOG.find((entry) => entry.kind === kind) ?? INDICATOR_CATALOG[0];
}

export function indicatorLabel(indicator: Indicator): string {
  if (indicator.customData) return indicator.customData.label;
  const entry = indicatorCatalogEntry(indicator);
  if (indicator.kind === "macd") return `MACD(${indicator.fastPeriod ?? 12},${indicator.slowPeriod ?? 26},${indicator.signalPeriod ?? 9})`;
  if (indicator.kind === "zigzag") return `${entry.shortLabel}(${indicator.zigzagDeviation ?? 5}%)`;
  if (indicator.kind === "supertrend") return `${entry.shortLabel}(${indicator.period},${indicator.supertrendMultiplier ?? 3})`;
  if (indicator.kind === "chandelierExit") return `${entry.shortLabel}(${indicator.period},${indicator.chandelierMultiplier ?? 3})`;
  if (indicator.kind === "parabolicSar") return `${entry.shortLabel}(${indicator.sarStep ?? 0.02},${indicator.sarMax ?? 0.2})`;
  if (indicator.kind === "gaps") return `${entry.shortLabel}(${indicator.gapsMinPercent ?? 0.1}%)`;
  if (indicator.kind === "correlation") return `${entry.shortLabel}(${indicator.correlationSymbol ?? "?"})`;
  if (indicator.kind === "tpo") return `${entry.shortLabel}(${indicator.tpoBlockMinutes ?? 30}min)`;
  if (indicator.kind === "pivotPoints") {
    const typeLabel = { classic: "Classic", fibonacci: "Fibonacci", woodie: "Woodie", camarilla: "Camarilla" }[indicator.pivotType ?? "classic"];
    const periodLabel = { daily: "J", weekly: "S", monthly: "M" }[indicator.pivotPeriod ?? "weekly"];
    return `${entry.shortLabel}(${typeLabel}, ${periodLabel})`;
  }
  if (indicator.kind === "ichimoku")
    return `${entry.shortLabel}(${indicator.ichimokuConversionPeriod ?? 9},${indicator.ichimokuBasePeriod ?? 26},${indicator.ichimokuSpanPeriod ?? 52})`;
  if (!entry.hasPeriod) return entry.shortLabel;
  if (entry.hasStdDev) return `${entry.shortLabel}(${indicator.period},${indicator.stdDev ?? 2})`;
  return `${entry.shortLabel}(${indicator.period})`;
}

export const INDICATOR_COLORS = ["#e0a95c", "#6c87c9", "#7fb37f", "#c96c8f", "#9a7fd1"];

export function defaultIndicatorColor(index: number): string {
  return INDICATOR_COLORS[((index % INDICATOR_COLORS.length) + INDICATOR_COLORS.length) % INDICATOR_COLORS.length];
}
