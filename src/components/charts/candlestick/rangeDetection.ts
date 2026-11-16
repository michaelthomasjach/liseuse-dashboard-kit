import type { Candle } from "./interfaces/Candle.interface";
import type {
  IndicatorRangeDetectionPoint,
  IndicatorRangeZone,
  RangeConditionLevel,
} from "./interfaces/IndicatorRangeDetectionPoint.interface";
import { computeWilderATR } from "./expectedVolatility";

/** « Détection de range (précoce) » : repère tôt une phase de range (marché sans direction) en croisant trois signes
 *  qui l'accompagnent presque toujours — les volumes qui se contractent, la volatilité qui baisse, et le Choppiness
 *  Index (CHOP) qui monte. Un CHOP **élevé** signale un range (au-dessus de 61,8, le marché est « haché ») : c'est donc
 *  sa montée au-dessus d'un seuil qui compte ici, la « baisse du CHOP » au sens courant étant le signal inverse (une
 *  tendance qui démarre).
 *
 *  Précoce : chaque condition a deux niveaux, « commence » (pente dans le bon sens) et « établie » (seuil franchi), et
 *  deux conditions sur trois qui *commencent* suffisent pour annoncer un « range probable » ; « range confirmé » quand
 *  les trois sont au moins commencées et deux établies. La zone (un rectangle sur les prix, du plus haut au plus bas des
 *  bougies) part de la première bougie détectée et se prolonge tant que le range tient : elle s'arrête sur une cassure
 *  (clôture au-delà du rectangle de plus d'une fraction d'ATR) ou après quelques bougies sans signal.
 *
 *  Séparé d'indicators.ts (budget de lignes), comme expectedVolatility.ts ; le rendu est dans
 *  render/drawRangeDetection.ts, qui passe par le tracé générique de rectangles (render/drawPriceBoxes.ts). */

export const RANGE_DETECTION_DEFAULTS = {
  /** Période du CHOP (`Indicator.period`). */
  chopPeriod: 14,
  /** CHOP au-dessus de ce seuil et en hausse : la condition « commence ». */
  chopEarly: 50,
  /** CHOP au-dessus de ce seuil : la condition est établie (61,8, la borne haute usuelle du CHOP). */
  chopConfirm: 61.8,
  /** CHOP sous ce seuil (38,2, la borne basse usuelle) : tendance franche, aucun range annoncé quoi que disent volume et
   *  volatilité. */
  chopTrend: 38.2,
  /** Période de l'ATR (Wilder). */
  atrPeriod: 14,
  /** Fenêtre, en bougies, du classement de l'ATR (en % du cours) : 100 = l'ATR comparé aux 100 dernières bougies. */
  volLookback: 100,
  /** ATR dans les X % les plus bas de la fenêtre (25) : volatilité contractée (condition établie). */
  volPercentile: 25,
  /** Moyennes du volume : courte et longue (bougies). */
  volumeFast: 10,
  volumeSlow: 30,
  /** Écart, en bougies, sur lequel se lisent les pentes (et l'accélération, sur deux écarts). */
  slopeBars: 3,
  /** Clôture au-delà du rectangle de plus de X × ATR : cassure, fin du range. */
  breakoutAtr: 1,
  /** Bougies sans signal tolérées avant de clore la zone. */
  graceBars: 5,
  /** Une zone close plus courte que ce nombre de bougies est écartée (bruit) ; la zone en cours est toujours montrée. */
  minBars: 5,
  showProbable: true,
  showLabels: true,
  showMidline: true,
  probableColor: "#f59e0b",
  confirmedColor: "#3b82f6",
  /** Opacité du fond des rectangles, en %. */
  opacity: 12,
};

export interface RangeDetectionSettings {
  chopPeriod: number;
  chopEarly: number;
  chopConfirm: number;
  chopTrend: number;
  atrPeriod: number;
  volLookback: number;
  volPercentile: number;
  volumeFast: number;
  volumeSlow: number;
  slopeBars: number;
  breakoutAtr: number;
  graceBars: number;
  minBars: number;
}

function sma(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v ?? 0;
    count += v === null ? 0 : 1;
    if (i >= period) {
      const old = values[i - period];
      sum -= old ?? 0;
      count -= old === null ? 0 : 1;
    }
    if (i >= period - 1 && count === period) out[i] = sum / period;
  }
  return out;
}

/** Rang centile (0 à 100) de `values[i]` parmi les `lookback` dernières valeurs connues (elle comprise). */
function percentileRank(values: (number | null)[], i: number, lookback: number): number | null {
  const v = values[i];
  if (v === null) return null;
  let below = 0;
  let total = 0;
  for (let j = Math.max(0, i - lookback + 1); j <= i; j++) {
    const w = values[j];
    if (w === null) continue;
    total++;
    if (w <= v) below++;
  }
  // Trop peu d'historique pour classer : pas de verdict plutôt qu'un rang qui ne veut rien dire.
  return total >= Math.min(lookback, 20) ? (below / total) * 100 : null;
}

