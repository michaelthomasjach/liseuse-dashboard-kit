/** Une divergence entre un oscillateur (RSI, MACD) et le prix, relevée entre deux pivots de l'oscillateur (voir
 *  divergences.ts). */
export interface Divergence {
  /** Haussière : le prix fait un creux plus bas (régulière) ou plus haut (cachée) que l'oscillateur ; baissière : le
   *  symétrique sur les sommets. */
  direction: "bullish" | "bearish";
  /** Divergence cachée (de continuation) plutôt que régulière (de retournement). */
  hidden: boolean;
  /** Bougies des deux pivots, la plus ancienne d'abord. */
  i1: number;
  i2: number;
  /** Valeurs de l'oscillateur aux deux pivots. */
  v1: number;
  v2: number;
  /** Prix aux deux pivots : le plus bas des bougies (haussière) ou leur plus haut (baissière). */
  p1: number;
  p2: number;
}
