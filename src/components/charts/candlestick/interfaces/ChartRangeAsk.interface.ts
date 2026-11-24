import type { Candle } from "./Candle.interface";

/** Une zone du graphique : première et dernière bougie (dates d'ouverture), bornes comprises. */
export interface ChartRangeAsk {
  from: Date;
  to: Date;
}

/** Ce que demande l'infobulle d'une zone sélectionnée (outil « Interroger l'IA sur une zone ») :
 *  - `explain` — expliquer le mouvement de prix de la zone ;
 *  - `events` — trouver les évènements (actualités, publications, résultats, banques centrales) derrière ce mouvement ;
 *  - `technicals` — analyser la technique de la zone (tendance, niveaux, volumes, indicateurs) ;
 *  - `custom` — la question tapée dans le champ de l'infobulle. */
export type ChartRangeAskKind = "explain" | "events" | "technicals" | "custom";

/** Une question posée sur une zone du graphique, prête à envoyer : `prompt` est la demande complète (symbole,
 *  unité de temps, dates, chiffres de la zone, bougies, puis la question), `candles` les bougies de la zone. */
export interface ChartRangeAskRequest {
  kind: ChartRangeAskKind;
  /** Le libellé de l'option choisie, ou la question tapée pour `custom`. */
  question: string;
  /** Première et dernière bougie de la zone (dates d'ouverture). */
  from: Date;
  to: Date;
  candles: Candle[];
  symbol?: string;
  timeframe?: string;
  prompt: string;
  /** La même demande en deux lignes (question, dates et nombre de bougies), pour l'afficher dans une conversation. */
  summary: string;
}
