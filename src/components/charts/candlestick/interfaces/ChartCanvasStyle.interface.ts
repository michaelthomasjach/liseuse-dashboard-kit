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
  /** Réglages de la fenêtre des paramètres (voir `ChartStyleSettings`), absents = rendu d'avant ces réglages. */
  /** Mèches et bordures des bougies ; absentes : la couleur du corps. */
  colorWickUp?: string;
  colorWickDown?: string;
  colorBorderUp?: string;
  colorBorderDown?: string;
  /** Grille horizontale du panneau des prix : masquée quand faux ; sa couleur et ses tirets. */
  horzGridVisible?: boolean;
  colorGridH?: string;
  gridDashH?: number[];
  /** Grille verticale (aux dates de l'axe du temps), sur toute la hauteur ; absente : pas de grille verticale. */
  vertGrid?: { color: string; dash: number[] };
  /** Séparateurs entre panneaux ; absent : `colorGrid`. */
  colorPaneSeparator?: string;
  /** Réticule ; absent : `colorMuted`, tirets « 3 3 », 1 px. */
  crosshair?: { color: string; dash: number[]; width: number };
  /** Ligne du dernier prix : forcée visible / masquée (absent : seulement en direct), tirets, couleur. */
  lastPriceLine?: { visible?: boolean; dash: number[]; color?: string; upColor?: string; downColor?: string };
}
