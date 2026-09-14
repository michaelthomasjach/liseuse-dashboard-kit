import type { Candle } from "../interfaces/Candle.interface";
import type { CandlestickChartProps } from "../interfaces/CandlestickChartProps.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import {
  SHOT_CANDLE_DATA,
  SHOT_CORRELATION_DATA,
  SHOT_FUNDAMENTALS,
  SHOT_GAPS_DATA,
  SHOT_LEVELS_DATA,
  SHOT_PATTERN_DATA,
  PATTERN_MARGIN,
  shotDate,
} from "./diagramShotData";

/** What the info modals illustrate an indicator or a drawing tool with: a real render of that
 *  thing, screenshotted.
 *
 *  These replaced hand-drawn SVG diagrams. A drawn diagram is a *reproduction* — it can only ever
 *  be as right as whoever drew it, it quietly rots as the renderer evolves, and the reader ends up
 *  looking at a picture of a Fibonacci retracement rather than at one. A capture of the component
 *  cannot drift: it is the component.
 *
 *  Every entry below is therefore a genuine use of the tool — real dates from the shot dataset,
 *  real prices near the candles — not a shape chosen to photograph well. `scripts/
 *  captureDiagramShots.cjs` renders each one through `DiagramShot.stories.tsx` and writes a JPEG.
 *
 *  ## On crops
 *
 *  `crop` is in fractions of the rendered frame (0-1), omitted meaning the whole thing. It exists
 *  because a single-click marker — a pin, an up arrow — is about twelve pixels on a 1100px chart,
 *  and the modal then scales that down again. Tools whose whole subject is a small mark are
 *  captured from a window around it; tools that span the chart are not cropped at all. */
export interface DiagramShotVariant {
  props: Partial<CandlestickChartProps>;
  crop?: "plot" | { x: number; y: number; width: number; height: number };
  /** Set only where the drawing cannot be seeded as data. "measure" is the one such tool: it is
   *  deliberately never stored among the drawings (see its own description), so the capture
   *  script has to pick the tool up and use it like a person would. */
  drive?: "measure";
}

/** Everything every shot starts from: no zoom handle, no fullscreen button, and no volume panel
 *  unless the shot is about volume — the subject should be the only thing in the frame that draws
 *  the eye. */
export const DIAGRAM_SHOT_BASE: Partial<CandlestickChartProps> = {
  zoomable: false,
  showVolume: false,
  fullscreenToggle: false,
};

const D = shotDate;

/* ------------------------------------------------------------------------------------------- *
 *  Crops
 *
 *  The frame is 1100 wide; `height` sizes the plot, and the chart's own header sits above it. The
 *  fractions below are of the rendered element, so they hold even as that chrome changes height.
 * ------------------------------------------------------------------------------------------- */

/** Everything below the chart's own header, resolved in the page against the header's real
 *  height (see the capture script's `readClip`). It was a fraction of the frame first, and
 *  that fraction quietly sliced the top off any indicator plotting near the high of the
 *  range. The default for anything that spans the chart. */
const PLOT = "plot" as const;
/** A window around a mark placed in the middle-right of the chart. */
const MARK = { x: 0.42, y: 0.18, width: 0.44, height: 0.62 };
/** A wider window, for a mark that carries a label beside it. */
const MARK_WIDE = { x: 0.3, y: 0.15, width: 0.6, height: 0.68 };

/* ------------------------------------------------------------------------------------------- *
 *  Indicators
 * ------------------------------------------------------------------------------------------- */

/** One indicator on the shared candles. `data` overrides it for the four detectors that need a
 *  series actually containing what they detect. */
const ind = (
  kind: IndicatorKind,
  period: number,
  extra: Record<string, unknown> = {},
  data?: Candle[],
): DiagramShotVariant => ({
  props: {
    defaultIndicators: [{ id: `shot-${kind}`, kind, period, ...extra }],
    fundamentals: SHOT_FUNDAMENTALS,
    ...(data ? { data } : {}),
  } as Partial<CandlestickChartProps>,
  crop: PLOT,
});

