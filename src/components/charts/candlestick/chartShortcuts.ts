/** La liste unique des raccourcis du graphique et de l'espace de travail : clavier, souris, gestes.
 *
 *  L'onglet « Raccourcis » de l'aide de l'espace de travail, la fenêtre des raccourcis d'un graphique seul et la story
 *  de la documentation lisent tous ce tableau. Un raccourci ajouté au code s'ajoute ici, dans le même commit : un
 *  raccourci que personne ne peut découvrir n'existe pas.
 *
 *  Seulement ce que le code fait réellement. Chaque entrée renvoie au fichier qui la traite, pour qu'on puisse
 *  vérifier qu'elle est toujours vraie. */

/** Une touche ou un geste. `Mod` est la touche de commande de la plateforme (Ctrl, ⌘ sur Mac), `Ctrl` la touche
 *  Contrôle elle-même (⌃ sur Mac), `Alt` l'option (⌥ sur Mac). Les gestes de souris sont dessinés en icônes. Toute
 *  autre chaîne est une touche affichée telle quelle (« C », « F3 », « / »). */
export type ShortcutToken =
  | "Mod"
  | "Ctrl"
  | "Alt"
  | "Shift"
  | "Enter"
  | "Escape"
  | "Delete"
  | "Backspace"
  | "Space"
  | "Tab"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "click"
  | "dblclick"
  | "rightclick"
  | "wheel"
  | "drag"
  | "longpress"
  | (string & {});

export type ChartShortcutGroup =
  | "Navigation et zoom"
  | "Dessins"
  | "Indicateurs et panneaux"
  | "Édition"
  | "Fenêtres et espace de travail"
  | "Éditeur de scripts";

export interface ChartShortcut {
  id: string;
  group: ChartShortcutGroup;
  /** Une ou plusieurs combinaisons équivalentes (« Ctrl + Y » ou « Ctrl + Maj + Z »), chacune une suite de touches. */
  keys: ShortcutToken[][];
  /** Ce que fait le raccourci, en une phrase. */
  description: string;
  /** Où il agit, quand ce n'est pas tout le graphique (« sur un axe », « en replay »). */
  context?: string;
}

/** Ordre d'affichage des groupes. */
export const CHART_SHORTCUT_GROUPS: ChartShortcutGroup[] = [
  "Navigation et zoom",
  "Dessins",
  "Indicateurs et panneaux",
  "Édition",
  "Fenêtres et espace de travail",
  "Éditeur de scripts",
];

