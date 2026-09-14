import type { Candle } from "./interfaces/Candle.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { IndicatorBand } from "./interfaces/IndicatorBand.interface";
import type { IndicatorMACD } from "./interfaces/IndicatorMACD.interface";
import type { IndicatorADXPoint } from "./interfaces/IndicatorADXPoint.interface";
import type { IndicatorSupertrendPoint } from "./interfaces/IndicatorSupertrendPoint.interface";
import type { IndicatorIchimokuPoint } from "./interfaces/IndicatorIchimokuPoint.interface";
import type { IndicatorChandelierPoint } from "./interfaces/IndicatorChandelierPoint.interface";
import type { IndicatorZigZagPoint } from "./interfaces/IndicatorZigZagPoint.interface";
import type { IndicatorSRLevel } from "./interfaces/IndicatorSRLevel.interface";
import { indicatorLabel } from "./indicatorCatalog";
import {
  DEFAULT_MARKET_STATE_SETTINGS,
  sourceDirection,
  sourceSetting,
  type MarketStateSettings,
} from "./marketStateSettings";

/** The "Market State" panel's own model: five 0-100 readings of the market, computed from
 *  whatever indicators are actually on the chart, plus a single long-side signal blended from
 *  them.
 *
 *  The point is stated best as the problem it replaces: a chart carrying fifteen indicators is
 *  fifteen things to read and weigh in your head, every time. This reads them for you — but the
 *  moment a number like "TREND 78/100" cannot be taken apart, it is worth nothing, because there
 *  is no way to tell a considered reading from a coin flip. So every score here carries the exact
 *  list of what fed it: which indicator, what it currently reads, what that became on a 0-100
 *  scale, how heavily it counted, and one line saying why. Nothing in this file produces a number
 *  it cannot show its work for.
 *
 *  Two rules keep it honest:
 *
 *  - **Only what is on screen.** Scores are built from the indicators the chart is actually
 *    displaying, not from a hidden set computed behind the reader's back. Add an ADX and the trend
 *    score gains a line; remove it and the score changes, visibly.
 *  - **Plus a stated baseline.** Every axis also has one contribution derived from price and
 *    volume alone, labelled as such, so the panel says something true on a bare chart instead of
 *    five dashes — and so a single indicator can never swing an axis all by itself. */
export type MarketStateAxis = "trend" | "momentum" | "volatility" | "flow" | "risk";

export interface MarketStateContribution {
  /** The indicator's own name as the legend shows it, or "Prix" / "Volume" for a baseline. */
  label: string;
  /** What it currently reads, formatted for display. */
  reading: string;
  /** What that reading is worth on this axis, 0-100. */
  score: number;
  /** Its share of the axis average. Baselines weigh 1; a directional indicator that says more
   *  weighs more. */
  weight: number;
  /** The arithmetic itself, with this bar's own numbers already substituted — e.g.
   *  `50 + (+0,19 % ÷ 4 %) × 50 = 52`. `why` says what the reading means; this says how it became
   *  a number, which is the only form in which a score can actually be disagreed with. */
  formula: string;
  /** One sentence turning the reading into the score, so the arithmetic is checkable. */
  why: string;
  /** Which side this one source reads, on its own thresholds (see `MarketStateSourceSetting`).
   *  Assigned after the fact rather than by each scorer: the thresholds are the reader's to set, so
   *  the same 63 is a long for one source and neutral for another, and only the settings know. */
  direction: MarketStateDirection;
  /** False when the reader has switched this source off. Still listed — a source you turned off is
   *  something you want to see is off, not something that should vanish — but it counts for
   *  nothing. */
  counted: boolean;
  /** Its weight after the reader's own multiplier, which is the number actually used. */
  effectiveWeight: number;
  /** True for a source read from `settings.extraIndicators`: in the reading, absent from the
   *  chart. Marked so the panel's "only what is on screen" rule shows its own exception. */
  offChart?: boolean;
}

export interface MarketStateScore {
  axis: MarketStateAxis;
  /** The short all-caps name shown in the box: TREND, VOL, FLOW, MOM, RISK. */
  label: string;
  /** What the axis measures, in a sentence — shown when the score is expanded. */
  hint: string;
  /** The weighted mean of `contributions`, rounded. `null` only if nothing contributed at all,
   *  which the baselines make practically impossible — a chart with fewer than a handful of
   *  candles is the real case. */
  score: number | null;
  contributions: MarketStateContribution[];
}

export interface MarketStateSignalPart {
  label: string;
  score: number;
  weight: number;
}

/** Which side the blend comes down on. A weighted mean of four 0-100 axes sits near 50 whenever
 *  nothing agrees, and calling that a weak long is how a readout starts lying: `"neutral"` covers
 *  the band where the reading has no side, and it is a real answer, not a missing one. */
export type MarketStateDirection = "long" | "short" | "neutral";

/** Half-width of the neutral band around 50. ±10 rather than something tighter: the axes disagree
 *  with each other constantly, and a blend that wanders a few points either way has not said
 *  anything worth acting on. */