export const INDICATOR_SHOTS: Partial<Record<IndicatorKind, DiagramShotVariant>> = {
  sma: ind("sma", 20),
  ema: ind("ema", 20),
  wma: ind("wma", 20),
  vwap: ind("vwap", 0),
  bollinger: ind("bollinger", 20, { stdDev: 2 }),
  rsi: ind("rsi", 14),
  chop: ind("chop", 14),
  macd: ind("macd", 0),
  zigzag: ind("zigzag", 0, { zigzagDeviation: 5, zigzagShowLabels: true }),
  atr: ind("atr", 14),
  supertrend: ind("supertrend", 10, { supertrendMultiplier: 3 }),
  parabolicSar: ind("parabolicSar", 0, { sarStep: 0.02, sarMax: 0.2 }),
  // The four detectors below run on candles built to contain what they look for — see each
  // series' own doc in diagramShotData.ts. On the shared random walk all four found nothing,
  // and produced four byte-identical pictures of an empty chart.
  gaps: ind("gaps", 0, { gapsMinPercent: 0.1 }, SHOT_GAPS_DATA),
  patternRecognition: ind("patternRecognition", 0, { recognitionDateLimit: shotDate(PATTERN_MARGIN) }, SHOT_PATTERN_DATA),
  candleRecognition: ind("candleRecognition", 0, { recognitionDateLimit: shotDate(PATTERN_MARGIN) }, SHOT_CANDLE_DATA),
  ichimoku: ind("ichimoku", 0),
  pivotPoints: ind("pivotPoints", 0, { pivotType: "classic", pivotPeriod: "monthly" }),
  supportResistance: ind("supportResistance", 100, { srMaxLevels: 6 }, SHOT_LEVELS_DATA),
  adx: ind("adx", 14),
  chandelierExit: ind("chandelierExit", 22, { chandelierMultiplier: 3 }),
  tpo: ind("tpo", 0),
  correlation: {
    props: {
      defaultIndicators: [
        {
          id: "shot-correlation",
          kind: "correlation",
          period: 20,
          correlationSymbol: "BETA",
          correlationSymbolName: "Beta Industries",
          correlationData: SHOT_CORRELATION_DATA,
        },
      ],
    },
    crop: PLOT,
  },
  freeCashFlow: ind("freeCashFlow", 0),
  netIncome: ind("netIncome", 0),
  totalRevenue: ind("totalRevenue", 0),
  netMargin: ind("netMargin", 0),
  grossMargin: ind("grossMargin", 0),
  peRatio: ind("peRatio", 0),
  eps: ind("eps", 0),
  debtToEquity: ind("debtToEquity", 0),
};

/** Volume is not an `IndicatorKind` — it is its own panel, behind its own prop — so it sits
 *  outside the table above and is captured under its own id. */
export const VOLUME_SHOT: DiagramShotVariant = {
  props: { showVolume: true },
  crop: PLOT,
};

/* ------------------------------------------------------------------------------------------- *
 *  Drawing tools
 *
 *  One real drawing per tool, seeded through `defaultDrawings` — the same public prop a host would
 *  use, so what gets photographed goes through exactly the renderer a hand-drawn one does.
 * ------------------------------------------------------------------------------------------- */

const draw = (drawing: Omit<TrendLineDrawing, "id">, crop: DiagramShotVariant["crop"] = PLOT): DiagramShotVariant => ({
  props: { defaultDrawings: [{ id: "shot", ...drawing }] },
  crop,
});

/** The three pitchfork pivots, shared by all four variants so the difference between the four
 *  pictures is the construction and nothing else — the same reason the prose compares them. */
const FORK = {
  x1: D(146),
  y1: 145,
  x2: D(104),
  y2: 174,
  extraPoints: [{ x: D(72), y: 152 }],
};

