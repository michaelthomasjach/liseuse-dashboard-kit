import type { IndicatorKind } from "./IndicatorKind.interface";
import type { CustomIndicatorDef } from "./CustomIndicatorDef.interface";
import type { OverlayDataPoint } from "./TrendLineDrawing.interface";
import type { IndicatorProjectionMethod } from "../indicatorProjection";
import type { IndicatorFill } from "./IndicatorFill.interface";
import type { IndicatorStyleRule } from "./IndicatorStyleRule.interface";
import type { IndicatorAreaFill } from "./IndicatorAreaFill.interface";
import type { ValueFormat } from "./ValueFormat.interface";
import type { IndicatorWatermark } from "./IndicatorWatermark.interface";

export interface Indicator {
  id: string;
  kind: IndicatorKind;
  /** Lookback window, in candles. Ignored by "vwap" (a cumulative, unwindowed average) and
   *  "macd"/"ichimoku" (their own multi-period settings below instead). Doubles as "atr"'s and
   *  "supertrend"'s own ATR period, and "supportResistance"'s own detection window. */
  period: number;
  /** Band width, in standard deviations. Only used by "bollinger". Default 2. */
  stdDev?: number;
  /** "macd" only — defaults 12/26/9, the conventional parameters. */
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  /** "macd" only — shows/hides the histogram bars (the MACD/signal lines stay either way).
   *  Default true. */
  macdShowHistogram?: boolean;
  /** "macd" only — histogram bar color above/below zero. Defaults to the chart's own
   *  up/down colors. */
  macdHistogramUpColor?: string;
  macdHistogramDownColor?: string;
  /** "zigzag" only — minimum swing size, as a percentage move from the last confirmed pivot,
   *  before the next one confirms. Default 5. */
  zigzagDeviation?: number;
  /** "zigzag" only — shows each confirmed pivot's HH/HL/LH/LL label (see
   *  `IndicatorZigZagPoint.label`) next to it. Default true. */
  zigzagShowLabels?: boolean;
  /** "supertrend" only — band width, as a multiple of ATR (see `period` above for the ATR period
   *  itself). Default 3. */
  supertrendMultiplier?: number;
  /** "supertrend" only — line color while trend is up/down. Defaults to the chart's own
   *  up/down colors (same as before this existed), so leaving both unset reproduces the exact
   *  prior behavior. */
  supertrendUpColor?: string;
  supertrendDownColor?: string;
  /** "parabolicSar" only — the acceleration factor's own starting value/step per extreme-point
   *  update, and its cap. Defaults 0.02/0.2, the conventional parameters. */
  sarStep?: number;
  sarMax?: number;
  /** "parabolicSar" only — each dot's color by which side of price it's currently on. Defaults
   *  to the chart's own up/down colors. */
  sarUpColor?: string;
  sarDownColor?: string;
  /** "gaps" only — the minimum jump between one candle's high/low and the next's, as a percentage
   *  of the earlier candle's own price, before it counts as a gap at all. Default 0.1. */
  gapsMinPercent?: number;
  /** "patternRecognition"/"candleRecognition" only — recognition only ever looks at a recent
   *  window ending on this date, not the whole dataset (so the chart doesn't fill up with every
   *  historical occurrence) — undefined means the dataset's own last candle, which tracks forward
   *  automatically as new candles arrive rather than freezing at whatever date the indicator
   *  happened to be added on (the "refreshed daily" default). A single-candle pattern
   *  (candleRecognition) only ever evaluates the candles its own shape needs, ending here; a
   *  multi-candle one (patternRecognition) widens that to up to 20 preceding candles — see
   *  `computePatternRecognitionValues`'s own doc for exactly how. */
  recognitionDateLimit?: Date;
  /** "ichimoku" only — defaults 9/26/52/26, the conventional parameters (see
   *  `computeIchimokuValues`'s own doc for what `ichimokuDisplacement` does and its one
   *  limitation). */
  ichimokuConversionPeriod?: number;
  ichimokuBasePeriod?: number;
  ichimokuSpanPeriod?: number;
  ichimokuDisplacement?: number;
  /** "pivotPoints" only — which formula turns the reference period's own high/low/close into
   *  levels (see `computePivotPointsValues`'s own doc for each one's exact math). Default
   *  "classic". */
  pivotType?: "classic" | "fibonacci" | "woodie" | "camarilla";
  /** "pivotPoints" only — which prior period's own high/low/close the current period's levels are
   *  derived from. Default "weekly" — "daily" only reads as useful against intraday data; against
   *  the daily bars most charts here actually show, it produces a new (unreadable) segment every
   *  single candle. */
  pivotPeriod?: "daily" | "weekly" | "monthly";
  /** "pivotPoints" only — draws just the current (most recent) period's own levels instead of the
   *  usual staircase of every past period still in view. Default false. */
  pivotShowLastOnly?: boolean;
  /** "supportResistance" only — how many of the strongest detected levels to keep (see
   *  `computeSupportResistanceValues`'s own doc for how "strongest" is ranked). `period` above
   *  doubles as this indicator's own lookback, in candles. Default 6. */
  srMaxLevels?: number;
  /** "chandelierExit" only — the ATR multiplier both stops are offset by (`period` above doubles
   *  as its own ATR length and the highest/lowest lookback, same reuse `supertrendMultiplier`'s
   *  own doc explains for Supertrend). Default 3, the Pine Script original's own default. */
  chandelierMultiplier?: number;
  /** "chandelierExit" only — highest/lowest *close* over the lookback (the Pine original's own
   *  default) instead of highest high / lowest low, before the ATR offset. Default true. */
  chandelierUseClose?: boolean;
  /** "chandelierExit" only — a pill badge at each direction flip ("Achat"/"Vente"). Default true. */
  chandelierShowLabels?: boolean;
  /** "chandelierExit" only — fills the region between price and whichever stop is currently
   *  active. Default true. */
  chandelierHighlightState?: boolean;
  /** "chandelierExit" only — its stops/fill/labels' own color while long/short. Defaults to the
   *  chart's own up/down colors. */
  chandelierUpColor?: string;
  chandelierDownColor?: string;
  /** "tpo" only — how many minutes each lettered block spans. A real candle finer than this
   *  (several fit in one block) groups the usual way; one coarser than this (the common case
   *  once a single candle already spans a day or more) is instead split into that many
   *  *synthetic* sub-blocks reconstructed from its own OHLC — see `computeTPOSessionProfiles`'s
   *  own doc for why, and exactly how. Default 30. */
  tpoBlockMinutes?: number;
  /** "tpo" only — how many equal price bins each session's own [low, high] is divided into
   *  (independent of block count — more blocks just means more letters landing in the same
   *  rows, not more rows). Default 24. */
  tpoRowCount?: number;
  /** "tpo" only — the percentage of total (block, row) touches the value area (VAH/VAL) must
   *  enclose, expanding outward from POC toward whichever neighboring row has more touches until
   *  it's reached. Default 70. */
  tpoValueAreaPercent?: number;
  /** "tpo" only — each block's own stamp: sequential letters (wrapping past "Z") or plain
   *  numbers. Default "letters". */
  tpoLabelStyle?: "letters" | "numbers";
  /** "tpo" only — a small gap between adjacent letters' own cells, even within the same row, so
   *  distinct blocks read as visually separate rather than one unbroken run. Default true. */
  tpoSplitByBlocks?: boolean;
  /** "tpo" only — how opaque the profile's own cells render, 0-100. A row inside the value area
   *  always renders somewhat more opaque than one outside it (same emphasis Market Profile tools
   *  already give the value area) — this scales *both* rather than replacing that relationship
   *  with a single flat alpha. Default 100 (fully opaque). */
  tpoOpacity?: number;
  /** "rsi" only — the two dashed reference levels drawn across its pane (see
   *  `drawVolumeAndPanes`'s own RSI/CHOP block). Defaults 70/30, the conventional overbought/
   *  oversold thresholds — some traders widen these to 80/20 for a stronger/less noisy signal, or
   *  narrow them for a more sensitive one. */
  rsiOverbought?: number;
  rsiOversold?: number;
  /** "chop" only — same reference-level mechanism as `rsiOverbought`/`rsiOversold` above, against
   *  CHOP's own 0-100 scale. Defaults 61.8/38.2, the conventional Fibonacci-derived thresholds
   *  (above the upper one: choppy/ranging; below the lower one: trending). */
  chopUpperThreshold?: number;
  chopLowerThreshold?: number;
  /** "atr" only — divides each value by that candle's own close (×100) before plotting, so the
   *  pane reads "volatility as a % of price" instead of a raw price-unit amount. Makes ATR
   *  comparable across symbols/timeframes at very different price levels, at the cost of no longer
   *  being directly usable as a stop-distance in the instrument's own price units. Default false
   *  (raw ATR, the original behavior). */
  atrAsPercent?: boolean;
  /** "adx" only — the dashed reference level drawn across its pane (same mechanism as
   *  `rsiOverbought`/`chopUpperThreshold` above), against ADX's own 0-100 scale. Default 25, the
   *  conventional "trend is strong enough to matter" threshold — below it, +DI/-DI crossovers are
   *  generally considered too unreliable to act on. */
  adxThreshold?: number;
  /** "adx" only — +DI/-DI's own line color (see `drawVolumeAndPanes`'s own ADX block for why they
   *  don't read the shared `color` field the way most indicators do). Defaults to the chart's own
   *  up/down colors, same "leaving both unset reproduces the exact prior behavior" convention as
   *  Supertrend/Parabolic SAR/Chandelier Exit's own directional-color pairs. */
  adxPlusColor?: string;
  adxMinusColor?: string;
  /** "correlation" only — the dashed reference levels drawn at +/- this value (see
   *  `drawVolumeAndPanes`'s own correlation block), against its fixed -1..1 scale. Default 0.7, a
   *  common "meaningfully correlated" cutoff — a coefficient beyond either line is generally read
   *  as a strong (positive or negative) relationship, inside them as weak/noise. */
  correlationStrongThreshold?: number;
  /** The eight fundamental kinds only (see `isFundamentalKind`) — plots the year-over-year percent
   *  change between each reported point and the point from ~12 months earlier instead of the raw
   *  reported value itself (see `computeFundamentalValues`'s own doc for exactly how "12 months
   *  earlier" is resolved against irregular reporting dates). Useful for comparing growth *rate*
   *  across companies/metrics whose absolute scale differs wildly (revenue in the billions vs. a
   *  P/E ratio in the tens) — something the raw "value" mode can't do at a glance. Default
   *  "value" (the original behavior, unchanged). */
  fundamentalDisplayMode?: "value" | "yoyChange";
  /** Format des valeurs de l'indicateur — axe de son panneau, badges de survol, valeur dans sa légende (voir
   *  `ValueFormat`). Absent ou "auto" : k / M / B / T à partir de 10 000. Passe devant le format d'un fondamental et
   *  celui d'un script (`plot.pane(nom, { format })`). */
  valueFormat?: ValueFormat;
  /** Légende de l'indicateur masquée (menu contextuel « Masquer la légende du … ») : l'en-tête de son panneau, ou sa
   *  ligne dans la légende des prix, se réduit à une poignée qui la réaffiche. */
  legendHidden?: boolean;
  /** Filigrane de son panneau (indicateurs en panneau séparé) — voir `IndicatorWatermark`. Absent : celui posé par
   *  le script (`customData.watermark`), sinon aucun. */
  watermark?: IndicatorWatermark;
  /** The eight fundamental kinds only — how the pane connects each reported point (see
   *  `drawVolumeAndPanes`'s own fundamentals block). "line" (default, prior behavior) draws a
   *  straight diagonal between consecutive reports, which reads smoothly but visually implies a
   *  gradual change that didn't really happen (the underlying value is actually a step function —
   *  flat between report dates, then a jump). "step" draws that step function literally, more
   *  truthful to how the data actually arrives; "area" fills beneath the line down to zero, useful
   *  for a metric where "how much" reads more naturally as a filled magnitude than a bare line
   *  (Free Cash Flow, Net Income, Total Revenue). */
  fundamentalChartStyle?: "line" | "step" | "area";
  /** Set once this indicator represents a `CustomIndicatorDef` the caller supplied via
   *  `CandlestickChartProps.customIndicators`, rather than one of the library's own built-in
   *  kinds — `kind` itself is meaningless in that case ("custom" exists in `IndicatorKind` purely
   *  to satisfy the type). Carries a full, self-contained copy of that def (not just its id) so
   *  this indicator keeps working correctly even if the caller later removes it from
   *  `customIndicators` or the array identity changes — same reasoning `Indicator` never re-reads
   *  its own settings from a live prop anywhere else either. */
  customData?: CustomIndicatorDef;
  /** "correlation" only — the second symbol its rolling coefficient is computed against, and that
   *  symbol's own fetched price series (same `OverlayDataPoint[]` shape/fetch path — see
   *  `CandlestickChartProps.onAddSymbolOverlay` — the "symbolOverlay" drawing type already uses to
   *  compare an instrument against the main one). Carried directly on the indicator, same
   *  "self-contained, not a second lookup" reasoning `customData` above already follows. */
  correlationSymbol?: string;
  correlationSymbolName?: string;
  correlationData?: OverlayDataPoint[];
  /** Continues the indicator's own lines past the last candle, dashed, in the empty space the
   *  chart already reserves there. Off by default, and deliberately so: everything else this
   *  library draws is measured from data that exists, and this is the one thing that is not.
   *
   *  Offered only by the kinds whose values are a *level that continues* — a moving average, an
   *  oscillator, a band. A pattern detector or a zigzag has no projection to offer: "the next
   *  pivot" is not something a curve fit can answer, and a toggle there would be a promise the
   *  maths cannot keep. See `supportsProjection`. */
  projection?: boolean;
  /** How many bars forward. Default 12. */
  projectionBars?: number;
  /** How many past values the method is fitted on. Default 30. */
  projectionLookback?: number;
  /** How the next values are guessed — see `IndicatorProjectionMethod` for what each one reads and
   *  where each one is wrong. Default "linear". */
  projectionMethod?: IndicatorProjectionMethod;
  /** How fast the trend is given up per projected bar, 0 to 1. Default 0.85 — see the field's own
   *  doc on `IndicatorProjectionSettings` for why an undamped extrapolation is the one that ends up
   *  off the pane. */
  projectionDamping?: number;
  /** CSS color. Defaults to a color cycled from a small built-in palette. Ignored by
   *  "supertrend"/"parabolicSar"/"chandelierExit" (each has its own up/down pair above instead —
   *  a single color can't represent a trend flip) and "supportResistance"/"tpo" (colored by
   *  their own rules, not a single indicator-wide color). */
  color?: string;
  /** Épaisseur de la courbe principale en pixels (1 à 4, choisie dans le sélecteur de couleur des réglages). Absente :
   *  celle de toujours (1,5 ; 1 pour les bords d'une bande). Lue par les courbes simples du prix, les bandes et les
   *  courbes des panneaux propres (RSI, CHOP…). */
  lineWidth?: number;
  /** When true, the indicator stays in the legend but its line isn't drawn — toggled from the
   *  legend's eye icon. Only meaningful for a `pane: "price"` indicator (see
   *  IndicatorCatalogEntry) — a `pane: "own"` one uses `paneCollapsed` instead, same as the
   *  volume pane. Default false. */
  hidden?: boolean;
  /** Unité de temps du graphique au moment de l'ajout (valeur de son `timeframe`, ex. « 1hour »), posée
   *  automatiquement comme pour les dessins (`TrendLineDrawing.timeframe`). Avec l'option « propres à
   *  l'unité de temps » (`timeframeScoped`), l'indicateur n'apparaît que sur cette unité ; sans
   *  `timeframe` (ajouté avant cette option, ou par l'hôte), il apparaît partout. */
  timeframe?: string;
  /** Couleur choisie pour chaque élément tracé d'un indicateur à plusieurs séries (`customData.draw: "multi"`, un
   *  script qui trace plusieurs lignes, barres, bandes… dans le même panneau), par clé de série
   *  (`customData.multiSeries[].key`) ; remplace la couleur écrite dans le code. Réglée dans l'onglet Style. */
  seriesColors?: Record<string, string>;
  /** Indicateur posé sur le panneau d'un autre (clic droit sur ce panneau) : l'id de cet indicateur. Calculé sur la
   *  série de ce panneau au lieu des prix, dessiné dans ce panneau et légendé dans son en-tête (voir
   *  `attachedIndicators.ts`). Seules les moyennes (SMA, EMA, WMA) s'y posent. */
  sourceId?: string;
  /** Couleur d'une ligne selon sa position face à une autre série du même indicateur, par clé de série
   *  (`customData.multiSeries[].key`) : `above` quand elle est au-dessus de la série `versus`, `below` en dessous — sa
   *  couleur change donc à chaque croisement (deux moyennes, une ligne et son signal…). Réglée dans l'onglet Style. */
  seriesCross?: Record<string, { versus: string; above: string; below: string }>;
  /** MACD : la ligne MACD prend `macdLineAboveColor` au-dessus de sa ligne de signal et `macdLineBelowColor` en
   *  dessous (sa couleur change à chaque croisement). Absent : une seule couleur. */
  macdCrossColors?: boolean;
  macdLineAboveColor?: string;
  macdLineBelowColor?: string;
  /** Indicateur de zones (`customData.draw: "zones"`) : opacité du fond des bandes, en % (défaut 12). */
  zoneOpacity?: number;
  /** Indicateur de zones : libellé de chaque zone écrit en haut de sa bande. Défaut true. */
  zoneShowLabels?: boolean;
  /** Indicateur de zones : repère vertical de chaque zone (`CustomIndicatorZone.marker`) et son libellé. Défaut true. */
  zoneShowMarkers?: boolean;
  /** Indicateur de zones : élargit (ou rétrécit, en négatif) chaque zone de ce nombre d'heures avant son début et
   *  après sa fin. Défaut 0 : la fenêtre fournie par l'application. */
  zonePadBeforeHours?: number;
  zonePadAfterHours?: number;
  /** A `pane: "own"` indicator's pane, collapsed to a header-only strip — same mechanism/UI as
   *  the volume pane's own collapse. Default false (expanded). */
  paneCollapsed?: boolean;
  /** Indicateur en panneau séparé (RSI, MACD, script…) affiché sur le graphique des prix plutôt que dans son panneau
   *  (paramètres du panneau → « Afficher sur le graphique des prix (overlay) ») : son panneau disparaît, sa série se
   *  dessine sur la zone des prix avec sa propre échelle, cachée (ses unités ne sont pas celles du cours), et elle
   *  rejoint la légende des indicateurs en haut à gauche. Les indicateurs posés sur lui le suivent. Défaut faux. */
  priceOverlay?: boolean;
  /** A `plot.pane(name, { dock: "left"|"right" })` script pane only (see `customData.dock`) —
   *  whether its own price/date axes are drawn in the docked column. Default true; toggled from
   *  the Style tab. Meaningless (ignored) for a `dock: "bottom"`/undocked pane, which already
   *  shares the main plot's own axes. */
  sideAxesVisible?: boolean;
  /** Ancien format des couleurs de l'onglet Style (zones colorées entre la courbe et un niveau ou le cours). Encore lu
   *  pour les réglages enregistrés avant `styleRules` : converti à la lecture (voir `indicatorStyleRules`), remplacé
   *  par `styleRules` à la première modification. Ne plus l'écrire. */
  fills?: IndicatorFill[];
  /** Style conditionnel réglées dans l'onglet Style : remplir entre deux courbes (un RSI et la SMA posée
   *  dessus, deux moyennes sur les prix…), colorer une courbe selon sa position, colorer le fond, marquer les
   *  croisements. Voir `IndicatorStyleRule`. Présent (même vide), il l'emporte sur `fills`. */
  styleRules?: IndicatorStyleRule[];
  /** Zones remplies (paramètres du panneau, rubrique Style, « Zones remplies ») : entre une ligne de l'indicateur et la
   *  base 0 du panneau, ou une autre courbe du même panneau, d'une couleur au-dessus et d'une autre en dessous. Voir
   *  `IndicatorAreaFill`. Absent : celles posées par le script (`customData.areaFills`, `pane.fillBetween`), sinon
   *  aucune. Présent (même vide), il l'emporte sur celles du script. */
  areaFills?: IndicatorAreaFill[];
}
