import type { IndicatorSRLevel } from "./IndicatorSRLevel.interface";

/** Un facteur de la probabilité de rebond : ce qu'il a constaté et de combien il a déplacé l'estimation (en points de
 *  pourcentage, par rapport à la probabilité sans lui). */
export interface BounceFactor {
  /** Nom court du facteur (« Historique de la zone », « ADX »…). */
  label: string;
  /** Ce qu'il a constaté, en une phrase. */
  detail: string;
  /** Effet sur la probabilité, en points (positif : rebond plus probable). */
  effect: number;
}

/** Une zone de support ou de résistance détectée par « Probabilité de rebond » (`kind: "srBounce"`), avec la probabilité
 *  que le prix y rebondisse au prochain contact. Étend `IndicatorSRLevel` (`price` = milieu de la zone, `startIndex` =
 *  premier contact, `touchCount` = nombre de sommets ou de creux qui la forment) : le clic, les axes et la sélection
 *  la traitent comme un niveau de support/résistance. */
export interface IndicatorBounceZone extends IndicatorSRLevel {
  top: number;
  bottom: number;
  /** Rôle face au prix actuel : sous le prix, un support ; au-dessus, une résistance. */
  role: "support" | "resistance";
  /** Probabilité de rebond au prochain contact, en % (5 à 95). */
  probability: number;
  /** Contacts passés de la zone qui ont tenu (rebond d'au moins 1 ATR) ou cédé (clôture au-delà d'une demi-ATR). */
  held: number;
  broken: number;
  /** Le détail du calcul, facteur par facteur. */
  factors: BounceFactor[];
}
