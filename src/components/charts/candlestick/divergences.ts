import type { Candle } from "./interfaces/Candle.interface";
import type { Divergence } from "./interfaces/Divergence.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { IndicatorMACD } from "./interfaces/IndicatorMACD.interface";
import { isRsiKind } from "./rsiZones";

/*
 * Divergences entre un oscillateur (RSI, ligne MACD) et le prix — option « Divergences » de ces deux indicateurs.
 *
 * Même méthode que l'indicateur RSI de TradingView (option « Calculate Divergence ») :
 *  - les pivots sont cherchés sur l'oscillateur : un sommet est une valeur plus haute que les `pivotLeft` bougies qui la
 *    précèdent et au moins aussi haute que les `pivotRight` qui la suivent ; un creux, l'inverse. Un pivot n'est donc
 *    connu que `pivotRight` bougies après lui (rien ne se redessine ensuite) ;
 *  - chaque pivot est comparé au pivot du même type qui le précède, s'ils sont séparés d'au moins `minBars` et d'au
 *    plus `maxBars` bougies ;
 *  - le prix est lu sur les mêmes bougies : leur plus haut pour deux sommets, leur plus bas pour deux creux.
 * Divergence baissière (régulière) : le prix fait un plus haut plus haut, l'oscillateur un sommet plus bas. Haussière :
 * le prix fait un plus bas plus bas, l'oscillateur un creux plus haut. Cachées (de continuation) : l'inverse — sommet
 * plus bas du prix et plus haut de l'oscillateur (baissière cachée), creux plus haut du prix et plus bas de
 * l'oscillateur (haussière cachée).
 */

export const DIVERGENCE_DEFAULTS = {
  pivotLeft: 5,
  pivotRight: 5,
  minBars: 5,
  maxBars: 60,
  bullColor: "#26a69a",
  bearColor: "#ef5350",
  lineWidth: 1.5,
  onPrice: true,
  showLabels: true,
  hidden: false,
};

export interface DivergenceOptions {
  pivotLeft: number;
  pivotRight: number;
  minBars: number;
  maxBars: number;
  hidden: boolean;
  /** Dernière bougie lue (la coupure d'un replay). */
  lastIndex?: number;
}

