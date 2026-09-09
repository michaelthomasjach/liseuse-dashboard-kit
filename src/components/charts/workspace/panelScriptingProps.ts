import type { CandlestickChartProps } from "../CandlestickChart";
import type { ScriptDef } from "../candlestick/interfaces/ScriptDef.interface";
import type { ScriptAlertEvent } from "../candlestick/interfaces/ScriptAlertEvent.interface";
import { strategyFromIndicator } from "../candlestick/scripting/strategyFromIndicator";
import type { useScriptingState } from "../candlestick/hooks/useScriptingState";

type WorkspaceScripting = ReturnType<typeof useScriptingState>;

/** Which of a chart's props a panel gets in exchange for sharing the workspace's one script list. */
type PanelScriptingProps = Pick<
  CandlestickChartProps,
  | "scripts"
  | "onScriptsChange"
  | "onScriptAlert"
  | "onEditScript"
  | "onCreateScript"
  | "onDeleteScript"
  | "onCreateStrategyFromIndicator"
  | "onScriptRunOutput"
>;

/** Wires one panel into the workspace's shared script list and shared editor.
 *
 *  Every script belongs to exactly one panel (`ScriptDef.targetPanelIndex`) but they all live in
 *  one list, because the editor above them is one editor. That single fact is what shapes every
 *  callback here: the panel is handed *its own subset*, so anything it reports back has to be
 *  spliced into the full list rather than replacing it, and anything it creates has to be stamped
 *  with its own index at creation time or it belongs to no panel and never runs. */
export function panelScriptingProps(
  panelIndex: number,
  scripting: WorkspaceScripting,
  onScriptAlert?: (event: ScriptAlertEvent) => void,
): PanelScriptingProps {
  return {
    scripts: scripting.scripts.filter((s) => s.targetPanelIndex === panelIndex),
    // A panel-local change (toggling a script's own enabled state from this panel's "Mes scripts"
    // picker row, say) reports back as just its own subset — every other panel's scripts have to
    // survive it untouched.
    onScriptsChange: (updatedSubset: ScriptDef[]) => {
      scripting.commitScripts([...scripting.scripts.filter((s) => s.targetPanelIndex !== panelIndex), ...updatedSubset]);
    },
    onScriptAlert,
    // The pane header's own "</>" shortcut (see PaneHeaders.tsx) on a script-produced indicator —
    // jumps straight to that script's own tab in the shared editor instead of leaving the user to
    // hunt for it by name in the tab strip.
    onEditScript: (scriptId: string) => {
      scripting.setActiveScriptId(scriptId);
      scripting.setEditorOpen(true);
    },
    // "Ouvrir dans l'éditeur" on a built-in indicator's own code view (see IndicatorModals.tsx) —
    // forks that indicator's script equivalent into a real new script. `targetPanelIndex` at
    // creation time (not a follow-up updateScript, see addScript's own doc on the stale closure
    // that would be) points it at the panel the user was actually looking at, so it runs there
    // immediately instead of sitting untargeted until they pick a chart in the editor's "Cible".
    onCreateScript: (name: string, code: string) => {
      scripting.addScript(name, code, { targetPanelIndex: panelIndex });
    },
    // The picker's own trash button on a "Mes scripts" row, after its confirmation modal.
    // Deliberately the *workspace's* own removeScript, not the panel's own (which would work on
    // the list all the same, routing back up through onScriptsChange): only this one also clears
    // the shared editor's activeScriptId/runOutputs, so the deleted script leaves the tab strip
    // instead of leaving it pointed at something that no longer exists.
    onDeleteScript: scripting.removeScript,
    // Two files, not a copy: the indicator becomes a module the new strategy imports, so it stays
    // the one place its calculation lives (see strategyFromIndicator). `targetPanelIndex` for the
    // same reason onCreateScript sets it — an untargeted script is routed to no panel and never
    // runs.
    onCreateStrategyFromIndicator: (scriptId: string) => {
      const source = scripting.scripts.find((s) => s.id === scriptId);
      if (!source) return;
      const generated = strategyFromIndicator(source.name, source.code);
      scripting.addScript(generated.name, generated.code, { files: generated.files, named: true, targetPanelIndex: panelIndex });
    },
    // Bridges each panel's own local script-run output back up into the *shared* editor's
    // `runOutputs` — the editor itself has no `ScriptRunner` of its own (every script actually
    // executes inside whichever panel it's routed to, not there), so without this its error/
    // console panel and notebook cell output (see CandlestickChartProps.onScriptRunOutput's own
    // doc) never see a single real result despite the chart rendering that script's indicators
    // just fine.
    onScriptRunOutput: scripting.reportRunOutput,
  };
}
