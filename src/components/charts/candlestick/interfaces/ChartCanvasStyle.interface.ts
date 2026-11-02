/** Theme colors + font, read once from the DOM at the top of `renderCandlestickChart` (canvas
 *  has no live binding to CSS custom properties) and threaded into every phase function instead
 *  of each re-reading `getComputedStyle` itself. */
export interface ChartCanvasStyle {
  colorUp: string;
  colorDown: string;
  colorBg: string;
  colorText: string;
  colorMuted: string;
  colorAccent: string;
  colorGrid: string;
  /** Bougies, barres OHLC, briques et volumes : `--lq-chart-candle-up` / `--lq-chart-candle-down`,
   *  repli sur colorUp / colorDown. Les indicateurs (supertrend, ichimoku…) gardent colorUp/Down. */
  colorCandleUp: string;
  colorCandleDown: string;
  /** Épaisseur des mèches et des barres OHLC (`--lq-chart-candle-wick-width`, repli 1). */
  wickWidth: number;
  /** Quadrillage du canvas, aligné sur celui de ChartAxis : `--lq-chart-grid-width` (1) et
   *  `--lq-chart-grid-dash` (« 2 3 » ; `none` = plein). La couleur est `colorGrid`. */
  gridWidth: number;
  gridDash: number[];
  /** Opacité des barres de volume hors e-ink (`--lq-chart-volume-opacity`, repli 0.55). */
  volumeOpacity: number;
  fontFamily: string;
  isEink: boolean;
}
