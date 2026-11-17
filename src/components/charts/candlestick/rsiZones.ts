import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { RsiZoneLineKey, RsiZoneLineStyle } from "./interfaces/RsiZoneLine.interface";

/** « RSI : zones de survente et de surachat » (`kind: "rsiZones"`, et le RSI classique avec `rsiZonesEnabled`) : le RSI,
 *  plus quatre lignes horizontales relevées sur les `rsiZonesPeaks` derniers passages en zone (30 par défaut) — chaque
 *  passage au-dessus du seuil de surachat donne son pic, chaque passage sous le seuil de survente son creux ; les lignes
 *  sont la moyenne de ces pics et le plus haut d'entre eux, puis la moyenne des creux et le plus bas d'entre eux. */

/** Nombre de pics (passages en zone) retenus par défaut pour la moyenne et le plus extrême. */
export const RSI_ZONES_DEFAULT_PEAKS = 30;

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
  overboughtExtreme: { name: "Surachat : plus haut des pics", short: "Max surachat" },
  overboughtMean: { name: "Surachat : moyenne des pics", short: "Moy. surachat" },
  oversoldMean: { name: "Survente : moyenne des creux", short: "Moy. survente" },
  oversoldExtreme: { name: "Survente : plus bas des creux", short: "Min survente" },
};

/** La hauteur de chaque ligne, ou null quand aucune bougie de la fenêtre n'est entrée dans la zone. */
export type RsiZoneLevels = Record<RsiZoneLineKey, number | null>;

/** Les pics de chaque passage en zone : un passage au-dessus du seuil de surachat (bougies consécutives, seuil compris)
 *  donne son plus haut ; un passage sous le seuil de survente, son plus bas. Les bougies sans RSI coupent un passage. */
export function rsiZonePeaks(
  values: readonly (IndicatorValue | null)[],
  opts: { oversold: number; overbought: number; lastIndex?: number },
): { overbought: number[]; oversold: number[] } {
  const end = Math.min(values.length - 1, opts.lastIndex ?? values.length - 1);
  const overbought: number[] = [];
  const oversold: number[] = [];
  let high: number | null = null;
  let low: number | null = null;
  for (let i = 0; i <= end; i++) {
    const v = values[i];
    const ok = typeof v === "number" && Number.isFinite(v);
    if (ok && v >= opts.overbought) high = high === null ? v : Math.max(high, v);
    else if (high !== null) {
      overbought.push(high);
      high = null;
    }
    if (ok && v <= opts.oversold) low = low === null ? v : Math.min(low, v);
    else if (low !== null) {
      oversold.push(low);
      low = null;
    }
  }
  // Un passage encore en cours compte avec son pic du moment.
  if (high !== null) overbought.push(high);
  if (low !== null) oversold.push(low);
  return { overbought, oversold };
}

/** Les quatre niveaux, sur les `peaks` derniers pics de chaque zone (jusqu'à `lastIndex`, la coupure d'un replay) : la
 *  moyenne des pics et le plus extrême d'entre eux (le plus haut en surachat, le plus bas en survente). Une zone sans
 *  aucun passage n'a pas de ligne. */
export function computeRsiZoneLevels(
  values: readonly (IndicatorValue | null)[],
  opts: { peaks: number; oversold: number; overbought: number; lastIndex?: number },
): RsiZoneLevels {
  const n = Math.max(1, Math.floor(opts.peaks));
  const { overbought, oversold } = rsiZonePeaks(values, opts);
  const ob = overbought.slice(-n);
  const os = oversold.slice(-n);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    overboughtExtreme: ob.length > 0 ? Math.max(...ob) : null,
    overboughtMean: ob.length > 0 ? mean(ob) : null,
    oversoldMean: os.length > 0 ? mean(os) : null,
    oversoldExtreme: os.length > 0 ? Math.min(...os) : null,
  };
}

/** Les niveaux d'un indicateur d'après ses propres réglages (seuils, nombre de pics). */
export function rsiZoneLevelsFor(indicator: Indicator, values: readonly (IndicatorValue | null)[], lastIndex?: number): RsiZoneLevels {
  return computeRsiZoneLevels(values, {
    peaks: indicator.rsiZonesPeaks ?? RSI_ZONES_DEFAULT_PEAKS,
    oversold: indicator.rsiOversold ?? 30,
    overbought: indicator.rsiOverbought ?? 70,
    lastIndex,
  });
}

/** Lignes des zones tracées : toujours pour « rsiZones », sur option pour le RSI classique. */
export function rsiZonesActive(indicator: Indicator): boolean {
  return indicator.kind === "rsiZones" || (indicator.kind === "rsi" && indicator.rsiZonesEnabled === true);
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
