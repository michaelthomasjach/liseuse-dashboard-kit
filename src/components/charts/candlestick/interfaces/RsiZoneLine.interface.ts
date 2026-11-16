/** Les quatre lignes horizontales de l'indicateur « RSI : zones de survente et de surachat » (`kind: "rsiZones"`) :
 *  la moyenne et l'extrême des valeurs du RSI passées en surachat, puis en survente, sur les dernières bougies. */
export type RsiZoneLineKey = "overboughtExtreme" | "overboughtMean" | "oversoldMean" | "oversoldExtreme";

/** Réglages d'une de ces lignes. Chaque champ absent prend la valeur par défaut de la ligne (`RSI_ZONE_LINE_DEFAULTS`). */
export interface RsiZoneLineStyle {
  /** Ligne affichée (oui par défaut). */
  show?: boolean;
  /** Couleur de la ligne et de son libellé. */
  color?: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  /** Opacité, en % (0 à 100). */
  opacity?: number;
  /** Épaisseur, en px. */
  width?: number;
}