/** Les divergences d'une série d'oscillateur face aux bougies, dans l'ordre du temps. */
export function findDivergences(series: readonly (number | null)[], candles: readonly Pick<Candle, "high" | "low">[], opts: DivergenceOptions): Divergence[] {
  const left = Math.max(1, Math.floor(opts.pivotLeft));
  const right = Math.max(1, Math.floor(opts.pivotRight));
  const minBars = Math.max(1, Math.floor(opts.minBars));
  const maxBars = Math.max(minBars, Math.floor(opts.maxBars));
  const end = Math.min(series.length - 1, candles.length - 1, opts.lastIndex ?? Infinity);
  const out: Divergence[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  // Un pivot en i se confirme à la bougie i + right : on ne lit rien au-delà de `end`.
  for (let i = left; i + right <= end; i++) {
    const v = series[i];
    if (v === null || !Number.isFinite(v)) continue;
    let isHigh = true;
    let isLow = true;
    for (let k = i - left; k <= i + right && (isHigh || isLow); k++) {
      if (k === i) continue;
      const w = series[k];
      if (w === null || !Number.isFinite(w)) {
        isHigh = false;
        isLow = false;
        break;
      }
      // Strict à gauche, large à droite : sur un plateau, le premier point est le pivot.
      if (k < i ? w >= v : w > v) isHigh = false;
      if (k < i ? w <= v : w < v) isLow = false;
    }
    if (isHigh) {
      if (lastHigh !== null) {
        const gap = i - lastHigh;
        if (gap >= minBars && gap <= maxBars) {
          const v1 = series[lastHigh] as number;
          const p1 = candles[lastHigh].high;
          const p2 = candles[i].high;
          if (p2 > p1 && v < v1) out.push({ direction: "bearish", hidden: false, i1: lastHigh, i2: i, v1, v2: v, p1, p2 });
          else if (opts.hidden && p2 < p1 && v > v1) out.push({ direction: "bearish", hidden: true, i1: lastHigh, i2: i, v1, v2: v, p1, p2 });
        }
      }
      lastHigh = i;
    }
    if (isLow) {
      if (lastLow !== null) {
        const gap = i - lastLow;
        if (gap >= minBars && gap <= maxBars) {
          const v1 = series[lastLow] as number;
          const p1 = candles[lastLow].low;
          const p2 = candles[i].low;
          if (p2 < p1 && v > v1) out.push({ direction: "bullish", hidden: false, i1: lastLow, i2: i, v1, v2: v, p1, p2 });
          else if (opts.hidden && p2 > p1 && v < v1) out.push({ direction: "bullish", hidden: true, i1: lastLow, i2: i, v1, v2: v, p1, p2 });
        }
      }
      lastLow = i;
    }
  }
  return out;
}

/** Option offerte au RSI (et à sa variante à zones) et au MACD, et cochée. */
export function divergencesActive(indicator: Indicator): boolean {
  return indicator.divergences === true && supportsDivergences(indicator);
}

export function supportsDivergences(indicator: Pick<Indicator, "kind" | "customData">): boolean {
  return !indicator.customData && (isRsiKind(indicator.kind) || indicator.kind === "macd");
}

/** La série comparée au prix : le RSI lui-même, la ligne MACD (pas l'histogramme). */
export function divergenceSeries(indicator: Indicator, values: readonly (IndicatorValue | null)[]): (number | null)[] {
  if (indicator.kind === "macd") return values.map((v) => (v && typeof v === "object" && "macd" in v ? (v as IndicatorMACD).macd : null));
  return values.map((v) => (typeof v === "number" ? v : null));
}

/** Les divergences d'un indicateur d'après ses propres réglages. */
export function divergencesFor(indicator: Indicator, values: readonly (IndicatorValue | null)[], candles: readonly Pick<Candle, "high" | "low">[], lastIndex?: number): Divergence[] {
  return findDivergences(divergenceSeries(indicator, values), candles, {
    pivotLeft: indicator.divergencePivotLeft ?? DIVERGENCE_DEFAULTS.pivotLeft,
    pivotRight: indicator.divergencePivotRight ?? DIVERGENCE_DEFAULTS.pivotRight,
    minBars: indicator.divergenceMinBars ?? DIVERGENCE_DEFAULTS.minBars,
    maxBars: indicator.divergenceMaxBars ?? DIVERGENCE_DEFAULTS.maxBars,
    hidden: indicator.divergenceHidden === true,
    lastIndex,
  });
}

/** Le nom court de l'indicateur, sur les étiquettes des divergences reportées sur les prix. */
export function divergenceSourceName(indicator: Pick<Indicator, "kind">): string {
  return indicator.kind === "macd" ? "MACD" : "RSI";
}

/** Libellé court posé au bout d'une divergence : « H » haussière, « B » baissière ; « H c » / « B c » cachées. */
export function divergenceLabel(d: Pick<Divergence, "direction" | "hidden">): string {
  return `${d.direction === "bullish" ? "H" : "B"}${d.hidden ? " c" : ""}`;
}

/** Dessine des divergences sur un canevas déjà découpé à sa zone : un segment entre les deux pivots (pointillé pour une
 *  divergence cachée) et, au second pivot, une étiquette « H » sous un creux ou « B » au-dessus d'un sommet. `y` donne
 *  la hauteur d'un pivot (sur l'oscillateur ou sur le prix). */
export function drawDivergenceSegments(
  ctx: CanvasRenderingContext2D,
  divergences: readonly Divergence[],
  indicator: Indicator,
  x: (i: number) => number,
  y: (d: Divergence, which: 1 | 2) => number,
  width: number,
  style: { isEink: boolean; colorText: string; fontFamily: string },
  /** Ajouté à l'étiquette (« B RSI ») : sur les prix, où se croisent les divergences de plusieurs indicateurs. */
  labelSuffix?: string,
) {
  if (divergences.length === 0) return;
  const lineWidth = indicator.divergenceLineWidth ?? DIVERGENCE_DEFAULTS.lineWidth;
  const labels = indicator.divergenceShowLabels ?? DIVERGENCE_DEFAULTS.showLabels;
  ctx.save();
  ctx.font = `600 10px ${style.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const d of divergences) {
    const x1 = x(d.i1 + 0.5);
    const x2 = x(d.i2 + 0.5);
    if (x2 < -40 || x1 > width + 40) continue;
    const y1 = y(d, 1);
    const y2 = y(d, 2);
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    const color = style.isEink
      ? style.colorText
      : d.direction === "bullish"
        ? (indicator.divergenceBullColor ?? DIVERGENCE_DEFAULTS.bullColor)
        : (indicator.divergenceBearColor ?? DIVERGENCE_DEFAULTS.bearColor);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(d.hidden ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    for (const [px, py] of [[x1, y1], [x2, y2]]) {
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, lineWidth + 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    if (labels) {
      const text = labelSuffix ? `${divergenceLabel(d)} ${labelSuffix}` : divergenceLabel(d);
      const w = ctx.measureText(text).width + 8;
      const h = 14;
      // Sous un creux, au-dessus d'un sommet : l'étiquette ne recouvre pas la courbe.
      const cy = d.direction === "bullish" ? y2 + 4 + h / 2 + lineWidth : y2 - 4 - h / 2 - lineWidth;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(x2 - w / 2, cy - h / 2, w, h, 3);
      else ctx.rect(x2 - w / 2, cy - h / 2, w, h);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x2, cy + 0.5);
    }
  }
  ctx.restore();
}