const at = (values: (number | null)[], i: number): number | null => (i >= 0 && i < values.length ? values[i] : null);

/** Niveau d'une condition : « na » quand elle ne se calcule pas (pas de volume, historique trop court). */
function levelScore(level: RangeConditionLevel): number {
  return level === "full" ? 1 : level === "early" ? 0.5 : 0;
}

/** `chopOf` : le CHOP du catalogue (`computeCHOPValues` d'indicators.ts), passé par l'appelant pour ne pas créer
 *  d'import circulaire entre les deux fichiers. */
export function computeRangeDetectionValues(
  data: Candle[],
  s: RangeDetectionSettings,
  chopOf: (data: Candle[], period: number) => (number | null)[],
): (IndicatorRangeDetectionPoint | null)[] {
  const n = data.length;
  const out: (IndicatorRangeDetectionPoint | null)[] = new Array(n).fill(null);
  if (n === 0) return out;
  const slope = Math.max(1, Math.round(s.slopeBars));
  const chop = chopOf(data, Math.max(2, Math.round(s.chopPeriod)));
  const atr = computeWilderATR(data, Math.max(1, Math.round(s.atrPeriod)));
  const atrPct = atr.map((a, i) => (a === null || !(data[i].close > 0) ? null : a / data[i].close));
  // Volume : absent ou nul partout (indice, devise sans volume) → la condition ne compte pas.
  const hasVolume = data.some((d) => (d.volume ?? 0) > 0);
  const volume = data.map((d) => (hasVolume && d.volume !== undefined && Number.isFinite(d.volume) ? d.volume : null));
  const volFast = sma(volume, Math.max(1, Math.round(s.volumeFast)));
  const volSlow = sma(volume, Math.max(2, Math.round(s.volumeSlow)));

  const states: IndicatorRangeDetectionPoint["rangeState"][] = new Array(n).fill("none");
  // Deux conditions qui ne font que commencer (aucune établie) : le signal doit tenir deux bougies de suite, sinon le
  // moindre creux de volume dans une tendance allumerait un « range probable ».
  let previousActive = 0;
  for (let i = 0; i < n; i++) {
    // CHOP : établi au-dessus du seuil haut ; « commence » au-dessus du seuil précoce s'il monte.
    const c = chop[i];
    const cPrev = at(chop, i - slope);
    const chopLevel: RangeConditionLevel =
      c === null ? "na" : c >= s.chopConfirm ? "full" : c >= s.chopEarly && cPrev !== null && c > cPrev ? "early" : "off";
    // Volatilité : ATR (en % du cours) dans le bas de sa fenêtre ; « commence » s'il baisse et que la baisse s'accélère
    // ou qu'il est déjà sous sa médiane.
    const rank = percentileRank(atrPct, i, Math.max(10, Math.round(s.volLookback)));
    const a0 = atrPct[i];
    const a1 = at(atrPct, i - slope);
    const a2 = at(atrPct, i - 2 * slope);
    const atrFalling = a0 !== null && a1 !== null && a0 < a1;
    const atrAccelerating = atrFalling && a2 !== null && a0 - a1! < a1! - a2;
    const volatilityLevel: RangeConditionLevel =
      rank === null ? "na" : rank <= s.volPercentile ? "full" : atrFalling && (atrAccelerating || rank <= 50) ? "early" : "off";
    // Volume : moyenne courte nettement sous la longue (−10 %) ; « commence » si la courte baisse et passe sous la longue.
    const f0 = volFast[i];
    const f1 = at(volFast, i - slope);
    const sl = volSlow[i];
    const volumeLevel: RangeConditionLevel =
      f0 === null || sl === null || sl <= 0 ? "na" : f0 < sl * 0.9 ? "full" : f1 !== null && f0 < f1 && f0 < sl ? "early" : "off";

    const levels = [volumeLevel, volatilityLevel, chopLevel];
    const available = levels.filter((l) => l !== "na");
    if (available.length < 2) continue;
    const active = available.filter((l) => l !== "off").length;
    const full = available.filter((l) => l === "full").length;
    const score = Math.round((available.reduce((sum, l) => sum + levelScore(l), 0) / available.length) * 100);
    // CHOP sous le seuil de tendance et qui ne remonte pas : le marché est directionnel, pas de range quoi que disent
    // les deux autres. Un CHOP bas qui remonte laisse passer la détection précoce (la tendance s'essouffle).
    const trending = c !== null && c < s.chopTrend && (cPrev === null || c <= cPrev);
    const probable = active >= 2 && (full >= 1 || previousActive >= 2);
    previousActive = active;
    const state = trending ? "none" : active === available.length && full >= 2 ? "confirmed" : probable ? "probable" : "none";
    states[i] = state;
    out[i] = {
      rangeState: state,
      rangeScore: score,
      chop: c,
      volatilityRank: rank,
      volumeRatio: f0 !== null && sl !== null && sl > 0 ? f0 / sl : null,
      conditions: { volume: volumeLevel, volatility: volatilityLevel, chop: chopLevel },
      zone: null,
    };
  }

  // Zones : de la première bougie détectée tant que le range tient (cassure ou trop de bougies sans signal).
  const zones: IndicatorRangeZone[] = [];
  let open: { start: number; lastActive: number; high: number; low: number; confirmed: boolean } | null = null;
  const close = (end: number, breakout: IndicatorRangeZone["breakout"], active: boolean) => {
    if (!open) return;
    const zoneEnd = Math.max(open.start + 1, end);
    let high = -Infinity;
    let low = Infinity;
    for (let j = open.start; j < zoneEnd; j++) {
      high = Math.max(high, data[j].high);
      low = Math.min(low, data[j].low);
    }
    if (active || zoneEnd - open.start >= Math.max(1, Math.round(s.minBars))) {
      zones.push({ start: open.start, end: zoneEnd, high, low, confirmed: open.confirmed, active, breakout });
    }
    open = null;
  };
  for (let i = 0; i < n; i++) {
    const state = states[i];
    if (open) {
      const tolerance = s.breakoutAtr * (atr[i] ?? 0);
      const bar = data[i];
      // Une zone toute jeune (moins de « durée minimale » bougies) s'élargit au lieu de casser : son rectangle n'a pas
      // encore pris la mesure du range.
      const mature = i - open.start >= Math.max(1, Math.round(s.minBars));
      if (mature && (bar.close > open.high + tolerance || bar.close < open.low - tolerance)) {
        close(open.lastActive + 1, bar.close > open.high ? "up" : "down", false);
        continue;
      }
      if (state === "none") {
        if (i - open.lastActive > Math.max(0, Math.round(s.graceBars))) close(open.lastActive + 1, null, false);
      } else {
        open.lastActive = i;
        if (state === "confirmed") open.confirmed = true;
      }
      if (open) {
        open.high = Math.max(open.high, bar.high);
        open.low = Math.min(open.low, bar.low);
        continue;
      }
    }
    if (state !== "none") open = { start: i, lastActive: i, high: data[i].high, low: data[i].low, confirmed: state === "confirmed" };
  }
  // Zone encore ouverte : elle va jusqu'à la bougie courante, même si les dernières sont « sans signal » (tolérance).
  if (open) close(n, null, true);

  for (const zone of zones) {
    for (let j = zone.start; j < zone.end; j++) {
      const point = out[j];
      if (point) point.zone = zone;
      else out[j] = { rangeState: "none", rangeScore: 0, chop: chop[j], volatilityRank: null, volumeRatio: null, conditions: { volume: "na", volatility: "na", chop: "na" }, zone };
    }
  }
  return out;
}

