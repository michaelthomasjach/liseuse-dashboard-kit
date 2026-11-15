import type { ScriptDef } from "../../interfaces/ScriptDef.interface";

/** Disposition demandée pour des fenêtres côte à côte : une seule ligne, une seule colonne, ou la grille par défaut
 *  du nombre de fenêtres (2 × 2 pour quatre…). */
export type AiWorkspaceArrangement = "cote_a_cote" | "empilees" | "grille";

/** Une fenêtre de l'espace de travail, telle que l'assistant la voit. */
export interface AiWorkspacePanel {
  /** 0 = « Fenêtre 1 ». */
  index: number;
  symbol: string | undefined;
  timeframe: string | undefined;
}

/**
 * Ce que l'assistant peut faire de l'espace de travail (`ChartWorkspace`) qui contient le graphique au premier plan :
 * le découper en fenêtres et donner un symbole à chacune — les mêmes gestes que le menu « Disposition des fenêtres »
 * et un clic sur le nom du symbole d'une fenêtre. Posé par `ChartWorkspace` sur ce seul graphique
 * (`CandlestickChartProps.aiWorkspace`) ; les données de chaque fenêtre restent celles de l'application
 * (`onPanelSymbolChange`).
 */
export interface AiWorkspaceControls {
  /** Les fenêtres affichées maintenant, dans l'ordre. */
  panels: () => AiWorkspacePanel[];
  /** Nombre maximal de fenêtres (8). */
  maxPanels: number;
  /** Découpe l'espace en autant de fenêtres que de symboles (2 à `maxPanels`) et donne le i-ième symbole à la
   *  i-ième fenêtre ; toutes prennent l'unité de temps de la fenêtre 1. Rend le nom lisible de la disposition. */
  showSymbols: (symbols: string[], arrangement: AiWorkspaceArrangement) => { layoutLabel: string; timeframe: string | undefined };
  /** Ajoute une fenêtre (disposition par défaut du nouveau nombre) qui montre ce symbole ; rend son index, ou null
   *  quand l'espace a déjà `maxPanels` fenêtres. */
  addPanel: (symbol: string) => number | null;
  /** Capture de tout l'espace de travail (toutes les fenêtres), null s'il n'est pas affiché. */
  capture?: () => Promise<HTMLCanvasElement | null>;
  /** La liste commune des scripts (toutes les fenêtres), à jour dans le même appel d'outil. */
  scripts?: () => ScriptDef[];
  /** Exécute un script de la liste commune — y compris un script créé dans ce même appel, que la fenêtre ne connaît
   *  pas encore (sa part de la liste date du dernier rendu). */
  runScript?: (id: string) => void;
  /** Change le code et/ou le nom d'un script de la liste commune. */
  updateScript?: (id: string, patch: { code?: string; name?: string }) => void;
}
