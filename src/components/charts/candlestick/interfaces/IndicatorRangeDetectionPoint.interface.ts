/** Niveau d'une des trois conditions de « Détection de range (précoce) » sur une bougie : « full » (établie : seuil
 *  franchi), « early » (elle commence : pente dans le sens d'un range), « off », ou « na » quand elle ne se calcule
 *  pas (pas de volume pour ce symbole, historique trop court). */
export type RangeConditionLevel = "full" | "early" | "off" | "na";

/** Une zone de range : un rectangle sur les prix, de la bougie `start` à la bougie `end` (exclusive), entre le plus
 *  haut et le plus bas de ses bougies. Toutes les bougies de la zone portent le même objet. */
export interface IndicatorRangeZone {
  start: number;
  end: number;
  high: number;
  low: number;
  /** L'état « range confirmé » a été atteint au moins une fois dans la zone. */
  confirmed: boolean;
  /** Zone encore ouverte : elle va jusqu'à la bougie courante et se prolonge tant que le range tient. */
  active: boolean;
  /** Comment la zone s'est terminée : cassure par le haut, par le bas, ou extinction des signaux (null). */
  breakout: "up" | "down" | null;
}

/** « Détection de range (précoce) » sur une bougie : l'état, le score (part des conditions remplies, une condition
 *  qui commence comptant pour moitié), les lectures qui y mènent et la zone éventuelle. Voir
 *  `computeRangeDetectionValues` (rangeDetection.ts). */
export interface IndicatorRangeDetectionPoint {
  rangeState: "none" | "probable" | "confirmed";
  /** 0 à 100. */
  rangeScore: number;
  chop: number | null;
  /** Rang centile de l'ATR (en % du cours) dans sa fenêtre, 0 à 100. */
  volatilityRank: number | null;
  /** Moyenne courte du volume / moyenne longue. */
  volumeRatio: number | null;
  conditions: { volume: RangeConditionLevel; volatility: RangeConditionLevel; chop: RangeConditionLevel };
  zone: IndicatorRangeZone | null;
}