export const SIGNAL_NEUTRAL_BAND = 10;

export interface MarketState {
  scores: MarketStateScore[];
  /** The blend, 0-100, read from the long side — 50 is the middle, 100 is maximally long, 0 is
   *  maximally short. `null` when no axis could be scored. */
  signal: number | null;
  /** Which side that lands on, given the neutral band above — and, when confirmation is switched
   *  on, only once that side has held for `settings.confirmBars` sessions. Until then this reads
   *  neutral: no side has lasted long enough to be worth calling. */
  direction: MarketStateDirection;
  /** The same verdict before confirmation. Identical to `direction` when confirmation is off; when
   *  it is on, this is what the bar says on its own and `direction` is what the panel will stand
   *  behind — the panel shows both, so a reading being held back is visible rather than silent. */
  rawDirection: MarketStateDirection;
  /** How many of the last `confirmBars` sessions agree with `rawDirection`, when confirmation is
   *  on. `null` when it is off. Lets the panel say "2/3" rather than only "not yet". */
  confirmedFor: number | null;
  /** How strongly, on the side `direction` names: the distance from the middle, restated as a
   *  percentage of that side. A signal of 26 is "SHORT 74 %", not "LONG 26 %" — the same number,
   *  said the way round a reader can act on. */
  strength: number | null;
  /** Exactly what went into `signal`, same decomposability rule as the axes. */
  signalParts: MarketStateSignalPart[];
  /** All three sides at once, as shares of the counted weight — exigence : « afficher les trois
   *  états à la fois LONG, NEUTRAL, SHORT ».
   *
   *  A blended signal of 58 says "slightly long" and hides how it got there: eight sources split
   *  five long, three short, or eleven sources all mildly long, are the same 58 and are not the
   *  same market. This is the vote behind the average — what share of the weight reads each way,
   *  each source judged on its own thresholds. The three always sum to 100. */
  stance: Record<MarketStateDirection, number>;
  /** Which bar every reading above describes — the last visible one, or whichever the pointer is
   *  on. Shown in the panel so a hovered reading is never mistaken for the current one. */
  atIndex: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
/** Every figure in this panel uses the reader's own decimal comma.
 *
 *  Through a kept `Intl.NumberFormat` rather than `Number.toLocaleString`, which builds a fresh
 *  formatter on every call: identical output, 22× faster, and it is most of what this file costs.
 *  Every reading formats a handful of numbers, and shading a chart means computing every bar — so a
 *  whole-series pass over 3000 bars spent 570 of its 660 ms inside the formatter alone. */
const formatters = new Map<number, Intl.NumberFormat>();
const n = (value: number, digits = 2) => {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(digits, formatter);
  }
  return formatter.format(value);
};
const p1 = (value: number) => `${value >= 0 ? "+" : ""}${n(value * 100)} %`;
const clamp100 = (value: number) => clamp(value, 0, 100);
// Everything the panel prints goes through these, so a reading and the formula under it are never
// written in two different notations — which is what a decimal point above a decimal comma looks
// like, and it reads as two unrelated numbers.
const fmt = (value: number, digits = 2) => n(value, digits);
const pct = (value: number) => p1(value);

/** Maps a signed relative distance onto 0-100 around a neutral 50, saturating at `full`. The one
 *  place "how far above its moving average is far?" is answered, so every indicator that asks it
 *  answers it the same way. `full` is a fraction: 0.04 means "4 % away is as extreme as it gets". */
function scoreFromRelative(distance: number, full: number): number {
  return clamp100(50 + (distance / full) * 50);
}

/** Where `value` sits within `series`, as a percentile 0-100. Used wherever the question is "is
 *  this high *for this instrument*" — an ATR of 2.4 means nothing on its own, and everything
 *  against the range of the last few hundred bars. */
function percentileOf(value: number, series: number[]): number | null {
  // Counted in one pass rather than filtered twice. It reads no worse and it is called once per
  // indicator per bar — over a whole series, two throwaway arrays per call is most of the cost of
  // shading a chart.
  let usable = 0;
  let below = 0;
  for (const entry of series) {
    if (!Number.isFinite(entry)) continue;
    usable += 1;
    if (entry < value) below += 1;
  }
  if (usable < 5) return null;
  return clamp100((below / usable) * 100);
}

/** How a percentile reads in a sentence. At the very ends, "plus élevé que 0 % de la fenêtre" is
 *  technically true and looks like a broken readout — the honest phrasing there is that this *is*
 *  the extreme. */
function rankPhrase(rank: number, count: number, high: string, low: string): string {
  if (rank <= 2) return `${low} sur les ${count} dernières mesures.`;
  if (rank >= 98) return `${high} sur les ${count} dernières mesures.`;
  return `Plus élevé que ${Math.round(rank)} % des ${count} dernières mesures.`;
}

