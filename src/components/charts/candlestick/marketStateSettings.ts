import type { MarketStateAxis, MarketStateDirection } from "./marketState";
import type { Indicator } from "./interfaces/Indicator.interface";

/** What the reader can change about one source feeding the readout — an indicator on the chart, or
 *  one of the price/volume baselines.
 *
 *  Keyed by the source's own label, the same string the panel prints, because that is the only
 *  identity a contribution has that a reader can point at. An indicator whose parameters change
 *  changes its label (`RSI(14)` → `RSI(21)`) and so starts from the defaults again, which is the
 *  honest outcome: the thresholds someone set for a 14-period RSI were set for a 14-period RSI. */
export interface MarketStateSourceSetting {
  /** Counted at all. A source turned off leaves its axis entirely rather than scoring 50 — a
   *  neutral vote and no vote are different claims. */
  enabled: boolean;
  /** Multiplies the weight the engine gives it. 0.5 halves its say, 2 doubles it. */
  weight: number;
  /** At or above this 0-100 score the source reads long; at or below `shortBelow` it reads short;
   *  between the two it is neutral. This is what makes the three-way readout mean something per
   *  indicator rather than only in the blend — exigence : « je veux pouvoir définir les conditions
   *  de long / neutre / short pour chaque indicateur ». */
  longAbove: number;
  shortBelow: number;
}

export const DEFAULT_SOURCE_SETTING: MarketStateSourceSetting = {
  enabled: true,
  weight: 1,
  // ±10 around the middle, the same band the blend's own neutral zone uses, so a source and the
  // signal it feeds call "no opinion" the same thing by default.
  longAbove: 60,
  shortBelow: 40,
};

/** Everything the readout can be tuned by. Owned by the chart (or by its caller) and passed into
 *  every computation, so the shading, the panel and the detached copy are always reading the same
 *  settings — two of them disagreeing about a coefficient is exactly the kind of drift that makes
 *  a readout untrustworthy. */
export interface MarketStateSettings {
  /** How many bars back the baselines and the percentiles look. */
  lookback: number;
  /** Half-width of the neutral band around 50 in the blended signal. */
  neutralBand: number;
  /** How much each axis counts in the blend. `volatility` is 0 by default and deliberately so —
   *  high volatility amplifies a good setup and a bad one equally, so folding it in as a direction
   *  is wrong either way. It is settable rather than absent because that is a judgement, and the
   *  reader is entitled to a different one. */
  axisWeights: Record<MarketStateAxis, number>;
  /** Per-source overrides, by label. Absent entries take `DEFAULT_SOURCE_SETTING`. */
  sources: Record<string, Partial<MarketStateSourceSetting>>;
  /** Whether a side has to hold before it is called at all — see `confirmBars`. Off by default:
   *  the unfiltered reading is the honest one, and hiding a side for three sessions is a trade the
   *  reader should make on purpose. */
  confirmEnabled: boolean;
  /** How many consecutive sessions the same side must read before the panel will name it.
   *
   *  A market that keeps crossing the neutral band genuinely alternates short, neutral, short —
   *  that is the market, not a fault. But a reading that flickers is a reading nobody can act on,
   *  so this holds the verdict back until it has been the same for this many bars. Anything short
   *  of that reads **neutral**, which is the honest name for "no side has held long enough to be
   *  worth calling".
   *
   *  Deliberately not a memory of the last confirmed side: that would need the whole history, and
   *  the panel and the chart shading would then disagree at any bar reached by a different route.
   *  Looking back a fixed number of bars gives the same answer wherever it is asked from. */
  confirmBars: number;
  /** Shortest run of bars the shading will draw, in bars. 1 shades exactly what the panel says at
   *  every bar; higher merges the flickers away and trades that exactness for calm. See
   *  `computeMarketStateBands`. */
  bandSmoothing: number;
  /** Indicators the readout reads but the chart does not draw.
   *
   *  The panel's founding rule is "only what is on screen", and this is the one deliberate
   *  exception to it — asked for, and worth it: a reader who wants an ADX in the reading without a
   *  fourth pane under the candles has no other way to get one. They are listed apart in the
   *  settings and marked in the panel, so the rule's exception stays visible rather than becoming
   *  a hidden input. */
  extraIndicators: Indicator[];
}

export const DEFAULT_MARKET_STATE_SETTINGS: MarketStateSettings = {
  lookback: 200,
  neutralBand: 10,
  axisWeights: { trend: 0.4, momentum: 0.3, flow: 0.15, risk: 0.15, volatility: 0 },
  sources: {},
  confirmEnabled: false,
  confirmBars: 3,
  bandSmoothing: 1,
  extraIndicators: [],
};

/** The effective setting for one source: whatever the reader stored, over the defaults. */
export function sourceSetting(settings: MarketStateSettings, label: string): MarketStateSourceSetting {
  return { ...DEFAULT_SOURCE_SETTING, ...(settings.sources[label] ?? {}) };
}

/** Which side a 0-100 score falls on, given that source's own thresholds. */
export function sourceDirection(score: number, setting: MarketStateSourceSetting): MarketStateDirection {
  if (score >= setting.longAbove) return "long";
  if (score <= setting.shortBelow) return "short";
  return "neutral";
}

/** Whether these settings still say what the defaults say — what a "Réinitialiser" button reads to
 *  know whether there is anything to reset. */
export function isDefaultMarketStateSettings(settings: MarketStateSettings): boolean {
  return (
    settings.lookback === DEFAULT_MARKET_STATE_SETTINGS.lookback &&
    settings.neutralBand === DEFAULT_MARKET_STATE_SETTINGS.neutralBand &&
    settings.bandSmoothing === DEFAULT_MARKET_STATE_SETTINGS.bandSmoothing &&
    settings.confirmEnabled === DEFAULT_MARKET_STATE_SETTINGS.confirmEnabled &&
    settings.confirmBars === DEFAULT_MARKET_STATE_SETTINGS.confirmBars &&
    settings.extraIndicators.length === 0 &&
    Object.keys(settings.sources).length === 0 &&
    (Object.keys(settings.axisWeights) as MarketStateAxis[]).every(
      (axis) => settings.axisWeights[axis] === DEFAULT_MARKET_STATE_SETTINGS.axisWeights[axis]
    )
  );
}
