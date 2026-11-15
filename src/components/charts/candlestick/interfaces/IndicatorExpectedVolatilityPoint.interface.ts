/** « Volatilité attendue du jour (ATR) » : pour chaque bougie, la période de l'échelle choisie à laquelle elle
 *  appartient (un jour dans le fuseau choisi, une heure, une bougie 4 h…) et les niveaux de cette période, figés à
 *  son ouverture. Toutes les bougies d'une même période portent le même point, que le rendu regroupe par
 *  `periodStart` en un segment horizontal par niveau (voir `computeExpectedVolatilityValues`).
 *
 *  `atr` et `sma` sont ceux de la dernière bougie CLÔTURÉE de l'échelle choisie au début de la période : ils ne
 *  bougent pas pendant la période. Null pour toute la période tant que l'ATR n'est pas amorcé (rien n'est tracé),
 *  `sma` seul null tant que sa propre moyenne ne l'est pas (les lignes de la SMA manquent alors). */
export interface IndicatorExpectedVolatilityPoint {
  /** Première bougie de la période (indice dans `data`). */
  periodStart: number;
  /** Fin de la période, en indice de bougie, exclusive et fractionnaire : `dernière bougie + 1` pour une période
   *  close, prolongée vers la droite (dans l'espace futur) pour la période en cours, jusqu'à sa fin prévue. */
  periodEnd: number;
  /** Ouverture de la période (ouverture de sa première bougie) : la médiane, l'ancre des autres niveaux. */
  open: number;
  atr: number;
  sma: number | null;
  /** Parmi les N dernières périodes (réglage « Nombre de séances affichées ») : seules celles-là sont tracées. */
  drawn: boolean;
  /** La toute dernière période : hors mode « 1 jour », la seule à garder ses étiquettes. */
  latest: boolean;
  /** Mode « 1 jour » : périodes de 00:00 à 23:59 dans le fuseau choisi, étiquettes gardées sur chaque séance. */
  dayMode: boolean;
  /** Nom de l'échelle dans les étiquettes (« 1 jour », « 1 heure », « 15 min »…). */
  scaleLabel: string;
  /** Décimales des prix de la série (l'équivalent du `format.mintick` de Pine) pour écrire les étiquettes. */
  decimals: number;
}
