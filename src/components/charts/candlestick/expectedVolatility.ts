import type { Candle } from "./interfaces/Candle.interface";
import type { IndicatorExpectedVolatilityPoint } from "./interfaces/IndicatorExpectedVolatilityPoint.interface";

/** « Volatilité attendue du jour (ATR) », porté du script Pine du même nom (titre court « Vol. jour ATR »).
 *
 *  Pour chaque période de l'échelle choisie : l'ouverture de la période (médiane), ouverture ± ATR et ouverture ± SMA
 *  de l'ATR, l'ATR et sa SMA étant ceux de la dernière bougie clôturée de cette échelle au début de la période. Pine
 *  les lit avec `request.security(…, [ta.atr(n)[1], ta.sma(ta.atr(n), m)[1]], lookahead_on)` ; ici les bougies du
 *  graphique sont agrégées en bougies de l'échelle choisie, sur lesquelles le même calcul est fait.
 *
 *  Séparé d'indicators.ts (budget de lignes) comme patternRecognition.ts ; le rendu est dans
 *  render/drawExpectedVolatility.ts. */

export type ExpectedVolatilityTimeframe = "chart" | "15m" | "30m" | "1h" | "4h" | "1d";

/** Valeurs par défaut, identiques à celles du script Pine. Couleurs : `color.gray`, `color.orange`, `color.aqua` de
 *  TradingView. La couleur de l'ATR est celle de l'indicateur (`Indicator.color`). */
export const EXPECTED_VOLATILITY_DEFAULTS = {
  atrPeriod: 9,
  smaPeriod: 14,
  timeframe: "chart" as ExpectedVolatilityTimeframe,
  timeZone: "Europe/Paris",
  sessions: 5,
  showLow: true,
  showSma: true,
  showLabels: true,
  showMedian: true,
  medianColor: "#787b86",
  atrColor: "#ff9800",
  smaColor: "#00bcd4",
  lineWidth: 2,
};

/** Les choix du menu « Échelle de temps de l'ATR », libellés comme dans le script Pine. */
export const EXPECTED_VOLATILITY_TIMEFRAMES: { value: ExpectedVolatilityTimeframe; label: string }[] = [
  { value: "chart", label: "Échelle courante" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 heure" },
  { value: "4h", label: "4 heures" },
  { value: "1d", label: "1 jour" },
];

const MINUTE = 60_000;
const TIMEFRAME_MS: Record<Exclude<ExpectedVolatilityTimeframe, "chart">, number> = {
  "15m": 15 * MINUTE,
  "30m": 30 * MINUTE,
  "1h": 60 * MINUTE,
  "4h": 240 * MINUTE,
  "1d": 1440 * MINUTE,
};

/** ATR de Wilder, exactement `ta.atr(period)` de Pine : range vrai = H − L sur la toute première bougie (pas de
 *  clôture précédente), max(H − L, |H − C(t−1)|, |L − C(t−1)|) ensuite ; puis `ta.rma` : moyenne simple des `period`
 *  premiers ranges vrais, et ATR(t) = (ATR(t−1) × (period − 1) + TR(t)) / period. Première valeur à l'indice
 *  `period − 1`. (L'ATR intégré du catalogue, via `technicalindicators`, ignore la première bougie : il démarre une
 *  bougie plus tard, d'où ce calcul à part pour rester fidèle au script.) */
export function computeWilderATR(bars: Pick<Candle, "high" | "low" | "close">[], period: number): (number | null)[] {
  const n = bars.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.round(period));
  let sum = 0;
  let atr: number | null = null;
  for (let i = 0; i < n; i++) {
    const { high, low } = bars[i];
    const tr = i === 0 ? high - low : Math.max(high - low, Math.abs(high - bars[i - 1].close), Math.abs(low - bars[i - 1].close));
    if (atr === null) {
      sum += tr;
      if (i === p - 1) atr = sum / p;
    } else {
      atr = (atr * (p - 1) + tr) / p;
    }
    out[i] = atr;
  }
  return out;
}

