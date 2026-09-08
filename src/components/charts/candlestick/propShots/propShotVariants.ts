import { createElement } from "react";
import type { CandlestickChartProps } from "../interfaces/CandlestickChartProps.interface";
import { shotClose, shotDate } from "./propShotData";

/** One illustrated prop: the configuration to render, and a caption saying what the picture
 *  shows. Only props whose effect is genuinely *visible* get an entry — a screenshot of
 *  `onDrawingsChange` or `formatPrice` would be a chart that looks like every other chart, which
 *  teaches nothing and costs a download; those stay text-only in the reference.
 *
 *  Keyed by prop name, which is what ties a picture back to its own card in `ChartPropsModal`.
 *
 *  Plain `.ts`, and the one React node below is built with `createElement` rather than JSX: this
 *  file exports nothing but data, and as a `.tsx` every one of those exports trips
 *  `react-refresh/only-export-components`. */
export interface PropShotVariant {
  /** Shown under the image, in the reference. */
  caption: string;
  props: Partial<CandlestickChartProps>;
  /** Region of the rendered chart worth keeping, in fractions of the frame (0-1). Most of these
   *  props only change one corner of a 1100x620 chart, and a full frame shrunk into a modal card
   *  makes that corner unreadable. Omitted means "the whole frame". */
  crop?: { x: number; y: number; width: number; height: number };
}

/** What every shot starts from. The three props the component itself defaults to `true`
 *  (`zoomable`, `showVolume`, `fullscreenToggle`) are forced off here so that each variant differs
 *  from this baseline by exactly the one prop it is illustrating — otherwise "showVolume: true"
 *  would screenshot the same picture as every other variant and demonstrate nothing. */
export const PROP_SHOT_BASE: Partial<CandlestickChartProps> = {
  zoomable: false,
  showVolume: false,
  fullscreenToggle: false,
};

/** The header bar plus the legend line under it, cropped to one half of the frame: a control
 *  reproduced at full 1100px width is a few pixels of button in an ocean of empty toolbar by the
 *  time the modal has scaled it down. Which half depends on where the control actually sits —
 *  `linkable` and `showTemplates` live in `.lq-chart__header-right` (margin-left: auto), every
 *  other header control flows from the left. */
const HEADER_LEFT = { x: 0, y: 0, width: 0.45, height: 0.16 };
const HEADER_RIGHT = { x: 0.55, y: 0, width: 0.45, height: 0.16 };
/** The drawing toolbar, which runs along the bottom edge under the date axis. */
const BOTTOM_BAR = { x: 0, y: 0.9, width: 0.3, height: 0.1 };

const DEMO_DRAWINGS: CandlestickChartProps["defaultDrawings"] = [
  { id: "shot-trend", x1: shotDate(120), y1: shotClose(120) - 6, x2: shotDate(30), y2: shotClose(30) + 6, color: "#e0a95c", strokeWidth: 2 },
  { id: "shot-level", x1: shotDate(150), y1: shotClose(64), x2: shotDate(4), y2: shotClose(64), lineType: "horizontal", color: "#6c87c9", text: "Résistance" },
];

const DEMO_EVENTS: CandlestickChartProps["events"] = [
  { date: shotDate(118), kind: "Résultats", label: "Résultats T1", color: "#4f8fd6" },
  { date: shotDate(74), kind: "Dividende", label: "Dividende 0,42 €", color: "#5fae7a" },
  { date: shotDate(26), kind: "Produit", label: "Lancement produit", color: "#c98cd0" },
];

