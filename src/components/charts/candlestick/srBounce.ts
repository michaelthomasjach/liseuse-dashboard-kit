import type { Candle } from "./interfaces/Candle.interface";
import type { IndicatorADXPoint } from "./interfaces/IndicatorADXPoint.interface";
import type { IndicatorBand } from "./interfaces/IndicatorBand.interface";
import type { BounceFactor, IndicatorBounceZone } from "./interfaces/IndicatorBounceZone.interface";

/** « Probabilité de rebond » (`kind: "srBounce"`, onglet « Communauté ») : détecte les zones de support et de résistance
 *  et estime, pour chacune, la probabilité que le prix y rebondisse au prochain contact.
 *
 *  1. **Zones.** Les sommets et les creux locaux (fractales : la bougie la plus haute, ou la plus basse, de `swingSpan`
 *     bougies de chaque côté) des `lookback` dernières bougies sont regroupés par prix, avec une tolérance d'une
 *     demi-ATR : chaque groupe d'au moins deux pivots forme une zone, de son pivot le plus bas à son plus haut.
 *  2. **Historique.** Chaque contact passé de la zone est suivi sur `horizon` bougies : il a *tenu* si le prix s'en est
 *     éloigné d'au moins 1 ATR du bon côté, *cédé* s'il a clôturé à plus d'une demi-ATR de l'autre côté.
 *  3. **Probabilité.** Une note (en logit) part du taux de tenue de la zone, lissé (`(tenues + 1) / (contacts + 2)`),
 *     puis cumule les facteurs de marché : nombre de pivots, ADX et sens des ±DI, régime de volatilité (ATR face à sa
 *     moyenne), confluence et alignement des moyennes mobiles (EMA, SMA, SMA longue), position des bandes de Bollinger
 *     et resserrement des bandes. La note est ramenée à une probabilité (fonction logistique), bornée à 5-95 %.
 *
 *  C'est une estimation construite sur l'historique du titre et des règles d'analyse technique, pas une probabilité
 *  calibrée statistiquement : chaque facteur et son effet sont rendus avec la zone (`factors`) pour qu'on voie d'où
 *  vient le chiffre. Les calculs d'indicateurs sont injectés par l'appelant (indicators.ts), pour éviter un import
 *  circulaire, comme pour la détection de range. */

export const SR_BOUNCE_DEFAULTS = {
  lookback: 200,
  maxZones: 6,
  swingSpan: 3,
  horizon: 10,
  atrPeriod: 14,
  adxPeriod: 14,
  emaPeriod: 20,
  smaPeriod: 50,
  smaLongPeriod: 200,
  bbPeriod: 20,
  bbStdDev: 2,
  supportColor: "#26a69a",
  resistanceColor: "#ef5350",
  opacity: 14,
  showLabels: true,
} as const;

export interface SrBounceSettings {
  lookback: number;
  maxZones: number;
  swingSpan: number;
  horizon: number;
  atrPeriod: number;
  adxPeriod: number;
  emaPeriod: number;
  smaPeriod: number;
  smaLongPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
}

export interface SrBounceCalculators {
  atr: (data: Candle[], period: number) => (number | null)[];
  adx: (data: Candle[], period: number) => (IndicatorADXPoint | null)[];
  ema: (data: Candle[], period: number) => (number | null)[];
  sma: (data: Candle[], period: number) => (number | null)[];
  bollinger: (data: Candle[], period: number, stdDev: number) => (IndicatorBand | null)[];
}

/** Les réglages d'un indicateur « srBounce », valeurs par défaut comprises (`period` = nombre de bougies analysées). */
export function srBounceSettingsOf(ind: {
  period?: number;
  srbMaxZones?: number;
  srbSwingSpan?: number;
  srbHorizon?: number;
  srbAtrPeriod?: number;
  srbAdxPeriod?: number;
  srbEmaPeriod?: number;
  srbSmaPeriod?: number;
  srbSmaLongPeriod?: number;
  srbBbPeriod?: number;
  srbBbStdDev?: number;
}): SrBounceSettings {
  const d = SR_BOUNCE_DEFAULTS;
  const int = (v: number | undefined, def: number, min: number) => Math.max(min, Math.round(v ?? def));
  return {
    lookback: int(ind.period, d.lookback, 30),
    maxZones: int(ind.srbMaxZones, d.maxZones, 1),
    swingSpan: int(ind.srbSwingSpan, d.swingSpan, 1),
    horizon: int(ind.srbHorizon, d.horizon, 2),
    atrPeriod: int(ind.srbAtrPeriod, d.atrPeriod, 2),
    adxPeriod: int(ind.srbAdxPeriod, d.adxPeriod, 2),
    emaPeriod: int(ind.srbEmaPeriod, d.emaPeriod, 2),
    smaPeriod: int(ind.srbSmaPeriod, d.smaPeriod, 2),
    smaLongPeriod: int(ind.srbSmaLongPeriod, d.smaLongPeriod, 2),
    bbPeriod: int(ind.srbBbPeriod, d.bbPeriod, 2),
    bbStdDev: Math.max(0.5, ind.srbBbStdDev ?? d.bbStdDev),
  };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const pct = (p: number) => Math.round(Math.min(0.95, Math.max(0.05, p)) * 100);
const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2));