/** Moyenne simple, comme `ta.sma` de Pine : null tant que la fenêtre contient une valeur manquante. */
export function computeSimpleAverage(values: (number | null)[], period: number): (number | null)[] {
  const p = Math.max(1, Math.round(period));
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  let missing = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) missing++;
    else sum += v;
    if (i >= p) {
      const old = values[i - p];
      if (old === null) missing--;
      else sum -= old;
    }
    if (i >= p - 1 && missing === 0) out[i] = sum / p;
  }
  return out;
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();
/** Un formateur par fuseau, réutilisé : en créer un par bougie coûterait plus cher que tout le reste du calcul. Un
 *  fuseau illisible retombe sur UTC plutôt que de faire échouer le graphique. */
function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = zonedFormatters.get(timeZone);
  if (!fmt) {
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };
    try {
      fmt = new Intl.DateTimeFormat("en-CA", { ...options, timeZone });
    } catch {
      fmt = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
    }
    zonedFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Le jour calendaire d'un instant dans `timeZone` (« 2026-11-15 »), et le minuit local de ce jour en ms UTC. */
function zonedDay(time: number, timeZone: string): { key: string; midnight: number } {
  const parts: Record<string, string> = {};
  for (const part of zonedFormatter(timeZone).formatToParts(new Date(time))) parts[part.type] = part.value;
  const sinceMidnight = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + (time % 1000);
  return { key: `${parts.year}-${parts.month}-${parts.day}`, midnight: time - sinceMidnight };
}