/** Les réglages d'un `Indicator` « rangeDetection », valeurs par défaut comprises. */
export function rangeDetectionSettingsOf(ind: {
  period?: number;
  rangeChopEarly?: number;
  rangeChopConfirm?: number;
  rangeChopTrend?: number;
  rangeAtrPeriod?: number;
  rangeVolLookback?: number;
  rangeVolPercentile?: number;
  rangeVolumeFast?: number;
  rangeVolumeSlow?: number;
  rangeSlopeBars?: number;
  rangeBreakoutAtr?: number;
  rangeGraceBars?: number;
  rangeMinBars?: number;
}): RangeDetectionSettings {
  const d = RANGE_DETECTION_DEFAULTS;
  return {
    chopPeriod: ind.period ?? d.chopPeriod,
    chopEarly: ind.rangeChopEarly ?? d.chopEarly,
    chopConfirm: ind.rangeChopConfirm ?? d.chopConfirm,
    chopTrend: ind.rangeChopTrend ?? d.chopTrend,
    atrPeriod: ind.rangeAtrPeriod ?? d.atrPeriod,
    volLookback: ind.rangeVolLookback ?? d.volLookback,
    volPercentile: ind.rangeVolPercentile ?? d.volPercentile,
    volumeFast: ind.rangeVolumeFast ?? d.volumeFast,
    volumeSlow: ind.rangeVolumeSlow ?? d.volumeSlow,
    slopeBars: ind.rangeSlopeBars ?? d.slopeBars,
    breakoutAtr: ind.rangeBreakoutAtr ?? d.breakoutAtr,
    graceBars: ind.rangeGraceBars ?? d.graceBars,
    minBars: ind.rangeMinBars ?? d.minBars,
  };
}

/** Libellé court de l'état, pour la légende et le rectangle. */
export function rangeStateLabel(state: IndicatorRangeDetectionPoint["rangeState"]): string {
  return state === "confirmed" ? "Range confirmé" : state === "probable" ? "Range probable" : "Pas de range";
}
