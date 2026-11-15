import type { StyleRuleSeriesRef } from "./IndicatorStyleRule.interface";

/** Ce qu'une condition mesure sur une bougie.
 *  Mesures chiffrées (comparées par `operator` à `value`, et `value2` pour « entre ») :
 *  - « changeOpen » : variation en % de la clôture par rapport à l'ouverture de la même bougie ;
 *  - « changePrev » : variation en % de la clôture par rapport à la clôture précédente ;
 *  - « range » : amplitude (plus haut − plus bas) en % de l'ouverture ;
 *  - « body » : corps (|clôture − ouverture|) en % de l'amplitude (100 : pas de mèche, 0 : doji parfait) ;
 *  - « gap » : écart en % entre l'ouverture et la clôture précédente (positif : gap haussier) ;
 *  - « volume » : volume divisé par la moyenne des `period` bougies précédentes (2 : deux fois la moyenne).
 *  Mesures vraies ou fausses (sans opérateur) :
 *  - « closeAbove » / « closeBelow » : clôture au-dessus / en dessous d'une courbe affichée (`series`) ;
 *  - « highest » / « lowest » : plus haut (plus bas) des `period` dernières bougies, celle-ci comprise ;
 *  - « bullish » / « bearish » : clôture au-dessus / en dessous de l'ouverture. */
export type CandleColorMetric =
  | "changeOpen"
  | "changePrev"
  | "range"
  | "body"
  | "gap"
  | "volume"
  | "closeAbove"
  | "closeBelow"
  | "highest"
  | "lowest"
  | "bullish"
  | "bearish";

/** « supérieur à », « inférieur à », « entre » (bornes `value` et `value2`, dans n'importe quel ordre, comprises). */
export type CandleColorOperator = "gt" | "lt" | "between";

/** Une condition sur une bougie : « [mesure] [opérateur] [valeur] ». */
export interface CandleColorCondition {
  metric: CandleColorMetric;
  /** Mesures chiffrées seulement. Défaut « gt ». */
  operator?: CandleColorOperator;
  /** Le seuil : en % pour les variations, l'amplitude, le corps et le gap ; un multiple de la moyenne pour le volume. */
  value?: number;
  /** Deuxième borne de « entre ». */
  value2?: number;
  /** Nombre de bougies : moyenne du volume (défaut 20), plus haut / plus bas (défaut 20). */
  period?: number;
  /** « closeAbove » / « closeBelow » : la courbe d'un indicateur tracé sur les prix (même référence que les règles
   *  de couleur des indicateurs ; `indicatorId` obligatoire ici, `field` pour une ligne d'un indicateur à plusieurs
   *  lignes). */
  series?: StyleRuleSeriesRef;
}

/**
 * Une règle de couleur des bougies (Paramètres du graphique → Bougies → « Couleurs conditionnelles ») ; se lit comme
 * une phrase : « Quand [condition] (et / ou [condition]…) → corps en [color], mèche en [wickColor], bordure en
 * [borderColor] ». Les règles sont lues dans l'ordre de la liste : la première qui s'applique à une bougie la colore,
 * les suivantes ne la touchent plus. Les conditions sont lues sur les vraies bougies (OHLCV de `data`), y compris en
 * Heikin Ashi.
 */
export interface CandleColorRule {
  id: string;
  /** Faux : la règle est gardée mais ne colore rien (case décochée). Défaut vrai. */
  enabled?: boolean;
  /** Nom libre, affiché en tête de la règle (« Forte hausse »). */
  name?: string;
  conditions: CandleColorCondition[];
  /** Comment combiner plusieurs conditions : toutes (« and », défaut) ou au moins une (« or »). */
  combine?: "and" | "or";
  /** Couleur du corps (et de la barre en mode Barres, du point en mode Ligne). */
  color: string;
  /** Couleur de la mèche ; absente : celle du corps. */
  wickColor?: string | null;
  /** Couleur de la bordure du corps ; absente : celle du corps. */
  borderColor?: string | null;
}

/** La couleur retenue pour une bougie, par une règle ou par un script (`plot.candleColor`). */
export interface CandleColorOverride {
  body: string;
  wick: string;
  border: string;
}
