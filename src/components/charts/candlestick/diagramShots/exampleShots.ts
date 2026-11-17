import type { CandlestickChartProps } from "../interfaces/CandlestickChartProps.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { DiagramShotVariant } from "./diagramShotVariants";
import { EXAMPLE_DATASETS, type ExampleDataset } from "./exampleShotData";

/** Les captures d'exemple des pages d'aide des indicateurs : une par cas de « Ce qu'il faut rechercher », citée dans la
 *  description par `[[illustration:example-…|Légende]]` (voir indicatorDescriptions.ts). Même chaîne que les autres
 *  captures : `scripts/captureDiagramShots.cjs` les rend et écrit un JPEG chacune. */
interface ExampleSpec {
  /** Les indicateurs posés sur le graphique (le premier est le sujet). */
  indicators: Omit<Indicator, "id">[];
  data: ExampleDataset;
  /** Panneau des volumes affiché (indicateurs qui en dépendent : VWAP…). */
  volume?: boolean;
}

const ex = ({ indicators, data, volume }: ExampleSpec): DiagramShotVariant => ({
  props: {
    defaultIndicators: indicators.map((indicator, i) => ({ id: `example-${i}`, ...indicator }) as Indicator),
    data: EXAMPLE_DATASETS[data],
    ...(volume ? { showVolume: true } : {}),
  } as Partial<CandlestickChartProps>,
  crop: "plot",
});

