import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";

/** Ce que le filtre du zoom du graphique doit savoir au moment d'un geste. */
export interface PlotZoomGestureState {
  /** Type de l'évènement reçu par d3-zoom (« wheel », « mousedown », « touchstart », « dblclick »…). */
  type: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  activeTool: DrawingToolType | null;
  replayArmed: boolean;
  /** Placement d'un point au doigt (écran étroit, outil armé) : le glisser déplace le repère, pas la vue. */
  placementActive: boolean;
  drawingHovered: boolean;
  measureHovered: boolean;
  shiftMeasureEnabled: boolean;
  /** Double-clic sur un indicateur : il ouvre ses paramètres, pas un zoom ×2. */
  dblClickOnTarget: boolean;
}

/**
 * Le geste peut-il zoomer ou déplacer la vue du graphique ?
 *
 * La molette zoome quel que soit l'outil armé : un outil de dessin ne prend que les clics et les glisser. Avant, le
 * zoom entier était détaché dès qu'un outil était choisi, et la molette ne faisait plus rien (« le zoom ne marche plus
 * quand un outil est sélectionné »). Les autres gestes (glisser, double-clic) restent à l'outil.
 */
export function acceptsPlotZoomGesture(s: PlotZoomGestureState): boolean {
  const wheel = s.type === "wheel";
  if (wheel && (s.activeTool !== null || s.placementActive)) return true;
  if (s.activeTool !== null) return false;
  return (
    // Molette permise pendant le replay armé (viser une bougie avant de cliquer sa coupure) ; seul le glisser est refusé.
    (!s.replayArmed || wheel) &&
    !s.placementActive &&
    !s.drawingHovered &&
    !s.measureHovered &&
    // Maj + appui : le raccourci de mesure, ni défilement ni zoom.
    !(s.shiftMeasureEnabled && !wheel && s.shiftKey) &&
    // ⌘ + appui (Mac) : le sélecteur de dessins (Ctrl + appui est déjà refusé par le filtre par défaut de d3-zoom).
    !(s.shiftMeasureEnabled && !wheel && s.metaKey) &&
    // d3-zoom avale le double-clic (zoom ×2, propagation arrêtée) : sur un indicateur, il n'atteignait jamais le
    // gestionnaire qui ouvre ses paramètres.
    !(s.type === "dblclick" && s.dblClickOnTarget)
  );
}
