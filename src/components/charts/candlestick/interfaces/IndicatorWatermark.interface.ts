/** Filigrane du panneau d'un indicateur : un texte en fond du panneau, comme le nom du symbole sur les prix.
 *  Réglé dans les paramètres de l'indicateur (onglet Style) ou posé par un script (`plot.pane(nom).watermark(…)`). */
export interface IndicatorWatermark {
  /** Affiché ou non. Absent : affiché (un filigrane posé est fait pour se voir). */
  visible?: boolean;
  /** Le texte. Absent ou vide : le nom de l'indicateur. */
  text?: string;
  /** Opacité, de 0.02 à 0.6. Défaut 0.08 (celle du filigrane des prix). */
  opacity?: number;
  /** Taille, en % de la taille par défaut (100), de 20 à 200. */
  size?: number;
}