function weightedMean(contributions: MarketStateContribution[]): number | null {
  // `effectiveWeight`, not `weight`: a source switched off weighs nothing and a source the reader
  // doubled weighs twice, and the axis average is the one place that has to know it.
  const total = contributions.reduce((sum, c) => sum + c.effectiveWeight, 0);
  if (total <= 0) return null;
  return Math.round(contributions.reduce((sum, c) => sum + c.score * c.effectiveWeight, 0) / total);
}

/** A simple moving average of `values` ending at `end` (inclusive). `null` when the window doesn't
 *  fit — never a partial average, which would quietly read as a different indicator. */
function meanEndingAt(values: number[], end: number, period: number): number | null {
  if (end < period - 1) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += values[i];
  return sum / period;
}

export interface MarketStateInput {
  candles: Candle[];
  /** The bar every reading describes. Clamped into range by the caller's own hover logic; guarded
   *  here anyway. */
  index: number;
  /** Exactly what the chart is drawing right now — same array the legend and the canvas read, so
   *  the panel can never disagree with what is on screen. A hidden indicator is the caller's to
   *  filter out (see `computeMarketState`'s own usage in CandlestickChart). */
  indicators: { indicator: Indicator; values: (IndicatorValue | null)[]; offChart?: boolean }[];
  /** How many bars back the baselines and the percentiles look. Defaults to 200 — long enough for
   *  "high for this instrument" to mean something, short enough to describe the present. Ignored
   *  when `settings` carries its own, which is the normal path. */
  lookback?: number;
  /** Weights, thresholds and the neutral band, as the reader set them. Defaults throughout when
   *  absent, which is what every existing caller gets. */
  settings?: MarketStateSettings;
}

/** What a scorer pushes. The three fields it lacks are not its business: whether a source counts,
 *  how heavily, and which side it reads are all the reader's settings talking, and they are applied
 *  in one place (`finalise`) rather than threaded through two dozen scorers that would each have to
 *  remember to. */
type RawContribution = Omit<MarketStateContribution, "direction" | "counted" | "effectiveWeight">;

type Bucket = { contributions: RawContribution[] };

/** Applies the reader's settings to one scorer's output. */
function finalise(raw: RawContribution, settings: MarketStateSettings, offChartLabels: Set<string>): MarketStateContribution {
  const setting = sourceSetting(settings, raw.label);
  return {
    ...raw,
    direction: sourceDirection(raw.score, setting),
    counted: setting.enabled,
    effectiveWeight: setting.enabled ? raw.weight * setting.weight : 0,
    offChart: offChartLabels.has(raw.label) || undefined,
  };
}

/** Reads one indicator's value at `index`, skipping the nulls every series starts with. */
function valueAt(entry: MarketStateInput["indicators"][number], index: number): IndicatorValue | null {
  return entry.values[index] ?? null;
}

/** Narrowing helpers over `IndicatorValue`'s union. Each names the real interface rather than an
 *  inline shape: a predicate has to be assignable to the union it narrows, and a partial shape
 *  isn't. Keyed on a field only that member has, same discrimination the renderers already use. */
const isBand = (v: IndicatorValue): v is IndicatorBand =>
  typeof v === "object" && v !== null && "upper" in v && "middle" in v;
const isMacd = (v: IndicatorValue): v is IndicatorMACD => typeof v === "object" && v !== null && "macd" in v;
const isAdx = (v: IndicatorValue): v is IndicatorADXPoint => typeof v === "object" && v !== null && "adx" in v;
const isSupertrend = (v: IndicatorValue): v is IndicatorSupertrendPoint =>
  typeof v === "object" && v !== null && "trend" in v;
const isIchimoku = (v: IndicatorValue): v is IndicatorIchimokuPoint =>
  typeof v === "object" && v !== null && "spanA" in v;
const isChandelier = (v: IndicatorValue): v is IndicatorChandelierPoint =>
  typeof v === "object" && v !== null && "dir" in v;
const isZigZag = (v: IndicatorValue): v is IndicatorZigZagPoint =>
  typeof v === "object" && v !== null && "kind" in v && "price" in v;
const isSrLevels = (v: IndicatorValue): v is IndicatorSRLevel[] => Array.isArray(v);

/** The three series and the one rolling statistic every reading needs, derived once per dataset.
 *
 *  They are pure functions of `candles` and identical at every bar, yet the readout is computed per
 *  bar — for the panel on each pointer move, and for the whole series when the chart shades its
 *  zones. Rebuilding them per call made one reading cost 0.84 ms and a whole-series pass over 3000
 *  bars cost 1.1 s, which is why the shading used to be sampled every Nth bar and disagreed with
 *  the panel in between. Cached, a reading is a fraction of that and the shading can afford to be
 *  computed at every bar, which is what makes the two agree by construction.
 *
 *  A `WeakMap` on the array's own identity: a new `candles` array is new data by definition, so
 *  there is no invalidation rule to get wrong, and nothing is retained once the caller drops it. */
const derivedCache = new WeakMap<Candle[], DerivedSeries>();

interface DerivedSeries {
  closes: number[];
  volumes: number[];
  /** `returns[i]` is the move from candle `i` to candle `i + 1`. */
  returns: number[];
  /** The standard deviation of the 20 returns ending just before bar `i`, or null where the window
   *  does not fit. Same definition as the per-call version it replaces, bound for bound. */
  realized: (number | null)[];
}