export const DRAWING_SHOTS: Partial<Record<DrawingToolType, DiagramShotVariant>> = {
  trendline: draw({ x1: D(142), y1: 143, x2: D(18), y2: 170, strokeWidth: 2 }),
  extended: draw({ lineType: "extended", extend: "both", x1: D(112), y1: 149, x2: D(46), y2: 163, strokeWidth: 2 }),
  channel: draw({ lineType: "channel", x1: D(140), y1: 142, x2: D(20), y2: 160, channelOffset: 13, strokeWidth: 2 }),
  disjointChannel: draw({
    lineType: "disjointChannel",
    x1: D(140),
    y1: 141,
    x2: D(20),
    y2: 162,
    extraPoints: [
      { x: D(20), y: 173 },
      { x: D(140), y: 158 },
    ],
    strokeWidth: 2,
  }),
  horizontal: draw({ lineType: "horizontal", x1: D(159), y1: 161, x2: D(0), y2: 161, text: "Résistance", strokeWidth: 2 }),
  ray: draw({ lineType: "ray", x1: D(88), y1: 157, x2: D(0), y2: 157, text: "Depuis la cassure", strokeWidth: 2 }),
  vertical: draw({ lineType: "vertical", x1: D(74), y1: 140, x2: D(74), y2: 178, text: "Résultats T2", strokeWidth: 2 }),
  pitchfork: draw({ lineType: "pitchfork", ...FORK, strokeWidth: 2 }),
  schiffPitchfork: draw({ lineType: "schiffPitchfork", ...FORK, strokeWidth: 2 }),
  modifiedSchiffPitchfork: draw({ lineType: "modifiedSchiffPitchfork", ...FORK, strokeWidth: 2 }),
  insidePitchfork: draw({ lineType: "insidePitchfork", ...FORK, strokeWidth: 2 }),
  rectangle: draw({ lineType: "rectangle", x1: D(112), y1: 168, x2: D(58), y2: 147, strokeWidth: 2 }),
  zones: draw({ lineType: "zones", x1: D(124), y1: 166, x2: D(36), y2: 150, strokeWidth: 2 }),
  elbowArrow: draw({
    lineType: "elbowArrow",
    x1: D(140),
    y1: 143,
    x2: D(108),
    y2: 143,
    extraPoints: [
      { x: D(108), y: 172 },
      { x: D(62), y: 172 },
    ],
    strokeWidth: 2,
  }),
  brush: draw({
    lineType: "brush",
    x1: D(120),
    y1: 150,
    x2: D(40),
    y2: 166,
    // A hand-drawn stroke is dozens of sampled points; this is a loop around a swing, generated
    // rather than typed out so it stays smooth.
    extraPoints: Array.from({ length: 28 }, (_, i) => {
      const t = (i + 1) / 29;
      return { x: D(Math.round(120 - t * 80)), y: 150 + Math.sin(t * Math.PI * 1.6) * 17 + t * 6 };
    }),
    strokeWidth: 2,
  }),
  arrowUp: draw({ lineType: "arrowUp", x1: D(70), y1: 146, x2: D(70), y2: 146 }, MARK),
  arrowDown: draw({ lineType: "arrowDown", x1: D(70), y1: 170, x2: D(70), y2: 170 }, MARK),
  arrowLine: draw({ x1: D(110), y1: 148, x2: D(52), y2: 169, arrowRight: true, strokeWidth: 2 }),
  fibonacci: draw({ lineType: "fibonacci", x1: D(132), y1: 141, x2: D(42), y2: 175, strokeWidth: 2 }),
  fibonacciExtension: draw({
    lineType: "fibonacciExtension",
    x1: D(134),
    y1: 143,
    x2: D(92),
    y2: 174,
    extraPoints: [{ x: D(62), y: 155 }],
    strokeWidth: 2,
  }),
  elliottImpulse: draw({
    lineType: "elliottImpulse",
    x1: D(148),
    y1: 141,
    x2: D(126),
    y2: 158,
    extraPoints: [
      { x: D(112), y: 150 },
      { x: D(84), y: 172 },
      { x: D(68), y: 163 },
      { x: D(38), y: 178 },
    ],
    strokeWidth: 2,
  }),
  elliottCorrection: draw({
    lineType: "elliottCorrection",
    x1: D(130),
    y1: 175,
    x2: D(100),
    y2: 150,
    extraPoints: [
      { x: D(78), y: 165 },
      { x: D(44), y: 142 },
    ],
    strokeWidth: 2,
  }),
  headShoulders: draw({
    lineType: "headShoulders",
    x1: D(150),
    y1: 146,
    x2: D(128),
    y2: 164,
    extraPoints: [
      { x: D(112), y: 150 },
      { x: D(90), y: 176 },
      { x: D(68), y: 149 },
      { x: D(48), y: 165 },
      { x: D(24), y: 141 },
    ],
    strokeWidth: 2,
  }),
  cupHandle: draw({
    lineType: "cupHandle",
    x1: D(148),
    y1: 170,
    x2: D(110),
    y2: 142,
    extraPoints: [
      { x: D(66), y: 169 },
      { x: D(46), y: 160 },
      { x: D(26), y: 168 },
    ],
    strokeWidth: 2,
  }),
  forecast: draw({ lineType: "forecast", x1: D(72), y1: 150, x2: D(14), y2: 174, strokeWidth: 2 }),
  rangeForecast: draw({
    lineType: "rangeForecast",
    x1: D(72),
    y1: 152,
    x2: D(12),
    y2: 174,
    extraPoints: [{ x: D(12), y: 140 }],
    strokeWidth: 2,
  }),
  longPosition: draw({
    lineType: "longPosition",
    x1: D(84),
    y1: 152,
    x2: D(24),
    y2: 170,
    extraPoints: [{ x: D(24), y: 143 }],
  }),
  shortPosition: draw({
    lineType: "shortPosition",
    x1: D(84),
    y1: 166,
    x2: D(24),
    y2: 147,
    extraPoints: [{ x: D(24), y: 174 }],
  }),
  text: draw({ lineType: "text", x1: D(72), y1: 166, x2: D(72), y2: 166, text: "Cassure confirmée", textSize: 15 }, MARK_WIDE),
  comment: draw({ lineType: "comment", x1: D(72), y1: 152, x2: D(72), y2: 152, text: "Volume anormal ici", textSize: 13 }, MARK_WIDE),
  note: draw({ lineType: "note", x1: D(66), y1: 148, x2: D(36), y2: 172, text: "Repli sur la moyenne", textSize: 13 }, MARK_WIDE),
  priceNote: draw({ lineType: "priceNote", x1: D(66), y1: 148, x2: D(36), y2: 172, text: "support testé 3 fois", textSize: 13 }, MARK_WIDE),
  pin: draw({ lineType: "pin", x1: D(70), y1: 156, x2: D(70), y2: 156 }, MARK),
  flagMark: draw({ lineType: "flagMark", x1: D(70), y1: 156, x2: D(70), y2: 156 }, MARK),
  signpost: draw({ lineType: "signpost", x1: D(70), y1: 174, x2: D(70), y2: 174, text: "Publication des résultats", textSize: 13 }, MARK_WIDE),
  priceLabel: draw({ lineType: "priceLabel", x1: D(70), y1: 158, x2: D(70), y2: 158 }, MARK),
  table: draw(
    {
      lineType: "table",
      x1: D(116),
      y1: 172,
      x2: D(52),
      y2: 148,
      tableRows: 3,
      tableCols: 3,
      tableCells: ["Scénario", "Niveau", "Écart", "Entrée", "152,40", "—", "Objectif", "168,00", "+10,2 %", "Stop", "144,00", "−5,5 %"],
      strokeWidth: 2,
    },
    PLOT,
  ),
  // The one tool that is never stored as a drawing: the capture script picks it up and drags it.
  measure: { props: { drawingTools: true }, crop: PLOT, drive: "measure" },
};

