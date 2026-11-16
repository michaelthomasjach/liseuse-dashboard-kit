import { useEffect, useMemo } from "react";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import type { CommunityIndicatorEntry } from "../interfaces/CommunityIndicatorEntry.interface";
import { useScriptingState } from "./useScriptingState";
import { scriptIndicatorToChartIndicator } from "../scripting/scriptIndicatorToChartIndicator";

export interface UseChartScriptingArgs {
  /** Always externally controlled — a `CandlestickChart` never owns its own script list or shows
   *  its own editor UI (that's exclusively `ChartWorkspace`'s job, which is the only thing that
   *  ever passes this). `undefined` (a standalone chart, outside any `ChartWorkspace`) just means
   *  no scripts run for it — there is no local way to add one. */
  scripts: ScriptDef[] | undefined;
  onScriptsChange: ((scripts: ScriptDef[]) => void) | undefined;
  /** Voir `CandlestickChartProps.communityIndicators` : le code des copies de la communauté suit cette liste. */
  communityIndicators?: CommunityIndicatorEntry[];
}

/** Everything `CandlestickChart.tsx` needs to actually *run* whatever scripts `ChartWorkspace` has
 *  routed to it, reduced to one call — extracted purely to keep that file's own line count under
 *  its 1000-line cap (see its own doc), not because this logic is reused anywhere else. This chart
 *  never renders a `ScriptEditorPanel` or exposes any script-editing UI of its own (see
 *  `CandlestickChartProps.scripts`'s own doc for why) — it only ever executes (`ScriptRunnerHost`)
 *  and converts the resulting `scriptIndicators` into real chart `Indicator`s (see
 *  `scriptIndicatorToChartIndicator`'s own doc), which is the one piece every caller of this hook
 *  needs before it can even call `usePaneLayout`'s own `extraIndicators`. */
export function useChartScripting({ scripts, onScriptsChange, communityIndicators }: UseChartScriptingArgs) {
  const controlledScripts = scripts !== undefined ? { scripts, onChange: onScriptsChange ?? (() => {}) } : undefined;
  const scriptingState = useScriptingState({ defaultScripts: undefined, onScriptsChange: undefined, controlledScripts });
  const scriptChartIndicators = useMemo(
    () => scriptingState.scriptIndicators.map(scriptIndicatorToChartIndicator),
    [scriptingState.scriptIndicators]
  );
  // Indicateurs de la communauté modifiés par leur auteur : les copies du graphique reprennent leur code (une
  // signature, pas le tableau, pour ne pas relancer à chaque rendu de l'application).
  const communitySignature = useMemo(
    () => JSON.stringify((communityIndicators ?? []).filter((e) => e.script).map((e) => [e.id, e.script!.code, e.script!.files ?? null])),
    [communityIndicators]
  );
  const hasCopies = (scripts ?? []).some((s) => s.community);
  useEffect(() => {
    if (!hasCopies || communityIndicators === undefined) return;
    scriptingState.syncCommunityScripts(communityIndicators);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communitySignature, hasCopies]);
  return { scriptingState, scriptChartIndicators };
}