/** Clé : l'identifiant de la capture sans son préfixe `example-`. */
export const EXAMPLE_SHOTS: Record<string, DiagramShotVariant> = {
  "donchian-uptrend": ex({ indicators: [{ kind: "donchian", period: 20 }], data: "up" }),
  "donchian-downtrend": ex({ indicators: [{ kind: "donchian", period: 20 }], data: "down" }),
  "donchian-range": ex({ indicators: [{ kind: "donchian", period: 20 }], data: "range" }),
  "rsiZones-range": ex({ indicators: [{ kind: "rsiZones", period: 14, rsiZonesLookback: 120 }], data: "range" }),
  "rsiZones-uptrend": ex({ indicators: [{ kind: "rsiZones", period: 14, rsiZonesLookback: 120 }], data: "up" }),
  "srBounce-range": ex({ indicators: [{ kind: "srBounce", period: 200, srbShowFactors: true }], data: "range" }),
  "srBounce-uptrend": ex({ indicators: [{ kind: "srBounce", period: 200 }], data: "up" }),
  "srBounce-reversal": ex({ indicators: [{ kind: "srBounce", period: 200, srbShowFactors: true }], data: "reversal" }),
  "zigzag-range": ex({ indicators: [{ kind: "zigzag", period: 0, zigzagDeviation: 5 }], data: "range" }),
  "zigzag-reversal": ex({ indicators: [{ kind: "zigzag", period: 0, zigzagDeviation: 5 }], data: "reversal" }),
  "atr-up": ex({ indicators: [{ kind: "atr", period: 14 }], data: "up" }),
  "atr-up-percent": ex({ indicators: [{ kind: "atr", period: 14, atrAsPercent: true }], data: "up" }),
  "supertrend-up": ex({ indicators: [{ kind: "supertrend", period: 10, supertrendMultiplier: 3 }], data: "up" }),
  "supertrend-reversal": ex({ indicators: [{ kind: "supertrend", period: 10, supertrendMultiplier: 3 }], data: "reversal" }),
  "supertrend-range": ex({ indicators: [{ kind: "supertrend", period: 10, supertrendMultiplier: 3 }], data: "range" }),
  "parabolicSar-reversal": ex({ indicators: [{ kind: "parabolicSar", period: 0, sarStep: 0.02, sarMax: 0.2 }], data: "reversal" }),
  "parabolicSar-range": ex({ indicators: [{ kind: "parabolicSar", period: 0, sarStep: 0.02, sarMax: 0.2 }], data: "range" }),
  "ichimoku-up": ex({ indicators: [{ kind: "ichimoku", period: 0 }], data: "up" }),
  "ichimoku-reversal": ex({ indicators: [{ kind: "ichimoku", period: 0 }], data: "reversal" }),
  "ichimoku-range": ex({ indicators: [{ kind: "ichimoku", period: 0 }], data: "range" }),
  "pivotPoints-uptrend": ex({ indicators: [{ kind: "pivotPoints", period: 0, pivotType: "classic", pivotPeriod: "weekly" }], data: "up" }),
  "pivotPoints-downtrend": ex({ indicators: [{ kind: "pivotPoints", period: 0, pivotType: "classic", pivotPeriod: "weekly" }], data: "down" }),
  "supportResistance-uptrend": ex({ indicators: [{ kind: "supportResistance", period: 150, srMaxLevels: 6 }], data: "up" }),
  "supportResistance-downtrend": ex({ indicators: [{ kind: "supportResistance", period: 150, srMaxLevels: 6 }], data: "down" }),
  "adx-uptrend": ex({ indicators: [{ kind: "adx", period: 14 }], data: "up" }),
  "adx-reversal": ex({ indicators: [{ kind: "adx", period: 14 }], data: "reversal" }),
  "chandelierExit-uptrend": ex({ indicators: [{ kind: "chandelierExit", period: 22, chandelierMultiplier: 3 }], data: "up" }),
  "chandelierExit-reversal": ex({ indicators: [{ kind: "chandelierExit", period: 22, chandelierMultiplier: 3 }], data: "reversal" }),
  "chandelierExit-range": ex({ indicators: [{ kind: "chandelierExit", period: 22, chandelierMultiplier: 3 }], data: "range" }),
  "rangeDetection-uptrend": ex({ indicators: [{ kind: "rangeDetection", period: 14 }], data: "up" }),
  "rangeDetection-reversal": ex({ indicators: [{ kind: "rangeDetection", period: 14 }], data: "reversal" }),
  "sma-uptrend": ex({ indicators: [{ kind: "sma", period: 20 }], data: "up" }),
  "sma-crossover": ex({ indicators: [{ kind: "sma", period: 20 }, { kind: "sma", period: 50 }], data: "reversal" }),
  "sma-range": ex({ indicators: [{ kind: "sma", period: 20 }, { kind: "sma", period: 50 }], data: "range" }),
  "ema-reversal": ex({ indicators: [{ kind: "ema", period: 20 }, { kind: "sma", period: 20 }], data: "reversal" }),
  "ema-crossover": ex({ indicators: [{ kind: "ema", period: 9 }, { kind: "ema", period: 21 }], data: "reversal" }),
  "wma-reversal": ex({ indicators: [{ kind: "wma", period: 20 }, { kind: "sma", period: 20 }], data: "reversal" }),
  "vwap-uptrend": ex({ indicators: [{ kind: "vwap", period: 0 }], data: "up", volume: true }),
  "vwap-range": ex({ indicators: [{ kind: "vwap", period: 0 }], data: "range", volume: true }),
  "bollinger-squeeze": ex({ indicators: [{ kind: "bollinger", period: 20, stdDev: 2 }], data: "down" }),
  "bollinger-uptrend": ex({ indicators: [{ kind: "bollinger", period: 20, stdDev: 2 }], data: "up" }),
  "bollinger-range": ex({ indicators: [{ kind: "bollinger", period: 20, stdDev: 2 }], data: "range" }),
  "rsi-range": ex({ indicators: [{ kind: "rsi", period: 14 }], data: "range" }),
  "rsi-uptrend": ex({ indicators: [{ kind: "rsi", period: 14 }], data: "up" }),
  "rsi-divergence": ex({ indicators: [{ kind: "rsi", period: 14 }], data: "reversal" }),
  "chop-uptrend": ex({ indicators: [{ kind: "chop", period: 14 }], data: "up" }),
  "chop-reversal": ex({ indicators: [{ kind: "chop", period: 14 }], data: "reversal" }),
  "macd-reversal": ex({ indicators: [{ kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }], data: "reversal" }),
  "macd-range": ex({ indicators: [{ kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }], data: "range" }),
};
