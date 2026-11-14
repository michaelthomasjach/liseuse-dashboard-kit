import type { AiToolDefinition } from "./interfaces/AiMessage.interface";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { availableAiTools, runAiTool, type AiToolOutcome } from "./aiTools";
import { answerScriptingDocs, SCRIPTING_DOCS_TOOL } from "./scriptingDocs";
import { loadScriptingPrompt } from "../scripting/loadScriptingPrompt";

/**
 * Les outils de l'assistant du graphique, offerts à l'application pour un autre pilote que l'assistant intégré (un
 * serveur MCP, un raccourci, un test…) : mêmes définitions, même exécution — donc rien qu'une personne ne pourrait
 * faire avec les boutons du graphique. Voir `CandlestickChartProps.onToolBridge`.
 */
export interface ChartToolBridge {
  /** Les outils disponibles maintenant (certains dépendent de l'état du graphique : unités de temps, symbole…). */
  definitions: () => AiToolDefinition[];
  /** Exécute un outil ; ne lève jamais : une erreur revient comme résultat (`isError`). */
  run: (name: string, input: Record<string, unknown>) => Promise<AiToolOutcome>;
}

/** Le pont, lu sur la dernière version du contexte du graphique à chaque appel. */
export function createChartToolBridge(chart: () => AiChartContext): ChartToolBridge {
  return {
    definitions: () => availableAiTools(chart()).map((t) => t.definition),
    run: async (name, input) => {
      if (name === SCRIPTING_DOCS_TOOL) return answerScriptingDocs(await loadScriptingPrompt().catch(() => null), input);
      return runAiTool(name, input ?? {}, chart());
    },
  };
}