/** Écart le plus courant entre deux bougies (médiane des écarts) : l'unité de temps du graphique. */
export function chartIntervalMs(data: Candle[]): number {
  const diffs: number[] = [];
  for (let i = Math.max(1, data.length - 500); i < data.length; i++) {
    const d = data[i].date.getTime() - data[i - 1].date.getTime();
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

/** « 15 min », « 1 h », « 1 jour »… : le nom de l'échelle courante dans les étiquettes (Pine y écrit
 *  `timeframe.period`). */
function intervalLabel(ms: number): string {
  if (ms <= 0) return "Échelle courante";
  if (ms % (7 * 1440 * MINUTE) === 0) return `${ms / (7 * 1440 * MINUTE)} sem.`;
  if (ms % (1440 * MINUTE) === 0) return ms === 1440 * MINUTE ? "1 jour" : `${ms / (1440 * MINUTE)} jours`;
  if (ms % (60 * MINUTE) === 0) return `${ms / (60 * MINUTE)} h`;
  if (ms % MINUTE === 0) return `${ms / MINUTE} min`;
  return `${Math.round(ms / 1000)} s`;
}

/** Nombre de décimales des prix : l'équivalent de `format.mintick`, lu sur les dernières bougies. Plafonné à six
 *  chiffres significatifs (deux décimales au moins), pour qu'une série aux décimales infinies (calculée, convertie)
 *  ne s'écrive pas « 50123.12345678 ». */
function priceDecimals(data: Candle[]): number {
  const last = data[data.length - 1]?.close ?? 0;
  const intDigits = Math.abs(last) >= 1 ? Math.floor(Math.log10(Math.abs(last))) + 1 : 0;
  const cap = Math.max(2, 6 - intDigits);
  let decimals = 0;
  for (let i = Math.max(0, data.length - 300); i < data.length && decimals < cap; i++) {
    for (const v of [data[i].open, data[i].high, data[i].low, data[i].close]) {
      while (decimals < cap && Math.abs(v * 10 ** decimals - Math.round(v * 10 ** decimals)) > 1e-6) decimals++;
    }
  }
  return decimals;
}

export interface ExpectedVolatilitySettings {
  atrPeriod: number;
  smaPeriod: number;
  timeframe: ExpectedVolatilityTimeframe;
  timeZone: string;
  sessions: number;
}

interface Bucket {
  first: number;
  last: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Fin prévue de la période, en ms : pour prolonger la période en cours dans l'espace futur. */
  endTime: number;
}

/** Calcule les niveaux de chaque bougie (voir `IndicatorExpectedVolatilityPoint`).
 *
 *  - « 1 jour » : une période par jour calendaire du fuseau choisi (00:00 → 23:59), l'ATR étant celui des bougies
 *    journalières formées sur ces mêmes jours.
 *  - « 15 minutes » … « 4 heures » : une période par bougie de cette échelle (alignée sur l'heure UTC ronde).
 *  - « Échelle courante », ou une échelle qui n'est pas plus large que celle du graphique : chaque bougie est sa
 *    propre période, avec l'ATR de la bougie précédente. (Pine, sous une échelle plus fine que le graphique, lirait
 *    l'ATR de la dernière sous-bougie ; ces sous-bougies n'existent pas dans les données du graphique.) */
export function computeExpectedVolatilityValues(data: Candle[], settings: ExpectedVolatilitySettings): (IndicatorExpectedVolatilityPoint | null)[] {
  const n = data.length;
  const result: (IndicatorExpectedVolatilityPoint | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  const interval = chartIntervalMs(data);
  const wanted = settings.timeframe === "chart" ? 0 : TIMEFRAME_MS[settings.timeframe];
  // Même règle que `utPlusGrande` dans Pine : seule une échelle strictement plus large que le graphique regroupe des
  // bougies ; « 1 jour » sur un graphique journalier revient à l'échelle courante.
  const perCandle = wanted === 0 || (interval > 0 && wanted <= interval);
  const dayMode = settings.timeframe === "1d" && !perCandle;
  const scaleLabel = settings.timeframe === "chart" || perCandle ? intervalLabel(interval) : EXPECTED_VOLATILITY_TIMEFRAMES.find((t) => t.value === settings.timeframe)!.label;

  // 1. Les bougies de l'échelle choisie.
  const buckets: Bucket[] = [];
  let currentKey: string | number | null = null;
  for (let i = 0; i < n; i++) {
    const c = data[i];
    const t = c.date.getTime();
    let key: string | number;
    let endTime: number;
    if (perCandle) {
      key = i;
      endTime = t + interval;
    } else if (dayMode) {
      const day = zonedDay(t, settings.timeZone);
      key = day.key;
      endTime = day.midnight + 1440 * MINUTE;
    } else {
      key = Math.floor(t / wanted);
      endTime = (key + 1) * wanted;
    }
    if (key !== currentKey) {
      buckets.push({ first: i, last: i, open: c.open, high: c.high, low: c.low, close: c.close, endTime });
      currentKey = key;
    } else {
      const b = buckets[buckets.length - 1];
      b.last = i;
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
    }
  }

  // 2. ATR et SMA sur ces bougies, lus à la bougie précédente (la dernière clôturée).
  const atr = computeWilderATR(buckets, settings.atrPeriod);
  const sma = computeSimpleAverage(atr, settings.smaPeriod);

  // 3. Fin de la période en cours : autant de bougies que les périodes complètes en comptent le plus souvent (une
  //    séance d'actions s'arrête à la clôture, pas à minuit), sinon jusqu'à sa fin prévue dans le temps.
  const counts = new Map<number, number>();
  for (let k = 1; k < buckets.length - 1; k++) {
    const count = buckets[k].last - buckets[k].first + 1;
    counts.set(count, (counts.get(count) ?? 0) + 1);
  }
  let typicalCount = 0;
  let typicalFreq = 0;
  for (const [count, freq] of counts) {
    if (freq > typicalFreq || (freq === typicalFreq && count > typicalCount)) {
      typicalCount = count;
      typicalFreq = freq;
    }
  }

  const withValue: number[] = [];
  for (let k = 1; k < buckets.length; k++) if (atr[k - 1] !== null) withValue.push(k);
  const sessions = Math.max(1, Math.round(settings.sessions));
  const drawnFrom = withValue.length > sessions ? withValue[withValue.length - sessions] : 0;
  const decimals = priceDecimals(data);
  const lastBucket = buckets.length - 1;

  for (const k of withValue) {
    const b = buckets[k];
    let periodEnd = b.last + 1;
    if (k === lastBucket && !perCandle) {
      const have = b.last - b.first + 1;
      if (typicalCount > have) periodEnd = b.first + typicalCount;
      else if (typicalCount === 0 && interval > 0) periodEnd = b.last + Math.max(1, (b.endTime - data[b.last].date.getTime()) / interval);
    }
    const point: IndicatorExpectedVolatilityPoint = {
      periodStart: b.first,
      periodEnd,
      open: b.open,
      atr: atr[k - 1]!,
      sma: sma[k - 1],
      drawn: k >= drawnFrom,
      latest: k === lastBucket,
      dayMode,
      scaleLabel,
      decimals,
    };
    for (let i = b.first; i <= b.last; i++) result[i] = point;
  }
  return result;
}
