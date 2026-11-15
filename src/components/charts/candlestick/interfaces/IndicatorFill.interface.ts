/** Ancien format des couleurs de l'onglet Style, remplacé par `IndicatorStyleRule` et converti à la lecture
 *  (`legacyFillToRule`) : une zone colorée entre la courbe d'un indicateur et une référence, d'une couleur quand la
 *  courbe est au-dessus de la référence, d'une autre quand elle est en dessous. */
export interface IndicatorFill {
  id: string;
  /** « level » : un niveau fixe (`level`, sur l'échelle de l'indicateur — 50 pour un RSI, 0 pour une MACD ou un
   *  volume) ; « close » : le cours de clôture de chaque bougie (indicateurs tracés sur les prix). */
  reference: "level" | "close";
  level?: number;
  /** Couleur quand la courbe est au-dessus de la référence ; absente : pas de couleur de ce côté. */
  aboveColor?: string | null;
  /** Couleur quand la courbe est en dessous de la référence ; absente : pas de couleur de ce côté. */
  belowColor?: string | null;
  /** Opacité en %, de 0 à 100. Défaut 25. */
  opacity?: number;
}
