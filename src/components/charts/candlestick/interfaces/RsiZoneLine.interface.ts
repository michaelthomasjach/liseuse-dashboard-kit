import type { IndicatorLineStyle } from "./IndicatorLineStyle.interface";

/** Les quatre lignes horizontales de l'indicateur « RSI : zones de survente et de surachat » (`kind: "rsiZones"`) :
 *  la moyenne et l'extrême des valeurs du RSI passées en surachat, puis en survente, sur les dernières bougies. */
export type RsiZoneLineKey = "overboughtExtreme" | "overboughtMean" | "oversoldMean" | "oversoldExtreme";

/** Réglages d'une de ces lignes. Chaque champ absent prend la valeur par défaut de la ligne (`RSI_ZONE_LINE_DEFAULTS`). */
export type RsiZoneLineStyle = IndicatorLineStyle;
