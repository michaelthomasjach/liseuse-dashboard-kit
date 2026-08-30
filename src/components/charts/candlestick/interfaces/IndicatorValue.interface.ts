import type { IndicatorBand } from "./IndicatorBand.interface";
import type { IndicatorMACD } from "./IndicatorMACD.interface";
import type { IndicatorZigZagPoint } from "./IndicatorZigZagPoint.interface";
import type { IndicatorSupertrendPoint } from "./IndicatorSupertrendPoint.interface";
import type { IndicatorIchimokuPoint } from "./IndicatorIchimokuPoint.interface";
import type { IndicatorGapPoint } from "./IndicatorGapPoint.interface";
import type { IndicatorPivotPointsPoint } from "./IndicatorPivotPointsPoint.interface";
import type { IndicatorADXPoint } from "./IndicatorADXPoint.interface";
import type { IndicatorChandelierPoint } from "./IndicatorChandelierPoint.interface";
import type { IndicatorSRLevel } from "./IndicatorSRLevel.interface";
import type { IndicatorPatternMatch } from "./IndicatorPatternMatch.interface";
import type { IndicatorCandleMatch } from "./IndicatorCandleMatch.interface";

/** A `plot.pane`/`plot.overlay` script pane with 2+ of its own named series (see
 *  `CustomIndicatorDef.multiSeries`'s own doc) — one bar's worth of every sub-series' own value,
 *  keyed by that sub-series' own `key`. Wrapped under a `multi` key rather than a bare `Record`
 *  specifically so a script naming one of its own series "middle"/"macd"/"adx" can never collide
 *  with the type-guards below that already check for those exact keys on a band/MACD-shaped
 *  value. Each entry is independently nullable — a sub-series that started later than another
 *  (its own first `pane.line(...)` call came on a later bar) is `null` until then, same as every
 *  other forward-filled series in this library. */
export interface IndicatorMultiSeriesValue {
  multi: Record<string, number | IndicatorBand | null>;
}

/** Every shape a single indicator value can take, in one place — every file that used to spell
 *  out this union inline (indicators.ts, useIndicatorPaneScales.ts,
 *  RenderCandlestickChartParams.interface.ts, ChartHoverBadges.tsx, PaneHeaders.tsx) now reads
 *  this alias instead, so a new indicator kind with its own value shape only ever needs adding
 *  here once rather than in every one of those five places. A plain `number` covers every
 *  single-line indicator (SMA/EMA/WMA/VWAP/RSI/CHOP/ATR/Parabolic SAR/every fundamental,
 *  built-in or custom) — only the ones with a genuinely richer per-point shape get their own
 *  member. */
export type IndicatorValue =
  | number
  | IndicatorBand
  | IndicatorMACD
  | IndicatorZigZagPoint
  | IndicatorSupertrendPoint
  | IndicatorIchimokuPoint
  | IndicatorGapPoint
  | IndicatorPivotPointsPoint
  | IndicatorADXPoint
  | IndicatorChandelierPoint
  | IndicatorSRLevel[]
  | IndicatorPatternMatch
  | IndicatorCandleMatch
  | IndicatorMultiSeriesValue;