function derivedSeries(candles: Candle[]): DerivedSeries {
  const cached = derivedCache.get(candles);
  if (cached) return cached;
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume ?? 0);
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const realized: (number | null)[] = new Array(candles.length).fill(null);
  for (let end = 20; end < candles.length; end++) {
    let sum = 0;
    for (let i = end - 20; i < end; i++) sum += returns[i];
    const mean = sum / 20;
    let variance = 0;
    for (let i = end - 20; i < end; i++) variance += (returns[i] - mean) ** 2;
    realized[end] = Math.sqrt(variance / 20);
  }
  const derived: DerivedSeries = { closes, volumes, returns, realized };
  derivedCache.set(candles, derived);
  return derived;
}

export function computeMarketState({
  candles,
  index,
  indicators,
  lookback,
  settings = DEFAULT_MARKET_STATE_SETTINGS,
}: MarketStateInput): MarketState {
  // The settings own the lookback; the bare argument stays for callers that predate them.
  const effectiveLookback = lookback ?? settings.lookback;
  const at = clamp(Math.round(index), 0, Math.max(0, candles.length - 1));
  // Which labels come from an indicator the chart is not drawing — see
  // `MarketStateSettings.extraIndicators` for why that exception exists and why it is marked.
  const offChartLabels = new Set(indicators.filter((entry) => entry.offChart).map((entry) => indicatorLabel(entry.indicator)));
  const trend: Bucket = { contributions: [] };
  const momentum: Bucket = { contributions: [] };
  const volatility: Bucket = { contributions: [] };
  const flow: Bucket = { contributions: [] };
  const risk: Bucket = { contributions: [] };

  const empty: MarketState = {
    scores: buildScores(trend, momentum, volatility, flow, risk, settings, offChartLabels),
    signal: null,
    direction: "neutral",
    rawDirection: "neutral",
    confirmedFor: null,
    strength: null,
    signalParts: [],
    stance: { long: 0, neutral: 100, short: 0 },
    atIndex: at,
  };
  if (candles.length < 20) return empty;

  const bar = candles[at];
  const price = bar.close;
  const from = Math.max(0, at - effectiveLookback + 1);
  // Length and highest high are all the window is ever asked for, and slicing 200 candles to ask
  // is 200 allocations per bar. Both are one loop.
  const windowLength = at - from + 1;
  const { closes, volumes, realized: realizedSeries } = derivedSeries(candles);

  // ---- baselines: what price and volume say on their own -------------------------------------

  const trendMean = meanEndingAt(closes, at, Math.min(50, Math.floor(windowLength / 2)));
  if (trendMean !== null) {
    const distance = (price - trendMean) / trendMean;
    trend.contributions.push({
      label: "Prix (intégré)",
      reading: `${fmt(price)} vs moyenne 50 ${fmt(trendMean)}`,
      score: scoreFromRelative(distance, 0.04),
      weight: 1,
      formula: `50 + (${p1(distance)} ÷ 4 %) × 50 = ${Math.round(scoreFromRelative(distance, 0.04))}`,
      why: `Écart de ${pct(distance)} à sa moyenne 50 périodes ; ±4 % sature l'échelle.`,
    });
  }

  const momentumBase = windowLength > 14 ? (price - closes[at - 14]) / closes[at - 14] : null;
  if (momentumBase !== null) {
    momentum.contributions.push({
      label: "Prix (intégré)",
      reading: `${pct(momentumBase)} sur 14 périodes`,
      score: scoreFromRelative(momentumBase, 0.06),
      weight: 1,
      formula: `50 + (${p1(momentumBase)} ÷ 6 %) × 50 = ${Math.round(scoreFromRelative(momentumBase, 0.06))}`,
      why: "Variation sur 14 périodes ; ±6 % sature l'échelle.",
    });
  }

  // Realized volatility: the standard deviation of daily returns over 20 bars, ranked against the
  // same measure over the whole window — the "is this calm or wild *for this instrument*" question.
  const realizedNow = realizedSeries[at] ?? null;
  if (realizedNow !== null) {
    const history: number[] = [];
    for (let i = from + 20; i <= at; i++) {
      const v = realizedSeries[i];
      if (v !== null && v !== undefined) history.push(v);
    }
    const rank = percentileOf(realizedNow, history);
    if (rank !== null) {
      volatility.contributions.push({
        label: "Prix (intégré)",
        reading: `Volatilité réalisée ${(realizedNow * 100).toFixed(2)} % (20 p.)`,
        score: rank,
        weight: 1,
        formula: `rang ${history.filter((v) => v < realizedNow).length} / ${history.length} → ${Math.round(rank)}`,
        why: rankPhrase(rank, history.length, "La plus forte volatilité", "La plus faible volatilité"),
      });
      risk.contributions.push({
        label: "Volatilité (intégré)",
        reading: `${Math.round(rank)}ᵉ centile`,
        score: rank,
        weight: 1,
        formula: `centile de volatilité = ${Math.round(rank)} → ${Math.round(rank)}`,
        why: "Une volatilité haute pour cet instrument est en soi un risque de position.",
      });
    }
  }

  let windowHigh = -Infinity;
  for (let i = from; i <= at; i++) if (candles[i].high > windowHigh) windowHigh = candles[i].high;
  if (windowHigh > 0) {
    const drawdown = (windowHigh - price) / windowHigh;
    risk.contributions.push({
      label: "Repli (intégré)",
      reading: `${pct(-drawdown)} sous le plus haut de la fenêtre`,
      score: clamp100((drawdown / 0.2) * 100),
      weight: 1,
      formula: `(${n(drawdown * 100)} % ÷ 20 %) × 100 = ${Math.round(clamp100((drawdown / 0.2) * 100))}`,
      why: "Distance au plus haut récent ; -20 % sature l'échelle.",
    });
  }

  // Volume, signed by the bar's own direction. Only volume *above* the average counts: a bar
  // trading less than usual says nothing about who is in control, in either direction — reading a
  // quiet down-bar as mildly bullish (which subtracting a negative excess would do) is inventing a
  // conviction nobody showed. Below average therefore lands on a flat 50.
  const volumeMean = meanEndingAt(volumes, at, Math.min(20, windowLength));
  if (volumeMean !== null && volumeMean > 0) {
    const relative = (volumes[at] - volumeMean) / volumeMean;
    const excess = clamp(relative, 0, 1);
    const direction = Math.sign(bar.close - bar.open) || 0;
    flow.contributions.push({
      label: "Volume (intégré)",
      reading: `${relative >= 0 ? "+" : ""}${Math.round(relative * 100)} % vs moyenne 20`,
      score: clamp100(50 + direction * excess * 40),
      weight: 1,
      formula: `50 + (${direction >= 0 ? "+1" : "−1"}) × ${n(excess)} × 40 = ${Math.round(clamp100(50 + direction * excess * 40))}`,
      why:
        excess === 0
          ? "Volume sous sa moyenne : rien ne dit qui mène, ni dans un sens ni dans l'autre."
          : direction === 0
            ? "Bougie sans direction : le volume ne penche d'aucun côté."
            : `Volume au-dessus de sa moyenne sur une bougie ${direction > 0 ? "haussière" : "baissière"}.`,
    });
  }

  // ---- what the indicators on the chart say ---------------------------------------------------

  for (const entry of indicators) {
    const { indicator } = entry;
    const value = valueAt(entry, at);
    if (value === null || value === undefined) continue;
    const label = indicatorLabel(indicator);

    switch (indicator.kind) {
      case "sma":
      case "ema":
      case "wma": {
        if (typeof value !== "number") break;
        const distance = (price - value) / value;
        trend.contributions.push({
          label,
          reading: `${fmt(value)} — prix ${price >= value ? "au-dessus" : "en dessous"}`,
          score: scoreFromRelative(distance, 0.04),
          weight: 1.5,
          formula: `50 + (${p1(distance)} ÷ 4 %) × 50 = ${Math.round(scoreFromRelative(distance, 0.04))}`,
          why: `Le prix est à ${pct(distance)} de cette moyenne ; ±4 % sature l'échelle.`,
        });
        break;
      }
      case "vwap": {
        if (typeof value !== "number") break;
        const distance = (price - value) / value;
        flow.contributions.push({
          label,
          reading: `${fmt(value)} — prix ${price >= value ? "au-dessus" : "en dessous"}`,
          score: scoreFromRelative(distance, 0.03),
          weight: 2,
          formula: `50 + (${p1(distance)} ÷ 3 %) × 50 = ${Math.round(scoreFromRelative(distance, 0.03))}`,
          why: "Le VWAP est le prix moyen pondéré par les volumes : s'en écarter par le haut, c'est acheter plus cher que la moyenne des échanges.",
        });
        break;
      }
      case "rsi": {
        if (typeof value !== "number") break;
        momentum.contributions.push({
          label,
          reading: fmt(value, 1),
          score: clamp100(value),
          weight: 2,
          formula: `RSI ${n(value, 1)} → ${Math.round(clamp100(value))} (repris tel quel)`,
          why: "Le RSI est déjà une échelle 0-100 de momentum : il est repris tel quel.",
        });
        break;
      }
      case "macd": {
        if (!isMacd(value) || value.histogram === null) break;
        // Scaled against its own recent amplitude — a histogram of 0.4 is huge on one instrument
        // and noise on another.
        const amplitudes = entry.values
          .slice(from, at + 1)
          .map((v) => (v && isMacd(v) && v.histogram !== null ? Math.abs(v.histogram) : null))
          .filter((n): n is number => n !== null);
        const scale = amplitudes.length > 0 ? Math.max(...amplitudes) : Math.abs(value.histogram);
        momentum.contributions.push({
          label,
          reading: `Histogramme ${fmt(value.histogram, 3)}`,
          score: scale > 0 ? clamp100(50 + (value.histogram / scale) * 50) : 50,
          weight: 2,
          formula:
            scale > 0
              ? `50 + (${n(value.histogram, 3)} ÷ ${n(scale, 3)}) × 50 = ${Math.round(clamp100(50 + (value.histogram / scale) * 50))}`
              : "amplitude nulle sur la fenêtre → 50",
          why: "Histogramme rapporté à sa propre amplitude maximale sur la fenêtre.",
        });
        break;
      }
      case "supertrend": {
        if (!isSupertrend(value)) break;
        trend.contributions.push({
          label,
          reading: value.trend === "up" ? "Tendance haussière" : "Tendance baissière",
          // 85/15, not 100/0: a two-state indicator is a strong opinion, never a certainty, and
          // letting one saturate the axis would drown out everything measured on a real scale.
          score: value.trend === "up" ? 85 : 15,
          weight: 2,
          formula: value.trend === "up" ? "haussière → 85" : "baissière → 15",
          why: "Indicateur directionnel binaire : forte opinion, jamais une certitude.",
        });
        break;
      }
      case "parabolicSar": {
        if (typeof value !== "number") break;
        trend.contributions.push({
          label,
          reading: value <= price ? "Points sous le prix" : "Points au-dessus du prix",
          score: value <= price ? 80 : 20,
          weight: 1.5,
          formula: value <= price ? "points sous le prix → 80" : "points au-dessus → 20",
          why: "Le SAR passe sous le prix en tendance haussière, au-dessus en tendance baissière.",
        });
        break;
      }
      case "chandelierExit": {
        if (!isChandelier(value)) break;
        trend.contributions.push({
          label,
          reading: value.dir > 0 ? "Stop long actif" : "Stop court actif",
          score: value.dir > 0 ? 80 : 20,
          weight: 1.5,
          formula: value.dir > 0 ? "stop long actif → 80" : "stop court actif → 20",
          why: "Le stop actif indique de quel côté l'indicateur considère la tendance.",
        });
        risk.contributions.push({
          label,
          reading: `Stop à ${fmt(value.dir > 0 ? value.longStop : value.shortStop)}`,
          score: clamp100((Math.abs(price - (value.dir > 0 ? value.longStop : value.shortStop)) / price / 0.08) * 100),
          weight: 1,
          formula: `(${n((Math.abs(price - (value.dir > 0 ? value.longStop : value.shortStop)) / price) * 100)} % ÷ 8 %) × 100 = ${Math.round(clamp100((Math.abs(price - (value.dir > 0 ? value.longStop : value.shortStop)) / price / 0.08) * 100))}`,
          why: "Distance au stop : plus il est loin, plus la position risque avant d'être coupée.",
        });
        break;
      }
      case "adx": {
        if (!isAdx(value)) break;
        const direction = value.plusDI >= value.minusDI ? 1 : -1;
        trend.contributions.push({
          label,
          reading: `ADX ${fmt(value.adx, 1)} — ${direction > 0 ? "+DI" : "-DI"} dominant`,
          score: clamp100(50 + direction * Math.min(value.adx, 50)),
          weight: 2,
          formula: `50 ${direction > 0 ? "+" : "−"} min(${n(value.adx, 1)} ; 50) = ${Math.round(clamp100(50 + direction * Math.min(value.adx, 50)))}`,
          why: "L'ADX donne la force de la tendance, +DI/-DI son sens ; au-delà de 50 l'échelle sature.",
        });
        break;
      }
      case "ichimoku": {
        if (!isIchimoku(value) || value.spanA === null || value.spanB === null) break;
        const top = Math.max(value.spanA, value.spanB);
        const bottom = Math.min(value.spanA, value.spanB);
        const position = price > top ? "au-dessus du nuage" : price < bottom ? "sous le nuage" : "dans le nuage";
        trend.contributions.push({
          label,
          reading: `Prix ${position}`,
          score: price > top ? 90 : price < bottom ? 10 : 50,
          weight: 2,
          formula: price > top ? "au-dessus du nuage → 90" : price < bottom ? "sous le nuage → 10" : "dans le nuage → 50",
          why: "Le nuage est la zone d'indécision : au-dessus, la tendance est haussière ; dedans, elle n'est pas tranchée.",
        });
        break;
      }
      case "zigzag": {
        if (!isZigZag(value) || value.label === null) break;
        const bullish = value.label === "HH" || value.label === "HL";
        trend.contributions.push({
          label,
          reading: `Dernier pivot ${value.label}`,
          score: bullish ? 75 : 25,
          weight: 1,
          formula: `${value.label} → ${bullish ? 75 : 25}`,
          why: "Sommets et creux ascendants (HH/HL) décrivent une structure haussière, descendants une structure baissière.",
        });
        break;
      }
      case "bollinger": {
        if (!isBand(value) || value.middle === 0) break;
        const width = (value.upper - value.lower) / value.middle;
        const widths = entry.values
          .slice(from, at + 1)
          .map((v) => (v && isBand(v) && v.middle !== 0 ? (v.upper - v.lower) / v.middle : null))
          .filter((n): n is number => n !== null);
        const rank = percentileOf(width, widths);
        if (rank !== null) {
          volatility.contributions.push({
            label,
            reading: `Largeur ${(width * 100).toFixed(2)} % du prix`,
            score: rank,
            weight: 2,
            formula: `rang ${widths.filter((w) => w < width).length} / ${widths.length} → ${Math.round(rank)}`,
            why: rankPhrase(rank, widths.length, "Bandes au plus large", "Bandes au plus serré"),
          });
        }
        // Where price sits inside the bands is a momentum reading, not a volatility one.
        const span = value.upper - value.lower;
        if (span > 0) {
          momentum.contributions.push({
            label: `${label} — position`,
            reading: `${Math.round(((price - value.lower) / span) * 100)} % de la bande`,
            score: clamp100(((price - value.lower) / span) * 100),
            weight: 1,
            formula: `(${n(price)} − ${n(value.lower)}) ÷ (${n(value.upper)} − ${n(value.lower)}) × 100 = ${Math.round(clamp100(((price - value.lower) / span) * 100))}`,
            why: "Position du prix entre la bande basse (0) et la bande haute (100).",
          });
        }
        break;
      }
      case "atr": {
        if (typeof value !== "number") break;
        const history = entry.values.slice(from, at + 1).filter((v): v is number => typeof v === "number");
        const rank = percentileOf(value, history);
        if (rank !== null) {
          volatility.contributions.push({
            label,
            reading: `${fmt(value)} (${((value / price) * 100).toFixed(2)} % du prix)`,
            score: rank,
            weight: 2,
            formula: `rang ${history.filter((v) => v < value).length} / ${history.length} → ${Math.round(rank)}`,
            why: rankPhrase(rank, history.length, "ATR au plus haut", "ATR au plus bas"),
          });
          risk.contributions.push({
            label,
            reading: `${((value / price) * 100).toFixed(2)} % du prix`,
            score: clamp100(((value / price) / 0.05) * 100),
            weight: 1.5,
            formula: `(${n((value / price) * 100)} % ÷ 5 %) × 100 = ${Math.round(clamp100(((value / price) / 0.05) * 100))}`,
            why: "Amplitude moyenne d'une bougie rapportée au prix ; 5 % sature l'échelle.",
          });
        }
        break;
      }
      case "chop": {
        if (typeof value !== "number") break;
        risk.contributions.push({
          label,
          reading: fmt(value, 1),
          score: clamp100(value),
          weight: 1.5,
          formula: `CHOP ${n(value, 1)} → ${Math.round(clamp100(value))} (repris tel quel)`,
          why: "Le Choppiness Index mesure l'absence de tendance : un marché sans direction est celui où les faux signaux coûtent le plus.",
        });
        break;
      }
      case "supportResistance": {
        if (!isSrLevels(value) || value.length === 0) break;
        const nearest = value.reduce((best, level) =>
          Math.abs(level.price - price) < Math.abs(best.price - price) ? level : best,
        );
        const distance = Math.abs(nearest.price - price) / price;
        risk.contributions.push({
          label,
          reading: `Niveau le plus proche à ${pct((nearest.price - price) / price)}`,
          // Close to a level is where a move either breaks out or reverses — the least
          // predictable place to be, hence the highest risk reading.
          score: clamp100(100 - (distance / 0.03) * 100),
          weight: 1,
          formula: `100 − (${n(distance * 100)} % ÷ 3 %) × 100 = ${Math.round(clamp100(100 - (distance / 0.03) * 100))}`,
          why: "Un prix collé à un niveau est à l'endroit le moins prévisible : cassure ou rejet.",
        });
        break;
      }
      default:
        // Fundamentals, patterns, TPO, pivots, gaps, correlation, custom scripts: real indicators,
        // but none of them reduces to a 0-100 reading of one of these five axes without inventing
        // a meaning they don't have. Left out on purpose rather than folded in badly.
        break;
    }
  }

  const scores = buildScores(trend, momentum, volatility, flow, risk, settings, offChartLabels);
  const byAxis = new Map(scores.map((s) => [s.axis, s]));

  // The blend. Trend and momentum say which way, flow says whether it is backed by real trading,
  // risk counts against. Volatility weighs 0 by default and deliberately so: high volatility
  // amplifies a good setup and a bad one equally, so folding it in as a direction would be wrong
  // either way — it is shown as its own reading instead. The reader can overrule every one of
  // these, which is why they are read from the settings rather than written here.
  const weights: { axis: MarketStateAxis; label: string; invert?: boolean }[] = [
    { axis: "trend", label: "Tendance" },
    { axis: "momentum", label: "Momentum" },
    { axis: "flow", label: "Flux" },
    { axis: "risk", label: "Risque (inversé)", invert: true },
    { axis: "volatility", label: "Volatilité" },
  ];
  const signalParts: MarketStateSignalPart[] = [];
  for (const { axis, label, invert } of weights) {
    const weight = settings.axisWeights[axis] ?? 0;
    if (weight <= 0) continue;
    const score = byAxis.get(axis)?.score;
    if (score === null || score === undefined) continue;
    signalParts.push({ label, score: invert ? 100 - score : score, weight });
  }
  const totalWeight = signalParts.reduce((sum, part) => sum + part.weight, 0);
  const signal =
    totalWeight > 0 ? Math.round(signalParts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight) : null;

  const rawDirection: MarketStateDirection =
    signal === null || Math.abs(signal - 50) <= settings.neutralBand ? "neutral" : signal > 50 ? "long" : "short";

  // Confirmation: the side is named only once it has read the same way for `confirmBars` sessions
  // in a row. Counted by asking this same function about the preceding bars with confirmation
  // switched off — the raw verdict is what has to agree, and re-deriving it any other way is how
  // two "identical" readings start differing.
  let direction = rawDirection;
  let confirmedFor: number | null = null;
  const confirmBars = Math.max(1, Math.round(settings.confirmBars));
  if (settings.confirmEnabled && confirmBars > 1) {
    const rawSettings = { ...settings, confirmEnabled: false };
    let agreeing = 1;
    for (let back = 1; back < confirmBars; back++) {
      const previous = at - back;
      if (previous < 0) break;
      const earlier = computeMarketState({ candles, index: previous, indicators, lookback, settings: rawSettings });
      if (earlier.rawDirection !== rawDirection) break;
      agreeing += 1;
    }
    confirmedFor = agreeing;
    if (agreeing < confirmBars) direction = "neutral";
  }
  // Restated on the side it actually falls: 26 is a 74 % short, not a 26 % long. Neutral keeps the
  // long-side number, since there is no side to restate it onto.
  const strength = signal === null ? null : direction === "short" ? 100 - signal : signal;

  // The vote behind the average: what share of the counted weight reads each way, every source
  // judged on its own thresholds. Only the axes that actually feed the blend are polled — a source
  // whose axis weighs nothing has no say in the signal, and letting it have one here would make
  // the two readings contradict each other in front of the reader.
  const polled = scores
    .filter((axis) => (settings.axisWeights[axis.axis] ?? 0) > 0)
    .flatMap((axis) => axis.contributions.filter((c) => c.counted && c.effectiveWeight > 0));
  const stanceWeight = polled.reduce((sum, c) => sum + c.effectiveWeight, 0);
  const stance: Record<MarketStateDirection, number> =
    stanceWeight > 0
      ? (() => {
          const share = (side: MarketStateDirection) =>
            polled.filter((c) => c.direction === side).reduce((sum, c) => sum + c.effectiveWeight, 0) / stanceWeight;
          const long = Math.round(share("long") * 100);
          const short = Math.round(share("short") * 100);
          // Neutral takes the remainder rather than its own rounding, so the three always sum to
          // exactly 100 — three percentages that add up to 101 read as an arithmetic bug.
          return { long, short, neutral: Math.max(0, 100 - long - short) };
        })()
      : { long: 0, neutral: 100, short: 0 };

  return { scores, signal, direction, rawDirection, confirmedFor, strength, signalParts, stance, atIndex: at };
}

