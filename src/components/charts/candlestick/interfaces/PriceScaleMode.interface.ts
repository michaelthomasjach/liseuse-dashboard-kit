/** Échelle de l'axe des prix (« Paramètres du graphique » → Échelles, ou clic droit sur les prix) :
 *  - `linear` : linéaire, l'écart en prix est proportionnel à la hauteur ;
 *  - `log` : logarithmique, une même variation en % a la même hauteur partout (long historique) ;
 *  - `percent` : linéaire, mais l'axe se lit en % de variation depuis la première bougie visible.
 *  Indépendante de l'ajustement automatique aux données visibles (`autoFit`), qui marche avec les trois. */
export type PriceScaleMode = "linear" | "log" | "percent";
