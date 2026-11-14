import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";

/**
 * Indicateurs posés sur le panneau d'un autre (clic droit sur un panneau : une SMA du RSI, une EMA de la MACD…) :
 * calculés sur la série de ce panneau au lieu des prix, dessinés dans ce panneau, légendés dans son en-tête. Un
 * indicateur attaché porte `sourceId` (l'id de l'indicateur du panneau) ; ces moyennes sont les seules à avoir un sens
 * sur une série qui n'est pas un cours (pas de plus haut, de plus bas ni de volume).
 */
export const ATTACHABLE_KINDS: { kind: IndicatorKind; label: string }[] = [
  { kind: "sma", label: "moyenne mobile simple (SMA)" },
  { kind: "ema", label: "moyenne mobile exponentielle (EMA)" },
  { kind: "wma", label: "moyenne mobile pondérée (WMA)" },
];
export const ATTACHED_DEFAULT_PERIOD = 14;

/** La valeur principale d'un point d'indicateur, celle sur laquelle une moyenne a un sens : le nombre lui-même, la
 *  ligne MACD, l'ADX, le milieu d'une bande, ou la première série d'un panneau à plusieurs séries. */
export function mainValue(v: IndicatorValue | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const o = v as unknown as Record<string, unknown>;
  if (typeof o.macd === "number") return o.macd;
  if (typeof o.adx === "number") return o.adx;
  if (typeof o.value === "number") return o.value;
  if (typeof o.middle === "number") return o.middle;
  if (typeof o.upper === "number" && typeof o.lower === "number") return (o.upper + o.lower) / 2;
  if (o.multi && typeof o.multi === "object") {
    for (const sub of Object.values(o.multi as Record<string, unknown>)) {
      if (typeof sub === "number") return sub;
    }
  }
  return null;
}

/** Une moyenne (SMA, EMA, WMA) sur une série qui peut avoir des trous (début de calcul de l'indicateur source) : null
 *  tant que la fenêtre n'est pas pleine de valeurs. */
export function movingAverageOn(kind: IndicatorKind, period: number, series: (number | null)[]): (number | null)[] {
  const n = Math.max(1, Math.round(period));
  const out: (number | null)[] = new Array(series.length).fill(null);
  if (kind === "ema") {
    const k = 2 / (n + 1);
    let ema: number | null = null;
    let seed: number[] = [];
    series.forEach((v, i) => {
      if (v === null) return;
      if (ema === null) {
        seed.push(v);
        if (seed.length === n) {
          ema = seed.reduce((a, b) => a + b, 0) / n;
          out[i] = ema;
          seed = [];
        }
        return;
      }
      ema = v * k + ema * (1 - k);
      out[i] = ema;
    });
    return out;
  }
  for (let i = 0; i < series.length; i++) {
    if (i + 1 < n) continue;
    let sum = 0;
    let weights = 0;
    let ok = true;
    for (let j = 0; j < n; j++) {
      const v = series[i - j];
      if (v === null || v === undefined) {
        ok = false;
        break;
      }
      const w = kind === "wma" ? n - j : 1;
      sum += v * w;
      weights += w;
    }
    if (ok) out[i] = sum / weights;
  }
  return out;
}

/** Valeurs de tous les indicateurs : ceux attachés à un panneau calculés sur la série de leur source. */
export function withAttachedValues(
  indicators: Indicator[],
  compute: (indicator: Indicator) => (IndicatorValue | null)[],
): { indicator: Indicator; values: (IndicatorValue | null)[] }[] {
  const plain = new Map<string, (IndicatorValue | null)[]>();
  for (const ind of indicators) if (!ind.sourceId) plain.set(ind.id, compute(ind));
  return indicators.map((indicator) => {
    if (!indicator.sourceId) return { indicator, values: plain.get(indicator.id) ?? [] };
    const source = plain.get(indicator.sourceId);
    if (!source) return { indicator, values: [] };
    return { indicator, values: movingAverageOn(indicator.kind, indicator.period, source.map(mainValue)) };
  });
}