function buildScores(
  trend: Bucket,
  momentum: Bucket,
  volatility: Bucket,
  flow: Bucket,
  risk: Bucket,
  settings: MarketStateSettings,
  offChartLabels: Set<string>
): MarketStateScore[] {
  const t = trend.contributions.map((c) => finalise(c, settings, offChartLabels));
  const m = momentum.contributions.map((c) => finalise(c, settings, offChartLabels));
  const v = volatility.contributions.map((c) => finalise(c, settings, offChartLabels));
  const f = flow.contributions.map((c) => finalise(c, settings, offChartLabels));
  const r = risk.contributions.map((c) => finalise(c, settings, offChartLabels));
  return [
    {
      axis: "trend",
      label: "TREND",
      hint: "Dans quel sens le marché est orienté, et avec quelle conviction. 50 = sans direction.",
      score: weightedMean(t),
      contributions: t,
    },
    {
      axis: "volatility",
      label: "VOL",
      hint: "L'amplitude des mouvements, rapportée à l'habitude de cet instrument. 100 = agité comme jamais sur la fenêtre.",
      score: weightedMean(v),
      contributions: v,
    },
    {
      axis: "flow",
      label: "FLOW",
      hint: "Si les échanges accompagnent le mouvement ou le subissent. 50 = volume ordinaire.",
      score: weightedMean(f),
      contributions: f,
    },
    {
      axis: "momentum",
      label: "MOM",
      hint: "La vitesse du mouvement en cours, indépendamment de sa direction de fond. 50 = à l'équilibre.",
      score: weightedMean(m),
      contributions: m,
    },
    {
      axis: "risk",
      label: "RISK",
      hint: "Ce qui joue contre une position : volatilité, repli, absence de tendance, proximité d'un niveau. Bas vaut mieux que haut.",
      score: weightedMean(r),
      contributions: r,
    },
  ];
}