/** La dernière valeur non nulle d'une série à l'indice `i` ou avant. */
function lastDefined<T>(values: (T | null)[], i: number): T | null {
  for (let k = Math.min(i, values.length - 1); k >= 0; k--) if (values[k] !== null && values[k] !== undefined) return values[k];
  return null;
}

interface RawZone {
  bottom: number;
  top: number;
  pivots: number;
  startIndex: number;
}

/** Les zones : pivots des `lookback` dernières bougies, regroupés par prix à une demi-ATR près. */
function detectZones(data: Candle[], start: number, span: number, atrNow: number): RawZone[] {
  const n = data.length;
  const swings: { price: number; index: number }[] = [];
  for (let i = start + span; i <= n - 1 - span; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) swings.push({ price: data[i].high, index: i });
    if (isLow) swings.push({ price: data[i].low, index: i });
  }
  swings.sort((a, b) => a.price - b.price);
  const tolerance = atrNow * 0.5;
  const zones: RawZone[] = [];
  let current: { prices: number[]; indices: number[] } | null = null;
  const close = () => {
    if (current && current.prices.length >= 2) {
      let bottom = Math.min(...current.prices);
      let top = Math.max(...current.prices);
      // Une zone a au moins un quart d'ATR d'épaisseur : deux pivots au même prix ne font pas une ligne d'un pixel.
      const minHeight = atrNow * 0.25;
      if (top - bottom < minHeight) {
        const mid = (top + bottom) / 2;
        bottom = mid - minHeight / 2;
        top = mid + minHeight / 2;
      }
      zones.push({ bottom, top, pivots: current.prices.length, startIndex: Math.min(...current.indices) });
    }
  };
  for (const s of swings) {
    if (current && s.price - current.prices[current.prices.length - 1] <= tolerance) {
      current.prices.push(s.price);
      current.indices.push(s.index);
    } else {
      close();
      current = { prices: [s.price], indices: [s.index] };
    }
  }
  close();
  return zones;
}

/** Les contacts passés d'une zone et leur issue : tenu (le prix s'éloigne d'au moins 1 ATR du côté d'où il venait) ou
 *  cédé (clôture à plus d'une demi-ATR de l'autre côté), sur `horizon` bougies. Un contact sans issue dans l'horizon,
 *  ou trop récent pour en avoir une, ne compte pas. */
function zoneHistory(data: Candle[], atr: (number | null)[], zone: RawZone, start: number, horizon: number): { held: number; broken: number } {
  let held = 0;
  let broken = 0;
  const n = data.length;
  let i = Math.max(1, start);
  while (i < n) {
    const a = atr[i] ?? atr[n - 1] ?? 0;
    const pad = a * 0.1;
    const inZone = data[i].low <= zone.top + pad && data[i].high >= zone.bottom - pad;
    const prevClose = data[i - 1].close;
    const fromAbove = prevClose > zone.top + pad;
    const fromBelow = prevClose < zone.bottom - pad;
    if (!inZone || (!fromAbove && !fromBelow) || a <= 0) {
      i++;
      continue;
    }
    let outcome: "held" | "broken" | null = null;
    let k = i;
    for (; k < Math.min(n, i + horizon + 1); k++) {
      const c = data[k].close;
      if (fromAbove) {
        if (c < zone.bottom - a * 0.5) { outcome = "broken"; break; }
        if (c > zone.top + a) { outcome = "held"; break; }
      } else {
        if (c > zone.top + a * 0.5) { outcome = "broken"; break; }
        if (c < zone.bottom - a) { outcome = "held"; break; }
      }
    }
    if (outcome === "held") held++;
    else if (outcome === "broken") broken++;
    // Le contact suivant commence après la sortie de celui-ci.
    i = Math.max(i + 1, k + 1);
  }
  return { held, broken };
}

