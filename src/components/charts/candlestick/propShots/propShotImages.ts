/* GENERATED FILE — do not edit by hand.
 * Run `node scripts/captureChartPropShots.cjs` to regenerate it and the images it points at.
 *
 * One illustration per visually-demonstrable prop of `CandlestickChart`, shown on that prop's
 * own card in `ChartPropsModal`. A prop absent from here has no picture, on purpose: its effect
 * is a callback or a format, and a screenshot of it would be a chart that looks like any other.
 *
 * Loaded through a dynamic `import()`, never a static one — Vite inlines every asset as a base64
 * data URI in library mode (see vite.config.lib.ts's own note on why), so a static import would
 * put all of this in the main bundle for a modal most consumers never open. */

import showVolume from "./images/showVolume.jpg";
import defaultChartDisplayMode from "./images/defaultChartDisplayMode.jpg";
import renkoAtrPeriod from "./images/renkoAtrPeriod.jpg";
import drawingTools from "./images/drawingTools.jpg";
import defaultDrawings from "./images/defaultDrawings.jpg";
import showIndicators from "./images/showIndicators.jpg";
import defaultIndicators from "./images/defaultIndicators.jpg";
import showTemplates from "./images/showTemplates.jpg";
import replay from "./images/replay.jpg";
import seasonality from "./images/seasonality.jpg";
import timeframes from "./images/timeframes.jpg";
import fullscreenToggle from "./images/fullscreenToggle.jpg";
import linkable from "./images/linkable.jpg";
import livePrice from "./images/livePrice.jpg";
import events from "./images/events.jpg";
import zoomable from "./images/zoomable.jpg";
import initialVisibleCandles from "./images/initialVisibleCandles.jpg";
import sidePanel from "./images/sidePanel.jpg";
import margin from "./images/margin.jpg";

export interface PropShotImage {
  /** Already a data URI by the time it reaches a consumer — see the note above. */
  src: string;
  /** What the picture is showing, in a sentence. Rendered under the image. */
  caption: string;
}

/** Keyed by prop name, matching `CHART_PROPS_REFERENCE`'s own `name`. */
export const PROP_SHOT_IMAGES: Record<string, PropShotImage> = {
  showVolume: { src: showVolume, caption: "Le panneau de volume, ajouté sous le tracé des prix." },
  defaultChartDisplayMode: { src: defaultChartDisplayMode, caption: "Le mode Heikin Ashi à la place des bougies japonaises." },
  renkoAtrPeriod: { src: renkoAtrPeriod, caption: "Le mode Renko, dont la taille de brique suit l'ATR de la période donnée." },
  drawingTools: { src: drawingTools, caption: "La barre d'outils de dessin, ajoutée sous l'axe des dates." },
  defaultDrawings: { src: defaultDrawings, caption: "Des dessins présents dès le premier rendu — ici une oblique et une horizontale annotée." },
  showIndicators: { src: showIndicators, caption: "Le bouton « Indicateurs » et la légende qui l'accompagne, en haut du tracé." },
  defaultIndicators: { src: defaultIndicators, caption: "Des indicateurs actifs dès le premier rendu — une SMA(20) sur les prix, un RSI(14) dans son propre panneau." },
  showTemplates: { src: showTemplates, caption: "Le sélecteur de modèles, ajouté dans l'en-tête." },
  replay: { src: replay, caption: "Le bouton Replay, qui rejoue l'historique bougie par bougie." },
  seasonality: { src: seasonality, caption: "Le bouton de saisonnalité, ajouté dans l'en-tête." },
  timeframes: { src: timeframes, caption: "Le sélecteur d'unité de temps, alimenté par la liste fournie." },
  fullscreenToggle: { src: fullscreenToggle, caption: "Le bouton plein écran, ajouté à droite de l'en-tête." },
  linkable: { src: linkable, caption: "Le bouton de liaison, qui synchronise plusieurs graphiques entre eux." },
  livePrice: { src: livePrice, caption: "La ligne du dernier cours, avec son étiquette sur l'axe des prix." },
  events: { src: events, caption: "Les pastilles d'événements, au pied du tracé." },
  zoomable: { src: zoomable, caption: "Les commandes de zoom : le sélecteur d'intervalle et le bouton de réinitialisation." },
  initialVisibleCandles: { src: initialVisibleCandles, caption: "Seules les 40 dernières bougies sont visibles à l'ouverture ; le reste attend à gauche." },
  sidePanel: { src: sidePanel, caption: "Le panneau latéral, à droite du tracé, et le bouton qui le replie." },
  margin: { src: margin, caption: "Les marges du tracé, ici volontairement larges pour les rendre lisibles." },
};
