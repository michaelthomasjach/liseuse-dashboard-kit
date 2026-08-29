import { useMemo } from "react";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import { useScriptingState } from "./useScriptingState";
import { scriptIndicatorToChartIndicator } from "../scripting/scriptIndicatorToChartIndicator";

export interface UseChartScriptingArgs {
  defaultScripts: ScriptDef[] | undefined;
  onScriptsChange: ((scripts: ScriptDef[]) => void) | undefined;
  /** Set only when this chart's own script list is driven from outside (`ChartWorkspace` sharing
   *  one list across panels) — see `useScriptingState`'s own `controlledScripts` doc. `undefined`
   *  for the common standalone case. */
  scripts: ScriptDef[] | undefined;
  scriptEditorOpen: boolean | undefined;
  onScriptEditorOpenChange: ((open: boolean) => void) | undefined;
}

/** Everything `CandlestickChart.tsx` needs from `useScriptingState` reduced to one call —
 *  extracted purely to keep that file's own line count under its 1000-line cap (see its own doc),
 *  not because this logic is reused anywhere else. Assembles the `controlledScripts`/
 *  `controlledEditorOpen` param objects `useScriptingState` expects from the plain
 *  `scripts`/`scriptEditorOpen`/`onScriptEditorOpenChange` props `CandlestickChart` itself
 *  receives, and converts the resulting `scriptIndicators` into real chart `Indicator`s (see
 *  `scriptIndicatorToChartIndicator`'s own doc) — the one piece every caller of this hook needs
 *  before it can even call `usePaneLayout`'s own `extraIndicators`. */
export function useChartScripting({ defaultScripts, onScriptsChange, scripts, scriptEditorOpen, onScriptEditorOpenChange }: UseChartScriptingArgs) {
  // Controlled the moment a caller passes `scripts` at all — a workspace sharing one list across
  // panels always does, a standalone chart never does, so this can't accidentally engage itself.
  const isScriptsControlled = scripts !== undefined;
  const controlledScripts = isScriptsControlled ? { scripts: scripts as ScriptDef[], onChange: onScriptsChange ?? (() => {}) } : undefined;
  const controlledEditorOpen = onScriptEditorOpenChange ? { editorOpen: scriptEditorOpen ?? false, onChange: onScriptEditorOpenChange } : undefined;
  const scriptingState = useScriptingState({ defaultScripts, onScriptsChange, controlledScripts, controlledEditorOpen });
  const scriptChartIndicators = useMemo(
    () => scriptingState.scriptIndicators.map(scriptIndicatorToChartIndicator),
    [scriptingState.scriptIndicators]
  );
  return { scriptingState, scriptChartIndicators, isScriptsControlled };
}