export const PROP_SHOT_VARIANTS = {
  showVolume: {
    caption: "Le panneau de volume, ajouté sous le tracé des prix.",
    props: { showVolume: true },
  },
  defaultChartDisplayMode: {
    caption: "Le mode Heikin Ashi à la place des bougies japonaises.",
    props: { defaultChartDisplayMode: "heikinAshi" },
  },
  renkoAtrPeriod: {
    caption: "Le mode Renko, dont la taille de brique suit l'ATR de la période donnée.",
    props: { defaultChartDisplayMode: "renko", renkoAtrPeriod: 14 },
  },
  drawingTools: {
    caption: "La barre d'outils de dessin, ajoutée sous l'axe des dates.",
    props: { drawingTools: true },
    crop: BOTTOM_BAR,
  },
  defaultDrawings: {
    caption: "Des dessins présents dès le premier rendu — ici une oblique et une horizontale annotée.",
    props: { drawingTools: true, defaultDrawings: DEMO_DRAWINGS },
  },
  showIndicators: {
    caption: "Le bouton « Indicateurs » et la légende qui l'accompagne, en haut du tracé.",
    props: { showIndicators: true },
    crop: HEADER_LEFT,
  },
  defaultIndicators: {
    caption: "Des indicateurs actifs dès le premier rendu — une SMA(20) sur les prix, un RSI(14) dans son propre panneau.",
    props: {
      showIndicators: true,
      defaultIndicators: [
        { id: "shot-sma", kind: "sma", period: 20, color: "#e0a95c" },
        { id: "shot-rsi", kind: "rsi", period: 14, color: "#6c87c9" },
      ],
    },
  },
  showTemplates: {
    caption: "Le sélecteur de modèles, ajouté dans l'en-tête.",
    props: { showTemplates: true },
    crop: HEADER_RIGHT,
  },
  replay: {
    caption: "Le bouton Replay, qui rejoue l'historique bougie par bougie.",
    props: { replay: true },
    crop: HEADER_LEFT,
  },
  seasonality: {
    caption: "Le bouton de saisonnalité, ajouté dans l'en-tête.",
    props: { seasonality: true },
    crop: HEADER_LEFT,
  },
  timeframes: {
    caption: "Le sélecteur d'unité de temps, alimenté par la liste fournie.",
    props: {
      timeframe: "1d",
      timeframes: [
        { label: "5 minutes", value: "5m" },
        { label: "1 heure", value: "1h" },
        { label: "1 jour", value: "1d" },
        { label: "1 semaine", value: "1w" },
      ],
    },
    crop: HEADER_LEFT,
  },
  fullscreenToggle: {
    caption: "Le bouton plein écran, ajouté à droite de l'en-tête.",
    props: { fullscreenToggle: true },
    crop: HEADER_LEFT,
  },
  linkable: {
    caption: "Le bouton de liaison, qui synchronise plusieurs graphiques entre eux.",
    props: { linkable: true, isLinked: true },
    crop: HEADER_RIGHT,
  },
  livePrice: {
    caption: "La ligne du dernier cours, avec son étiquette sur l'axe des prix.",
    props: { livePrice: true },
  },
  events: {
    caption: "Les pastilles d'événements, au pied du tracé.",
    props: { events: DEMO_EVENTS },
  },
  zoomable: {
    caption: "Les commandes de zoom : le sélecteur d'intervalle et le bouton de réinitialisation.",
    props: { zoomable: true },
    crop: HEADER_LEFT,
  },
  initialVisibleCandles: {
    caption: "Seules les 40 dernières bougies sont visibles à l'ouverture ; le reste attend à gauche.",
    props: { zoomable: true, initialVisibleCandles: 40 },
  },
  sidePanel: {
    caption: "Le panneau latéral, à droite du tracé, et le bouton qui le replie.",
    props: {
      sidePanel: createElement(
        "div",
        { style: { padding: "12px 14px", fontSize: 12, lineHeight: 1.7 } },
        createElement("strong", { style: { display: "block", marginBottom: 8 } }, "Carnet d'ordres"),
        createElement("div", null, "Achat \u2014 145,88 \u00d7 1 200"),
        createElement("div", null, "Vente \u2014 145,94 \u00d7 900"),
      ),
    },
  },
  margin: {
    caption: "Les marges du tracé, ici volontairement larges pour les rendre lisibles.",
    props: { margin: { top: 40, right: 96, bottom: 64, left: 64 } },
  },
} satisfies Record<string, PropShotVariant>;

export type PropShotVariantId = keyof typeof PROP_SHOT_VARIANTS;