/** Pourcentage de bougies récentes dont la largeur de Bollinger est inférieure à la dernière : bas = bandes resserrées. */
function bandwidthRank(bb: (IndicatorBand | null)[], last: number, window: number): number | null {
  const width = (b: IndicatorBand | null) => (b && b.middle !== 0 ? (b.upper - b.lower) / Math.abs(b.middle) : null);
  const now = width(bb[last] ?? null);
  if (now === null) return null;
  let below = 0;
  let count = 0;
  for (let i = Math.max(0, last - window + 1); i <= last; i++) {
    const w = width(bb[i] ?? null);
    if (w === null) continue;
    count++;
    if (w < now) below++;
  }
  return count > 10 ? below / count : null;
}

/** Les zones et leur probabilité, sur les bougies de la fenêtre analysée (même tableau répété, comme les supports et
 *  résistances automatiques). `lastIndex` : dernière bougie à lire (la coupure d'un replay), la fin des données sinon. */
export function computeSrBounceValues(
  data: Candle[],
  settings: SrBounceSettings,
  calc: SrBounceCalculators,
  lastIndex?: number,
): (IndicatorBounceZone[] | null)[] {
  const result: (IndicatorBounceZone[] | null)[] = new Array(data.length).fill(null);
  const last = Math.min(data.length - 1, lastIndex ?? data.length - 1);
  if (last < 30) return result;
  const series = data.slice(0, last + 1);
  const n = series.length;
  const start = Math.max(0, n - settings.lookback);

  const atr = calc.atr(series, settings.atrPeriod);
  const atrNow = lastDefined(atr, n - 1);
  if (atrNow === null || !(atrNow > 0)) return result;
  const adx = lastDefined(calc.adx(series, settings.adxPeriod), n - 1);
  const ema = lastDefined(calc.ema(series, settings.emaPeriod), n - 1);
  const sma = lastDefined(calc.sma(series, settings.smaPeriod), n - 1);
  const smaLong = lastDefined(calc.sma(series, settings.smaLongPeriod), n - 1);
  const bbAll = calc.bollinger(series, settings.bbPeriod, settings.bbStdDev);
  const bb = lastDefined(bbAll, n - 1);
  const squeeze = bandwidthRank(bbAll, n - 1, 120);
  let atrMean = 0;
  let atrCount = 0;
  for (let i = Math.max(0, n - 50); i < n; i++) {
    if (atr[i] !== null) {
      atrMean += atr[i] as number;
      atrCount++;
    }
  }
  const atrRatio = atrCount > 0 ? atrNow / (atrMean / atrCount) : 1;
  const close = series[n - 1].close;
  const prevClose = series[Math.max(0, n - 2)].close;

  const zones = detectZones(series, start, settings.swingSpan, atrNow);
  const out: IndicatorBounceZone[] = zones.map((z) => {
    const mid = (z.top + z.bottom) / 2;
    // Sous le prix : support ; au-dessus : résistance ; prix dans la zone : selon le côté d'où il arrive.
    const role: "support" | "resistance" = close > z.top ? "support" : close < z.bottom ? "resistance" : prevClose >= mid ? "support" : "resistance";
    const support = role === "support";
    const { held, broken } = zoneHistory(series, atr, z, start, settings.horizon);
    const near = (v: number | null) => v !== null && v >= z.bottom - atrNow * 0.5 && v <= z.top + atrNow * 0.5;

    const terms: { label: string; detail: string; value: number }[] = [];
    // 1. Historique de la zone : la base de l'estimation.
    const rate = (held + 1) / (held + broken + 2);
    terms.push({
      label: "Historique de la zone",
      detail: held + broken === 0 ? "aucun contact passé dont l'issue est connue" : `${held} rebond${held > 1 ? "s" : ""} et ${broken} cassure${broken > 1 ? "s" : ""} sur les contacts passés`,
      value: logit(rate),
    });
    // 2. Nombre de pivots qui forment la zone : plus il y en a, plus le niveau est reconnu.
    terms.push({ label: "Pivots", detail: `${z.pivots} sommets ou creux forment la zone`, value: Math.min(0.5, (z.pivots - 2) * 0.12) });
    // 3. ADX : une tendance forte qui va vers la zone la casse plus souvent ; un marché sans tendance respecte les niveaux.
    if (adx) {
      const towards = support ? adx.minusDI > adx.plusDI : adx.plusDI > adx.minusDI;
      let v = 0;
      let detail = `ADX ${adx.adx.toFixed(0)}`;
      if (adx.adx >= 25 && towards) {
        v = -0.4 - Math.min(0.5, (adx.adx - 25) / 30);
        detail += `, tendance forte dirigée vers la zone`;
      } else if (adx.adx >= 25) {
        v = 0.2;
        detail += `, tendance forte qui s'en éloigne`;
      } else if (adx.adx < 20) {
        v = 0.3;
        detail += `, marché sans tendance (les niveaux y tiennent mieux)`;
      } else detail += `, tendance modérée`;
      terms.push({ label: "ADX", detail, value: v });
    }
    // 4. ATR : une volatilité qui s'emballe casse les niveaux ; une volatilité calme les laisse jouer.
    terms.push({
      label: "ATR",
      detail: `volatilité à ${Math.round(atrRatio * 100)} % de sa moyenne sur 50 bougies`,
      value: atrRatio > 1.3 ? -0.4 : atrRatio < 0.8 ? 0.15 : 0,
    });
    // 5. Moyennes mobiles dans la zone : un support ou une résistance dynamique qui renforce le niveau.
    const confluent = [
      near(ema) ? `EMA ${settings.emaPeriod}` : null,
      near(sma) ? `SMA ${settings.smaPeriod}` : null,
      near(smaLong) ? `SMA ${settings.smaLongPeriod}` : null,
    ].filter((s): s is string => s !== null);
    terms.push({
      label: "Moyennes mobiles dans la zone",
      detail: confluent.length > 0 ? `${confluent.join(", ")} passe${confluent.length > 1 ? "nt" : ""} dans la zone` : "aucune moyenne mobile dans la zone",
      value: confluent.length * 0.25,
    });
    // 6. Tendance des moyennes : un support tient mieux en tendance haussière, une résistance en tendance baissière.
    if (smaLong !== null || (ema !== null && sma !== null)) {
      let v = 0;
      const parts: string[] = [];
      if (smaLong !== null) {
        const above = close > smaLong;
        v += (support ? above : !above) ? 0.25 : -0.25;
        parts.push(`prix ${above ? "au-dessus" : "au-dessous"} de la SMA ${settings.smaLongPeriod}`);
      }
      if (ema !== null && sma !== null) {
        const up = ema > sma;
        v += (support ? up : !up) ? 0.15 : -0.15;
        parts.push(`EMA ${settings.emaPeriod} ${up ? "au-dessus" : "au-dessous"} de la SMA ${settings.smaPeriod}`);
      }
      terms.push({ label: "Tendance des moyennes", detail: parts.join(", "), value: v });
    }
    // 7. Bollinger : une bande dans la zone (prix étiré) favorise le rebond ; des bandes resserrées annoncent une cassure.
    if (bb) {
      const bandHere = support ? near(bb.lower) : near(bb.upper);
      let v = bandHere ? 0.3 : 0;
      const parts = [bandHere ? `bande ${support ? "inférieure" : "supérieure"} dans la zone` : "bandes loin de la zone"];
      if (squeeze !== null && squeeze < 0.2) {
        v -= 0.3;
        parts.push("bandes resserrées (cassure plus probable)");
      }
      terms.push({ label: "Bandes de Bollinger", detail: parts.join(", "), value: v });
    }

    const total = terms.reduce((s, t) => s + t.value, 0);
    const p = sigmoid(total);
    const factors: BounceFactor[] = terms.map((t) => ({
      label: t.label,
      detail: t.detail,
      effect: Math.round((p - sigmoid(total - t.value)) * 100),
    }));
    return {
      price: mid,
      top: z.top,
      bottom: z.bottom,
      startIndex: z.startIndex,
      touchCount: z.pivots,
      role,
      probability: pct(p),
      held,
      broken,
      factors,
    };
  });

  // Les zones les plus proches du prix d'abord (c'est là que se jouera le prochain contact), puis par solidité.
  const kept = out
    .sort((a, b) => Math.abs(a.price - close) - Math.abs(b.price - close) || b.touchCount - a.touchCount)
    .slice(0, settings.maxZones)
    .sort((a, b) => b.price - a.price);
  if (kept.length === 0) return result;
  for (let i = start; i <= last; i++) result[i] = kept;
  return result;
}

/** Le libellé d'une zone : son rôle, son prix et sa probabilité. */
export function srBounceLabel(zone: IndicatorBounceZone): string {
  return `${zone.role === "support" ? "Support" : "Résistance"} ${fmt(zone.price)} · ${zone.probability} % de rebond`;
}
