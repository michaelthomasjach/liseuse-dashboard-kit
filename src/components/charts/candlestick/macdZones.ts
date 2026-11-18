import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { IndicatorMACD } from "./interfaces/IndicatorMACD.interface";
import type { IndicatorLineStyle } from "./interfaces/IndicatorLineStyle.interface";
import type { MacdZoneLineKey } from "./interfaces/MacdZoneLine.interface";
import { rsiZonePeaks } from "./rsiZones";

/** Option « Lignes des pics et des creux » du MACD (`macdZonesEnabled`), le pendant des lignes de zones du RSI.
 *
 *  Le MACD n'a pas de seuils fixes comme les 70 / 30 du RSI : sa zone « haute » est tout ce qui est au-dessus de 0, sa
 *  zone « basse » tout ce qui est en dessous. Un pic est le plus haut de la ligne MACD sur un passage au-dessus de 0
 *  (bougies consécutives, d'un croisement de zéro au suivant) ; un creux, le plus bas d'un passage sous 0. Sur les
 *  `macdZonesPeaks` derniers pics (30 par défaut), on trace leur moyenne et le plus haut d'entre eux ; sur les derniers
 *  creux, leur moyenne et le plus bas. Un passage encore en cours compte avec son extrême du moment. */

export const MACD_ZONES_DEFAULT_PEAKS = 30;

/** De haut en bas, dans l'ordre où elles se lisent sur le panneau. */
export const MACD_ZONE_LINE_KEYS: MacdZoneLineKey[] = ["peakMax", "peakMean", "troughMean", "troughMin"];

export const MACD_ZONE_LINE_DEFAULTS: Record<MacdZoneLineKey, Required<IndicatorLineStyle>> = {
  peakMax: { show: true, color: "#ef5350", lineStyle: "dotted", opacity: 80, width: 1 },
  peakMean: { show: true, color: "#ef5350", lineStyle: "dashed", opacity: 80, width: 1 },
  troughMean: { show: true, color: "#26a69a", lineStyle: "dashed", opacity: 80, width: 1 },
  troughMin: { show: true, color: "#26a69a", lineStyle: "dotted", opacity: 80, width: 1 },
};

/** Nom complet (paramètres) et libellé court (sur le panneau, devant la valeur). */
export const MACD_ZONE_LINE_LABELS: Record<MacdZoneLineKey, { name: string; short: string }> = {
  peakMax: { name: "Pics : plus haut", short: "Max pics" },
  peakMean: { name: "Pics : moyenne", short: "Moy. pics" },
  troughMean: { name: "Creux : moyenne", short: "Moy. creux" },
  troughMin: { name: "Creux : plus bas", short: "Min creux" },
};

/** La hauteur de chaque ligne, ou null quand la ligne MACD n'est jamais passée de ce côté de zéro. */
export type MacdZoneLevels = Record<MacdZoneLineKey, number | null>;

/** Les quatre niveaux, relevés jusqu'à `lastIndex` (la coupure d'un replay) sur les `peaks` derniers passages. */
export function computeMacdZoneLevels(
  values: readonly (IndicatorValue | null)[],
  opts: { peaks: number; lastIndex?: number },
): MacdZoneLevels {
  const n = Math.max(1, Math.floor(opts.peaks));
  const line = values.map((v) => (v && typeof v === "object" && "macd" in v ? (v as IndicatorMACD).macd : null));
  // Strictement au-dessus et au-dessous de 0 : le plus petit nombre positif comme seuil.
  const { overbought, oversold } = rsiZonePeaks(line, { overbought: Number.MIN_VALUE, oversold: -Number.MIN_VALUE, lastIndex: opts.lastIndex });
  const peaks = overbought.slice(-n);
  const troughs = oversold.slice(-n);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    peakMax: peaks.length > 0 ? Math.max(...peaks) : null,
    peakMean: peaks.length > 0 ? mean(peaks) : null,
    troughMean: troughs.length > 0 ? mean(troughs) : null,
    troughMin: troughs.length > 0 ? Math.min(...troughs) : null,
  };
}

export function macdZonesActive(indicator: Indicator): boolean {
  return indicator.kind === "macd" && indicator.macdZonesEnabled === true;
}

export function macdZoneLevelsFor(indicator: Indicator, values: readonly (IndicatorValue | null)[], lastIndex?: number): MacdZoneLevels {
  return computeMacdZoneLevels(values, { peaks: indicator.macdZonesPeaks ?? MACD_ZONES_DEFAULT_PEAKS, lastIndex });
}

/** Les réglages effectifs d'une ligne : ceux de l'indicateur, complétés par les valeurs par défaut. */
export function resolveMacdZoneLine(indicator: Indicator, key: MacdZoneLineKey): Required<IndicatorLineStyle> {
  const own = indicator.macdZoneLines?.[key] ?? {};
  const def = MACD_ZONE_LINE_DEFAULTS[key];
  return {
    show: own.show ?? def.show,
    color: own.color ?? def.color,
    lineStyle: own.lineStyle ?? def.lineStyle,
    opacity: Math.max(0, Math.min(100, own.opacity ?? def.opacity)),
    width: own.width ?? def.width,
  };
}

/** Les niveaux des lignes affichées, pour que l'échelle automatique du panneau les garde visibles. */
export function shownMacdZoneValues(indicator: Indicator, levels: MacdZoneLevels | null | undefined): number[] {
  if (!levels) return [];
  const out: number[] = [];
  for (const key of MACD_ZONE_LINE_KEYS) {
    const v = levels[key];
    const line = resolveMacdZoneLine(indicator, key);
    if (v !== null && line.show && line.opacity > 0) out.push(v);
  }
  return out;
}
