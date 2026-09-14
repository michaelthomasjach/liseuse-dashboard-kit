import type { ComponentType } from "react";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import { diagramShot } from "./diagramShot";

/** One illustration per built-in `IndicatorKind`, for the info modal behind each row's "?" in the
 *  "Ajouter un indicateur" picker.
 *
 *  Every one is a real screenshot of that indicator plotted on a chart — not a drawing of it. They
 *  were hand-drawn SVGs for a while, and the trouble with a drawing is that it is a reproduction:
 *  it can only be as right as whoever drew it, it drifts as the renderer evolves without anything
 *  failing, and the reader ends up looking at a picture *of* an Ichimoku cloud rather than at one.
 *  See `diagramShots/diagramShotVariants.ts` for the configuration behind each capture, and
 *  `scripts/captureDiagramShots.cjs` for the run that produces them.
 *
 *  "custom" has none, for the same reason it has no canned description: a caller's own
 *  `CustomIndicatorDef` is something this library knows nothing about to photograph. */
export const INDICATOR_DIAGRAMS: Partial<Record<IndicatorKind, ComponentType>> = {
  sma: diagramShot("indicator-sma", "Moyenne mobile simple tracée sur les bougies"),
  ema: diagramShot("indicator-ema", "Moyenne mobile exponentielle tracée sur les bougies"),
  wma: diagramShot("indicator-wma", "Moyenne mobile pondérée tracée sur les bougies"),
  vwap: diagramShot("indicator-vwap", "VWAP tracé sur les bougies, avec le panneau des volumes"),
  bollinger: diagramShot("indicator-bollinger", "Bandes de Bollinger encadrant le prix"),
  rsi: diagramShot("indicator-rsi", "RSI dans son propre panneau sous le prix"),
  chop: diagramShot("indicator-chop", "Choppiness Index dans son propre panneau"),
  macd: diagramShot("indicator-macd", "MACD, sa ligne de signal et son histogramme"),
  zigzag: diagramShot("indicator-zigzag", "Zig Zag reliant les pivots significatifs, étiquetés"),
  atr: diagramShot("indicator-atr", "Average True Range dans son propre panneau"),
  supertrend: diagramShot("indicator-supertrend", "Supertrend basculant d'un côté à l'autre du prix"),
  parabolicSar: diagramShot("indicator-parabolicSar", "Parabolic SAR en points sous puis au-dessus du prix"),
  gaps: diagramShot("indicator-gaps", "Deux écarts de cotation, l'un comblé, l'autre resté ouvert"),
  patternRecognition: diagramShot("indicator-patternRecognition", "Un double sommet détecté et annoté sur le prix"),
  candleRecognition: diagramShot("indicator-candleRecognition", "Une bougie identifiée comme marteau, annotée sur le graphique"),
  ichimoku: diagramShot("indicator-ichimoku", "Ichimoku : ses lignes et son nuage projeté en avant du prix"),
  pivotPoints: diagramShot("indicator-pivotPoints", "Points pivots mensuels, en paliers constants sur chaque période"),
  supportResistance: diagramShot("indicator-supportResistance", "Support et résistance déduits, avec leur nombre de touches"),
  adx: diagramShot("indicator-adx", "ADX avec ses lignes +DI et −DI"),
  chandelierExit: diagramShot("indicator-chandelierExit", "Chandelier Exit suivant le prix, avec ses étiquettes d'achat et de vente"),
  tpo: diagramShot("indicator-tpo", "Profil TPO du temps passé à chaque niveau de prix"),
  correlation: diagramShot("indicator-correlation", "Coefficient de corrélation face à un second symbole"),
  freeCashFlow: diagramShot("indicator-freeCashFlow", "Flux de trésorerie disponible, en paliers trimestriels"),
  netIncome: diagramShot("indicator-netIncome", "Bénéfice net, en paliers trimestriels"),
  totalRevenue: diagramShot("indicator-totalRevenue", "Chiffre d'affaires, en paliers trimestriels"),
  netMargin: diagramShot("indicator-netMargin", "Marge nette, en paliers trimestriels"),
  grossMargin: diagramShot("indicator-grossMargin", "Marge brute, en paliers trimestriels"),
  peRatio: diagramShot("indicator-peRatio", "PER, en paliers trimestriels"),
  eps: diagramShot("indicator-eps", "Bénéfice par action, en paliers trimestriels"),
  debtToEquity: diagramShot("indicator-debtToEquity", "Ratio dette sur capitaux propres, en paliers trimestriels"),
};

/** Volume is not an `IndicatorKind` — it is its own panel behind its own prop — so the info modal
 *  reaches for this one by name rather than through the table above. */
export const VolumeDiagram = diagramShot("indicator-volume", "Le panneau des volumes sous le tracé des prix");
