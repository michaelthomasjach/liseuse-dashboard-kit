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
  /** One sentence turning the reading into the score, so the arithmetic is checkable. */
  why: string;
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

export interface MarketState {
  scores: MarketStateScore[];
  /** The long-side signal, 0-100 — the blend below. `null` when no axis could be scored. */
  longSignal: number | null;
  /** Exactly what went into `longSignal`, same decomposability rule as the axes. */
  longSignalParts: MarketStateSignalPart[];
  /** Which bar every reading above describes — the last visible one, or whichever the pointer is
   *  on. Shown in the panel so a hovered reading is never mistaken for the current one. */
  atIndex: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const clamp100 = (value: number) => clamp(value, 0, 100);
const fmt = (value: number, digits = 2) => value.toFixed(digits);
const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)} %`;

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
  const usable = series.filter((n) => Number.isFinite(n));
  if (usable.length < 5) return null;
  const below = usable.filter((n) => n < value).length;
  return clamp100((below / usable.length) * 100);
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
  const total = contributions.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return null;
  return Math.round(contributions.reduce((sum, c) => sum + c.score * c.weight, 0) / total);
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
  indicators: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  /** How many bars back the baselines and the percentiles look. Defaults to 200 — long enough for
   *  "high for this instrument" to mean something, short enough to describe the present. */
  lookback?: number;
}

type Bucket = { contributions: MarketStateContribution[] };

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

export function computeMarketState({ candles, index, indicators, lookback = 200 }: MarketStateInput): MarketState {
  const at = clamp(Math.round(index), 0, Math.max(0, candles.length - 1));
  const trend: Bucket = { contributions: [] };
  const momentum: Bucket = { contributions: [] };
  const volatility: Bucket = { contributions: [] };
  const flow: Bucket = { contributions: [] };
  const risk: Bucket = { contributions: [] };

  const empty: MarketState = { scores: buildScores(trend, momentum, volatility, flow, risk), longSignal: null, longSignalParts: [], atIndex: at };
  if (candles.length < 20) return empty;

  const bar = candles[at];
  const price = bar.close;
  const from = Math.max(0, at - lookback + 1);
  const window = candles.slice(from, at + 1);
  const closes = candles.map((c) => c.close);

  // ---- baselines: what price and volume say on their own -------------------------------------

  const trendMean = meanEndingAt(closes, at, Math.min(50, Math.floor(window.length / 2)));
  if (trendMean !== null) {
    const distance = (price - trendMean) / trendMean;
    trend.contributions.push({
      label: "Prix (intégré)",
      reading: `${fmt(price)} vs moyenne 50 ${fmt(trendMean)}`,
      score: scoreFromRelative(distance, 0.04),
      weight: 1,
      why: `Écart de ${pct(distance)} à sa moyenne 50 périodes ; ±4 % sature l'échelle.`,
    });
  }

  const momentumBase = window.length > 14 ? (price - closes[at - 14]) / closes[at - 14] : null;
  if (momentumBase !== null) {
    momentum.contributions.push({
      label: "Prix (intégré)",
      reading: `${pct(momentumBase)} sur 14 périodes`,
      score: scoreFromRelative(momentumBase, 0.06),
      weight: 1,
      why: "Variation sur 14 périodes ; ±6 % sature l'échelle.",
    });
  }

  // Realized volatility: the standard deviation of daily returns over 20 bars, ranked against the
  // same measure over the whole window — the "is this calm or wild *for this instrument*" question.
  const returns = candles.slice(1).map((c, i) => (c.close - candles[i].close) / candles[i].close);
  const realized = (end: number) => {
    if (end < 20) return null;
    const slice = returns.slice(end - 20, end);
    const mean = slice.reduce((s, r) => s + r, 0) / slice.length;
    return Math.sqrt(slice.reduce((s, r) => s + (r - mean) ** 2, 0) / slice.length);
  };
  const realizedNow = realized(at);
  if (realizedNow !== null) {
    const history: number[] = [];
    for (let i = from + 20; i <= at; i++) {
      const v = realized(i);
      if (v !== null) history.push(v);
    }
    const rank = percentileOf(realizedNow, history);
    if (rank !== null) {
      volatility.contributions.push({
        label: "Prix (intégré)",
        reading: `Volatilité réalisée ${(realizedNow * 100).toFixed(2)} % (20 p.)`,
        score: rank,
        weight: 1,
        why: rankPhrase(rank, history.length, "La plus forte volatilité", "La plus faible volatilité"),
      });
      risk.contributions.push({
        label: "Volatilité (intégré)",
        reading: `${Math.round(rank)}ᵉ centile`,
        score: rank,
        weight: 1,
        why: "Une volatilité haute pour cet instrument est en soi un risque de position.",
      });
    }
  }

  const windowHigh = Math.max(...window.map((c) => c.high));
  if (windowHigh > 0) {
    const drawdown = (windowHigh - price) / windowHigh;
    risk.contributions.push({
      label: "Repli (intégré)",
      reading: `${pct(-drawdown)} sous le plus haut de la fenêtre`,
      score: clamp100((drawdown / 0.2) * 100),
      weight: 1,
      why: "Distance au plus haut récent ; -20 % sature l'échelle.",
    });
  }

  // Volume, signed by the bar's own direction. Only volume *above* the average counts: a bar
  // trading less than usual says nothing about who is in control, in either direction — reading a
  // quiet down-bar as mildly bullish (which subtracting a negative excess would do) is inventing a
  // conviction nobody showed. Below average therefore lands on a flat 50.
  const volumes = candles.map((c) => c.volume ?? 0);
  const volumeMean = meanEndingAt(volumes, at, Math.min(20, window.length));
  if (volumeMean !== null && volumeMean > 0) {
    const relative = (volumes[at] - volumeMean) / volumeMean;
    const excess = clamp(relative, 0, 1);
    const direction = Math.sign(bar.close - bar.open) || 0;
    flow.contributions.push({
      label: "Volume (intégré)",
      reading: `${relative >= 0 ? "+" : ""}${Math.round(relative * 100)} % vs moyenne 20`,
      score: clamp100(50 + direction * excess * 40),
      weight: 1,
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
          why: "Le stop actif indique de quel côté l'indicateur considère la tendance.",
        });
        risk.contributions.push({
          label,
          reading: `Stop à ${fmt(value.dir > 0 ? value.longStop : value.shortStop)}`,
          score: clamp100((Math.abs(price - (value.dir > 0 ? value.longStop : value.shortStop)) / price / 0.08) * 100),
          weight: 1,
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
            why: rankPhrase(rank, history.length, "ATR au plus haut", "ATR au plus bas"),
          });
          risk.contributions.push({
            label,
            reading: `${((value / price) * 100).toFixed(2)} % du prix`,
            score: clamp100(((value / price) / 0.05) * 100),
            weight: 1.5,
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

  const scores = buildScores(trend, momentum, volatility, flow, risk);
  const byAxis = new Map(scores.map((s) => [s.axis, s]));

  // The blend. Trend and momentum say which way, flow says whether it is backed by real trading,
  // risk counts against. Volatility is deliberately absent: high volatility amplifies a good setup
  // and a bad one equally, so folding it in as a direction would be wrong either way — it is shown
  // as its own reading instead.
  const weights: { axis: MarketStateAxis; label: string; weight: number; invert?: boolean }[] = [
    { axis: "trend", label: "Tendance", weight: 0.4 },
    { axis: "momentum", label: "Momentum", weight: 0.3 },
    { axis: "flow", label: "Flux", weight: 0.15 },
    { axis: "risk", label: "Risque (inversé)", weight: 0.15, invert: true },
  ];
  const longSignalParts: MarketStateSignalPart[] = [];
  for (const { axis, label, weight, invert } of weights) {
    const score = byAxis.get(axis)?.score;
    if (score === null || score === undefined) continue;
    longSignalParts.push({ label, score: invert ? 100 - score : score, weight });
  }
  const totalWeight = longSignalParts.reduce((sum, p) => sum + p.weight, 0);
  const longSignal =
    totalWeight > 0 ? Math.round(longSignalParts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight) : null;

  return { scores, longSignal, longSignalParts, atIndex: at };
}

function buildScores(trend: Bucket, momentum: Bucket, volatility: Bucket, flow: Bucket, risk: Bucket): MarketStateScore[] {
  return [
    {
      axis: "trend",
      label: "TREND",
      hint: "Dans quel sens le marché est orienté, et avec quelle conviction. 50 = sans direction.",
      score: weightedMean(trend.contributions),
      contributions: trend.contributions,
    },
    {
      axis: "volatility",
      label: "VOL",
      hint: "L'amplitude des mouvements, rapportée à l'habitude de cet instrument. 100 = agité comme jamais sur la fenêtre.",
      score: weightedMean(volatility.contributions),
      contributions: volatility.contributions,
    },
    {
      axis: "flow",
      label: "FLOW",
      hint: "Si les échanges accompagnent le mouvement ou le subissent. 50 = volume ordinaire.",
      score: weightedMean(flow.contributions),
      contributions: flow.contributions,
    },
    {
      axis: "momentum",
      label: "MOM",
      hint: "La vitesse du mouvement en cours, indépendamment de sa direction de fond. 50 = à l'équilibre.",
      score: weightedMean(momentum.contributions),
      contributions: momentum.contributions,
    },
    {
      axis: "risk",
      label: "RISK",
      hint: "Ce qui joue contre une position : volatilité, repli, absence de tendance, proximité d'un niveau. Bas vaut mieux que haut.",
      score: weightedMean(risk.contributions),
      contributions: risk.contributions,
    },
  ];
}
