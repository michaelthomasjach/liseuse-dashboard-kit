import type { DrawingToolType } from "./interfaces/DrawingToolType.interface";

/** Plain-language "how this works" text for each drawing tool's own info icon (see ToolsRail.tsx)
 *  — same role `INDICATOR_DESCRIPTIONS` already plays for indicators, just for the tool-picker
 *  menus instead. "zoomIn" has no entry — it never reaches a menu at all (see
 *  DRAWING_DIAGRAMS' own doc for why), so nothing here ever needs to explain it to anyone. */
export const DRAWING_TOOL_DESCRIPTIONS: Partial<Record<DrawingToolType, string>> = {
  trendline: "Relie deux points cliqués par une droite — l'outil de base pour tracer un support, une résistance ou l'axe d'une tendance.",
  extended: "Une ligne de tendance classique, prolongée indéfiniment des deux côtés au-delà de ses deux points d'ancrage.",
  channel: "Une ligne de tendance principale, doublée d'une seconde ligne parallèle décalée par un 3e clic — délimite un canal de prix.",
  disjointChannel: "Deux lignes indépendantes (4 points au total), chacune avec sa propre pente — pour un canal dont les bords ne sont pas parallèles.",
  horizontal: "Un seul niveau de prix, tracé sur toute la largeur du graphique — pour marquer un support ou une résistance horizontale.",
  ray: "Comme une ligne horizontale, mais elle ne démarre qu'à la date cliquée au lieu de couvrir tout l'historique.",
  vertical: "Une ligne verticale à une date précise — pour repérer un événement (annonce, résultats…) sur l'axe du temps.",
  pitchfork: "Fourche d'Andrews : trois lignes parallèles (médiane + deux dents) tracées à partir de 3 points A/B/C, pour visualiser un canal de tendance.",
  schiffPitchfork:
    "Variante du Pitchfork où le point de départ de la médiane est décalé vers le milieu du segment A-B, plutôt que sur A lui-même.",
  modifiedSchiffPitchfork: "Autre variante : la médiane part du milieu exact du segment A-B, entre le Pitchfork classique et le Schiff.",
  insidePitchfork: "Variante où les trois lignes partent d'un point plus récent que A, pour un canal ajusté à la structure la plus actuelle.",
  rectangle: "Un rectangle entre deux points cliqués (coins opposés) — pour délimiter une zone de prix sur une période donnée.",
  zones: "Trois bandes horizontales superposées (positive/neutre/négative) — pour marquer une zone de prix à trois niveaux de lecture.",
  elbowArrow: "Une flèche brisée à angle droit, en plusieurs clics — pour pointer un élément du graphique depuis un angle précis.",
  brush: "Un tracé libre à main levée, comme un stylo — pour annoter le graphique sans contrainte de forme.",
  arrowUp: "Une flèche pointant vers le haut, placée d'un clic — pour marquer un point d'intérêt haussier.",
  arrowDown: "Une flèche pointant vers le bas, placée d'un clic — pour marquer un point d'intérêt baissier.",
  arrowLine: "Une ligne droite entre deux points, terminée par une pointe de flèche — pour indiquer une direction ou un mouvement.",
  fibonacci: "Trace les niveaux de retracement de Fibonacci (0, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%) entre deux points cliqués.",
  fibonacciExtension: "Projette les niveaux d'extension de Fibonacci à partir de 3 points (A, B, C), pour anticiper un objectif de prix au-delà de B.",
  elliottImpulse: "Trace une vague impulsive d'Elliott en 5 segments (points 0 à 5) — la structure directionnelle de base de la théorie des vagues.",
  elliottCorrection: "Trace une vague correctrice d'Elliott en 3 segments (points 0, A, B, C) — le contre-mouvement qui suit une impulsion.",
  headShoulders: "Trace la figure Épaule-Tête-Épaule en 7 points — un sommet plus haut entouré de deux sommets plus bas, avec sa ligne de cou.",
  cupHandle: "Trace la figure Tasse avec anse en 5 points (A début de tasse, B fond, C fin de tasse/début d'anse, D fond d'anse, E fin d'anse).",
  forecast: "Une projection de prix en courbe (pas en ligne droite) entre deux points — pour esquisser un scénario de mouvement futur.",
  rangeForecast: "Un point de départ, puis un 2e clic qui fixe un objectif Max et Min symétriques — trois branches partant du même point.",
  longPosition: "Place une position longue en un clic : entrée, objectif et stop calculés automatiquement, puis ajustables à la main.",
  shortPosition: "Place une position courte en un clic : entrée, objectif et stop calculés automatiquement, puis ajustables à la main.",
  text: "Ajoute du texte libre à l'endroit cliqué sur le graphique.",
  comment: "Ajoute une bulle de commentaire (comme un post-it) à l'endroit cliqué.",
  note: "Ajoute une note reliée par une ligne à son point d'ancrage sur le graphique.",
  priceNote: "Comme une note, mais reliée en plus à un niveau de prix précis, affiché dans son propre encart.",
  pin: "Place une épingle à l'endroit cliqué — un simple repère visuel, sans texte.",
  flagMark: "Place un petit drapeau à l'endroit cliqué — un repère rapide sur un point du graphique.",
  signpost: "Place un panneau avec une étiquette, relié par une ligne pointillée à la date concernée.",
  priceLabel: "Ajoute une étiquette de prix, comme un commentaire mais avec le niveau de prix affiché en évidence.",
  table: "Place un tableau éditable (lignes/colonnes personnalisables) directement sur le graphique.",
  measure: "Clique-glisse entre deux points pour mesurer la variation en %, en points, et le nombre de bougies entre eux.",
};
