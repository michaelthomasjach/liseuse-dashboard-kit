/** Réglages d'une ligne tracée par un indicateur (une bande, un niveau…). Chaque champ absent prend la valeur par défaut
 *  que l'indicateur donne à cette ligne. */
export interface IndicatorLineStyle {
  /** Ligne affichée (oui par défaut). */
  show?: boolean;
  /** Couleur de la ligne (et de son libellé, s'il en a un). */
  color?: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  /** Opacité, en % (0 à 100). */
  opacity?: number;
  /** Épaisseur, en px. */
  width?: number;
}

/** Les trois lignes des canaux de Donchian (`kind: "donchian"`). */
export type DonchianLineKey = "upper" | "basis" | "lower";

/** Le fond coloré entre les bandes des canaux de Donchian. */
export interface DonchianBackground {
  show?: boolean;
  color?: string;
  /** Opacité, en % (0 à 100). */
  opacity?: number;
}
