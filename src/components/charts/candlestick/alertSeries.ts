import type { Candle } from "./interfaces/Candle.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "./interfaces/FundamentalDataPoint.interface";
import { computeIndicatorValues } from "./indicators";
import { VOLUME_PANE_ID, mainValue, withAttachedValues } from "./attachedIndicators";

/**
 * La série sur laquelle porte une alerte (`ChartAlertDraft.conditionIndicatorId`), bougie par bougie, calculée comme le
 * graphique la trace : « price » → la clôture, « volume » → le volume, l'id d'un indicateur → sa valeur principale
 * (la ligne MACD, l'ADX, le milieu d'une bande, la première série d'un script… voir `mainValue`). Un indicateur posé sur
 * un panneau (une SMA du RSI, du volume) est calculé sur la série de ce panneau. `null` là où la série n'a pas de valeur
 * (début de calcul) ; tableau vide pour un indicateur absent de `indicators`.
 *
 * Le kit ne fait que collecter les alertes : c'est à l'application de les vérifier, à chaque cours, avec ceci pour une
 * alerte qui ne porte pas sur le prix.
 */
export function alertSeriesValues(data: Candle[], indicators: Indicator[], seriesId: string, fundamentals?: FundamentalDataPoint[]): (number | null)[] {
  if (seriesId === "price") return data.map((d) => d.close);
  if (seriesId === VOLUME_PANE_ID) return data.map((d) => (typeof d.volume === "number" && Number.isFinite(d.volume) ? d.volume : null));
  const target = indicators.find((i) => i.id === seriesId);
  if (!target) return [];
  // L'indicateur et la chaîne des panneaux qui le portent (la SMA d'un RSI a besoin du RSI).
  const chain: Indicator[] = [target];
  let source = target.sourceId;
  while (source && source !== VOLUME_PANE_ID && !chain.some((i) => i.id === source)) {
    const host = indicators.find((i) => i.id === source);
    if (!host) break;
    chain.unshift(host);
    source = host.sourceId;
  }
  const computed = withAttachedValues(chain, (indicator) => computeIndicatorValues(data, indicator, fundamentals), data.map((d) => d.volume ?? null));
  const entry = computed.find((e) => e.indicator.id === seriesId);
  return entry ? entry.values.map((v) => mainValue(v)) : [];
}