export const CHART_SHORTCUTS: ChartShortcut[] = [
  // — Navigation et zoom (useD3Zoom, useZoomAndScales, useAxisWheelZoom, ChartCanvasOverlay, useReplayState) —
  { id: "wheel-zoom", group: "Navigation et zoom", keys: [["wheel"]], description: "Zoomer ou dézoomer dans le temps, autour du pointeur." },
  { id: "wheel-pan", group: "Navigation et zoom", keys: [["Shift", "wheel"]], description: "Se déplacer dans le temps (molette horizontale ou glisser à deux doigts sur un pavé tactile)." },
  { id: "drag-pan", group: "Navigation et zoom", keys: [["drag"]], description: "Faire défiler le graphique ; un glisser franchement vertical déplace aussi l'échelle des prix." },
  { id: "axis-wheel", group: "Navigation et zoom", keys: [["wheel"]], description: "Zoomer sur cet axe seulement.", context: "sur un axe" },
  { id: "axis-drag", group: "Navigation et zoom", keys: [["drag"]], description: "Étirer ou comprimer l'échelle de l'axe.", context: "sur un axe" },
  { id: "axis-dblclick", group: "Navigation et zoom", keys: [["dblclick"]], description: "Remettre l'axe en automatique (ajusté aux bougies visibles).", context: "sur un axe" },
  { id: "reset-zoom", group: "Navigation et zoom", keys: [["Space"]], description: "Réinitialiser le zoom." },
  { id: "plot-dblclick", group: "Navigation et zoom", keys: [["dblclick"]], description: "Réinitialiser le zoom.", context: "dans le vide du graphique" },
  { id: "replay-step", group: "Navigation et zoom", keys: [["ArrowLeft"], ["ArrowRight"]], description: "Reculer ou avancer d'une bougie.", context: "en replay" },
  { id: "replay-quit", group: "Navigation et zoom", keys: [["Escape"]], description: "Quitter le replay.", context: "en replay" },

  // — Dessins (useDrawingInteractions, useDrawingState, CandlestickChart) —
  { id: "measure", group: "Dessins", keys: [["Shift", "click"], ["Shift", "drag"]], description: "Mesurer : écart de prix et en %, nombre de barres, durée. Mesure temporaire, effacée au clic suivant ou par Échap.", context: "dans le vide de la zone des prix" },
  { id: "angle-lock", group: "Dessins", keys: [["Shift"]], description: "Bloquer l'angle du segment à 0°, 45° ou 90°.", context: "pendant le tracé" },
  { id: "draw-drag", group: "Dessins", keys: [["drag"]], description: "Tracer d'un seul geste : l'appui pose le premier point, le relâchement le second.", context: "outil armé" },
  { id: "draw-cancel", group: "Dessins", keys: [["Escape"]], description: "Annuler le tracé en cours, désélectionner le dessin ou effacer la mesure." },
  { id: "elbow-finish", group: "Dessins", keys: [["Enter"], ["dblclick"]], description: "Terminer la flèche coudée.", context: "flèche coudée" },
  { id: "draw-delete", group: "Dessins", keys: [["Delete"], ["Backspace"]], description: "Supprimer le dessin survolé ou sélectionné, ou la mesure." },
  { id: "draw-copy", group: "Dessins", keys: [["Mod", "C"]], description: "Copier le dessin survolé." },
  { id: "draw-paste", group: "Dessins", keys: [["Mod", "V"]], description: "Coller le dernier dessin copié, légèrement décalé." },
  { id: "draw-undo", group: "Dessins", keys: [["Mod", "Z"]], description: "Annuler la dernière modification des dessins." },
  { id: "draw-redo", group: "Dessins", keys: [["Mod", "Y"], ["Mod", "Shift", "Z"]], description: "Rétablir la modification annulée." },
  { id: "draw-move", group: "Dessins", keys: [["drag"]], description: "Déplacer un dessin, ou l'un de ses points par sa poignée.", context: "sur un dessin" },
  { id: "draw-edit", group: "Dessins", keys: [["dblclick"]], description: "Ouvrir les paramètres du dessin ; dans un tableau, modifier la cellule.", context: "sur un dessin" },
  { id: "draw-select", group: "Dessins", keys: [["click"]], description: "Sélectionner le dessin et afficher sa barre d'outils.", context: "sur un dessin" },

  // — Indicateurs et panneaux (CandlestickChart, usePaneLayout, ChartLegend, PaneHeaders, ChartStrategyPanel) —
  { id: "indicator-picker", group: "Indicateurs et panneaux", keys: [["Mod", "Space"]], description: "Ouvrir la liste des indicateurs." },
  { id: "indicator-copy", group: "Indicateurs et panneaux", keys: [["Mod", "C"], ["Mod", "V"]], description: "Copier l'indicateur survolé dans la légende, puis le coller en double." },
  { id: "indicator-settings", group: "Indicateurs et panneaux", keys: [["dblclick"]], description: "Ouvrir les paramètres de l'indicateur.", context: "sur sa courbe, sa légende ou l'en-tête de son panneau" },
  { id: "indicator-select", group: "Indicateurs et panneaux", keys: [["click"]], description: "Sélectionner l'indicateur.", context: "sur sa courbe" },
  { id: "pane-expand", group: "Indicateurs et panneaux", keys: [["dblclick"]], description: "Déplier un panneau replié.", context: "sur l'en-tête du panneau" },
  { id: "volume-settings", group: "Indicateurs et panneaux", keys: [["dblclick"]], description: "Ouvrir les paramètres du volume.", context: "sur une barre ou la légende du volume" },
  { id: "pane-pan", group: "Indicateurs et panneaux", keys: [["drag"]], description: "Déplacer l'échelle du panneau (glisser vertical).", context: "dans un panneau" },
  { id: "strategy-resize", group: "Indicateurs et panneaux", keys: [["ArrowUp"], ["ArrowDown"]], description: "Agrandir ou réduire le panneau de stratégie (avec Maj, par grands pas).", context: "poignée du panneau de stratégie" },

  // — Édition (ChartCanvasOverlay, TemplateControls, WatchlistPanel, CustomToolbar, OverlayInteractionLayer) —
  { id: "text-commit", group: "Édition", keys: [["Enter"]], description: "Valider le texte saisi sur le graphique, ou le nouveau nom." },
  { id: "text-cancel", group: "Édition", keys: [["Escape"]], description: "Abandonner la saisie en cours." },
  { id: "template-save", group: "Édition", keys: [["Mod", "S"]], description: "Enregistrer le modèle de graphique." },
  { id: "overlay-delete", group: "Édition", keys: [["Delete"], ["Backspace"]], description: "Supprimer le niveau sélectionné posé par l'hôte (ligne ou zone déplaçable)." },
  { id: "toolbar-rename", group: "Édition", keys: [["dblclick"]], description: "Renommer la barre d'outils personnalisée.", context: "sur son nom" },
  { id: "context-menu", group: "Édition", keys: [["rightclick"]], description: "Ouvrir le menu du graphique, d'un axe, d'un panneau ou d'un outil." },

  // — Fenêtres et espace de travail (useFullscreen, ChartContextMenu, ChartLegend, useWorkspaceLockHold, AiPanel) —
  { id: "close", group: "Fenêtres et espace de travail", keys: [["Escape"]], description: "Fermer la fenêtre ou le menu ouvert, quitter le plein écran." },
  { id: "menu-sub", group: "Fenêtres et espace de travail", keys: [["ArrowRight"], ["ArrowLeft"]], description: "Ouvrir ou refermer un sous-menu.", context: "menu du clic droit" },
  { id: "symbol-search", group: "Fenêtres et espace de travail", keys: [["dblclick"]], description: "Rechercher un symbole.", context: "sur le nom du symbole" },
  { id: "chart-settings", group: "Fenêtres et espace de travail", keys: [["dblclick"]], description: "Ouvrir les paramètres du graphique.", context: "sur le type de graphique (« Bougies »)" },
  { id: "day-separators", group: "Fenêtres et espace de travail", keys: [["rightclick"]], description: "Régler les séparateurs de jours.", context: "sur leur bouton du rail" },
  { id: "workspace-lock", group: "Fenêtres et espace de travail", keys: [["longpress"]], description: "Verrouiller ou déverrouiller la grille (appui maintenu 3 secondes)." },
  { id: "ai-send", group: "Fenêtres et espace de travail", keys: [["Enter"]], description: "Envoyer le message à l'assistant ; Maj + Entrée passe à la ligne.", context: "assistant" },
  { id: "ai-commands", group: "Fenêtres et espace de travail", keys: [["/"], ["ArrowUp"], ["ArrowDown"], ["Tab"]], description: "Commandes de l'assistant : « / » les liste, les flèches s'y déplacent, Tab ou Entrée en choisit une.", context: "assistant" },

  // — Éditeur de scripts (ScriptEditorPanel, ScriptEditorCodeMirror, ScriptGraphEditor, ScriptEditorWindow, ScriptFileTabs) —
  { id: "script-save", group: "Éditeur de scripts", keys: [["Mod", "S"]], description: "Enregistrer le script." },
  { id: "script-run-cell", group: "Éditeur de scripts", keys: [["Shift", "Enter"]], description: "Exécuter la cellule sous le curseur." },
  { id: "script-complete", group: "Éditeur de scripts", keys: [["Ctrl", "Space"]], description: "Proposer les complétions de l'API." },
  { id: "script-search", group: "Éditeur de scripts", keys: [["Mod", "F"]], description: "Rechercher et remplacer dans le script." },
  { id: "script-search-next", group: "Éditeur de scripts", keys: [["F3"], ["Shift", "F3"]], description: "Occurrence suivante, précédente." },
  { id: "script-next-occurrence", group: "Éditeur de scripts", keys: [["Mod", "D"]], description: "Sélectionner aussi l'occurrence suivante de la sélection." },
  { id: "script-goto-line", group: "Éditeur de scripts", keys: [["Mod", "Alt", "G"]], description: "Aller à une ligne." },
  { id: "script-comment", group: "Éditeur de scripts", keys: [["Mod", "/"]], description: "Commenter ou décommenter les lignes." },
  { id: "script-move-line", group: "Éditeur de scripts", keys: [["Alt", "ArrowUp"], ["Alt", "ArrowDown"]], description: "Monter ou descendre la ligne." },
  { id: "script-indent", group: "Éditeur de scripts", keys: [["Tab"], ["Shift", "Tab"]], description: "Indenter, désindenter." },
  { id: "script-undo", group: "Éditeur de scripts", keys: [["Mod", "Z"], ["Mod", "Y"]], description: "Annuler, rétablir dans le code." },
  { id: "script-docs-search", group: "Éditeur de scripts", keys: [["Enter"], ["Escape"]], description: "Ouvrir le premier résultat de la recherche dans la documentation, ou l'effacer.", context: "recherche de la documentation" },
  { id: "script-graph-fit", group: "Éditeur de scripts", keys: [["Space"]], description: "Tout afficher.", context: "éditeur en blocs" },
  { id: "script-graph-zoom", group: "Éditeur de scripts", keys: [["wheel"]], description: "Zoomer autour du pointeur ; glisser le fond pour se déplacer.", context: "éditeur en blocs" },
  { id: "script-graph-link", group: "Éditeur de scripts", keys: [["drag"]], description: "Relier deux blocs : du point de sortie de l'un au point d'entrée de l'autre.", context: "éditeur en blocs" },
  { id: "script-window-max", group: "Éditeur de scripts", keys: [["dblclick"]], description: "Agrandir ou rétablir la fenêtre.", context: "sur la barre de titre" },
  { id: "script-tab-rename", group: "Éditeur de scripts", keys: [["dblclick"]], description: "Renommer le fichier.", context: "sur son onglet" },
];