/** Tools the capture run skips, and why.
 *
 *  "measure" is the only one. It is deliberately never stored among the drawings, so unlike every
 *  other tool it cannot be seeded through `defaultDrawings` — the capture has to *use* it, and in
 *  a headless browser its two clicks do not arrive. They were chased a long way: the coordinates
 *  are right (`elementFromPoint` returns the overlay), `pointer-events` is auto, the React handler
 *  is mounted, focus emulation is on and the page is brought to front, the two clicks are a render
 *  apart, and CDP input, hand-dispatched pointer/mouse events and calling the mounted handler off
 *  the fiber were each tried on their own. The tool arms; the clicks never land.
 *
 *  So its modal shows its description and no picture, which is the honest outcome — better than a
 *  drawing pretending to be a capture, and far better than the blank chart the run produced while
 *  it was failing silently. `drive` below stays, and the run still fails loudly if it is ever
 *  re-enabled and still does not work. */
const UNCAPTURABLE = new Set(["drawing-measure"]);

/** Every id the capture script iterates, in the order the images are written. Indicators first,
 *  then volume, then the drawing tools. */
export const DIAGRAM_SHOT_IDS: string[] = [
  ...Object.keys(INDICATOR_SHOTS).map((kind) => `indicator-${kind}`),
  "indicator-volume",
  ...Object.keys(DRAWING_SHOTS).map((tool) => `drawing-${tool}`),
].filter((id) => !UNCAPTURABLE.has(id));

/** Resolves one of those ids back to what it renders. */
export function diagramShotVariant(id: string): DiagramShotVariant | undefined {
  if (id === "indicator-volume") return VOLUME_SHOT;
  if (id.startsWith("indicator-")) return INDICATOR_SHOTS[id.slice("indicator-".length) as IndicatorKind];
  if (id.startsWith("drawing-")) return DRAWING_SHOTS[id.slice("drawing-".length) as DrawingToolType];
  return undefined;
}
