import type { Indicator } from "./Indicator.interface";
import type { ScriptParamValue } from "./ScriptParam.interface";

/** Un script posé sur le graphique au moment de l'enregistrement d'un modèle, avec ses entrées. */
export interface ChartTemplateScript {
  /** `ScriptDef.id` : le script lui-même reste dans la liste des scripts, le modèle ne garde que le fait qu'il soit
   *  affiché. Un script supprimé depuis est ignoré à l'application. */
  id: string;
  /** Ses entrées (`ScriptDef.paramValues`) telles qu'elles étaient. */
  paramValues?: Record<string, ScriptParamValue>;
}

/** Everything a saved layout needs to reproduce "all the indicators/panes" (see the Save button
 *  in the chart's own header) — deliberately just the indicator/pane *configuration*, not
 *  transient view state like zoom/pan or a pane's own manual Y-axis rescale, which nobody
 *  reloading a template later would expect to jump back to. */
export interface ChartTemplateSnapshot {
  indicators: Indicator[];
  /** Where the Volume pane sits among the "own"-pane indicators — see `usePaneLayout`'s own
   *  `volumePaneOrder` doc. */
  volumePaneOrder: number;
  volumePaneState: "expanded" | "collapsed" | "hidden";
  /** Keyed by "volume" or an indicator's own id — see `usePaneLayout`'s own `paneHeightFractions`
   *  doc. */
  paneHeightFractions: Record<string, number>;
  /** Les scripts affichés sur le graphique (`ScriptDef.enabled`), avec leurs entrées. Appliquer le modèle affiche
   *  exactement ceux-là et retire les autres. Absent (modèle enregistré avant cette information) : aucun script. */
  scripts?: ChartTemplateScript[];
}

export interface ChartTemplate extends ChartTemplateSnapshot {
  id: string;
  name: string;
}

/** Ordre et hauteurs des panneaux, tels que `CandlestickChartProps.onPaneLayoutChange` les annonce. */
export interface ChartPaneLayout {
  /** Voir `ChartTemplateSnapshot.volumePaneOrder`. */
  volumePaneOrder: number;
  /** Voir `ChartTemplateSnapshot.paneHeightFractions`. */
  paneHeightFractions: Record<string, number>;
}
