/** La plage de dates qu'un `CandlestickChart` montre : les instants qui tombent au bord gauche et au
 *  bord droit de son tracé (voir `CandlestickChartProps.syncedVisibleRange` / `onVisibleRangeChange`).
 *
 *  Des bords plutôt que la première et la dernière bougie visibles : un bord tombe le plus souvent
 *  entre deux bougies, et sa date est alors interpolée entre les leurs (prolongée au même pas moyen
 *  que les données au-delà de la première ou de la dernière). C'est ce qui permet à un autre graphique
 *  de reproduire la même vue au pixel près, et de la suivre en continu pendant un glisser plutôt que
 *  bougie par bougie. */
export interface ChartVisibleRange {
  /** L'instant au bord gauche du tracé. */
  start: Date;
  /** L'instant au bord droit du tracé. */
  end: Date;
}