const MOUSE_WORDS: Record<string, string> = {
  click: "clic",
  dblclick: "double-clic",
  rightclick: "clic droit",
  wheel: "molette",
  drag: "glisser",
  longpress: "appui long",
};

/** Le nom d'une touche, en toutes lettres, pour la recherche et les lecteurs d'écran. */
export function shortcutTokenLabel(token: ShortcutToken, apple: boolean): string {
  switch (token) {
    case "Mod":
      return apple ? "⌘" : "Ctrl";
    case "Ctrl":
      return apple ? "⌃" : "Ctrl";
    case "Alt":
      return apple ? "⌥" : "Alt";
    case "Shift":
      return "Maj";
    case "Enter":
      return "Entrée";
    case "Escape":
      return "Échap";
    case "Delete":
      return "Suppr";
    case "Backspace":
      return "Retour arrière";
    case "Space":
      return "Espace";
    case "Tab":
      return "Tab";
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    default:
      return MOUSE_WORDS[token] ?? token;
  }
}

/** Les raccourcis dont la description, le contexte, le groupe ou les touches contiennent tous les mots cherchés,
 *  sans tenir compte des accents ni de la casse. */
export function filterChartShortcuts(shortcuts: ChartShortcut[], query: string, apple: boolean): ChartShortcut[] {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return shortcuts;
  return shortcuts.filter((s) => {
    const keys = s.keys.map((combo) => combo.map((t) => `${shortcutTokenLabel(t, apple)} ${t}`).join(" ")).join(" ");
    const haystack = fold(`${s.description} ${s.context ?? ""} ${s.group} ${keys}`);
    return words.every((w) => haystack.includes(w));
  });
}
