import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { RsiZoneLineKey, RsiZoneLineStyle } from "./interfaces/RsiZoneLine.interface";

/** « RSI : zones de survente et de surachat » (`kind: "rsiZones"`) : le RSI, plus quatre lignes horizontales relevées sur
 *  les `rsiZonesLookback` dernières bougies — la moyenne et l'extrême des valeurs passées sous le seuil de survente, et
 *  la moyenne et l'extrême de celles passées au-dessus du seuil de surachat. L'extrême de la survente est la valeur la
 *  plus basse atteinte ; celui du surachat, la plus haute. */

export const RSI_ZONES_DEFAULT_LOOKBACK = 100;

/** De haut en bas, dans l'ordre où elles se lisent sur le panneau. */
export const RSI_ZONE_LINE_KEYS: RsiZoneLineKey[] = ["overboughtExtreme", "overboughtMean", "oversoldMean", "oversoldExtreme"];

export const RSI_ZONE_LINE_DEFAULTS: Record<RsiZoneLineKey, Required<RsiZoneLineStyle>> = {
  overboughtExtreme: { show: true, color: "#ef5350", lineStyle: "dotted", opacity: 80, width: 1 },
  overboughtMean: { show: true, color: "#ef5350", lineStyle: "dashed", opacity: 80, width: 1 },
  oversoldMean: { show: true, color: "#26a69a", lineStyle: "dashed", opacity: 80, width: 1 },
  oversoldExtreme: { show: true, color: "#26a69a", lineStyle: "dotted", opacity: 80, width: 1 },
};

/** Nom complet (paramètres) et libellé court (sur le panneau, devant la valeur). */
export const RSI_ZONE_LINE_LABELS: Record<RsiZoneLineKey, { name: string; short: string }> = {
  overboughtExtreme: { name: "Surachat : maximum", short: "Max surachat" },
  overboughtMean: { name: "Surachat : moyenne", short: "Moy. surachat" },
  oversoldMean: { name: "Survente : moyenne", short: "Moy. survente" },
  oversoldExtreme: { name: "Survente : maximum (plus bas atteint)", short: "Max survente" },
};

/** La hauteur de chaque ligne, ou null quand aucune bougie de la fenêtre n'est entrée dans la zone. */
export type RsiZoneLevels = Record<RsiZoneLineKey, number | null>;

/** Les quatre niveaux sur les `lookback` bougies qui finissent à `lastIndex` (incluse). Une valeur égale au seuil compte
 *  dans la zone. Les bougies sans RSI (amorçage) sont ignorées. */
export function computeRsiZoneLevels(
  values: readonly (IndicatorValue | null)[],
  opts: { lookback: number; oversold: number; overbought: number; lastIndex?: number },
): RsiZoneLevels {
  const end = Math.min(values.length - 1, opts.lastIndex ?? values.length - 1);
  const start = Math.max(0, end - Math.max(1, Math.floor(opts.lookback)) + 1);
  let osSum = 0;
  let osCount = 0;
  let osLow = Infinity;
  let obSum = 0;
  let obCount = 0;
  let obHigh = -Infinity;
  for (let i = start; i <= end; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v <= opts.oversold) {
      osSum += v;
      osCount += 1;
      if (v < osLow) osLow = v;
    } else if (v >= opts.overbought) {
      obSum += v;
      obCount += 1;
      if (v > obHigh) obHigh = v;
    }
  }
  return {
    overboughtExtreme: obCount > 0 ? obHigh : null,
    overboughtMean: obCount > 0 ? obSum / obCount : null,
    oversoldMean: osCount > 0 ? osSum / osCount : null,
    oversoldExtreme: osCount > 0 ? osLow : null,
  };
}

/** Les niveaux d'un indicateur « rsiZones » d'après ses propres réglages (seuils, fenêtre). */
export function rsiZoneLevelsFor(indicator: Indicator, values: readonly (IndicatorValue | null)[], lastIndex?: number): RsiZoneLevels {
  return computeRsiZoneLevels(values, {
    lookback: indicator.rsiZonesLookback ?? RSI_ZONES_DEFAULT_LOOKBACK,
    oversold: indicator.rsiOversold ?? 30,
    overbought: indicator.rsiOverbought ?? 70,
    lastIndex,
  });
}

/** Les réglages effectifs d'une ligne : ceux de l'indicateur, complétés par les valeurs par défaut. */
export function resolveRsiZoneLine(indicator: Indicator, key: RsiZoneLineKey): Required<RsiZoneLineStyle> {
  const own = indicator.rsiZoneLines?.[key] ?? {};
  const def = RSI_ZONE_LINE_DEFAULTS[key];
  return {
    show: own.show ?? def.show,
    color: own.color ?? def.color,
    lineStyle: own.lineStyle ?? def.lineStyle,
    opacity: Math.max(0, Math.min(100, own.opacity ?? def.opacity)),
    width: own.width ?? def.width,
  };
}

/** Le RSI et sa variante à zones partagent l'échelle 0-100, les seuils et leur tracé. */
export function isRsiKind(kind: string): boolean {
  return kind === "rsi" || kind === "rsiZones";
}
