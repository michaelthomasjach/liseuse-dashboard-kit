import type { ComponentType } from "react";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { diagramShot } from "./diagramShot";

/** One illustration per drawing tool, for the info modal behind each tool's own "?" in the
 *  drawing-tool menus (see ToolsRail.tsx).
 *
 *  Every one is a real screenshot of that tool drawn on a chart — the same stance as
 *  `INDICATOR_DIAGRAMS`, and it took longer to get here for a reason worth recording: a drawing
 *  tool has no shape at all until somebody draws one, so there was nothing to photograph the way
 *  an indicator can simply be switched on. The drawings are therefore seeded through
 *  `defaultDrawings` — the same public prop a host would use — which puts them through exactly the
 *  renderer a hand-drawn one goes through. See `diagramShots/diagramShotVariants.ts`.
 *
 *  "measure" is the one tool with no entry here. Being ephemeral, it cannot be seeded as data, and
 *  in a headless browser its clicks never arrive — see UNCAPTURABLE in diagramShotVariants.ts for
 *  what was tried. Its modal shows its description alone, which is honest; a drawing pretending to
 *  be a capture would not be.
 *
 *  "zoomIn" has no entry — it never reaches one of these menus, so nothing ever asks for it. */
export const DRAWING_DIAGRAMS: Partial<Record<DrawingToolType, ComponentType>> = {
  trendline: diagramShot("drawing-trendline", "Une ligne de tendance tracée entre deux points du graphique"),
  extended: diagramShot("drawing-extended", "Une ligne prolongée jusqu'aux deux bords du graphique"),
  channel: diagramShot("drawing-channel", "Un canal parallèle encadrant la tendance"),
  disjointChannel: diagramShot("drawing-disjointChannel", "Un canal disjoint dont les deux lignes convergent"),
  horizontal: diagramShot("drawing-horizontal", "Un niveau horizontal traversant tout le graphique, étiqueté"),
  ray: diagramShot("drawing-ray", "Un niveau horizontal partant d'une date vers la droite"),
  vertical: diagramShot("drawing-vertical", "Un trait vertical marquant une date, étiqueté"),
  pitchfork: diagramShot("drawing-pitchfork", "Une fourche d'Andrews tracée sur trois pivots"),
  schiffPitchfork: diagramShot("drawing-schiffPitchfork", "Une fourche de Schiff, plus plate que la fourche classique"),
  modifiedSchiffPitchfork: diagramShot("drawing-modifiedSchiffPitchfork", "Une fourche de Schiff modifiée"),
  insidePitchfork: diagramShot("drawing-insidePitchfork", "Une Inside Pitchfork, au couloir plus étroit"),
  rectangle: diagramShot("drawing-rectangle", "Un rectangle délimitant une zone du graphique"),
  zones: diagramShot("drawing-zones", "Les trois bandes positive, neutre et négative"),
  elbowArrow: diagramShot("drawing-elbowArrow", "Une flèche coudée à plusieurs segments"),
  brush: diagramShot("drawing-brush", "Un tracé à main levée sur le graphique"),
  arrowUp: diagramShot("drawing-arrowUp", "Une flèche haut marquant un point d'intérêt haussier"),
  arrowDown: diagramShot("drawing-arrowDown", "Une flèche bas marquant un point d'intérêt baissier"),
  arrowLine: diagramShot("drawing-arrowLine", "Un segment terminé par une pointe de flèche"),
  fibonacci: diagramShot("drawing-fibonacci", "Un retracement de Fibonacci et ses niveaux étiquetés"),
  fibonacciExtension: diagramShot("drawing-fibonacciExtension", "Une extension de Fibonacci projetée depuis trois points"),
  elliottImpulse: diagramShot("drawing-elliottImpulse", "Une vague impulsive d'Elliott, ses six points numérotés"),
  elliottCorrection: diagramShot("drawing-elliottCorrection", "Une vague correctrice d'Elliott, ses points 0, A, B et C"),
  headShoulders: diagramShot("drawing-headShoulders", "Une épaule-tête-épaule avec sa ligne de cou"),
  cupHandle: diagramShot("drawing-cupHandle", "Une tasse avec anse, ses cinq points de A à E"),
  forecast: diagramShot("drawing-forecast", "Une projection courbe entre deux points, annotée"),
  rangeForecast: diagramShot("drawing-rangeForecast", "Une projection en fourchette, entre un maximum et un minimum"),
  longPosition: diagramShot("drawing-longPosition", "Une position longue : entrée, objectif et stop"),
  shortPosition: diagramShot("drawing-shortPosition", "Une position courte : entrée, objectif et stop"),
  text: diagramShot("drawing-text", "Du texte libre posé sur le graphique"),
  comment: diagramShot("drawing-comment", "Un commentaire dans sa bulle, pointant un point du graphique"),
  note: diagramShot("drawing-note", "Une note reliée à son ancre par un trait"),
  priceNote: diagramShot("drawing-priceNote", "Une note de prix, dont l'étiquette commence par le prix de l'ancre"),
  pin: diagramShot("drawing-pin", "Une épingle plantée sur un point du graphique"),
  flagMark: diagramShot("drawing-flagMark", "Un drapeau planté sur un point du graphique"),
  signpost: diagramShot("drawing-signpost", "Un panneau relié par un connecteur à la bougie sous lui"),
  priceLabel: diagramShot("drawing-priceLabel", "Une étiquette affichant le prix du point désigné"),
  table: diagramShot("drawing-table", "Un tableau posé sur le graphique, ses cellules remplies"),
};
