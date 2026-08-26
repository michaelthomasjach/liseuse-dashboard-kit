import type { ComponentType } from "react";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import { SmaDiagram, EmaDiagram, WmaDiagram, VwapDiagram } from "./movingAverageDiagrams";
import { BollingerDiagram, ChopDiagram, AtrDiagram } from "./volatilityDiagrams";
import { RsiDiagram, MacdDiagram, AdxDiagram } from "./momentumDiagrams";
import { ZigzagDiagram, SupertrendDiagram, ParabolicSarDiagram, IchimokuDiagram, ChandelierExitDiagram } from "./trendDiagrams";
import {
  GapsDiagram,
  PatternRecognitionDiagram,
  CandleRecognitionDiagram,
  PivotPointsDiagram,
  SupportResistanceDiagram,
  TpoDiagram,
} from "./structureDiagrams";
import {
  CorrelationDiagram,
  FreeCashFlowDiagram,
  NetIncomeDiagram,
  TotalRevenueDiagram,
  NetMarginDiagram,
  GrossMarginDiagram,
  PeRatioDiagram,
  EpsDiagram,
  DebtToEquityDiagram,
} from "./statsFundamentalsDiagrams";

/** One explanatory diagram per built-in `IndicatorKind` (see `INDICATOR_DESCRIPTIONS` for the
 *  matching prose) — "custom" has none, same reasoning that kind has no canned description either
 *  (a caller's own `CustomIndicatorDef` is something this library knows nothing about to draw). */
export const INDICATOR_DIAGRAMS: Partial<Record<IndicatorKind, ComponentType>> = {
  sma: SmaDiagram,
  ema: EmaDiagram,
  wma: WmaDiagram,
  vwap: VwapDiagram,
  bollinger: BollingerDiagram,
  chop: ChopDiagram,
  atr: AtrDiagram,
  rsi: RsiDiagram,
  macd: MacdDiagram,
  adx: AdxDiagram,
  zigzag: ZigzagDiagram,
  supertrend: SupertrendDiagram,
  parabolicSar: ParabolicSarDiagram,
  ichimoku: IchimokuDiagram,
  chandelierExit: ChandelierExitDiagram,
  gaps: GapsDiagram,
  patternRecognition: PatternRecognitionDiagram,
  candleRecognition: CandleRecognitionDiagram,
  pivotPoints: PivotPointsDiagram,
  supportResistance: SupportResistanceDiagram,
  tpo: TpoDiagram,
  correlation: CorrelationDiagram,
  freeCashFlow: FreeCashFlowDiagram,
  netIncome: NetIncomeDiagram,
  totalRevenue: TotalRevenueDiagram,
  netMargin: NetMarginDiagram,
  grossMargin: GrossMarginDiagram,
  peRatio: PeRatioDiagram,
  eps: EpsDiagram,
  debtToEquity: DebtToEquityDiagram,
};
